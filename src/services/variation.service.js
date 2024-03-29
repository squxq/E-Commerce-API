const { v4: uuidv4 } = require("uuid");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
const { prismaInbound } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { formatName, createSKU } = require("../utils/name-sku");
const catchAsync = require("../utils/catchAsync");

class Variation {
  constructor(categoryId, name) {
    this.categoryId = categoryId;
    this.name = name;
  }

  // check if the category is valid
  async checkCategory(id = null, name = null) {
    const checkCategoryQuery = await prismaInbound.$queryRaw`
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

    if (checkCategoryQuery.length === 0)
      throw new ApiError(httpStatus.NOT_FOUND, `No category: ${id || this.categoryId} was found!`);

    if (!checkCategoryQuery[0].ids.includes(id || this.categoryId))
      throw new ApiError(httpStatus.BAD_REQUEST, `Category: ${id || this.categoryId} is not valid!`);

    if (
      checkCategoryQuery[0].names.find((existingName) => {
        return existingName ? formatName(existingName) === formatName(name) : false;
      })
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Variation name (${name || this.name}) is already in use!`);
    }
  }

  // check if value(s) is/are valid
  checkValues(value, values) {
    if (!value && !values) throw new ApiError(httpStatus.BAD_REQUEST, "At least one value is required!");

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
    const result = await prismaInbound.$queryRaw`
      SELECT a.id, array_agg(b.value) AS values
      FROM variation AS a
      LEFT JOIN variation_option AS b
      ON b.variation_id = a.id
      WHERE a.id = ${variationId}
      GROUP BY a.id
    `;

    if (result.length === 0) throw new ApiError(httpStatus.NOT_FOUND, `Invalid variation: ${variationId} provided!`);

    this.values.sort();
    result[0].values.sort();
    let i = 0;
    let j = 0;
    while (i < this.values.length && j < result[0].values.length) {
      const formattedValue = formatName(this.values[i]);
      const formattedValues = formatName(result[0].values[j]);

      if (formattedValue < formattedValues) {
        // eslint-disable-next-line no-plusplus
        i++;
      } else if (formattedValue > formattedValues) {
        // eslint-disable-next-line no-plusplus
        j++;
      } else if (formattedValue === formattedValues) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Duplicate values provided! ${this.values[i]} is already in use.`);
      }
    }
  }

  // get SKU info
  // eslint-disable-next-line class-methods-use-this
  async getSKUInfo(variationOptions = null, variationId = null, multiple = false, productItemIds = null) {
    return prismaInbound.$queryRaw`
      ${
        !productItemIds
          ? Prisma.sql`WITH product_item_info AS (
        SELECT DISTINCT product_item_id AS product_item_id
        FROM product_configuration
        WHERE variation_option_id ${
          // eslint-disable-next-line no-nested-ternary
          variationId
            ? Prisma.sql`IN (
          SELECT id
          FROM variation_option
          WHERE variation_id = ${variationId}
          )`
            : multiple
            ? Prisma.sql`IN (${Prisma.join(variationOptions.map)})`
            : Prisma.sql`= ${variationOptions}`
        }
        )`
          : Prisma.sql``
      }

      SELECT a.id AS item_id,
        "SKU" AS sku,
        array_agg(b.name ORDER BY b.name ASC) AS variation_names
      FROM product_item AS a
      INNER JOIN variation AS b
      ON b.id IN (
        SELECT variation_id
        FROM variation_option
        WHERE id IN (
          SELECT variation_option_id
          FROM product_configuration
          WHERE product_item_id IN (a.id)
        )
      )
      WHERE a.id IN (${
        productItemIds ? Prisma.join(productItemIds) : Prisma.sql`SELECT product_item_id FROM product_item_info`
      })
      GROUP BY a.id, "SKU"
    `;
  }

  // update SKUs in product_item
  // eslint-disable-next-line class-methods-use-this
  async updateSKUs(array) {
    return prismaInbound.$queryRaw`
      UPDATE product_item SET
        "SKU" = v.new_sku
      FROM (VALUES
        ${Prisma.join(
          array.map((subArr) => {
            return Prisma.sql`(${Prisma.join(subArr)})`;
          })
        )}
      ) AS v(item_id, new_sku)
      WHERE id = v.item_id
      RETURNING id, product_id, "SKU", "QIS", images, price
    `;
  }

  // change SKU order
  async changeOrderSKU(variationId, oldName) {
    // this.name = variationName
    // find all product items that have a variation option with variation id === variationId
    // find all product items variations names

    const productSKUs = await this.getSKUInfo(null, variationId);

    const updateSKUArray = productSKUs.map(({ item_id: id, sku, variation_names: variationNames }) => {
      const SKU = sku.split("-");
      const skuArray = SKU.slice(4);
      let orderedOptions = {};
      variationNames.forEach((name, index) => {
        if (name === oldName) {
          orderedOptions[this.name] = skuArray[index];
        } else {
          orderedOptions[name] = skuArray[index];
        }
      });

      orderedOptions = Object.keys(orderedOptions)
        .sort()
        .reduce((obj, key) => {
          // eslint-disable-next-line no-undef, no-param-reassign
          obj[key] = orderedOptions[key];
          return obj;
        }, {});

      const newSKU = [...SKU.slice(0, 4), ...Object.values(orderedOptions)].join("-");
      return [id, newSKU];
    });

    const productItems = await this.updateSKUs(updateSKUArray);

    return productItems;
  }

  // validate variation and name
  async validateVariation(variationId, variationName = null) {
    const variation = await prismaInbound.$queryRaw`
      SELECT id, category_id, name
      FROM variation
      WHERE id = ${variationId || this.categoryId}
    `;

    if (variation.length === 0) throw new ApiError(httpStatus.NOT_FOUND, `Variation ${variationId} not found!`);

    this.categoryId = variation[0].category_id;

    let productItems;
    if (variationName && formatName(variationName) !== formatName(variation[0].name)) {
      this.name = variationName;
      await this.checkCategory(null, variation[0].name);

      // change order in sku based on current variationName
      productItems = await this.changeOrderSKU(variation[0].id, variation[0].name);
    } else {
      this.name = variation[0].name;
    }

    this.variationId = variation[0].id;

    return {
      variationName: this.name,
      productItems,
    };
  }

  // check for existing resources - variation_options
  async checkResources() {
    let resources;
    if (this.optionId) {
      resources = await prismaInbound.$queryRaw`
        SELECT array_agg(c.product_item_id) AS resources_ids
        FROM product_configuration AS c
        WHERE c.variation_option_id = ${this.optionId}
      `;
    } else {
      resources = await prismaInbound.$queryRaw`
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
    const deleteVariationTransaction = await prismaInbound.$transaction(async (prisma) => {
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

  async deleteProducts(variationOptionIds, save = null, variationName = null) {
    const toDeleteProducts = [];
    const toUpdateProducts = [];
    let productItemsArr;

    let productItemIds = await prismaInbound.$queryRaw`
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
      } else {
        toUpdateProducts.push(productItemIds[index]);
      }
    }

    // change sku in all uncommon elements from toDeleteProducts and productItemIds
    if (toUpdateProducts.length > 0) {
      const productSKUs = await this.getSKUInfo(variationOptionIds, null, false, toUpdateProducts);

      const newSKUArray = productSKUs.map(({ item_id: id, sku, variation_names: variationNames }) => {
        const SKU = sku.split("-");
        const toDeleteIndex = variationNames.indexOf(variationName);
        SKU.splice(toDeleteIndex + 2, 1);

        return [id, SKU.join("-")];
      });

      productItemsArr = await this.updateSKUs(newSKUArray);
    }

    // all the products in toDeleteProducts have only one variation - the one that is going to be deleted
    // no products to delete
    if (toDeleteProducts.length === 0) {
      // first delete all the product_configurations that are attatched to variation_options that are going to be deleted
      const deleteProductConfigurations = await prismaInbound.$queryRaw`
        DELETE FROM product_configuration
        WHERE product_item_id IN (${Prisma.join(productItemIds)})
          AND variation_option_id IN (${Prisma.join(variationOptionIds)})
        RETURNING id, product_item_id, variation_option_id
      `;

      return {
        ...(await this.deleteVariation(variationOptionIds)),
        productItems: productItemsArr,
        productConfigurations: deleteProductConfigurations,
      };
    }

    // some products to delete - is save true or false
    if (!save) {
      // delete product configurations and product items in productItemIds if product_item is the only in product delete that as well
      const deleteProductTree = await prismaInbound.$transaction(async (prisma) => {
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
          products: deleteProducts,
          productItems,
          productConfigurations,
        };
      });

      return {
        ...this.deleteVariation(variationOptionIds),
        productItems: productItemsArr,
        incompatibilities: deleteProductTree,
      };
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Products cant be saved! Change: save=false or add another variation option to the following products: ${productItemIds}.`
    );
  }

  async validateOption(optionId) {
    const option = await prismaInbound.$queryRaw`
      SELECT b.id, b.name
      FROM variation_option AS a
      LEFT JOIN variation AS b
      ON a.variation_id = b.id
      WHERE a.id = ${optionId}
    `;

    if (option.length === 0) throw new ApiError(httpStatus.NOT_FOUND, `Variation option: ${optionId} not found!`);

    this.optionId = optionId;

    return {
      variationId: option[0].id,
      variationName: option[0].name,
    };
  }

  // delete validation
  async deleteValidation(variationId, save, optionId) {
    let variationName;
    if (variationId) {
      // validate variation
      const { variationName: vName } = await this.validateVariation(variationId);
      variationName = vName;
    } else if (optionId) {
      // validate option and find its variation
      const { variationName: vName } = await this.validateOption(optionId);
      variationName = vName;
    }

    // check for products connected to this variation
    const resources = await this.checkResources();

    if (!resources[0].resources_ids) {
      // return delete variation and variation_options
      return this.deleteVariation(this.optionId ? [this.optionId] : resources[1].resources_ids);
    }

    // delete products if the only variation is the one to be deleted
    // check for other variations besides the one to be deleted
    return this.deleteProducts(this.optionId ? [this.optionId] : resources[1].resources_ids, save, variationName);
  }

  // change value in all products SKU
  async changeValueSKU(newValue, optionId, variationName) {
    const newSKUValue = createSKU(newValue, true);

    // get all the product items that have option_id = optionId
    const productSKUs = await this.getSKUInfo(optionId, null, true);

    const newSKUArray = productSKUs.map(({ item_id: id, sku, variation_names: variationNames }) => {
      const newIndex = variationNames.indexOf(variationName);
      const SKU = sku.split("-");
      SKU[newIndex + 2] = newSKUValue;

      return [id, SKU.join("-")];
    });

    const productItems = await this.updateSKUs(newSKUArray);

    return productItems;
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
  // check if the categoryId is valid
  await createNewVariation.checkCategory(null, name);

  // check if value(s) is/are valid
  createNewVariation.checkValues(value, values);

  const createVariationTransaction = await prismaInbound.$transaction(async (prisma) => {
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
  // eslint-disable-next-line no-param-reassign
  delete data.variationId;

  // validate data to update
  if (Object.keys(data).length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "No data provided!");

  // validate variationId and name if is provided
  const { variationName: name, productItems } = await updateNewVariation.validateVariation(variationId, data.name);

  // eslint-disable-next-line no-param-reassign
  data.name = name.trim();

  const variation = await prismaInbound.variation.update({
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
    productItems,
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
  const variationOptions = await createNewVariationOptions.variationOptionsTransaction(prismaInbound, variationId);

  return {
    [variationOptions.length > 1 ? "variationOptions" : "variationOption"]: variationOptions,
  };
});

/**
 * @desc Update variation option
 * @param { Object } data
 * @returns { Object }
 */
const updateVariationOption = catchAsync(async (data) => {
  const updateNewVariationOption = new Variation();

  const { optionId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.optionId;

  // validate data to update
  if (Object.keys(data).length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "No data provided!");

  // check optionId
  const { variationId, variationName } = await updateNewVariationOption.validateOption(optionId);

  let productItems;
  if (data.value) {
    updateNewVariationOption.checkValues(data.value);

    // check for existing values
    await updateNewVariationOption.checkDuplicateValues(variationId);

    // change all the SKUs
    productItems = await updateNewVariationOption.changeValueSKU(data.value, optionId, variationName);
  }

  const option = await prismaInbound.variation_option.update({
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

  return {
    variationOption: option,
    productItems,
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
