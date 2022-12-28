const yargs = require("yargs/yargs")();

yargs
  .scriptName("ngit")
  .command(require("./commands/init"))
  .command(require("./commands/add"))
  .command(require("./commands/hash-object"))
  .command(require("./commands/cat-file"))
  .command(require("./commands/commit"))
  .command(require("./commands/ls-tree"))
  .command(require("./commands/config"))
  .command(require("./commands/add-remote"))
  .demandCommand(1)
  .help();

module.exports = yargs;