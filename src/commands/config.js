const fs = require("fs/promises");

const { loadRepository } = require("../repository");
const ini = require("ini");

module.exports = {
  command: "config <key> <value>",
  describe: "Configura uma chave no arquivo de configuração com um novo valor.",

  async handler(argv) {
    const repo = await loadRepository();

    const keys = argv.key.split(".");

    const configSection = keys.slice(0, -1).reduce(
      (currentSection, key) => {
        if (!(key in currentSection)) {
          currentSection[key] = {};
        }

        return currentSection[key];
      },
      repo.config
    );

    configSection[keys.at(-1)] = argv.value;

    await fs.writeFile(repo.paths.config, ini.encode(repo.config));
  }
};
