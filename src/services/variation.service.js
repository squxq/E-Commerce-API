const { v4: uuidv4 } = require("uuid");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
const { prismaProducts } = require("../config/db");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");

class CreateVariation {
  constructor(categoryId) {
    this.categoryId = categoryId;
  }

  // check if the category is valid
  async checkCategory(name) {
    const checkCategoryQuery = await prismaProducts.$queryRaw`
      SELECT *
      FROM (
        SELECT array_agg(a.id) AS ids
        FROM product_category AS a
        WHERE a.id NOT IN (
          SELECT b.parent_id
          FROM product_category AS b
          WHERE b.parent_id IS NOT NULL
        )
      ) AS e
      JOIN
      (
        SELECT c.id AS category_id, array_agg(d.name) AS names
        FROM product_category AS c
        LEFT JOIN variation AS d
        ON d.category_id = c.id
        WHERE c.id = '057c963d-c91b-4447-92c1-7ddf45c16c66'
        GROUP BY c.id
      ) AS f
      ON TRUE
    `;

    if (!checkCategoryQuery[0].category_id) throw new ApiError(httpStatus.NOT_FOUND, "No category was found");

    if (!checkCategoryQuery[0].ids.includes(this.categoryId))
      throw new ApiError(httpStatus.BAD_REQUEST, "Category is not valid");

    if (checkCategoryQuery[0].names.includes(name))
      throw new ApiError(httpStatus.BAD_REQUEST, "Variation name is already in use");

    this.name = name;
  }

  // check if value(s) is/are valid
  checkValues(value, values) {
    if (!value && !values) throw new ApiError(httpStatus.BAD_REQUEST, "At least one value is required");

    if (value && !values) {
      this.values = [value];
      return;
    }
    if (!value && values.length > 0) {
      this.values = values;
      return;
    }

    if (value && values.length > 0) {
      if (!values.includes(value)) {
        values.unshift(value);
      }
      this.values = values;
      // eslint-disable-next-line no-useless-return
      return;
    }
  }

  async variationOptionsTransaction(prisma, variationId) {
    if (!this.values) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Class order not correctly followed", false);

    const date = Date.now();

    const valuesParams = this.values.map((value) => [uuidv4(), variationId, value, date]);

    const variationOptions = await prisma.$queryRaw`
      INSERT INTO "variation_option" ("id", "variation_id", "value", "updatedAt")
      VALUES ${Prisma.join(
        valuesParams.map((row) => {
          row[row.length - 1] = Prisma.sql`to_timestamp(${row[row.length - 1]} / 1000.0)`;
          return Prisma.sql`(${Prisma.join(row)})`;
        })
      )}
      RETURNING id, variation_id, value
    `;

    return variationOptions;
  }

  // check for duplicates before creation
  async checkDuplicateValues(variationId) {
    // this means that we are creating variation options on top of an existing variation
    const result = await prismaProducts.$queryRaw`
      SELECT a.id, array_agg(b.value) AS values
      FROM variation AS a
      LEFT JOIN variation_option AS b
      ON b.variation_id = a.id
      WHERE a.id = ${variationId}
      GROUP BY a.id
    `;

    if (result.length === 0) throw new ApiError(httpStatus.NOT_FOUND, "Invalid variation provided");

    this.values.forEach((value) => {
      if (result[0].values.includes(value)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Variation option already exists");
      }
    });
  }
}

/**
 * @desc Create new Variation Option
 * @param { String } categoryId
 * @param { String } name
 * @param { String } value
 * @param { Array } values
 * @returns { Object }
 */
const createVariation = catchAsync(async (categoryId, name, value, values) => {
  const createNewVariation = new CreateVariation(categoryId);
  // before creating we need to check if the category is valid which means that the category exists and is the last layer category

  // check if the categoryId is valid
  await createNewVariation.checkCategory(name);

  // check if value(s) is/are valid
  createNewVariation.checkValues(value, values);

  const createVariationTransaction = await prismaProducts.$transaction(async (prisma) => {
    // create variation
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

    const variationOptions = await createNewVariation.variationOptionsTransaction(prisma, variation.id);

    return {
      variation,
      [variationOptions.length > 1 ? "variationOptions" : "variationOption"]: variationOptions,
    };
  });

  return createVariationTransaction;
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
        const variation = await prisma.variation.update({
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
        return variation;
      }
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `You can't create a variation in a category that is not the last layer category, layer: ${lastLayerCategory[0].layer_number}`
      );
    }

    const variation = await prisma.variation.update({
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
    return variation;
  });

  if (!updateVariationTransaction) throw new ApiError(httpStatus.NO_CONTENT, "Variation was not updated, please retry");
  return updateVariationTransaction;
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
 * @param { String } value
 * @param { Array } values
 * @returns { Array }
 */
const createVariationOptions = catchAsync(async (variationId, value, values) => {
  const createNewVariationOptions = new CreateVariation(null);

  createNewVariationOptions.checkValues(value, values);
  await createNewVariationOptions.checkDuplicateValues(variationId);

  const variationOptionsTransaction = await prismaProducts.$transaction(async (prisma) => {
    // get variationId
    const variation = await prisma.variation.findUnique({
      where: {
        id: variationId,
      },
      select: { id: true },
    });

    const variationOptions = await createNewVariationOptions.variationOptionsTransaction(prisma, variation.id);

    return {
      [variationOptions.length > 1 ? "variationOptions" : "variationOption"]: variationOptions,
    };
  });

  return variationOptionsTransaction;
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
