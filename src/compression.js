const util = require("util");
const zlib = require("zlib");

const compressAsync = util.promisify(zlib.deflate);

const compress = (data) => compressAsync(data, { level: 1 });
const decompress = util.promisify(zlib.inflate);

module.exports = { compress, decompress };

// teste