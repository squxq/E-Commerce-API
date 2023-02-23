const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { variationService } = require("../services");

/**
 * @desc Create new Variation
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.body.categoryId
 * @property { String } req.body.name
 * @returns { JSON }
 */
const createVariation = catchAsync(async (req, res) => {
  const { categoryId, name } = req.body;

  const result = await variationService.createVariation(categoryId, name);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: ["Variation created successfully"],
    output: result,
  });
});

/**
 * @desc Update existing Variation Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @property { String } req.body.variationId
 * @returns { JSON }
 */
const updateVariation = catchAsync(async (req, res) => {
  const result = await variationService.updateVariation(req.body);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: ["Variation updated successfully"],
    output: result,
  });
});

/**
 * @desc Delete a Variation Controller
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.params.variationId
 * @returns { JSON }
 */
const deleteVariation = catchAsync(async (req, res) => {
  await variationService.deleteVariation(req.params.variationId);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: ["Variation deleted successfully"],
  });
});

/**
 * @desc Create variation option(s)
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.body.variationId
 * @property { Array } req.body.values
 * @returns { JSON }
 */
const createVariationOptions = catchAsync(async (req, res) => {
  const { variationId, values } = req.body;

  const result = await variationService.createVariationOptions(variationId, values);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: ["Variation options successfully created"],
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
