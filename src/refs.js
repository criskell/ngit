const nodePath = require("path");
const fs = require("fs/promises");

const saveRef = async (gitDir, ref) => {
  const value = ref.symbolic ? `ref: ${ref.value}` : ref.value;

  await writeRef(gitDir, ref.name, value);
};

const resolveRef = async (gitDir, name, options) => {
  options ??= {};
  options.minDepth ??= 1;
  options.maxDepth ??= Infinity;

  const resolve = async (name, currentDepth) => {
    const raw = await readRef(gitDir, name);

    if (!raw) return { name };

    const symbolic = raw.startsWith("ref:");
    const value = symbolic ? raw.slice(5) : raw;

    const ref = {
      name,
      value,
      symbolic,
    };

    if (ref.symbolic) {
      return currentDepth < options.maxDepth
        ? resolve(ref.value, currentDepth + 1)
        : null;
    }

    return currentDepth < options.minDepth ? null : ref;
  };

  return resolve(name, 1);
};

const refPath = (gitDir, name) => {
  return nodePath.join(gitDir, name);
};

const readRef = async (gitDir, name) => {
  try {
    return (await fs.readFile(refPath(gitDir, name), "ascii")).slice(0, -1);
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }

    throw e;
  }
};

const writeRef = async (gitDir, name, value) => {
  const path = refPath(gitDir, name);
  await fs.mkdir(nodePath.dirname(path), { recursive: true });
  await fs.writeFile(path, value + "\n", "ascii");
};

const removeRef = async (gitDir, name) => {
  await fs.unlink(refPath(gitDir, name));
};

const renameRef = async (gitDir, sourceName, targetName) => {
  await fs.rename(refPath(gitDir, sourceName), refPath(targetName));
};

const list = async (gitDir, options) => {
  options ??= {};

  const refsDir = refPath(gitDir, "refs");
  const directory = nodePath.join(refsDir, options.dir || "");
  const names = (await listFiles(directory))
    .map((path) => path.replace(this.directory + "/", ""));

  return names;
};

module.exports = {
  resolveRef,
  saveRef,
};