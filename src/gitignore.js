const nodePath = require("path");

const isIgnoredByCondition = (condition, workingFilePath) => {
  return workingFilePath.startsWith(condition);
};

const isIgnoredByList = (conditions, workingFilePath) => {
  return conditions.some((condition) => isIgnoredByCondition(condition, workingFilePath))
    || isIgnoredByCondition(".git/", workingFilePath);
};

module.exports = { isIgnoredByList };