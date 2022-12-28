const fs = require("fs/promises");
const ini = require("ini");

const { loadRepository } = require("../repository");

module.exports = {
  command: "remote add [name] [url]",
  describe: "Adiciona um remoto",

  async handler(argv) {
    const repo = await loadRepository();

    repo.config[`remote "${argv.name}"`] = {
      url: argv.url,
      fetch: "+refs/heads/*:refs/remotes/origin/*"
    };

    await fs.writeFile(repo.paths.config, ini.encode(repo.config));
  }
};
