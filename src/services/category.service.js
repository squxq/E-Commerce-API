const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const hash = require("object-hash");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const prisma = require("../config/db");
const parser = require("../utils/parser");
const { uploadImage } = require("../utils/cloudinary");
const { duplicateNames } = require("../utils/duplicates");

/**
 * @desc Create New Category
 * @param { String } categoryName
 * @param { String } parentCategoryId
 * @param { Object } file
 * @returns { Object<id|parent_category_id|category_name|category_image|category_description> }
 */
const createCategory = catchAsync(async (categoryName, parentCategoryId, file) => {
  // check if field is empty
  if (!categoryName) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category name not provided");
  } else if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category image not provided");
  }
  // check for duplicate names
  await duplicateNames(categoryName, parentCategoryId);
  // uuid for projects db
  const categoryId = uuidv4().toString();

  // file buffer from data uri string
  let image = parser(file);

  // folder name
  const formattedName = categoryName
    .trim()
    .split(" ")
    .map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");

  // folder name
  const folderName = `Category/${formattedName}`;

  // upload image
  image = await uploadImage(image.content, folderName);

  // create category in product_category
  const result =
    await prisma.$queryRaw`INSERT INTO product_category(id, parent_category_id, category_name, category_image) VALUES(${categoryId}, ${parentCategoryId}, ${categoryName}, ${image.secure_url}) RETURNING *
      `;

  return result[0];
});

/**
 * @desc Update category
 * @param { Object } data
 * @param { Object } image
 * @returns { Object }
 */
const updateCategory = catchAsync(async (data, image) => {
  // check for data to update category
  const { categoryId, parentCategoryId = null } = data;
  delete data.categoryId;
  if (!image && Object.keys(data).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data to update category");
  }

  // check for duplicate names if data.categoryName exists
  if (data.categoryName) {
    await duplicateNames(data.categoryName, parentCategoryId);
  }

  const category = await prisma.product_category.findUnique({
    where: {
      id: categoryId,
    },
  });

  if (Object.keys(category).length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  /* eslint no-param-reassign: ["error", { "props": false }] */
  Object.keys(data).forEach((property) => {
    data[`${property.replace(/\.?([A-Z])/g, (x, y) => `_${y.toLowerCase()}`)}`] = data[property];
    delete data[property];
  });

  let bufferImage = parser(image);
  if (
    image &&
    category.category_image.substring(category.category_image.length - 37, category.category_image.length - 5) !==
      hash(bufferImage.content, { algorithm: "md5" })
  ) {
    // folder name
    const formattedName = category.category_name
      .trim()
      .split(" ")
      .map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join("");

    // folder name
    const folderName = `Category/${formattedName}`;

    // upload image
    bufferImage = await uploadImage(image.content, folderName);

    data.category_image = bufferImage.secure_url;
  }
  const result = await prisma.product_category.update({
    where: {
      id: category.id,
    },
    data,
  });

  return result;
});

module.exports = {
  createCategory,
  updateCategory,
};
