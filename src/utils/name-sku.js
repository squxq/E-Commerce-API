function formatName(name) {
  return encodeURIComponent(
    name.trim().replace(/[\s]|[^a-zA-Z0-9-_]/g, (match) => {
      if (match === " ") {
        return "_";
      }
      return "";
    })
  );
}

function createSKU(str, option = false) {
  if (option) {
    const formattedOption = option.trim().replace(/[-\s]/g, "");
    if (formattedOption.length > 6) {
      return `${formattedOption.slice(0, 6) + formattedOption.charAt(-1)}`.toUpperCase();
    }

    return formattedOption.toUpperCase();
  }

  const words = str.trim().replace(/-/g, "").split(" ");
  const importantLetters = words.reduce((arr, word) => {
    const firstLetter = word.charAt(0);
    const capitals = word.match(/[A-Z]/g, (match) => {
      if (match !== word.charAt(0)) {
        return match;
      }
    });
    arr.push([firstLetter, capitals]);
    return arr;
  }, []);

  // one word
  if (importantLetters.length === 1) {
    // check camelCase / PascalCase
    if (importantLetters[0][1] && importantLetters[0][1]?.length > 0) {
      // means that there is camelCase / PascalCase
      const result = importantLetters[0][0].toUpperCase() + importantLetters[0][1].join("");
      return result.length > 4 ? result.slice(0, 4) : result;
    }

    if (words[0].length < 4) {
      return words[0].toUpperCase();
    }

    if (words[0].length < 6) {
      return `${words[0].slice(0, -2) + words[0].charAt(-1)}`.toUpperCase();
    }

    return `${words[0].slice(0, 4)}`.toUpperCase();
  }

  // multiple words
  return importantLetters.map((word) => word[0].toUpperCase()).join("");
}

module.exports = {
  formatName,
  createSKU,
};
