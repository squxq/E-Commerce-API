const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { categoryService } = require("../services");
// const ApiError = require("../utils/ApiError");

/**
 * @desc Create New Category Controller
 * @param {Object} req
 * @param {Object} res
 * @property { String } req.body.categoryName
 * @property { String } req.body.parentCategoryId
 * @property {Object } req.file
 * @returns { JSON }
 */
const createCategory = catchAsync(async (req, res) => {
  const { categoryName, parentCategoryId = null } = req.body;

  const result = await categoryService.createCategory(categoryName, parentCategoryId, req.file);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: req.polyglot.t("successfulCategoryCreate"),
    output: result,
  });
});

module.exports = {
  createCategory,
};
