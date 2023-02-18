const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const pool = require("../pool");
const { v4: uuidv4 } = require("uuid");

/**
 * @desc Create Cew Collection
 * @param { String } categoryName
 * @param { String } parentCategoryId
 */
const createCategory = catchAsync(async (categoryName, parentCategoryId) => {
  // check if field is empty
  if (!categoryName) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Category name not provided");
  }

  const categoryId = uuidv4().toString();

  // create category in product_category
  const result = pool.query(
    "INSERT INTO product_category(id, parent_category_id, category_name) VALUES($1, $2, $3) RETURNING *",
    [categoryId, parentCategoryId, categoryName]
  );

  return result;
});

module.exports = {
  createCategory,
};
