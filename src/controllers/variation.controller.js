const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { variationService } = require("../services");

/**
 * @desc Create new Variation
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.body.categoryId
 * @property { String } req.body.name
 * @property { String } req.body.value
 * @property { Array } req.body.values
 * @returns { JSON }
 */
const createVariation = catchAsync(async (req, res) => {
  const { categoryId, name, value = null, values = null } = req.body;

  const result = await variationService.createVariation(categoryId, name, value, values);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: "Variation created successfully",
    output: result,
  });
});

/**
 * @desc Update existing Variation Controller
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.body.variationId
 * @property { String } req.body.name
 * @property { String } req.body.categoryId
 * @returns { JSON }
 */
const updateVariation = catchAsync(async (req, res) => {
  const result = await variationService.updateVariation(req.body);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: "Variation updated successfully",
    output: result,
  });
});

/**
 * @desc Delete a Variation Controller
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.params.variationId
 * @property { Object } req.query
 * @returns { JSON }
 */
const deleteVariation = catchAsync(async (req, res) => {
  const result = await variationService.deleteVariation(req.params.variationId, req.query);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: "Variation deleted successfully",
    output: result,
  });
});

/**
 * @desc Create variation option(s)
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.body.variationId
 * @property { String } req.body.value
 * @property { Array } req.body.values
 * @returns { JSON }
 */
const createVariationOptions = catchAsync(async (req, res) => {
  const { variationId, value = null, values = null } = req.body;

  const result = await variationService.createVariationOptions(variationId, value, values);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: "Variation option(s) successfully created",
    output: result,
  });
});

/**
 * @desc Update variation option(s)
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @returns { JSON }
 */
const updateVariationOption = catchAsync(async (req, res) => {
  const result = await variationService.updateVariationOption(req.body);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: ["Variation option successfully updated"],
    output: result,
  });
});

/**
 * @desc Delete variation option(s)
 * @param { Object } req
 * @param { Object } res
 * @property { Array } req.body.ids
 * @returns { JSON }
 */
const deleteVariationOptions = catchAsync(async (req, res) => {
  await variationService.deleteVariationOptions(req.body.ids);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: ["Variation option(s) successfully deleted"],
  });
});

module.exports = {
  createVariation,
  updateVariation,
  deleteVariation,
  createVariationOptions,
  updateVariationOption,
  deleteVariationOptions,
};
