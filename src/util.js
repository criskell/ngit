const readableStreamToBuffer = async (readableStream) => {
  const buffers = [];

  for await (const buffer of readableStream) {
    buffers.push(buffer);
  }

  return Buffer.concat(buffers);
};

module.exports = {
  readableStreamToBuffer,
};