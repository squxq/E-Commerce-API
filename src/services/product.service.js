const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { prismaProducts } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { uploadImage } = require("../utils/cloudinary");
const parser = require("../utils/parser");
const convertCurrency = require("../utils/currencyConverter");
const { Currencies, FxRates } = require("../models");
const runInTransaction = require("../utils/mongoTransaction");

class CreateProductItem {
  constructor(quantity, price, options, categoryId = null) {
    this.quantity = quantity;
    this.price = price;
    this.options = options;
    this.categoryId = categoryId;
  }

  // eslint-disable-next-line class-methods-use-this
  createSKU(str) {
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
  }

  // checkOptions
  async checkOptions() {
    const allowedOptions = await prismaProducts.$queryRaw`
      SELECT c.name, array_agg(value) AS values, d.name AS category_name
      FROM variation_option AS a
      JOIN variation AS c
      ON a.variation_id = c.id
      JOIN product_category AS d
      ON d.id = ${this.categoryId}
      WHERE variation_id IN
      (
        SELECT id
        FROM variation AS b
        WHERE b.category_id = ${this.categoryId}
      )
      GROUP BY a.variation_id, c.name, d.name
      ORDER BY c.name ASC
    `;

    if (allowedOptions.length === 0) throw new ApiError(httpStatus.NOT_FOUND, "Category doesnt have any variations");

    // validate options object
    Object.entries(this.options).forEach(([key, value]) => {
      const exists = allowedOptions.find((option) => {
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

    return allowedOptions[0].category_name;
  }

  // checkPrice
  async checkPrice() {
    const result = await runInTransaction(async (session) => {
      const currency = await Currencies.findOne({ code: this.price.currency }, {}, { session });
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
    }).catch(() => {
      throw new ApiError(httpStatus.BAD_REQUEST, `${this.price.currency} is not a valid currency`);
    });

    if (result.currency === null) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid currency provided");
    }

    let exchangeRate;
    if (result.fxRate === null) {
      exchangeRate = await convertCurrency(this.price.currency, "USD");
    } else {
      exchangeRate = parseFloat(result.fxRate.exchange_rate.toString());
    }

    let formattedPrice = Math.floor(
      parseFloat(this.price.value) * result.currency.base[result.currency.base.length - 1] ** result.currency.exponent
    );

    formattedPrice = Math.round(Math.round((formattedPrice * exchangeRate + Number.EPSILON) * 10) / 10);

    if (formattedPrice < 0) throw new ApiError(httpStatus.BAD_REQUEST, "Price must be greater than 0");

    return formattedPrice;
  }

  // generateSKU
  generateSKU(categoryName, productName) {
    const orderedOptions = Object.keys(this.options)
      .sort()
      .reduce((obj, key) => {
        // eslint-disable-next-line no-undef, no-param-reassign
        obj[key] = this.options[key];
        return obj;
      }, {});

    const names = [categoryName, productName];

    let sku = names.map(
      function (skuName) {
        return this.createSKU(skuName);
      }.bind(this)
    );

    sku = sku.concat(
      Object.values(orderedOptions).map((option) => {
        if (option.replace(" ", "").length > 4) {
          return this.createSKU(option);
        }
        return option.replace(" ", "").toUpperCase();
      })
    );

    return { sku, orderedOptions };
  }

  // createItemTransaction
  async createProductItemTransaction(productId, sku, orderedOptions, imagesArray, formattedPrice, prisma) {
    const variationsPromises = Object.entries(orderedOptions).map(async ([key, value]) => {
      return prisma.$queryRaw`
          SELECT a.id
          FROM variation_option AS a
          LEFT JOIN variation AS b
          ON b.id = a.variation_id
          WHERE b.name = ${key} AND a.value = ${value}
        `;
    });

    let variationsIds = await Promise.all(variationsPromises);
    variationsIds = variationsIds.map((varArr) => varArr[0].id).sort();

    let otherConfigurations = await prisma.$queryRaw`
      SELECT array_agg(a.variation_option_id) AS config
      FROM product_configuration AS a
      WHERE a.product_item_id IN (
        SELECT b.id
        FROM product_item AS b
        WHERE b.product_id = '505ed5d9-6f8c-431a-9304-cf41418aea2d'
      )
      GROUP BY a.product_item_id
    `;

    otherConfigurations = otherConfigurations.map((obj) => obj.config.sort());

    otherConfigurations.forEach((configuration) => {
      if (configuration.join(",") === variationsIds.join(",")) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Different product items cannot have the same variation options");
      }
    });

    const createProductItem = await prisma.product_item.create({
      data: {
        product_id: productId,
        SKU: sku.join("-"),
        QIS: Math.floor(this.quantity),
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

    const configurationPromises = variationsIds.map(async (id) =>
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
  }

  // getProductName
  // eslint-disable-next-line class-methods-use-this
  async getProductName(productId) {
    const product = await prismaProducts.product.findUnique({
      where: { id: productId },
      select: { name: true },
    });

    return product.name;
  }

  async uploadImages(images, productName = null, productId = null) {
    if (!productName) {
      if (productId) {
        // eslint-disable-next-line no-param-reassign
        productName = await this.getProductName(productId);
      } else {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Its not possible to upload images without a product name.");
      }
    }

    const formattedName = encodeURIComponent(
      productName
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
    imagesArray.push(productName);

    return imagesArray;
  }
}

/**
 * @desc Create new product / product item / product configurations
 * @param { Object } data
 * @param { Array } images
 * @property { String } data.categoryId
 * @property { String } data.name
 * @property { String } data.description
 * @property { Number } data.quantity
 * @property { Object } data.price
 * @property { String } data.options
 * @returns { Array }
 */
const createProduct = catchAsync(async (data, images) => {
  const { categoryId, name, description, quantity, price, options } = data;
  // instantiate CreateProductItem class
  const createNewProductItem = new CreateProductItem(quantity, price, options, categoryId);

  // check the allowed options for product configuration
  const categoryName = await createNewProductItem.checkOptions();

  // check and format the price
  const formattedPrice = await createNewProductItem.checkPrice();

  // check for a main image
  if (images.length < 1) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No images provided");
  }
  let mainImage;
  let hasMain = false;
  if (images.find((image) => image.fieldname === "main")) {
    mainImage = images.find((image) => image.fieldname === "main");
    images.splice(images.indexOf(mainImage), 1);
    images.unshift(mainImage);
    hasMain = true;
  }

  // upload images
  const imagesArray = await createNewProductItem.uploadImages(images, name);
  const mainPublicId = imagesArray[0];
  if (hasMain) imagesArray.shift();
  imagesArray.pop();

  // SKU - generation === categoryName + productName + productVariationOptions
  const { sku, orderedOptions } = createNewProductItem.generateSKU(categoryName, name);

  const createProductTransaction = await prismaProducts.$transaction(async (prisma) => {
    const createNewProduct = await prisma.product
      .create({
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
      })
      .catch((err) => {
        if (err.code === "P2002" && ["category_id", "name"].every((element) => err.meta.target.includes(element))) {
          throw new ApiError(httpStatus.BAD_REQUEST, "A product with this name already exists");
        }

        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err.message, false);
      });

    const [createProductItem, createProductConfiguration] = await createNewProductItem.createProductItemTransaction(
      createNewProduct.id,
      sku,
      orderedOptions,
      imagesArray,
      formattedPrice,
      prisma
    );

    return {
      product: createNewProduct,
      productItem: createProductItem,
      [createProductConfiguration.length > 1 ? "productConfigurations" : "productConfiguration"]: createProductConfiguration,
    };
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
const createProductItem = catchAsync(async (productId, quantity, price, options, images) => {
  const product = await prismaProducts.product.findUnique({
    where: { id: productId },
    select: { category_id: true }, // product object inside category_id: the actual id
  });

  if (!product) throw new ApiError(httpStatus.NOT_FOUND, "Product not found");

  // Initialize createNewProductItem class
  const createNewProductItem = new CreateProductItem(quantity, price, options, product.category_id);

  // check the allowed options for product configuration
  const categoryName = await createNewProductItem.checkOptions();

  // check and format the price
  const formattedPrice = await createNewProductItem.checkPrice();

  // upload images
  if (images.length < 1) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No images provided");
  }
  const imagesArray = await createNewProductItem.uploadImages(images, null, productId);
  const productName = imagesArray[imagesArray.length - 1];
  imagesArray.pop();

  // SKU - generation === categoryName + productName + productVariationOptions
  const { sku, orderedOptions } = createNewProductItem.generateSKU(categoryName, productName);

  // create productItemTransaction
  const createProductItemTransaction = await prismaProducts.$transaction(async (prisma) => {
    const [createNewProditem, createProductConfiguration] = await createNewProductItem.createProductItemTransaction(
      productId,
      sku,
      orderedOptions,
      imagesArray,
      formattedPrice,
      prisma
    );

    return {
      productItem: createNewProditem,
      [createProductConfiguration.length > 1 ? "productConfigurations" : "productConfiguration"]: createProductConfiguration,
    };
  });

  return createProductItemTransaction;
});

module.exports = {
  createProduct,
  createProductItem,
};
