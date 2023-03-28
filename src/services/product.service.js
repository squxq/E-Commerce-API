const hash = require("object-hash");
const { v4: uuidv4 } = require("uuid");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
const catchAsync = require("../utils/catchAsync");
const { prismaProducts } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { uploadImage, updateName, deleteImage, deleteFolder } = require("../utils/cloudinary");
const parser = require("../utils/parser");
const { Currencies, FxRates } = require("../models");
const convertCurrency = require("../utils/currencyConverter");
const runInTransaction = require("../utils/mongoTransaction");
const { formatName, createSKU } = require("../utils/name-sku");

class CreateProductItem {
  constructor(quantity, price, options, categoryId = null) {
    this.quantity = quantity;
    this.price = price;
    this.options = options;
    this.categoryId = categoryId;
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

    if (allowedOptions.length === 0)
      throw new ApiError(httpStatus.NOT_FOUND, `Category ${this.categoryId} doesnt have any variations!`);

    // validate options object
    Object.entries(this.options).forEach(([key, value]) => {
      const exists = allowedOptions.find((option) => {
        if (option.name === key) {
          if (!option.values.includes(value)) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Wrong variation option provided for: ${key}, value: ${value} does not exist!`
            );
          }
        }
        return option.name === key;
      });

      if (!exists) throw new ApiError(httpStatus.BAD_REQUEST, `Variation ${key} does not exist!`);
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
      throw new ApiError(httpStatus.BAD_REQUEST, `${this.price.currency} is not a valid currency!`);
    });

    if (result.currency === null) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid currency provided!");
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

    if (formattedPrice < 0) throw new ApiError(httpStatus.BAD_REQUEST, "Price must be greater than 0!");

    return formattedPrice;
  }

  // generateSKU
  generateSKU(categoryName, productName, options) {
    const orderedOptions = Object.keys(options || this.options)
      .sort()
      .reduce((obj, key) => {
        // eslint-disable-next-line no-undef, no-param-reassign
        obj[key] = options ? options[key] : this.options[key];
        return obj;
      }, {});

    const names = [categoryName, productName];

    let sku = names.map(function (skuName) {
      return createSKU(skuName);
    });

    sku = sku.concat(
      Object.values(orderedOptions).map((option) => {
        if (option.replace(" ", "").length > 4) {
          return createSKU(option);
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
          INNER JOIN variation AS b
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
        throw new ApiError(httpStatus.BAD_REQUEST, "Different product items cannot have the same variation options.");
      }
    });

    return variationsIds;
  }

  // eslint-disable-next-line class-methods-use-this
  async createProductConfigurations(prisma, variationsIds, productItemId) {
    const date = Date.now();

    const valuesParams = variationsIds.map((id) => [uuidv4(), productItemId, id, date]);

    const configurations = await prisma.$queryRaw`
      INSERT INTO "product_configuration" ("id", "product_item_id", "variation_option_id", "updatedAt")
      VALUES ${Prisma.join(
        valuesParams.map((row) => {
          // eslint-disable-next-line no-param-reassign
          row[row.length - 1] = Prisma.sql`to_timestamp(${row[row.length - 1]} / 1000)`;
          return Prisma.sql`(${Prisma.join(row)})`;
        })
      )}
      RETURNING id, product_item_id, variation_option_id
    `;

    return configurations;
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

  async uploadImages(images, productName = null, productId = null, buffer = null, main = false, categoryName = null) {
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

    const formattedName = formatName(productName);

    const folder = `Products/${formatName(categoryName)}-${formattedName}`;

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
    // products is a product item id
    // first we check for duplicate images

    const images = await prisma.$queryRaw`
      SELECT b.product_id, b.images
      FROM product_item AS b
      WHERE b.id = ${products}
    `;

    const imagesPromise = images[0].images.map(async (publicId) => {
      // each public id and the product id under the name of images[0].product_id
      const result = await prisma.$queryRaw`
        SELECT COUNT(*)::int
        FROM (
          SELECT a.*
          FROM product_item AS a
          WHERE a.product_id = ${images[0].product_id}
            AND ${publicId} = ANY(a.images)
          LIMIT 2
        ) AS b
      `;

      // count === 1 || count === 2
      return {
        publicId,
        count: result[0].count,
      };
    });

    const countResults = await Promise.all(imagesPromise);

    await Promise.all(
      countResults.map(async ({ publicId, count }) => {
        if (count === 1) {
          await deleteImage(publicId);
        }
      })
    );

    // delete product item
    const productItem = await prisma.product_item.delete({
      where: {
        id: products,
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

    return {
      productItem,
    };
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
          images: true,
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

  // change category id
  async updateCategory(prisma, categoryId, productId, save) {
    // check if category exists and has the variations and variation options needed
    // for every product item check their variations options

    // get variation and variation options
    const productVariations = await prisma.$queryRaw`
      SELECT a.product_item_id AS product_item_id,
        array_agg(d.name) AS variation_names,
        array_agg(c.value) AS variation_values
      FROM product_configuration AS a
      INNER JOIN variation_option AS c
      ON c.id = a.variation_option_id
      INNER JOIN variation AS d
      ON d.id = c.variation_id
      WHERE a.product_item_id IN (
        SELECT b.id
        FROM product_item AS b
        WHERE b.product_id = ${productId}
      )
      GROUP BY a.product_item_id
    `;

    // check if new category id has the variations and variations id
    const categoryVariations = await prisma.$queryRaw`
      SELECT a.name AS category_name,
        b.id AS variation_id,
        b.name AS variation_name,
        array_agg(c.value) AS variation_values,
        array_agg(c.id) AS variation_option_ids
      FROM product_category AS a
      INNER JOIN variation AS b
      ON b.category_id = a.id
      INNER JOIN variation_option AS c
      ON c.variation_id = b.id
      WHERE a.id = ${categoryId}
      GROUP BY b.id, a.name
    `;

    if (categoryVariations.length === 0) throw new ApiError(httpStatus.BAD_REQUEST, "Category not found");
    else if (!categoryVariations[0].variation_id)
      throw new ApiError(httpStatus.BAD_REQUEST, "Category has no variations, its not possible to update the product");

    // check if category has enough variations and variation options for all the product items
    const validProducts = productVariations.map(
      ({ product_item_id: id, variation_names: names, variation_values: values }) => {
        // eslint-disable-next-line array-callback-return
        let variations = names.map((name, index) => {
          const match = categoryVariations.find(({ variation_name: variationName, variation_values: variationValues }) => {
            return variationName === name && variationValues.includes(values[index]);
          });

          if (match) {
            return {
              variationId: match.variation_id,
              name,
              value: values[index],
              variationOptionId: match.variation_option_ids[index],
            };
          }
        });

        variations = variations.filter((variation) => variation !== undefined);

        if (save && variations.length !== names.length) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Its not possible to save all resources due to the new product category not having the variations: ${names.join(
              ", "
            )} with the variation options: ${values.join(", ")}`
          );
        }

        return {
          id,
          delete: variations.length === 0,
          ...(variations.length > 0 && { variations }),
        };
      }
    );

    // save === false => check if there is at least one product item that can be saved
    if (!validProducts.find(({ delete: toDelete }) => toDelete === false)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Product cannot be updated to the specified category because no product item can be saved"
      );
    }

    // check options because on deleting some variations from the products they may have the same variation options
    // only for save === false because its only here that we delete variations
    const options = validProducts.map(({ variations }) => {
      // variations is an array
      return variations
        .map((variationObj) => variationObj.variationOptionId)
        .sort()
        .join(",");
    });

    if (Array.from(new Set(options)).length !== options.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Result from deleting variations such that product items can be saved, is that some product_items have the same variation options, which is not allowed`
      );
    }

    // 2 options: all product items have delete: false and all its variations are allowed in the target category || one product item has delete: false
    // we just have to move the product to the target category and delete and create the product_configurations

    // delete all product_configurations
    await prisma.product_configuration.deleteMany({
      where: {
        product_item_id: {
          in: validProducts.map(({ id }) => id),
        },
      },
    });

    // create product configurations
    const updatedProductConfigurations = validProducts.map(({ id, delete: toDelete, variations }) => {
      if (!toDelete) {
        // variations => { variationId, name, value}
        // find variation option such that variation_id === variationId, variation name === name and variation option value === value
        const productConfigurations = variations.map(async (variation) => {
          const newVariation = await prisma.$queryRaw`
                SELECT b.id AS id
                FROM variation AS a
                INNER JOIN variation_option AS b
                ON b.variation_id = a.id AND b.value = ${variation.value}
                WHERE a.id = ${variation.variationId} AND a.name = ${variation.name}
              `;

          if (newVariation.length === 0) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Something went wrong", false);

          return prisma.product_configuration.create({
            data: {
              product_item_id: id,
              variation_option_id: newVariation[0].id,
            },
            select: {
              id: true,
              product_item_id: true,
              variation_option_id: true,
            },
          });
        });

        return Promise.all(productConfigurations);
      }

      // delete product item
      return this.deleteProductItems(prisma, id);
    });

    return {
      categoryName: categoryVariations[0].category_name,
      productConfigs: await Promise.all(updatedProductConfigurations),
    };
  }

  // delete product
  async deleteProductTransaction(productId) {
    const deleteNewProductTransaction = await prismaProducts.$transaction(async (prisma) => {
      // validate product id
      const product = await prisma.$queryRaw`
        SELECT product_id,
          product_public_id,
          product_item_ids,
          array_agg(col ORDER BY col) AS product_item_public_ids,
          product_configuration_ids
        FROM (
          SELECT a.id AS product_id,
              a.image AS product_public_id,
              array_agg(b.id) AS product_item_ids,
            unnest(b.images) AS col,
            array_agg(c.id) AS product_configuration_ids
          FROM product AS a
          INNER JOIN product_item AS b
          ON b.product_id = a.id
          INNER JOIN product_configuration AS c
          ON c.product_item_id = b.id
          WHERE a.id = ${productId}
          GROUP BY a.id, b.images
        ) AS t
        GROUP BY t.product_id, t.product_public_id, t.product_item_ids, t.product_configuration_ids
      `;

      if (product.length === 0) throw new ApiError(httpStatus.BAD_REQUEST, `Product: ${productId} not found`);

      // delete all product items and their images from cloudinary
      const productItems = await this.deleteProductItems(prisma, product[0], true);

      // delete product folder from cloudinary
      await deleteFolder(product[0].product_public_id.substring(0, product[0].product_public_id.lastIndexOf("/")));

      // delete product itself
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
        product: deletedProduct,
        ...productItems,
      };
    });

    return deleteNewProductTransaction;
  }

  // eslint-disable-next-line class-methods-use-this
  async checkImages(images, productId) {
    // check for existing images in the product folder
    const imageArray = await prismaProducts.$queryRaw`
      SELECT * FROM (
        SELECT image
        FROM product
        WHERE id = ${productId}

      UNION ALL

        SELECT unnest(images)
        FROM product_item
        WHERE product_id = ${productId}
      ) AS a
    `;

    let newImageArray = Array.from(new Set(imageArray.map((row) => row.image)));
    const providedImages = images.map((image) => hash(parser(image).content, { algorithm: "md5" }));

    const existingImages = newImageArray.filter(
      (image) => providedImages.indexOf(image.substring(image.length - 32)) !== -1
    );

    newImageArray = newImageArray.map((publicId) => publicId.substring(publicId.length - 32));
    const toUploadHashArray = providedImages.filter((image) => newImageArray.indexOf(image) === -1);

    const toUploadImages = images.filter(
      (image) => toUploadHashArray.indexOf(hash(parser(image).content, { algorithm: "md5" })) !== -1
    );

    return {
      toUpload: toUploadImages,
      existing: existingImages,
    };
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
  const createNewProduct = new CreateProductItem(quantity, price, options, categoryId);

  // check name
  const names = await prismaProducts.$queryRaw`
    SELECT name AS name
    FROM product
    WHERE category_id = ${categoryId}
  `;

  if (names.find((existingName) => formatName(existingName.name) === formatName(name))) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Duplicate product name provided! ${name} is already in use.`);
  }

