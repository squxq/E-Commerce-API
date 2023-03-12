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
  async checkCategory(id = null, name = null, save = null) {
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
        WHERE c.id = ${id || this.categoryId}
        GROUP BY c.id
      ) AS f
      ON TRUE
    `;

    if (!checkCategoryQuery[0].category_id) throw new ApiError(httpStatus.NOT_FOUND, "No category was found");

    if (!checkCategoryQuery[0].ids.includes(id || this.categoryId))
      throw new ApiError(httpStatus.BAD_REQUEST, "Category is not valid");

    if (checkCategoryQuery[0].names.includes(name || this.name)) {
      if (save || !name)
        throw new ApiError(httpStatus.BAD_REQUEST, `Variation name (${name || this.name}) is already in use`);
      // if save is false we want to find the existing variation that has the same name and the same category id to then delete it
      const toDeleteVariation = await prismaProducts.$queryRaw`
        SELECT id
        FROM variation
        WHERE category_id = ${id} AND name = ${name}
      `;

      // delete the variation
      return this.deleteValidation(toDeleteVariation[0].id, save);
    }
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
          // eslint-disable-next-line no-param-reassign
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
    let resources;
    if (this.optionId) {
      resources = await prismaProducts.$queryRaw`
        SELECT array_agg(c.product_item_id) AS resources_ids
        FROM product_configuration AS c
        WHERE c.variation_option_id = ${this.optionId}
      `;
    } else {
      resources = await prismaProducts.$queryRaw`
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
    }

    return resources;
  }

  async deleteVariation(variationOptionIds) {
    let deletedVariation;
    const deleteVariationTransaction = await prismaProducts.$transaction(async (prisma) => {
      const deletedVariationOptions = await prisma.$queryRaw`
        DELETE FROM variation_option
        WHERE id IN (${Prisma.join(variationOptionIds)})
        RETURNING id, variation_id, value
      `;

      if (!this.optionId) {
        deletedVariation = await prisma.variation.delete({
          where: { id: this.variationId },
          select: {
            id: true,
            category_id: true,
            name: true,
          },
        });
      }

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
        ...this.deleteVariation(variationOptionIds),
        incompatibilities: {
          productConfigurations: deleteProductConfigurations,
        },
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

      return {
        ...this.deleteVariation(variationOptionIds),
        incompatibilities: deleteProductTree,
      };
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Products cant be saved, Change: save=false or add another variation option to the following products: ${productItemIds}`
    );
  }

  async validateOption(optionId) {
    const option = await prismaProducts.$queryRaw`
      SELECT b.id
      FROM variation_option AS a
      LEFT JOIN variation AS b
      ON a.variation_id = b.id
      WHERE a.id = ${optionId}
    `;

    if (!option) throw new ApiError(httpStatus.NOT_FOUND, "Variation option not found");

    this.optionId = optionId;

    return option[0].id;
  }

  // delete validation
  async deleteValidation(variationId, save, optionId) {
    if (!variationId && !optionId)
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Something went wrong please try again", false);

    if (variationId) {
      // validate variation
      await this.validateVariation(variationId);
    } else if (optionId) {
      // validate option and find its variation
      await this.validateOption(optionId);
    }

    // check for products connected to this variation
    const resources = await this.checkResources();

    if (!resources[0].resources_ids) {
      // return delete variation and variation_options
      return this.deleteVariation(this.optionId ? [this.optionId] : resources[1].resources_ids);
    }

    // delete products if the only variation is the one to be deleted
    // check for other variations besides the one to be deleted
    return this.deleteProducts(this.optionId ? [this.optionId] : resources[1].resources_ids, save);
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
 * @param { Boolean } save
 * @returns { Object }
 */
const updateVariation = catchAsync(async (data, save) => {
  const updateNewVariation = new Variation();

  const { variationId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.variationId;

  // validate data to update
  if (Object.keys(data).length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "No data provided");

  // validate variationId and name if is provided
  const { variationName: name } = await updateNewVariation.validateVariation(variationId, data.name);

  // eslint-disable-next-line no-param-reassign
  data.name = name;

  let incompatibilities;
  if (data.categoryId) {
    incompatibilities = await updateNewVariation.checkCategory(data.categoryId, data.name, save);

    // eslint-disable-next-line no-param-reassign
    data.category_id = data.categoryId;
    // eslint-disable-next-line no-param-reassign
    delete data.categoryId;
  }

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

  return {
    variation,
    incompatibilities,
  };
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
 * @returns { Object }
 */
const createVariationOptions = catchAsync(async (variationId, value, values) => {
  const createNewVariationOptions = new Variation(null);

  // check for the values provided
  createNewVariationOptions.checkValues(value, values);

  // check for existing values
  await createNewVariationOptions.checkDuplicateValues(variationId);

  // create the new variation options
  const variationOptions = await createNewVariationOptions.variationOptionsTransaction(prismaProducts, variationId);

  return {
    [variationOptions.length > 1 ? "variationOptions" : "variationOption"]: variationOptions,
  };
});

/**
 * @desc Update variation option
 * @param { Object } data
 * @param { Boolean } save
 * @returns { Object }
 */
const updateVariationOption = catchAsync(async (data, save) => {
  const updateNewVariationOption = new Variation();

  const { optionId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.optionId;

  // validate data to update
  if (Object.keys(data).length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "No data provided");

  // check optionId
  const variationId = await updateNewVariationOption.validateOption(optionId);

  if (data.value) {
    updateNewVariationOption.checkValues(data.value);

    // check for existing values
    await updateNewVariationOption.checkDuplicateValues(variationId);
  }

  // if variationId is provided
  if (data.variationId) {
    // eslint-disable-next-line no-param-reassign
    data.variation_id = data.variationId;
    // eslint-disable-next-line no-param-reassign
    delete data.variationId;
  }

  let incompatibilities;
  const option = await prismaProducts.variation_option
    .update({
      where: {
        id: optionId,
      },
      data,
      select: {
        id: true,
        variation_id: true,
        value: true,
      },
    })
    .catch(async (err) => {
      // if error is a unique constraint violation we will delete the variation option and update this one to there
      if (err.code === "P2002" && ["variation_id", "value"].every((value) => err.meta.target.includes(value))) {
        if (save) throw new ApiError(httpStatus.BAD_REQUEST, "Variation option already exists");

        // delete the variation option that is blocking this one to be updated
        // find the variation option
        const toDeleteVariationOption = await prismaProducts.$queryRaw`
          SELECT id
          FROM variation_option
          WHERE variation_id = ${data.variation_id} AND value = (
            SELECT value
            FROM variation_option
            WHERE id = ${optionId}
          )
        `;

        incompatibilities = await updateNewVariationOption.deleteValidation(null, save, toDeleteVariationOption[0].id);

        return prismaProducts.variation_option
          .update({
            where: { id: optionId },
            data,
            select: {
              id: true,
              variation_id: true,
              value: true,
            },
          })
          .catch((error) => {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message, false);
          });
      }
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Something went wrong please try again", false);
    });

  return {
    variationOption: option,
    incompatibilities,
  };
});

/**
 * @desc Delete variation option(s)
 * @param { String } optionId
 * @param { Boolean } save
 * @returns { Object }
 */
const deleteVariationOption = catchAsync(async (optionId, save) => {
  // check if optionId has any resources attatched to it and continue the procedure from there === delete variation
  const deleteNewVariationOption = new Variation();

  return deleteNewVariationOption.deleteValidation(null, save, optionId);
});

module.exports = {
  createVariation,
  updateVariation,
  deleteVariation,
  createVariationOptions,
  updateVariationOption,
  deleteVariationOption,
};
