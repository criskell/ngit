const fs = require("fs/promises");
const nodePath = require("path");

const matchPaths = async (entryPaths) => {
  if (Array.isArray(entryPaths)) {
    const paths = await Promise.all(entryPaths.map((entryPath) => matchPaths(entryPath)));

    return paths.flat(Infinity);
  }

  const path = entryPaths;

  if ((await fs.lstat(path)).isFile()) {
    return path;
  }

  const childEntries = await fs.readdir(path, { withFileTypes: true });

  return Promise.all(childEntries.map((entry) => {
    if (entry.isFile()) {
      return nodePath.join(path, entry.name);
    }

    return matchPaths(nodePath.join(path, entry.name));
  }));
};

module.exports = { matchPaths };