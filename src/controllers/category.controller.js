const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { categoryService } = require("../services");
// const ApiError = require("../utils/ApiError");

/**
 * @desc Create New Category Controller
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.body.name
 * @property { String } req.body.parentId
 * @property { String } req.body.description
 * @property { Object } req.file
 * @returns { JSON }
 */
const createCategory = catchAsync(async (req, res) => {
  const { name, parentId = null, description = null } = req.body;

  const result = await categoryService.createCategory(name, parentId, description, req.file, req.query);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: req.polyglot.t("successCategoryCreate"),
    output: result,
  });
});

/**
 * @desc Update Category Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body.categoryId
 * @property { Object } req.file
 * @returns { JSON }
 */
const updateCategory = catchAsync(async (req, res) => {
  const result = await categoryService.updateCategory(req.body, req.file, req.query);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: "Category updated successfully",
    output: result,
  });
});

/**
 * @ Delete Category Controller
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.params.categoryId
 * @property { Object } req.query
 */
const deleteCategory = catchAsync(async (req, res) => {
  const result = await categoryService.deleteCategory(req.params.categoryId, req.query);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: "Category deleted successfully",
    output: result,
  });
});

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
};
