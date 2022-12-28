const fs = require("fs/promises");
const nodePath = require("path");
const ini = require("ini");
const os = require("os");

const { maybeStat, exists } = require("./filesystem");
const { parseIndex } = require("./staging");

const loadRepository = async (currentDirectory) => {
  const defaultIndex = {
    version: 2,
    entries: new Map(),
  };

  currentDirectory ||= process.cwd();

  const gitDirectory = await findGitDirectory(currentDirectory);

  const config = ini.decode(await fs.readFile(nodePath.join(gitDirectory, "config"), "ascii"));

  const rootDirectory = config.bare ? gitDirectory : nodePath.dirname(gitDirectory);

  const paths = {
    git: gitDirectory,
    root: rootDirectory,
    gitignore: nodePath.join(rootDirectory, ".gitignore"),
    index: nodePath.join(gitDirectory, "index"),
    config: nodePath.join(gitDirectory, "config"),
    refs: nodePath.join(gitDirectory, "refs"),
  };

  const ignoreList = (await exists(paths.gitignore))
    ? (await fs.readFile(paths.gitignore, "ascii")).split(os.EOL)
    : [];

  const index = await exists(paths.index)
    ? await parseIndex(await fs.readFile(paths.index))
    : defaultIndex;

  const repository = {
    paths,
    config,
    ignoreList,
    index,
  };

  return repository;

  async function findGitDirectory(currentDirectory) {
    let path = currentDirectory;

    while (true) {
      const gitPath = nodePath.join(path, ".git");
      const gitStat = await maybeStat(gitPath);

      if (gitStat && gitStat.isDirectory()) {
        path = gitPath;

        break;
      }

      const configStat = await maybeStat(nodePath.join(path, "config"));

      if (configStat) break;

      const parent = nodePath.dirname(path);

      if (parent === path) return null;

      path = parent;
    }

    return path;
  }
};

module.exports = { loadRepository };