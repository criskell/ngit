const yargs = require("./yargs");

require("dotenv/config");

const runCli = (args) => {
  return yargs.parse(args);
};

module.exports = runCli;