const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { prismaProducts } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { uploadImage } = require("../utils/cloudinary");
const parser = require("../utils/parser");
const convertCurrency = require("../utils/currencyConverter");
const { Currencies, FxRates } = require("../models");
const runInTransaction = require("../utils/mongoTransaction");

const createSKU = (str) => {
  if (str.trim().indexOf(" ") === -1) {
    return str.trim().substring(0, 2).toUpperCase();
  }
  return str
    .trim()
    .split(" ")
    .map((word) => {
      return word.charAt(0).toUpperCase();
    })
    .join("");
};

const checkOptions = async (id, options, setting) => {
  const allowedOptionsTransaction = await prismaProducts.$transaction(async (prisma) => {
    if (setting === "product") {
      const product = await prisma.product.findUnique({
        where: { id },
        select: { category_id: true }, // product object inside category_id: the actual id
      });

      // eslint-disable-next-line no-param-reassign
      id = product.category_id;
    }

    const allowedOptions = await prismaProducts.$queryRaw`
    SELECT c.name, array_agg(value) AS values, d.name AS category_name
    FROM variation_option AS a
    JOIN variation AS c
    ON a.variation_id = c.id
    JOIN product_category AS d
    ON d.id = ${id}
    WHERE variation_id IN
    (
      SELECT id
      FROM variation AS b
      WHERE b.category_id = ${id}
    )
    GROUP BY a.variation_id, c.name, d.name
    ORDER BY c.name ASC
  `;

    return [allowedOptions];
  });

  // validate options object
  Object.entries(options).forEach(([key, value]) => {
    const exists = allowedOptionsTransaction[0].find((option) => {
      if (option.name === key) {
        if (!option.values.includes(value)) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Wrong variation option provided for: ${key}, value: ${value} does not exist`
          );
        }
      }
      return option.name === key;
    });

    if (!exists) throw new ApiError(httpStatus.BAD_REQUEST, `Wrong variation option provided for: ${key}`);
  });

  return allowedOptionsTransaction[0][0].category_name;
};

const checkPrice = async (price) => {
  const result = await runInTransaction(async (session) => {
    const currency = await Currencies.findOne({ code: price.currency }, {}, { session });
    const fxRate = await FxRates.findOne(
      {
        source_currency: currency.code,
        target_currency: "USD",
        valid_from_date: {
          $lte: new Date().toISOString(),
        },
        valid_to_date: {
          $gte: new Date().toISOString(),
        },
      },
      {},
      { session }
    );
    return { currency, fxRate };
  });

  if (result.currency === null) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid currency provided");
  }

  let exchangeRate;
  if (result.fxRate === null) {
    exchangeRate = convertCurrency(price.currency, "USD");
  } else {
    exchangeRate = parseFloat(result.fxRate.exchange_rate.toString());
  }
  // eslint-disable-next-line no-param-reassign
  price.value = parseFloat(price.value); // float value

  let formattedPrice = Math.floor(
    price.value * result.currency.base[result.currency.base.length - 1] ** result.currency.exponent
  );

  formattedPrice = Math.round(Math.round((formattedPrice * exchangeRate + Number.EPSILON) * 10) / 10);
  return formattedPrice;
};

const createProductItemTransaction = async (
  prisma,
  productId,
  sku,
  quantity,
  imagesArray,
  formattedPrice,
  orderedOptions,
  categoryId
) => {
  const createProductItem = await prisma.product_item.create({
    data: {
      product_id: productId,
      SKU: sku.join("-"),
      QIS: Math.floor(quantity),
      images: imagesArray,
      price: formattedPrice,
    },
    select: {
      id: true,
      product_id: true,
      SKU: true,
      QIS: true,
      images: true,
      price: true,
    },
  });

  const variationsPromises = Object.entries(orderedOptions).map(async ([key, value]) => {
    return prisma.$queryRaw`
          SELECT b.id
          FROM variation AS a
          JOIN variation_option AS b
          ON a.name = ${key} AND b.value = ${value}
          WHERE category_id = ${categoryId}
        `;
  });

  let variationIds = await Promise.all(variationsPromises);
  variationIds = variationIds.map((variationId) => variationId[0]);

  const configurationPromises = variationIds.map(async ({ id }) =>
    prisma.product_configuration.create({
      data: {
        product_item_id: createProductItem.id,
        variation_option_id: id,
      },
      select: {
        id: true,
        product_item_id: true,
        variation_option_id: true,
      },
    })
  );

  const createProductConfiguration = await Promise.all(configurationPromises);

  return [createProductItem, createProductConfiguration];
};

const generateSKU = (options, categoryName, productName) => {
  const orderedOptions = Object.keys(options)
    .sort()
    .reduce((obj, key) => {
      // eslint-disable-next-line no-undef, no-param-reassign
      obj[key] = options[key];
      return obj;
    }, {});

  const names = [categoryName, productName];

  let sku = names.map((skuName) => createSKU(skuName));
  sku = sku.concat(
    Object.values(orderedOptions).map((option) => {
      if (option.replace(" ", "").length > 4) {
        return createSKU(option);
      }
      return option.replace(" ", "").toUpperCase();
    })
  );

  return [sku, orderedOptions];
};

/**
 * @desc Create new product / product item / product configurations
 * @param { Object } data
 * @param { Array } images
 * @returns { Array }
 */
const createProduct = catchAsync(async (data, images) => {
  const { categoryId, name, description, quantity, price, options } = data;
  // check the allowed options for product configuration
  const categoryName = await checkOptions(categoryId, options, "category");

  // check and format the price
  const formattedPrice = await checkPrice(price);

  // check for a main image
  let mainImage;
  let hasMain = false;
  if (images.find((image) => image.fieldname === "main")) {
    mainImage = images.find((image) => image.fieldname === "main");
    images.splice(images.indexOf(mainImage), 1);
    images.unshift(mainImage);
    hasMain = true;
  }

  // upload image
  const formattedName = encodeURIComponent(
    name
      .trim()
      .toLowerCase()
      .split(" ")
      .join("_")
      .replace(/[^a-zA-Z0-9-_]/g, "")
  );

  const folder = `Products/${formattedName}`;

  // images
  const imagePromises = images.map(async (image) => {
    if (image.fieldname === "main") {
      const { public_id: publicId } = await uploadImage(parser(image).content, folder, `${formattedName}_main`);
      return publicId;
    }
    const { public_id: publicId } = await uploadImage(parser(image).content, folder, formattedName);
    return publicId;
  });

  const imagesArray = await Promise.all(imagePromises);
  const mainPublicId = imagesArray[0];
  if (hasMain) imagesArray.shift();

  // SKU - generation === categoryName + productName + productVariationOptions
  const [sku, orderedOptions] = generateSKU(options, categoryName, name);

  const createProductTransaction = await prismaProducts.$transaction(async (prisma) => {
    const createNewProduct = await prisma.product.create({
      data: {
        category_id: categoryId,
        name,
        description,
        image: mainPublicId,
      },
      select: {
        id: true,
        category_id: true,
        name: true,
        description: true,
        image: true,
      },
    });

    const [createProductItem, createProductConfiguration] = await createProductItemTransaction(
      prisma,
      createNewProduct.id,
      sku,
      quantity,
      imagesArray,
      formattedPrice,
      orderedOptions,
      categoryId
    );

    return [createNewProduct, createProductItem, createProductConfiguration];
  });

  return createProductTransaction;
});

/**
 * @desc Create new product item
 * @param { String } productId
 * @param { Number } quantity
 * @param { String } price
 * @param { Object } options
 * @param { Object } images
 * @returns { Array }
 */
const createProductItem = catchAsync(async (productId, quantity, price, options) => {
  // check the allowed options for product configuration
  const categoryName = checkOptions(productId, options, "product");

  // check and format the price
  const formattedPrice = await checkPrice(price);
});

module.exports = {
  createProduct,
  createProductItem,
};
