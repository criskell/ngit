const parseMessage = (raw) => {
  const lines = raw.split(/\n(?! )/);

  const headers = new Map();

  let currentLine;

  while ((currentLine = lines.shift()) !== "") {
    const spaceIndex = currentLine.indexOf(" ");
    const key = currentLine.slice(0, spaceIndex);
    const value = currentLine.slice(spaceIndex + 1).replaceAll("\n ", "\n");

    headers.set(key, value);
  }

  const body = lines.join("\n");

  return {
    headers,
    body,
  };
};

const serializeMessage = (message) => {
  return (
    Array.from(message.headers)
      .map(([key, value]) => {
        const serializedValue = value.replaceAll("\n", "\n ");

        return `${key} ${serializedValue}`;
      })
      .join("\n") +
    "\n\n" +
    message.body + "\n"
  );
};

module.exports = { parseMessage, serializeMessage };