  // check the allowed options for product configuration
  const categoryName = await createNewProduct.checkOptions();

  // check and format the price
  const formattedPrice = await createNewProduct.checkPrice();

  // check for a main image
  if (images.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No images provided!");
  }

  let mainImage;
  let hasMain = false;
  if (images.find((image) => image.fieldname === "main")) {
    mainImage = images.find((image) => image.fieldname === "main");
    images.splice(images.indexOf(mainImage), 1);
    images.unshift(mainImage);
    hasMain = true;

    if (images.length === 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No product item images provided!");
    }
  }

  // upload images
  const imagesArray = await createNewProduct.uploadImages(images, name, null, null, false, categoryName);
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
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Duplicate product name provided! ${createNewProductTransaction.name} is already in use.`
          );
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
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided!");
  }

  // validate product id
  const product = await prismaProducts.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      name: true,
      image: true,
    },
  });

  if (!product) throw new ApiError(httpStatus.BAD_REQUEST, `Product: ${productId} not found!`);
  const { name } = product;

  if (data.name) {
    if (formatName(data.name) === formatName(name)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Duplicate product name provided! ${data.name} is already in use.`);
    }
    // eslint-disable-next-line no-param-reassign
    delete data.name;
  }

  // validate image
  if (image) {
    const publicId = await updateNewProduct.validateImage(image, productId, name);
    // eslint-disable-next-line no-param-reassign
    data.image = publicId;
  }

  const updateProductCategoryTransaction = await prismaProducts.$transaction(async (prisma) => {
    const result = await prisma.product.update({
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

    if (data.image) {
      const newPublicId = `${product.image.substring(0, product.image.lastIndexOf("/") + 1)}${product.image
        .substring(product.image.lastIndexOf("/") + 1)
        .replace("main_", "")}`;
      // if the old main image is not used no more in any product item delete it in cloudinary
      const itemImages = await prisma.$queryRaw`
        SELECT id
        FROM product_item
        WHERE ${newPublicId} = ANY(images)
      `;

      if (itemImages.length === 0) {
        await deleteImage(newPublicId);
      }
    }

    let productItems;
    if (data.name) {
      // re-generate sku(s) for all product items
      // for all product items that have product_id === productId
      // change sku from 1st "-" to 2nd "-" with createSKU(data.name)
      const newSKU = updateNewProduct.createSKU(data.name);

      productItems = await prisma.$queryRaw`
          UPDATE product_item AS p
          SET "SKU" = regexp_replace("SKU", split_part("SKU", '-', 2), ${newSKU})
          WHERE p.product_id = ${productId}
          RETURNING p.id, p.product_id, "SKU", "QIS", p.images, p.price
        `;
    }

    return {
      product: result,
      [productItems && (productItems.length === 1 ? "productItem" : "productItems")]: productItems,
    };
  });

  return updateProductCategoryTransaction;
});

