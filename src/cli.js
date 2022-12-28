const yargs = require("./yargs");

const runCli = (args) => {
  return yargs.parse(args);
};

module.exports = runCli;