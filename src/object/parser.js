const { parseMessage } = require("./message");

const objectTypes = ["commit", "tree", "blob"];

const isObjectType = (test) => objectTypes.includes(test);

const unwrapObject = (wrapped) => {
  const spaceIndex = wrapped.indexOf(0x20);
  const type = wrapped.toString("ascii", 0, spaceIndex);

  if (!isObjectType(type)) return null;

  const nullIndex = wrapped.indexOf(0x00);
  const size = parseInt(wrapped.toString("ascii", spaceIndex + 1, nullIndex));

  if (!Number.isFinite(size)) return null;

  const data = wrapped.subarray(nullIndex + 1, nullIndex + size + 1);

  return {
    type,
    data,
  };
};

const parseObject = (raw) => {
  if (raw.type === "commit") return parseCommit(raw.data);
  if (raw.type === "tree") return parseTree(raw.data);
  if (raw.type === "blob") return parseBlob(raw.data);
};

const parseCommit = (data) => {
  const { headers, body } = parseMessage(data.toString());

  if (
    !(headers.has("tree") && headers.has("author") && headers.has("committer"))
  )
    return null;

  return {
    type: "commit",
    data: {
      message: body,
      treeId: headers.get("tree"),
      author: headers.get("author"),
      parentIds: headers.has("parent") ? headers.get("parent").split(" ") : [],
      committer: headers.get("committer"),
      gpgSignature: headers.get("gpgsig"),
    },
  };
};

const parseTree = (data) => {
  const entries = [];

  let cursor = 0;

  /**
   * mode<space>path<nul><object-id>
   */
  while (cursor < data.length) {
    const spaceIndex = data.indexOf(" ", cursor);

    if (spaceIndex === -1) break;

    const modeString = data.subarray(cursor, spaceIndex).toString();
    const mode = parseInt(modeString, 8);
    const nullIndex = data.indexOf("\0", spaceIndex);

    if (nullIndex === -1) break;

    const path = data.subarray(spaceIndex + 1, nullIndex).toString("ascii");

    cursor = nullIndex + 1 + 20;

    const objectId = data.subarray(nullIndex + 1, cursor).toString("hex");

    const entry = {
      mode,
      path,
      objectId,
      modeString,
    };

    entries.push(entry);
  }

  return {
    type: "tree",
    data: entries,
  };
};

const parseBlob = (data) => {
  return {
    type: "blob",
    data,
  };
};

module.exports = {
  unwrapObject,
  parseObject,
  parseTree,
  parseCommit,
  parseBlob,
};