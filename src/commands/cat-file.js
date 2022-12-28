const fs = require("fs/promises");

const { loadRepository } = require("../repository");
const { readableStreamToBuffer } = require("../util");
const { readRawObject } = require("../gitobject");

module.exports = {
  command: "cat-file <objectId>",
  describe: "Obtém o conteúdo do objeto passado.",

  builder(yargs) {
    yargs.positional("objectId", {
      describe: "ID do objeto.",
      type: "string",
    });
  },

  async handler(argv) {
    const repo = await loadRepository();

    const { type, data } = await readRawObject(repo.paths.git, argv.objectId);

    process.stdout.write(data);
  }
};