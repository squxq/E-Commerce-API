const httpStatus = require("http-status");
const { prismaProducts } = require("../config/db");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");

/**
 * @desc Create new Variation Option
 * @param { String } categoryId
 * @param { String } name
 * @returns { Object<id|category_id|name> }
 */
const createVariation = catchAsync(async (categoryId, name) => {
  const variation = await prismaProducts.variation.create({
    data: {
      category_id: categoryId,
      name,
    },
    select: {
      id: true,
      category_id: true,
      name: true,
    },
  });

  if (!variation) throw new ApiError(httpStatus.NO_CONTENT, "Variation not created, please try again");
  return variation;
});

/**
 * @desc Update existing Variation
 * @param { String } variationId
 * @param { Object } data
 * @returns { Object }
 */
const updateVariation = catchAsync(async (data) => {
  const { variationId } = data;
  /* eslint no-param-reassign: "error" */
  delete data.variationId;
  if (Object.keys(data).length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "No data provided to update variation");

  Object.entries(data).forEach(([key, value]) => {
    const newKey = key.replace(/\.?([A-Z])/g, (x, y) => `_${y.toLowerCase()}`);
    if (newKey !== key) {
      data[newKey] = value;
      delete data[key];
    }
  });

  const variation = await prismaProducts.variation.update({
    where: {
      id: variationId,
    },
    data,
    select: {
      id: true,
      category_id: true,
      name: true,
    },
  });

  if (!variation) throw new ApiError(httpStatus.NO_CONTENT, "Variation was not updated, please retry");
  return variation;
});

/**
 * @desc Delete a variation
 * @param { String } variationId
 */
const deleteVariation = catchAsync(async (variationId) => {
  await prismaProducts.variation.delete({
    where: {
      id: variationId,
    },
  });
});

/**
 * @desc Create variation option(s)
 * @param { String } variationId
 * @param { Array } values
 * @returns { Array }
 */
const createVariationOptions = catchAsync(async (variationId, values) => {
  const result = await prismaProducts.$transaction(
    values.map((value) =>
      prismaProducts.variation_option.create({
        data: {
          variation_id: variationId,
          value,
        },
        select: {
          id: true,
          value: true,
        },
      })
    )
  );
  // Check for any irregularity
  if (!result || result.length === 0) throw new ApiError(httpStatus.NO_CONTENT, "The variation options were not created");
  return result;
});

/**
 * @desc Update variation option
 * @param { Object } data
 * @returns { Object<id|variation_id|value> }
 */
const updateVariationOption = catchAsync(async (data) => {
  const { optionId } = data;
  /* eslint no-param-reassign: "error" */
  delete data.optionId;
  if (Object.keys(data).length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "No data provided to update variation");

  Object.entries(data).forEach(([key, value]) => {
    const newKey = key.replace(/\.?([A-Z])/g, (x, y) => `_${y.toLowerCase()}`);
    if (newKey !== key) {
      data[newKey] = value;
      delete data[key];
    }
  });

  const option = await prismaProducts.variation_option.update({
    where: {
      id: optionId,
    },
    data,
    select: {
      id: true,
      variation_id: true,
      value: true,
    },
  });

  if (!option) throw new ApiError(httpStatus.NO_CONTENT, "Variation was not updated, please retry");
  return option;
});

/**
 * @desc Delete variation option(s)
 * @param { Array } ids
 */
const deleteVariationOptions = catchAsync(async (ids) => {
  await prismaProducts.$transaction(
    ids.map((id) =>
      prismaProducts.variation_option.delete({
        where: { id },
      })
    )
  );
});

module.exports = {
  createVariation,
  updateVariation,
  deleteVariation,
  createVariationOptions,
  updateVariationOption,
  deleteVariationOptions,
};
