const nodePath = require("path");
const fs = require("fs/promises");
const ini = require("ini");

const { exists } = require("../filesystem");
const { matchPaths } = require("../path");
const { isIgnoredByList } = require("../gitignore");
const { loadRepository } = require("../repository");
const { saveBlobFromFile } = require("../gitobject");
const { makeEntryFromStats, addToIndex, saveIndex } = require("../staging");

module.exports = {
  command: "add <paths..>",
  describe: "Adiciona arquivos ao índice.",

  builder(yargs) {
    yargs.positional("paths", {
      describe: "Lista de caminhos para os arquivos.",
      type: "array",
    });
  },

  async handler(argv) {
    const repo = await loadRepository();

    const matchedPaths = await matchPaths(argv.paths);
    const workingTreePaths = matchedPaths.map((path) => nodePath.relative(repo.paths.root, path));
    const pathsToAdd = await workingTreePaths.filter((path) => !isIgnoredByList(repo.ignoreList, path));

    await Promise.all(pathsToAdd.map(async (path) => {
      const fullPath = nodePath.join(repo.paths.root, path);

      const blobId = await saveBlobFromFile(
        repo.paths.git,
        fullPath
      );

      const stats = await fs.lstat(fullPath, {
        bigint: true,
      });

      const indexEntry = makeEntryFromStats(stats, path, blobId);

      addToIndex(repo.index, indexEntry);

      console.log(`Arquivo adicionado: ${path} (id: ${blobId})`);
    }));

    await saveIndex(repo.index, repo.paths.index);
  }
};