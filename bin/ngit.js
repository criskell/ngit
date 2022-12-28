#!/usr/bin/env node
const { hideBin } = require("yargs/helpers");
const { runCli } = require("../src");

runCli(hideBin(process.argv));