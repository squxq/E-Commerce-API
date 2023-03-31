const { updateName } = require("./cloudinary");

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
    const formattedOption = str.trim().replace(/[-\s]/g, "");
    if (formattedOption.length > 6) {
      return `${formattedOption.slice(0, 6) + formattedOption.charAt(-1)}`.toUpperCase();
    }

    return formattedOption.toUpperCase();
  }

  const words = str.trim().replace(/-/g, "").split(" ");
  const importantLetters = words.reduce((arr, word) => {
    const firstLetter = word.charAt(0);
    const capitals = word.slice(1).match(/[A-Z]/g);
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

async function updateImage(image, formattedName, mode) {
  const imageArr = image.split("/");

  if (mode === "category") {
    imageArr[imageArr.length - 2] =
      formattedName + imageArr[imageArr.length - 2].substring(imageArr[imageArr.length - 2].indexOf("-"));
  } else if (mode === "product") {
    imageArr[imageArr.length - 2] =
      imageArr[imageArr.length - 2].substring(0, imageArr[imageArr.length - 2].indexOf("-") + 1) + formattedName;
  }

  const newName = imageArr.join("/");

  // rename images in cloudinary
  try {
    await updateName(image, newName);
    return newName;
  } catch (err) {
    return image;
  }
}

async function updateImages(imagesArr, formattedName, mode) {
  // imagesArr = [{id: '', images: ['']}]
  const imagesPromises = imagesArr.map(async ({ id, images }) => {
    if (Array.isArray(images)) {
      const publicIds = images.map(async (image) => {
        return updateImage(image, formattedName, mode);
      });

      const results = await Promise.all(publicIds);

      return [id, results];
    }

    const newName = await updateImage(images, formattedName, mode);

    return [id, newName];
  });

  return Promise.all(imagesPromises);
}

module.exports = {
  formatName,
  createSKU,
  updateImages,
};
