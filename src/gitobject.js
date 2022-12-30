const fs = require("fs/promises");
const nodePath = require("path");

const { unwrapObject, parseObject } = require("./object/parser");
const { serializeObject, wrapObject } = require("./object/serializer");
const { sha1 } = require("./hash");
const { compress, decompress } = require("./compression");
const { exists } = require("./filesystem");

const writeAsLooseObject = async (gitDirectory, hash, wrapped) => {
  const parent = nodePath.join(gitDirectory, "objects", hash.slice(0, 2));
  const path = nodePath.join(parent, hash.slice(2));

  if (await exists(path)) return;

  await fs.mkdir(parent, { recursive: true });

  const compressed = await compress(wrapped);

  await fs.writeFile(path, compressed);
};

const readAsLooseObject = async (gitDirectory, hash) => {
  const parent = nodePath.join(gitDirectory, "objects", hash.slice(0, 2));
  const path = nodePath.join(parent, hash.slice(2));

  const compressed = await fs.readFile(path);

  return compressed;
};

const getWrapped = (compressed) => {
  return decompress(compressed);
};

const readWrapped = async (gitDirectory, hash) => {
  const wrapped = await getWrapped(await readAsLooseObject(gitDirectory, hash));

  return wrapped;
};

const hashObject = async (gitDirectory, object) => {
  const rawObject = Buffer.isBuffer(object.data)
    ? object
    : serializeObject(object);

  const wrapped = wrapObject(rawObject);

  const hash = sha1(wrapped);

  if (object.write) {
    await writeAsLooseObject(gitDirectory, hash, wrapped);
  }

  return hash;
};

const saveBlobFromFile = async (gitDirectory, path) => {
  const data = await fs.readFile(path);

  return hashObject(gitDirectory, {
    type: "blob",
    write: true,
    data,
  });
};

const readObject = async (gitDirectory, objectId) => {
  const rawObject = await readRawObject(gitDirectory, objectId);

  if (!rawObject) return null;

  const object = parseObject(rawObject);

  return object;
};

const readRawObject = async (gitDirectory, objectId) => {
  const wrapped = await readWrapped(gitDirectory, objectId);

  return unwrapObject(wrapped);
};

module.exports = {
  hashObject,
  saveBlobFromFile,
  readRawObject,
  readObject,
  readWrapped,
  readAsLooseObject,
  getWrapped,
};