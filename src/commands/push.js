const nodePath = require("path");
const fs = require("fs/promises");
const ini = require("ini");
const axios = require("axios");
const readline = require("readline");
const stream = require("stream");

const { exists } = require("../filesystem");
const { matchPaths } = require("../path");
const { isIgnoredByList } = require("../gitignore");
const { loadRepository } = require("../repository");
const { getWrapped, readAsLooseObject } = require("../gitobject");
const { unwrapObject, parseObject } = require("../object/parser");
const { getSortedIndexEntries } = require("../staging");
const { resolveRef, saveRef } = require("../refs");
const { sha1 } = require("../hash");
const { compress } = require("../compression");

module.exports = {
  command: "push <remote> <branch>",
  describe: "Envia uma ramificação para um remoto.",

  async handler(argv) {
    const repo = await loadRepository();

    const remoteUrl = repo.config[`remote "${argv.remote}"`].url;
    const remoteBranchName = argv.branch;

    const auth = {};

    console.log("Digite suas credenciais para o repositório localizado em: " + remoteUrl);

    const username = process.env.GIT_USERNAME || await prompt("Digite o e-mail/usuário: ");
    const password = process.env.GIT_PASSWORD || await prompt("Digite a senha: ", true);

    auth.username = username;
    auth.password = password;

    const remoteBranchHash = await getRemoteBranchHash(remoteUrl, remoteBranchName, auth);
    const localBranchHash = (await resolveRef(repo.paths.git, `refs/heads/${remoteBranchName}`)).value;

    const remoteBranchHashRef = remoteBranchHash ? remoteBranchHash : "0".repeat(40);

    const objects = await findObjectsToPack(repo, remoteBranchHash, localBranchHash);

    const pack = await createPack(objects);

    const receivePackRequest = Buffer.concat([
      pktLines([
        `${remoteBranchHashRef} ${localBranchHash} refs/heads/${remoteBranchName}\0 report-status\n`
      ]),
      pack,
    ]);

    const response = await axios.post(`${remoteUrl}/git-receive-pack`, receivePackRequest, {
      headers: {
        "content-type": "application/x-git-receive-pack-request"
      },
      responseType: "arraybuffer",
      auth,
    });

    const packetLines = parsePktLines(response.data, true);
  }
};

const prompt = (message, hiddenInput = false) => {
  return new Promise((resolve) => {
    let hidden = false;

    const stdout = !hiddenInput
      ? process.stdout
      : new stream.Writable({
        write: (data, encoding, cb) => {
          if (!hidden) {
            process.stdout.write(data, encoding);
          }
          cb();
        }
      });

    const interface = readline.createInterface({
      input: process.stdin,
      output: stdout,
      terminal: true,
    });

    interface.question(message, (data) => {
      resolve(data);
      interface.close();
    });

    hidden = hiddenInput;
  });
};

const serializePackObject = (object) => {
  const headerBytes = [];

  let size = object.size;

  const typeNumber = {
    commit: 1,
    tree: 2,
    blob: 3,
  }[object.type];

  const fourBits = size & 0b1111;

  size >>= 4;

  const firstByte = (size ? 0x80 : 0) | (typeNumber << 4) | fourBits;

  headerBytes.push(firstByte);

  while (size) {
    const lastSevenBits = size & 0b1111111;
    size >>= 7;
    headerBytes.push((size ? 0x80 : 0) | lastSevenBits);
  }

  const header = Buffer.from(headerBytes);

  return Buffer.concat([header, object.data]);
};

const createPack = (objects) => {
  const packWithHeader = Buffer.alloc(12);
  packWithHeader.write("PACK", "ascii");
  packWithHeader.writeUInt32BE(2, 4); // versao
  packWithHeader.writeUInt32BE(objects.size, 8);

  const packWithContent = Array.from(objects.values())
    .reduce(
      (content, object) =>
        Buffer.concat([
          content,
          serializePackObject(object)
        ]),
      packWithHeader
    );

  const packWithChecksum = Buffer.concat([
    packWithContent,
    Buffer.from(sha1(packWithContent), "hex"),
  ]);

  return packWithChecksum;
};

const findObjectsToPack = async (repo, currentCommit, newCommit) => {
  const objects = new Map();

  const loadTreeEntry = async (entry) => {
    if (objects.has(entry.objectId)) return;

    const loose = await readAsLooseObject(repo.paths.git, entry.objectId);
    const wrapped = await getWrapped(loose);
    const raw = unwrapObject(wrapped);
    const parsedObject = parseObject(raw);

    if (parsedObject.type === "blob") {
      objects.set(entry.objectId, {
        type: "blob",
        data: await compress(raw.data),
        size: raw.data.length,
      });
      return;
    }

    return loadTree(entry.objectId);
  };

  const loadTree = async (treeId) => {
    if (objects.has(treeId)) return;

    const loose = await readAsLooseObject(repo.paths.git, treeId);
    const wrapped = await getWrapped(loose);
    const raw = unwrapObject(wrapped);
    const parsedObject = parseObject(raw);

    objects.set(treeId, {
      type: "tree",
      data: await compress(raw.data),
      size: raw.data.length,
    });

    for (const entry of parsedObject.data) {
      await loadTreeEntry(entry);
    }
  };

  const loadCommit = async (commitId) => {
    if (objects.has(commitId)) return;

    const loose = await readAsLooseObject(repo.paths.git, commitId);
    const wrapped = await getWrapped(loose);
    const raw = unwrapObject(wrapped);
    const parsedObject = parseObject(raw);

    objects.set(commitId, {
      type: "commit",
      data: await compress(raw.data),
      size: raw.data.length,
    });

    await loadTree(parsedObject.data.treeId);

    if (commitId !== currentCommit) {
      for (const parentId of parsedObject.data.parentIds) {
        await loadCommit(parentId);
      }
    }
  };

  await loadCommit(newCommit);

  return objects;
};

const pktLines = (lines) => {
  return Buffer.concat([
    Buffer.concat(lines.map(serializePktLine)),
    Buffer.from("0000"),
  ]);
};

const serializePktLine = (data) => {
  data = Buffer.isBuffer(data) ? data : Buffer.from(data, "ascii");

  return Buffer.concat([
    Buffer.from((data.length + 4).toString(16).padStart(4, "0"), "ascii"),
    data,
  ]);
};

const parsePktLines = (buffer, decode = false) => {
  const payloads = [];

  let cursor = 0;

  while (cursor + 4 <= buffer.length) {
    let pktLineLength = parseInt(buffer.subarray(cursor, cursor + 4).toString(), 16);

    if (pktLineLength === 0) pktLineLength = 4;

    const payload = buffer.subarray(cursor + 4, cursor + pktLineLength);

    payloads.push(decode ? payload.toString("ascii") : payload);

    cursor += pktLineLength;
  }

  return payloads;
};

const getRemoteBranchHash = async (remoteUrl, branchName, auth) => {
  const response = await axios.get(`${remoteUrl}/info/refs?service=git-receive-pack`, {
    responseType: "arraybuffer",
    auth,
  });

  const pktLines = parsePktLines(response.data, true);

  if (pktLines[2].startsWith("0".repeat(40))) return null;

  const ref = pktLines.slice(2).filter(x => x).map((line) => {
    const split = line.split(" ");
    const ref = split[1].replace(/\0.*$/, '');
    const hash = split[0];

    return {
      ref,
      hash,
    };
  }).find((line) => {
    return line.ref === `refs/heads/${branchName}`;
  });

  return ref.hash;
};