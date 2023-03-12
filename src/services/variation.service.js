const { v4: uuidv4 } = require("uuid");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
const { prismaProducts } = require("../config/db");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");

class Variation {
  constructor(categoryId, name) {
    this.categoryId = categoryId;
    this.name = name;
  }

  // check if the category is valid
  async checkCategory() {
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
        WHERE c.id = ${this.categoryId}
        GROUP BY c.id
      ) AS f
      ON TRUE
    `;

    if (!checkCategoryQuery[0].category_id) throw new ApiError(httpStatus.NOT_FOUND, "No category was found");

    if (!checkCategoryQuery[0].ids.includes(this.categoryId))
      throw new ApiError(httpStatus.BAD_REQUEST, "Category is not valid");

    if (checkCategoryQuery[0].names.includes(this.name))
      throw new ApiError(httpStatus.BAD_REQUEST, "Variation name is already in use");
  }

  // check if value(s) is/are valid
  checkValues(value, values) {
    if (!value && !values) throw new ApiError(httpStatus.BAD_REQUEST, "At least one value is required");

    const newValues = new Set();

    if (value && !values) {
      newValues.add(value);
    } else if (!value && values.length > 0) {
      values.forEach(newValues.add, newValues);
    } else if (value && values.length > 0) {
      if (!values.includes(value)) {
        values.unshift(value);
      }
      values.forEach(newValues.add, newValues);
    }

    this.values = Array.from(newValues).sort();
  }

  async variationOptionsTransaction(prisma, variationId) {
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

  // validate variation and name
  async validateVariation(variationId, variationName = null) {
    const variation = await prismaProducts.$queryRaw`
      SELECT id, category_id, name
      FROM variation
      WHERE id = ${variationId}
    `;

    if (variation.length === 0) throw new ApiError(httpStatus.NOT_FOUND, "Variation not found");

    this.categoryId = variation[0].category_id;

    if (variationName && variationName !== variation[0].name) {
      this.name = variationName;
      await this.checkCategory();
    } else {
      this.name = variation[0].name;
    }

    this.variationId = variation[0].id;

    return {
      variationName: this.name,
    };
  }

  // check for existing resources - variation_options
  async checkResources() {
    const resources = await prismaProducts.$queryRaw`
      WITH variation_option_ids AS (
        SELECT a.id
        FROM variation_option AS a
        WHERE a.variation_id = ${this.variationId}
      )

      SELECT array_agg(c.product_item_id) AS resources_ids
      FROM product_configuration AS c
      WHERE c.variation_option_id IN (SELECT id FROM variation_option_ids)

      UNION ALL

