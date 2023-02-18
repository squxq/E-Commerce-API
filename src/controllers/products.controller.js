const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { productsService } = require("../services");
// const ApiError = require("../utils/ApiError");

/**
 * @desc Create New Collection Controller
 * @param {Object} req
 * @param {Object} res
 * @property {Object} req.body
 * @returns { JSON }
 */
const createCategory = catchAsync(async (req, res) => {
  const { categoryName, parentCategoryId = null } = req.body;

  const result = await productsService.createCategory(categoryName, parentCategoryId);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: req.polyglot.t("successfulCategoryCreate"),
    output: result,
  });
});

module.exports = {
  createCategory,
};
