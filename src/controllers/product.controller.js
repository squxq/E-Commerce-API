const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { productService } = require("../services");
const { ProducerService } = require("../../dist/config/kafka");
const { Products, ProductItems } = require("../models");
const { RegisterClass } = require("../models/plugins");

const producer = new ProducerService();

/**
 * @desc Create a new Product Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @property { Object } req.files
 * @returns { JSON }
 */
const createProduct = catchAsync(async (req, res) => {
  const result = await productService.createProduct(req.body, req.files);

  if (result.hasOwnProperty("product")) {
    const encodedPayload = await RegisterClass.encodePayload(Products, {
      name: result.product.name,
      description: result.product.description,
      category: result.category,
      variants: {
        ...result.variants,
        price: result.productItem.price,
      },
    });

    await producer.produce("Products", {
      key: result.product.id,
      value: encodedPayload,
    });
  }

  delete result.category;
  delete result.variants;

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: req.polyglot.t("successProductCreate"),
    output: result,
  });
});

/**
 * @desc Update a Product Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @property { String } req.productId
 * @property { Object } req.file
 * @returns { JSON }
 */
const updateProduct = catchAsync(async (req, res) => {
  const result = await productService.updateProduct(req.body, req.file);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: req.polyglot.t("successProductUpdate"),
    output: result,
  });
});

/**
 * @desc Delete a Product Controller
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.params.productId
 * @returns { JSON }
 */
const deleteProduct = catchAsync(async (req, res) => {
  const result = await productService.deleteProduct(req.params.productId);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: req.polyglot.t("successProductDelete"),
    output: result,
  });
});

/**
 * @desc Create a new Product Item Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @property { Object } req.files
 * @property { String } req.body.productId
 * @property { Number } req.body.quantity
 * @property { Object } req.body.price
 * @property { Object } req.body.options
 * @returns { JSON }
 */
const createProductItem = catchAsync(async (req, res) => {
  const { productId, quantity, price, options } = req.body;
  const result = await productService.createProductItem(productId, quantity, price, options, req.files);

  if (result.hasOwnProperty("productItem")) {
    const encodedPayload = await RegisterClass.encodePayload(ProductItems, {
      variants: {
        ...result.variants,
        price: result.productItem.price,
      },
    });

    await producer.produce("ProductItems", {
      key: result.productItem.product_id,
      value: encodedPayload,
    });
  }

  delete result.variants;

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: req.polyglot.t("successProductItemCreate"),
    output: result,
  });
});

/**
 * @desc Update a Product Item Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @property { Object } req.files
 * @property { String } req.body.productItemId
 * @returns { JSON }
 */
const updateProductItem = catchAsync(async (req, res) => {
  const result = await productService.updateProductItem(req.body, req.files);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: req.polyglot.t("successProductItemUpdate"),
    output: result,
  });
});

/**
 * @desc Delete Product Item Controller
 * @param { Object } req
 * @param { Object } res
 * @property { String } req.params.productItemId
 * @property { Boolean } req.query.save
 * @returns { JSON }
 */
const deleteProductItem = catchAsync(async (req, res) => {
  const result = await productService.deleteProductItem(req.params.productItemId, req.query.save);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: req.polyglot.t("successProductItemDelete"),
    output: result,
  });
});

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  createProductItem,
  updateProductItem,
  deleteProductItem,
};