      SELECT array_agg(d.id)
      FROM variation_option_ids AS d
    `;

    return resources;
  }

  async deleteVariation(variationOptionIds) {
    const deleteVariationTransaction = await prismaProducts.$transaction(async (prisma) => {
      const deletedVariationOptions = await prisma.$queryRaw`
        DELETE FROM variation_option
        WHERE id IN (${Prisma.join(variationOptionIds)})
        RETURNING id, variation_id, value
      `;

      const deletedVariation = await prisma.variation.delete({
        where: { id: this.variationId },
        select: {
          id: true,
          category_id: true,
          name: true,
        },
      });

      return {
        variation: deletedVariation,
        variationOptions: deletedVariationOptions,
      };
    });

    return deleteVariationTransaction;
  }

  async deleteProducts(variationOptionIds, save = null) {
    const toDeleteProducts = [];

    let productItemIds = await prismaProducts.$queryRaw`
      SELECT product_item_id AS id
      FROM product_configuration
      WHERE product_item_id IN (
        SELECT c.product_item_id
        FROM product_configuration AS c
        WHERE c.variation_option_id IN (${Prisma.join(variationOptionIds)})
      )
    `;

    productItemIds = productItemIds.map((productItem) => productItem.id);

    for (let index = 0; index < productItemIds.length; index += 1) {
      if (productItemIds.indexOf(productItemIds[index], productItemIds.indexOf(productItemIds[index]) + 1) === -1) {
        toDeleteProducts.push(productItemIds[index]);
      }
    }

    // all the products in toDeleteProducts have only one variation - the one that is going to be deleted
    // no products to delete
    if (toDeleteProducts.length === 0) {
      // first delete all the product_configurations that are attatched to variation_options that are going to be deleted
      const deleteProductConfigurations = await prismaProducts.$queryRaw`
        DELETE FROM product_configuration
        WHERE product_item_id IN (${Prisma.join(productItemIds)})
          AND variation_option_id IN (${Prisma.join(variationOptionIds)})
        RETURNING id, product_item_id, variation_option_id
      `;

      return {
        productConfigurations: deleteProductConfigurations,
        ...this.deleteVariation(variationOptionIds),
      };
    }

    // some products to delete - is save true or false
    if (!save) {
      // delete product configurations and product items in productItemIds if product_item is the only in product delete that as well
      const deleteProductTree = await prismaProducts.$transaction(async (prisma) => {
        const productConfigurations = await prisma.$queryRaw`
          DELETE FROM product_configuration
          WHERE product_item_id IN (${Prisma.join(toDeleteProducts)})
          RETURNING id, product_item_id, variation_option_id
        `;

        // missing delete product_item images from cloudinary
        const productItems = await prisma.$queryRaw`
          DELETE FROM product_item
          WHERE id IN (${Prisma.join(toDeleteProducts)})
          RETURNING id, product_id, "SKU", "QIS", images, price
        `;

        const deleteProducts = await prisma.$queryRaw`
          DELETE FROM product AS a
          WHERE NOT EXISTS (
            SELECT FROM product_item AS b
            WHERE b.product_id = a.id
          )
          RETURNING id, category_id, name, description, image
        `;

        return {
          productConfigurations,
          productItems,
          products: deleteProducts,
        };
      });

      const variationTransaction = await this.deleteVariation(variationOptionIds);

      return {
        ...variationTransaction,
        ...deleteProductTree,
      };
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Products cant be saved, Change: save=false or add another variation option to the following products: ${productItemIds}`
    );
  }

  // delete validation
  async deleteValidation(variationId, save) {
    // validate variation
    await this.validateVariation(variationId);

    // check for products connected to this variation
    const resources = await this.checkResources();

    if (!resources[0].resources_ids) {
      // return delete variation and variation_options
      return this.deleteVariation(resources[1].resources_ids);
    }

    // delete products if the only variation is the one to be deleted
    // check for other variations besides the one to be deleted
    return this.deleteProducts(resources[1].resources_ids, save);
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
  const createNewVariation = new Variation(categoryId, name);
  // before creating we need to check if the category is valid which means that the category exists and is not parent of any existing category

  // check if the categoryId is valid
  await createNewVariation.checkCategory();

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
 * @param { Object } data
 * @returns { Object }
 */
const updateVariation = catchAsync(async (data) => {
  const updateNewVariation = new Variation();

  const { variationId } = data;
  delete data.variationId;

  // validate data to update
  if (Object.keys(data).length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "No data provided");

  // validate variationId and name if is provided
  const { variationName: name } = await updateNewVariation.validateVariation(variationId, data.name);

  data.name = name;

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

  return variation;
});

/**
 * @desc Delete a variation
 * @param { String } variationId
 * @returns { Object}
 */
const deleteVariation = catchAsync(async (variationId, query) => {
  const deleteNewVariation = new Variation();

  return deleteNewVariation.deleteValidation(variationId, query.save);
});

/**
 * @desc Create variation option(s)
 * @param { String } variationId
 * @param { String } value
 * @param { Array } values
 * @returns { Array }
 */
const createVariationOptions = catchAsync(async (variationId, value, values) => {
  const createNewVariationOptions = new Variation(null);

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
