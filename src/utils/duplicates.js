const httpStatus = require("http-status");
const catchAsync = require("./catchAsync");
const ApiError = require("./ApiError");
const prisma = require("../config/db");

// Check for duplicate names - category
const duplicateNames = catchAsync(async (proposedName, id) => {
  let result;
  if (!id) {
    result = await prisma.$queryRaw`
        SELECT array_agg(category_name) AS names FROM product_category WHERE parent_category_id IS NULL
        `;
  } else {
    result = await prisma.$queryRaw`
        SELECT array_agg(category_name) AS names FROM product_category WHERE parent_category_id = ${id}
        `;
  }
  result = result[0].names;

  if (result) {
    result.forEach((name) => {
      if (name === proposedName) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Duplicate category name provided, please choose a different name");
      }
    });
  }
});

module.exports = {
  duplicateNames,
};
