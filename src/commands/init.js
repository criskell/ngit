const nodePath = require("path");
const fs = require("fs/promises");
const { exists } = require("../filesystem");
const ini = require("ini");

module.exports = {
  command: "init",
  describe: "Inicializa um repositório no diretório atual.",

  builder(args) {
    return args.option("bare", {
      describe: "Indica se o repositório é do tipo bare.",
      type: "boolean",
      default: false,
    });
  },

  async handler(argv) {
    const pathToGit = nodePath.join.bind(null, process.cwd(), argv.bare ? "" : ".git");

    if (await exists(pathToGit())) {
      console.error("Já existe um repositório no diretório atual.");
      process.exit(1);
    }

    await fs.mkdir(pathToGit());
    await fs.mkdir(pathToGit("objects"));
    await fs.mkdir(pathToGit("refs"));
    await fs.mkdir(pathToGit("refs", "heads"));
    await fs.mkdir(pathToGit("refs", "tags"));
    await fs.writeFile(pathToGit("HEAD"), "ref: refs/heads/main\n", "ascii");
    await fs.writeFile(pathToGit("config"), ini.encode({
      core: {
        repositoryformatversion: 0,
        filemode: true,
        bare: argv.bare,
      },
    }), "ascii");
    await fs.writeFile(pathToGit("description"), "", "ascii");

    console.info(`Repositório inicializado em: ${pathToGit()}`);
  }
};