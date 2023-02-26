const httpStatus = require("http-status");
const catchAsync = require("./catchAsync");
const ApiError = require("./ApiError");
const { prismaProducts } = require("../config/db");

// Check for duplicate names - category
const duplicateNames = catchAsync(async (proposedName, id) => {
  let result;
  if (!id) {
    result = await prismaProducts.$queryRaw`
        SELECT array_agg(name) AS names FROM product_category WHERE parent_id IS NULL
        `;
  } else {
    result = await prismaProducts.$queryRaw`
        SELECT array_agg(name) AS names FROM product_category WHERE parent_id = ${id}
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