/**
 * @desc Delete a product
 * @param { String } productId
 * @returns { Object }
 */
const deleteProduct = catchAsync(async (productId) => {
  const deleteNewProduct = new CreateProductItem();

  return deleteNewProduct.deleteProductTransaction(productId);
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
    select: {
      category_id: true,
      name: true,
    }, // product object inside category_id: the actual id
  });

  if (!product) throw new ApiError(httpStatus.NOT_FOUND, `Product: ${productId} not found!`);

  // Initialize createNewProductItem class
  const createNewProductItem = new CreateProductItem(quantity, price, options, product.category_id);

  // check the allowed options for product configuration
  const categoryName = await createNewProductItem.checkOptions();

  // check and format the price
  const formattedPrice = await createNewProductItem.checkPrice();

  // upload images
  if (images.length < 1) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No images provided!");
  }

  const { toUpload, existing } = await createNewProductItem.checkImages(images, productId);
  let imagesArray = await createNewProductItem.uploadImages(toUpload, product.name, null, null, false, categoryName);
  const productName = imagesArray[imagesArray.length - 1];
  imagesArray.pop();

  imagesArray = [...existing, ...imagesArray];

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
 * @param { Object } query
 * @property { String } data.productItemId
 * @returns { Object }
 */
const updateProductItem = catchAsync(async (data, images, query) => {
  // query(example): {images: add, qunatity: add}
  const { productItemId } = data;
  // eslint-disable-next-line no-param-reassign
  delete data.productItemId;

  // validate data object for something to update
  if (images.length === 0 && Object.keys(data).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided!");
  }

  // validate product item id
  const productItem = await prismaProducts.$queryRaw`
    SELECT b.id AS product_id,
      b.name AS product_name,
      c.id AS category_id,
      c.name AS category_name,
      a."QIS" AS item_quantity,
      a.images AS item_images,
      b.image AS product_image
    FROM product_item AS a
    INNER JOIN product AS b
    ON b.id = a.product_id
    INNER JOIN product_category AS c
    ON c.id = b.category_id
    WHERE a.id = ${productItemId}
  `;

  if (productItem.length === 0) throw new ApiError(httpStatus.NOT_FOUND, `Product Item: ${productItemId} not found!`);

  const updateNewProductItem = new CreateProductItem(data.quantity, data.price, data.options, productItem[0].category_id);

  if (data.quantity) {
    if (query.quantity === "add") {
      // eslint-disable-next-line no-param-reassign
      data.QIS = Math.floor(data.quantity) + productItem[0].item_quantity;
    } else if (query.quantity === "replace") {
      // eslint-disable-next-line no-param-reassign
      data.QIS = Math.floor(data.quantity);
    }

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

  if (images.length > 0) {
    const { toUpload, existing } = await updateNewProductItem.checkImages(images, productItem[0].product_id);
    let imagesArray = await updateNewProductItem.uploadImages(
      toUpload,
      productItem[0].product_name,
      null,
      null,
      false,
      productItem[0].category_name
    );
    imagesArray.pop();

    imagesArray = [...existing, ...imagesArray];

    if (query.images === "add") {
      // add images to the product image array
      // eslint-disable-next-line no-param-reassign
      data.images = Array.from(new Set(productItem[0].item_images.concat(imagesArray)));
    } else if (query.images === "replace") {
      // replace entirely the product image array
      // eslint-disable-next-line no-param-reassign
      data.images = imagesArray;
    }
  }

  const updateProductItemTransaction = await updateNewProductItem.updateProductItemTransaction(
    productItemId,
    data,
    variationsIds
  );

  return {
    ...updateProductItemTransaction,
  };
});

/**
 * @desc Delete a product item
 * @param { String } productItemId
 * @param { Boolean } save
 * @returns { Object }
 */
const deleteProductItem = catchAsync(async (productItemId, save) => {
  const deleteNewProductItem = new CreateProductItem();

  // validate product item
  const validateProductItem = await prismaProducts.$queryRaw`
      WITH product_item_id AS (
        SELECT a.id, a.product_id
        FROM product_item AS a
        WHERE a.id = ${productItemId}
      )

      SELECT (SELECT id FROM product_item_id) AS item_id,
        array_agg(b.id) AS other_items,
        (SELECT product_id FROM product_item_id) AS product_id
      FROM product_item AS b
      WHERE b.product_id = (SELECT product_id FROM product_item_id)
        AND b.id != (SELECT id FROM product_item_id)
    `;

  if (validateProductItem.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Product Item: ${productItemId} not found!`);
  }

  // check if there are any more product items and what value does save has
  if (!validateProductItem[0].other_items) {
    if (save) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Its not possible to save the product, due to the fact that this is the only product item left. Change: save=false or add another product item to this product."
      );
    }

    // delete the product itself
    return deleteNewProductItem.deleteProductTransaction(validateProductItem[0].product_id);
  }

  const deleteProductItemTransaction = await prismaProducts.$transaction(async (prisma) => {
    // delete product configurations
    const productConfigurations = await prisma.$queryRaw`
        DELETE FROM product_configuration
        WHERE product_item_id = ${productItemId}
        RETURNING id, product_item_id, variation_option_id
      `;

    // delete product item itself
    const { productItem } = await deleteNewProductItem.deleteProductItems(prisma, productItemId);

    return {
      productItem,
      [productConfigurations.length === 1 ? "productConfiguration" : "productConfigurations"]: productConfigurations,
    };
  });

  return deleteProductItemTransaction;
});

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  createProductItem,
  updateProductItem,
  deleteProductItem,
};
