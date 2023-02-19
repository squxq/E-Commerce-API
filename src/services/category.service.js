const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const pool = require("../pool");
const parser = require("../utils/parser");
const { uploadImage } = require("../utils/cloudinary");

/**
 * @desc Create New Category
 * @param { String } categoryName
 * @param { String } parentCategoryId
 * @param { Object } file
 */
const createCategory = catchAsync(async (categoryName, parentCategoryId, file) => {
  // check if field is empty
  if (!categoryName) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category name not provided");
  } else if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category image not provided");
  }
  // check for duplicate names
  let result;
  if (!parentCategoryId) {
    result = await pool.query(
      "SELECT array_agg(category_name) AS names FROM product_category WHERE parent_category_id IS NULL"
    );
  } else {
    result = await pool.query(
      "SELECT array_agg(category_name) AS names FROM product_category WHERE parent_category_id = ($1)",
      [parentCategoryId]
    );
  }

  result.rows[0].names.forEach((name) => {
    if (name === categoryName) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Duplicate category name provided");
    }
  });

  // uuid for projects db
  const categoryId = uuidv4().toString();

  // file buffer from data uri string
  let image = parser(file);

  // upload image
  image = await uploadImage(image.content, "category", categoryName);

  // create category in product_category
  const dbOuput = pool.query(
    "INSERT INTO product_category(id, parent_category_id, category_name, category_image) VALUES($1, $2, $3, $4) RETURNING id",
    [categoryId, parentCategoryId, categoryName, image.secure_url]
  );

  return dbOuput;
});

module.exports = {
  createCategory,
};
