const fs = require("fs/promises");

const { loadRepository } = require("../repository");
const { readableStreamToBuffer } = require("../util");
const { hashObject } = require("../gitobject");

module.exports = {
  command: "hash-object [arquivo]",
  describe: "Obtém o ID para os dados de um objeto passado.",

  builder(yargs) {
    yargs.option("type", {
      describe: "Tipo do objeto.",
      type: "string",
      default: "blob",
    });

    yargs.option("write", {
      describe: "Indica se o objeto deve ser escrito no banco de dados",
      type: "boolean",
      default: false,
    });

    yargs.positional("arquivo", {
      alias: "file",
      describe: "Arquivo com o conteúdo do objeto. Caso não fornecido, irá ler da entrada padrão.",
      type: "string",
    });
  },

  async handler(argv) {
    const repo = await loadRepository();

    const stream = argv.file ? fs.createReadStream(argv.file) : process.stdin;

    const data = await readableStreamToBuffer(stream);

    const objectId = await hashObject(repo.paths.git, {
      type: argv.type,
      data,
      write: argv.write,
    });

    console.log(objectId);
  }
};
