const nodePath = require("path");
const fs = require("fs/promises");

const { sha1 } = require("./hash");

const convertStatsTimestamp = (millisecondsBigInt, nanosecondsBigInt) => {
  const seconds = Math.floor(
    Number(BigInt.asUintN(32, millisecondsBigInt || 0n)) / 1000
  );
  const nanoseconds = Number(BigInt.asUintN(32, nanosecondsBigInt || 0n));

  return [seconds, nanoseconds];
};

const makeEntryFromStats = (stats, path, objectId) => {
  let mode = Number(stats.mode);
  let permissions = mode & 0o777;

  if (! (permissions === 0o755 || permissions === 0o644)) {
    mode = (mode & 0o170000) + 0o644;
  }

  const entry = {
    objectId,
    file: {
      mode: mode,
      path: path.replaceAll(nodePath.sep, "/"),
      size: Number(stats.size),
      inodeNumber: Number(stats.ino),
      device: Number(stats.dev),
    },
    timestamps: {
      metadataChanged: convertStatsTimestamp(stats.ctimeMs, stats.ctimeNs),
      dataChanged: convertStatsTimestamp(stats.mtimeMs, stats.mtimeNs),
    },
    flags: {
      assumeValid: false,
      extendedFlag: false,
    },
    stage: 0,
    groupId: Number(stats.gid),
    userId: Number(stats.uid),
  };

  return entry;
};

const parseHeader = (raw) => {
  const signature = raw.subarray(0, 4);
  const version = raw.readUInt32BE(4);
  const numberOfEntries = raw.readUInt32BE(8);

  return {
    signature,
    version,
    numberOfEntries,
  };
};

const parseFlags = (rawFlags) => {
  return {
    assumeValid: Boolean(rawFlags >>> 15),
    extendedFlag: Boolean((rawFlags >>> 14) & 1),
    stage: (rawFlags >>> 12) & 0b0011,
    pathLength: rawFlags & 0b0000000111111111,
  };
};

const parseEntries = (data, startAt, numberOfEntries) => {
  const entries = new Map();

  let cursor = startAt;

  while (entries.size < numberOfEntries) {
    const ctimeInSeconds = data.readUInt32BE(cursor);
    const ctimeInNanoseconds = data.readUInt32BE(cursor + 4);
    const mtimeInSeconds = data.readUInt32BE(cursor + 8);
    const mtimeInNanoseconds = data.readUInt32BE(cursor + 12);
    const dev = data.readUInt32BE(cursor + 16);
    const ino = data.readUInt32BE(cursor + 20);
    const mode = data.readUInt32BE(cursor + 24);
    const uid = data.readUInt32BE(cursor + 28);
    const gid = data.readUInt32BE(cursor + 32);
    const size = data.readUInt32BE(cursor + 36);
    const objectId = data.subarray(cursor + 40, cursor + 60).toString("hex");
    const rawFlags = data.readUInt16BE(cursor + 60);
    const flags = parseFlags(rawFlags);
    const path = data
      .subarray(cursor + 62, cursor + 62 + flags.pathLength)
      .toString();

    entries.set(path, {
      objectId,

      file: {
        mode,
        path,
        size,
        inodeNumber: ino,
        device: dev,
      },

      timestamps: {
        metadataChanged: [ctimeInSeconds, ctimeInNanoseconds],
        dataChanged: [mtimeInSeconds, mtimeInNanoseconds],
      },

      flags: {
        assumeValid: flags.assumeValid,
        extendedFlag: flags.extendedFlag,
      },

      stage: flags.stage,

      userId: uid,
      groupId: gid,
    });

    const entryLength = 62 + flags.pathLength;
    const paddingLength = 8 - (entryLength % 8);
    const totalLength = entryLength + paddingLength;

    cursor += totalLength;
  }

  return { entries, cursor };
};

const parseIndex = (rawIndex) => {
  const header = parseHeader(rawIndex);
  const { entries, cursor } = parseEntries(rawIndex, 12, header.numberOfEntries);
  const checksum = rawIndex.subarray(-20);

  return {
    version: header.version,
    header,
    entries,
    checksum,
  };
};

const serializeHeader = (version, numberOfEntries) => {
  const header = Buffer.alloc(12);

  header.write("DIRC");
  header.writeUInt32BE(version, 4);
  header.writeUInt32BE(numberOfEntries, 8);

  return header;
};

const serializeFlags = (flags) => {
  return (
    ((1 << 15) & (Number(flags.assumeValid) << 15)) |
    (Number(flags.extendedFlag) << 14) |
    (flags.stage << 12) |
    flags.pathLength
  );
};

const serializeEntry = (entry) => {
  const entryLength = 62 + entry.file.path.length;
  const paddingLength = 8 - (entryLength % 8);
  const totalLength = entryLength + paddingLength;

  const buf = Buffer.alloc(totalLength);

  const flags = serializeFlags({
    assumeValid: entry.flags.assumeValid,
    extendedFlag: entry.flags.extendedFlag,
    pathLength: entry.file.path.length,
    stage: entry.stage,
  });

  buf.writeUInt32BE(entry.timestamps.metadataChanged[0], 0);
  buf.writeUInt32BE(entry.timestamps.metadataChanged[1], 4);
  buf.writeUInt32BE(entry.timestamps.dataChanged[0], 8);
  buf.writeUInt32BE(entry.timestamps.dataChanged[1], 12);
  buf.writeUInt32BE(entry.file.device, 16);
  buf.writeUInt32BE(entry.file.inodeNumber % 2 ** 32, 20);
  buf.writeUInt32BE(entry.file.mode, 24);
  buf.writeUInt32BE(entry.userId, 28);
  buf.writeUInt32BE(entry.groupId, 32);
  buf.writeUInt32BE(entry.file.size, 36);
  buf.write(entry.objectId, 40, 20, "hex");
  buf.writeUInt16BE(flags, 60);
  buf.write(entry.file.path, 62);

  return buf;
};

const serializeIndex = (index) => {
  const entries = getSortedIndexEntries(index);
  const header = serializeHeader(index.version, entries.length);
  const rawEntries = Buffer.concat(entries.map(serializeEntry));

  const content = Buffer.concat(
    index.rawExtensions
      ? [header, rawEntries, index.rawExtensions]
      : [header, rawEntries]
  );
  const checksum = Buffer.from(sha1(content), "hex");

  return Buffer.concat([content, checksum]);
};

const addToIndex = (index, entry) => {
  index.entries.set(entry.file.path, entry);
};

const hasInIndex = (index, path) => {
  return index.entries.has(path);
};

const saveIndex = async (index, file) => {
  const serializedIndex = serializeIndex(index);

  await fs.writeFile(file, serializedIndex);
};

const getSortedIndexEntries = (index) => {
  return Array.from(index.entries.values()).sort(
    (a, b) =>
      Number(a.file.path > b.file.path) - Number(a.file.path < b.file.path)
  );
};

module.exports = { parseIndex, serializeIndex, addToIndex, hasInIndex, saveIndex, getSortedIndexEntries, makeEntryFromStats };