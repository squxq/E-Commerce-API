const DatauriParser = require("datauri/parser");

const bufferParser = new DatauriParser();

// datauri helper
const parser = (file) => bufferParser.format("webp", file.buffer);

module.exports = parser;
