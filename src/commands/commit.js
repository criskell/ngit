const nodePath = require("path");
const fs = require("fs/promises");
const ini = require("ini");

const { exists } = require("../filesystem");
const { matchPaths } = require("../path");
const { isIgnoredByList } = require("../gitignore");
const { loadRepository } = require("../repository");
const { hashObject } = require("../gitobject");
const { getSortedIndexEntries } = require("../staging");
const { resolveRef, saveRef } = require("../refs");

module.exports = {
  command: "commit",
  describe: "Cria um commit a partir da staging area.",

  builder(yargs) {
    yargs.option("message", {
      alias: "m",
      type: "string",
      describe: "Mensagem do commit.",
    });
  },

  async handler(argv) {
    const repo = await loadRepository();

    const message = argv.message;

    const name = repo.config.user.name;
    const email = repo.config.user.email;
    const author = formatUser(name, email, new Date());
    const committer = author;

    const indexEntries = getSortedIndexEntries(repo.index);

    const snapshot = snapshotFromEntries(indexEntries);
    const snapshotRoot = snapshot.get(".");
    const treeId = await createTreeObject(repo.paths.git, snapshotRoot);

    const currentHead = await resolveRef(repo.paths.git, "HEAD");
    const headCommitId = currentHead?.value;
    const parentIds = headCommitId ? [headCommitId] : [];

    const commitObject = {
      type: "commit",
      data: {
        message,
        treeId,
        parentIds,
        author,
        committer,
      },
      write: true,
    };

    const commitId = await hashObject(repo.paths.git, commitObject);

    currentHead.value = commitId;

    await saveRef(repo.paths.git, currentHead);

    console.log(`Commit criado. ID: ${commitId}`);
  }
};

const formatUser = (name, email, date) => {
  const timestamp = Math.round(date.getTime() / 1000);
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const formattedOffset = `${offset >= 0 ? "+" : "-"}${addZero(offsetHours)}${addZero(offsetMinutes)}`;

  return `${name} <${email}> ${timestamp} ${formattedOffset}`;
};

const addZero = (number) => number >= 10 ? +number : '0' + number;

const snapshotFromEntries = (indexEntries) => {
  const snapshot = new Map();

  const makeRecursivelyDir = (path) => {
    const found = snapshot.get(path);

    if (found && found.type === "directory") return found;

    const entry = {
      type: "directory",
      children: [],
      path,
      mode: 0o040000,
    };

    snapshot.set(path, entry);

    if (path === ".") {
      return entry;
    }    

    makeRecursivelyDir(nodePath.dirname(path)).children.push(entry);

    return entry;
  };

  for (const indexEntry of indexEntries) {
    const snapshotEntry = {
      path: indexEntry.file.path,
      mode: indexEntry.file.mode,
      type: "file",
      objectId: indexEntry.objectId,
    };

    snapshot.set(indexEntry.file.path, snapshotEntry);

    const parent = makeRecursivelyDir(nodePath.dirname(indexEntry.file.path));

    parent.children.push(
      snapshotEntry
    );
  }

  return snapshot;
};

const createTreeObject = async (gitDirectory, snapshotEntry) => {
  const treeEntries = await Promise.all(
    snapshotEntry.children.map(async (snapshotEntry) => {
      const objectId =
        snapshotEntry.type === "file"
          ? snapshotEntry.objectId
          : await createTreeObject(gitDirectory, snapshotEntry);

      return {
        mode: snapshotEntry.mode,
        path: nodePath.basename(snapshotEntry.path),
        objectId,
      };
    })
  );

  return (
    await hashObject(gitDirectory, {
      type: "tree",
      data: treeEntries,
      write: true,
    })
  );
};
