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
  // before creating we need to check if the category is valid which means that the category exists
  // and is the last layer category

  const createVariationTransaction = await prismaProducts.$transaction(async (prisma) => {
    const lastLayerCategory = await prisma.$queryRaw`
      WITH RECURSIVE layer AS (
        SELECT id,
          name,
          parent_id,
          1 AS layer_number
        FROM product_category
        WHERE parent_id IS NULL

      UNION ALL

        SELECT child.id,
          child.name,
          child.parent_id,
          layer_number+1 AS layer_number
        FROM product_category child
        JOIN layer l
          ON l.id = child.parent_id
      )
      SELECT array_agg(id) AS ids,
        layer_number
      FROM layer
      WHERE layer_number = (SELECT MAX(layer_number) FROM layer)
      GROUP BY layer_number
    `;
    // lastLayerCategory.ids where we need to search
    if (lastLayerCategory[0].ids.find((id) => id === categoryId)) {
      const variation = await prisma.variation.create({
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

      return [variation];
    }
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `You can't create a variation in a category that is not the last layer category, layer: ${lastLayerCategory[0].layer_number}`
    );
  });
  if (!createVariationTransaction[0]) throw new ApiError(httpStatus.NO_CONTENT, "Variation not created, please try again");
  return createVariationTransaction[0];
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

  const updateVariationTransaction = await prismaProducts.$transaction(async (prisma) => {
    if (data.category_id) {
      const lastLayerCategory = await prisma.$queryRaw`
          WITH RECURSIVE layer AS (
            SELECT id,
              name,
              parent_id,
              1 AS layer_number
            FROM product_category
            WHERE parent_id IS NULL

          UNION ALL

            SELECT child.id,
              child.name,
              child.parent_id,
              layer_number+1 AS layer_number
            FROM product_category child
            JOIN layer l
              ON l.id = child.parent_id
          )
          SELECT array_agg(id) AS ids,
            layer_number
          FROM layer
          WHERE layer_number = (SELECT MAX(layer_number) FROM layer)
          GROUP BY layer_number
    `;
      if (lastLayerCategory[0].ids.find((id) => id === data.category_id)) {
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
        return [variation];
      }
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `You can't create a variation in a category that is not the last layer category, layer: ${lastLayerCategory[0].layer_number}`
      );
    }
  });

  if (!updateVariationTransaction[0]) throw new ApiError(httpStatus.NO_CONTENT, "Variation was not updated, please retry");
  return updateVariationTransaction[0];
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
