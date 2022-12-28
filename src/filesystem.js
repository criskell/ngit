const fs = require("fs/promises");

const maybeStat = async (path) =>
  (await fs.stat(path).catch((error) => null));

const exists = async (path) =>
  !!(await fs.stat(path).catch((error) => false));

const isDirectory = async (path) => (await fs.lstat(gitDirectory)).isDirectory();

const isFile = async (path) => (await fs.lstat(gitDirectory)).isDirectory();

module.exports = { exists, maybeStat };