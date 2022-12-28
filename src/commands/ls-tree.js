const fs = require("fs/promises");

const { loadRepository } = require("../repository");
const { readObject } = require("../gitobject");

module.exports = {
  command: "ls-tree [treeId]",
  describe: "Lista as entradas de uma árvore.",

  builder(yargs) {
    yargs.positional("treeId", {
      describe: "ID da árvore",
      type: "string",
    });
  },

  async handler(argv) {
    const repo = await loadRepository();

    const treeObject = await readObject(repo.paths.git, argv.treeId);

    console.log(treeObject);
  }
};
