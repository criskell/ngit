const { serializeMessage } = require("./message");

const wrapObject = ({ type, data }) => {
  const size = data.length;
  const header = Buffer.from(`${type} ${size}\0`, "ascii");

  return Buffer.concat([header, data]);
};

const serializeObject = (object) => {
  if (object.type === "commit")
    return {
      type: "commit",
      data: serializeCommit(object),
    };

  if (object.type === "tree")
    return {
      type: "tree",
      data: serializeTree(object),
    };

  if (object.type === "blob")
    return {
      type: "blob",
      data: serializeBlob(object),
    };
};

const serializeCommit = (commit) => {
  const headers = new Map();

  headers.set("tree", commit.data.treeId);

  if (commit.data.parentIds.length) {
    headers.set("parent", commit.data.parentIds.join(" "));
  }

  headers.set("author", commit.data.author);
  headers.set("committer", commit.data.committer);

  if (commit.data.gpgSignature) {
    headers.set("gpgsig", commit.data.gpgSignature);
  }

  const message = {
    headers,
    body: commit.data.message,
  };

  return Buffer.from(serializeMessage(message));
};

const serializeTreeEntry = (entry) => {
  return Buffer.concat([
    Buffer.from(entry.mode.toString(8).replace(/^0/, "") + " " + entry.path + "\0"),
    Buffer.from(entry.objectId, "hex"),
  ]);
};

const serializeTree = (tree) => {
  tree.data = tree.data.sort(
    (a, b) =>
      Number(a.path > b.path) - Number(a.path < b.path)
  );

  return Buffer.concat(tree.data.map((entry) => serializeTreeEntry(entry)));
};

const serializeBlob = (blob) => {
  return blob.data;
};

module.exports = {
  wrapObject,
  serializeObject,
  serializeCommit,
  serializeTree,
  serializeBlob,
  serializeTreeEntry,
};