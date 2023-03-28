function formatName(name) {
  return encodeURIComponent(
    name
      .trim()
      .toLowerCase()
      .split(" ")
      .join("_")
      .replace(/[^a-zA-Z0-9-_]/g, "")
  );
}

function createSKU(str) {
  if (str.trim().indexOf(" ") === -1) {
    return str.trim().replace(/-/g, "").substring(0, 2).toUpperCase();
  }
  return str
    .trim()
    .replace(/-/g, "_")
    .split(" ")
    .map((word) => {
      return word.charAt(0).toUpperCase();
    })
    .join("");
}

module.exports = {
  formatName,
  createSKU,
};
