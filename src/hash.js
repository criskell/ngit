const crypto = require("crypto");

const sha1 = (wrapped) => {
  const hash = crypto.createHash("sha1");
  hash.update(wrapped);
  return hash.digest("hex");
};

module.exports = { sha1 };