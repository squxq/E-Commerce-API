function formatName(name) {
  return encodeURIComponent(
    name
      .trim()
      .toLowerCase()
      .replace(/[\s]|[^a-zA-Z0-9-_]/g, (match) => {
        if (match === " ") {
          return "_";
        }
        return "";
      })
  );
}

function createSKU(str) {
  const words = str.trim().replace(/-/g, "").split(" ");
  const importantLetters = words.reduce((arr, word) => {
    const firstLetter = word.charAt(0);
    const capitals = word.match(/[A-Z]/g);
    arr.push([firstLetter, capitals]);
    return arr;
  }, []);

  // one word
  if (importantLetters.length === 1) {
    // check camelCase / PascalCase
    // if (importantLetters[0])
  }

  // if (str.indexOf(" ") === -1) {
  //   if (str.length < 3) {
  //     return str.toUpperCase();
  //   } else if (str.length === 3) {
  //     return str.
  //   }
  //   return str.substring(0, 2).toUpperCase();
  // }
  // return str
  //   .replace(/-/g, "_")
  //   .split(" ")
  //   .map((word) => {
  //     return word.charAt(0).toUpperCase();
  //   })
  //   .join("");
}

module.exports = {
  formatName,
  createSKU,
};
