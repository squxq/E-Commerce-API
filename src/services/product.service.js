const hash = require("object-hash");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
const catchAsync = require("../utils/catchAsync");
const { prismaProducts } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { uploadImage, updateName, deleteImage } = require("../utils/cloudinary");
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

      if (!exists) throw new ApiError(httpStatus.BAD_REQUEST, `Variation ${key} does not exist`);
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

  // verify the product item options
  // eslint-disable-next-line class-methods-use-this
  async verifyProductItemOptions(prisma, orderedOptions, productId) {
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
        WHERE b.product_id = ${productId}
      )
      GROUP BY a.product_item_id
    `;

    otherConfigurations = otherConfigurations.map((obj) => obj.config.sort());

    otherConfigurations.forEach((configuration) => {
      if (configuration.join(",") === variationsIds.join(",")) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Different product items cannot have the same variation options");
      }
    });

    return variationsIds;
  }

  // eslint-disable-next-line class-methods-use-this
  async createProductConfigurations(prisma, variationsIds, productItemId) {
    const configurationPromises = variationsIds.map(async (id) =>
      prisma.product_configuration.create({
        data: {
          product_item_id: productItemId,
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

    return createProductConfiguration;
  }

  // createItemTransaction
  async createProductItemTransaction(productId, sku, orderedOptions, imagesArray, formattedPrice, prisma) {
    const variationsIds = await this.verifyProductItemOptions(prisma, orderedOptions, productId);

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

    const createProductConfiguration = await this.createProductConfigurations(prisma, variationsIds, createProductItem.id);

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

  async uploadImages(images, productName = null, productId = null, buffer = null, main = false) {
    if (!productName) {
      if (productId) {
        // eslint-disable-next-line no-param-reassign
        productName = await this.getProductName(productId);
      } else {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Its not possible to upload images without a product name.",
          false
        );
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

    // if images is an array
    if (images) {
      // images
      const imagePromises = images.map(async (image) => {
        if (image.fieldname === "main") {
          const { public_id: publicId } = await uploadImage(parser(image).content, folder, `main`);
          return publicId;
        }
        const { public_id: publicId } = await uploadImage(parser(image).content, folder);
        return publicId;
      });

      const imagesArray = await Promise.all(imagePromises);
      imagesArray.push(productName);

      return imagesArray;
    }

    // if we pass a buffer
    const publicId = await uploadImage(buffer, folder, main ? "main" : null);
    return publicId.public_id;
  }

  // get the main image from the db
  // eslint-disable-next-line class-methods-use-this
  async removeMainCloudinary(images, productId) {
    const main = images.find((mainPublicId) => mainPublicId.substring(mainPublicId.lastIndexOf("/") + 1).startsWith("main"));

    const newPublicId = `${main.substring(0, main.lastIndexOf("/") + 1)}${main
      .substring(main.lastIndexOf("/") + 1)
      .replace("main_", "")}`;

    // rename it in cloudinary
    await updateName(main, newPublicId);

    // rename it in db
    await prismaProducts.$queryRaw`
      UPDATE product_item
      SET images = array_replace(images, ${main}, ${newPublicId})
      WHERE product_id = ${productId}
        AND ${main} = ANY(images)
    `;
  }

  // validate single image
  async validateImage(image, productId, productName) {
    // file is not empty because we checked it in updateProduct
    const { content: buffer } = parser(image);

    const etag = hash(buffer, { algorithm: "md5" });

    let images = await prismaProducts.$queryRaw`
      SELECT * FROM (
        (
          SELECT image AS images
          FROM product
          WHERE id = ${productId}
        )

        UNION ALL

        (
          SELECT unnest(images)
          FROM product_item
          WHERE product_id = ${productId}
        )
      ) AS a
    `;

    images = Array.from(new Set(images.map((obj) => obj.images)));

    let publicId = "";
    images.every((imagePublicId) => {
      if (imagePublicId.substring(imagePublicId.length - 32) === etag) {
        // eslint-disable-next-line no-param-reassign
        publicId = imagePublicId;
        return false;
      }
      return true;
    });

    if (!publicId) {
      // change main image from cloudinary
      await this.removeMainCloudinary(images, productId);

      // we have to upload the image
      publicId = await this.uploadImages(null, productName, null, buffer, true);

      return publicId;
    }

    // if the image already exists we need to check if the image starts with main and if yes we just return nothing
    if (!publicId.substring(publicId.lastIndexOf("/") + 1).startsWith("main")) {
      // change main image from cloudinary
      await this.removeMainCloudinary(images, productId);

      // update name in cloudinary and db to `main_${publicId}`
      const newPublicId = await updateName(
        publicId,
        `${publicId.substring(0, publicId.lastIndexOf("/") + 1)}main_${publicId.substring(publicId.lastIndexOf("/") + 1)}`
      );

      // rename all image publicIds in db
      await prismaProducts.$queryRaw`
        UPDATE product_item
        SET images = array_replace(images, ${publicId}, ${newPublicId})
        WHERE product_id = ${productId}
          AND ${publicId} = ANY(images)
      `;

      return newPublicId;
    }
  }

  // delete product item(s)
  // eslint-disable-next-line class-methods-use-this
  async deleteProductItems(prisma, products, multiple = false) {
    if (multiple) {
      // which means we are deleting the product
      // first we delete the product_configurations

      const productConfigurations = await prisma.$queryRaw`
        DELETE FROM product_configuration
        WHERE id IN (${Prisma.join(products.product_configuration_ids)})
        RETURNING id, product_item_id, variation_option_id
      `;

      const imagesPromises = Array.from(new Set([...products.product_item_public_ids, products.product_public_id])).map(
        async (image) => deleteImage(image)
      );

      await Promise.all(imagesPromises);

      const productItems = await prisma.$queryRaw`
        DELETE FROM product_item
        WHERE id IN (${Prisma.join(products.product_item_ids)})
        RETURNING id, product_id, "SKU", "QIS", images, price
      `;

      return {
        [productItems.length === 1 ? "productItem" : "productItems"]: productItems,
        [productConfigurations.length === 1 ? "productConfiguration" : "productConfigurations"]: productConfigurations,
      };
    }
    // we are deleting a single product item
  }

  // update product item
  async updateProductItemTransaction(productItemId, data, variationsIds = null) {
    const updateTransaction = prismaProducts.$transaction(async (prisma) => {
      let productConfigurations = [];
      if (variationsIds) {
        // means that data.options exists
        // delete and create new product_configurations
        await prisma.$queryRaw`
          DELETE FROM product_configuration
          WHERE product_item_id = ${productItemId}
        `;

        productConfigurations = await this.createProductConfigurations(prisma, variationsIds, productItemId);
      }

      const updateProductItemTransaction = await prisma.product_item.update({
        where: {
          id: productItemId,
        },
        data,
        select: {
          id: true,
          product_id: true,
          SKU: true,
          QIS: true,
          price: true,
        },
      });

      return {
        productItem: updateProductItemTransaction,
        [productConfigurations.length === 1 ? "productConfiguration" : "productConfigurations"]:
          productConfigurations.length !== 0 ? productConfigurations : undefined,
      };
    });

    return updateTransaction;
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
  const createNewProduct = new CreateProductItem(quantity, price, options, categoryId);

  // check the allowed options for product configuration
  const categoryName = await createNewProduct.checkOptions();

  // check and format the price
  const formattedPrice = await createNewProduct.checkPrice();

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
  const imagesArray = await createNewProduct.uploadImages(images, name);
  const mainPublicId = imagesArray[0];
  if (hasMain) imagesArray.shift();
  imagesArray.pop();

  // SKU - generation === categoryName + productName + productVariationOptions
  const { sku, orderedOptions } = createNewProduct.generateSKU(categoryName, name);

  const createProductTransaction = await prismaProducts.$transaction(async (prisma) => {
    const createNewProductTransaction = await prisma.product
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

    const [createProductItem, createProductConfiguration] = await createNewProduct.createProductItemTransaction(
      createNewProductTransaction.id,
      sku,
      orderedOptions,
      imagesArray,
      formattedPrice,
      prisma
    );

    return {
      product: createNewProductTransaction,
      productItem: createProductItem,
      [createProductConfiguration.length > 1 ? "productConfigurations" : "productConfiguration"]: createProductConfiguration,
    };
  });

  return createProductTransaction;
});

/**
 * @desc Update a Product
 * @param { Object } data
 * @param { Object } image
 * @property { String } data.productId
 * @returns { Object }
 */
const updateProduct = catchAsync(async (data, image) => {
  const updateNewProduct = new CreateProductItem();
  const { productId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.productId;

  // validate data object for something to update
  if (!image && Object.keys(data).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided");
  }

  // validate product id
  const product = await prismaProducts.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      name: true,
    },
  });

  if (!product) throw new ApiError(httpStatus.BAD_REQUEST, "Product not found");
  const { name } = product;

  if (data.name && data.name !== name) {
    // eslint-disable-next-line no-param-reassign
    data.name = name;
  }

  // validate image
  if (image) {
    const publicId = await updateNewProduct.validateImage(image, productId, name);
    // eslint-disable-next-line no-param-reassign
    data.image = publicId;
  }

  const result = await prismaProducts.product.update({
    where: {
      id: productId,
    },
    data,
    select: {
      id: true,
      category_id: true,
      name: true,
      description: true,
      image: true,
    },
  });

  return {
    product: result,
  };
});

/**
 * @desc Delete a product
 * @param { String } productId
 * @return { Object }
 */
const deleteProduct = catchAsync(async (productId) => {
  const deleteNewProduct = new CreateProductItem();
  // delete product itself

  // validate product id
  const product = await prismaProducts.$queryRaw`
    SELECT a.id AS product_id,
      a.image AS product_public_id,
      array_agg(b.id) AS product_item_ids,
      ARRAY(SELECT DISTINCT * FROM unnest(array_agg(b.images))) AS product_item_public_ids,
      array_agg(c.id) AS product_configuration_ids
    FROM product AS a
    LEFT JOIN product_item AS b
    ON b.product_id = a.id
    LEFT JOIN product_configuration AS c
    ON c.product_item_id = b.id
    WHERE a.id = ${productId}
    GROUP BY a.id
  `;

  if (product.length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "Product not found");

  const deleteProductTransaction = await prismaProducts.$transaction(async (prisma) => {
    // delete all product items and their images from cloudinary
    const productItems = await deleteNewProduct.deleteProductItems(prisma, product[0], true);

    const deletedProduct = await prisma.product.delete({
      where: {
        id: productId,
      },
      select: {
        id: true,
        category_id: true,
        name: true,
        description: true,
        image: true,
      },
    });

    return {
      deletedProduct,
      ...productItems,
    };
  });

  return deleteProductTransaction;
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

/**
 * @desc Update a Product Item
 * @param { Object } data
 * @param { Object } images
 * @param { String } query
 * @property { String } data.productItemId
 * @returns { Object }
 */
const updateProductItem = catchAsync(async (data, images, query) => {
  const { productItemId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.productItemId;

  // validate data object for something to update
  if (images.length === 0 && Object.keys(data).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided");
  }

  // validate product item id
  const productItem = await prismaProducts.$queryRaw`
    SELECT b.id AS product_id, b.name AS product_name, c.id AS category_id, c.name AS category_name
    FROM product_item AS a
    LEFT JOIN product AS b
    ON b.id = a.product_id
    LEFT JOIN product_category AS c
    ON c.id = b.category_id
    WHERE a.id = ${productItemId}
  `;

  if (productItem.length === 0) throw new ApiError(httpStatus.NOT_FOUND, "Product Item not found");

  const updateNewProductItem = new CreateProductItem(data.quantity, data.price, data.options, productItem[0].category_id);

  if (data.quantity) {
    // eslint-disable-next-line no-param-reassign
    data.QIS = Math.floor(data.quantity);

    // eslint-disable-next-line no-param-reassign
    delete data.quantity;
  }

  if (data.price) {
    // check and format the price
    const formattedPrice = await updateNewProductItem.checkPrice();
    // eslint-disable-next-line no-param-reassign
    data.price = formattedPrice;
  }

  let variationsIds;
  if (data.options) {
    // check the allowed options for product configuration
    await updateNewProductItem.checkOptions();

    // re-generate sku
    const { sku, orderedOptions } = updateNewProductItem.generateSKU(
      productItem[0].category_name,
      productItem[0].product_name
    );

    // eslint-disable-next-line no-param-reassign
    data.SKU = sku.join("-");

    variationsIds = await updateNewProductItem.verifyProductItemOptions(
      prismaProducts,
      orderedOptions,
      productItem[0].product_id
    );

    // eslint-disable-next-line no-param-reassign
    delete data.options;
  }

  const updateProductItemTransaction = await updateNewProductItem.updateProductItemTransaction(
    productItemId,
    data,
    variationsIds
  );

  return updateProductItemTransaction;
});

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  createProductItem,
  updateProductItem,
};
