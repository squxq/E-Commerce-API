const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { inboundProductService, interfaceProductService } = require("../services");
// eslint-disable-next-line import/no-unresolved, import/extensions
const { ProducerService } = require("../config/kafka");
const { Products, Ids } = require("../models");
const { RegisterClass } = require("../models/plugins");
const { kafka } = require("../config/config");

// inbound

const producer = new ProducerService();
const register = new RegisterClass(kafka.schemaHost, kafka.schemaKey, kafka.schemaSecret);

/**
 * @desc Create a new Product Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @property { Object } req.files
 * @returns { JSON }
 */
const createProduct = catchAsync(async (req, res) => {
  const result = await inboundProductService.createProduct(req.body, req.files);

  if ("product" in result) {
    const encodedPayload = await register.encodePayload(Products.avro.productCreate, {
      name: result.product.name,
      description: result.product.description,
      image: result.product.image,
      brand: result.product.brand,
      category: result.category,
      variants: {
        id: result.productItem.id,
        price: result.productItem.price,
        ...result.variants,
      },
    });

    await producer.produce("Products", {
      key: await register.encodePayload(Ids, { id: result.product.id, action: "CREATE", content: "PRODUCT" }),
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
  const result = await inboundProductService.updateProduct(req.body, req.file);

  if ("product" in result) {
    const encodedPayload = await register.encodePayload(Products.avro.productUpdate, {
      changes: result.changes,
    });

    await producer.produce("Products", {
      key: await register.encodePayload(Ids, { id: result.product.id, action: "UPDATE", content: "PRODUCT" }),
      value: encodedPayload,
    });
  }

  delete result.changes;

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
  const result = await inboundProductService.deleteProduct(req.params.productId);

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
  const result = await inboundProductService.createProductItem(productId, quantity, price, options, req.files);

  if ("productItem" in result) {
    const encodedPayload = await register.encodePayload(Products.avro.productItemCreate, {
      variants: {
        id: result.productItem.id,
        price: result.productItem.price,
        ...result.variants,
      },
    });

    await producer.produce("Products", {
      key: await register.encodePayload(Ids, { id: result.productItem.product_id, action: "CREATE", content: "ITEM" }),
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
  const result = await inboundProductService.updateProductItem(req.body, req.files);

  if ("productItem" in result) {
    const encodedPayload = await register.encodePayload(Products.avro.productItemUpdate, {
      changes: {
        id: result.productItem.id,
        price: result.price || null,
        ...(result.options || {}),
      },
    });

    await producer.produce("Products", {
      key: await register.encodePayload(Ids, { id: result.productItem.product_id, action: "UPDATE", content: "ITEM" }),
      value: encodedPayload,
    });
  }

  delete result.price;
  delete result.options;

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
  const result = await inboundProductService.deleteProductItem(req.params.productItemId, req.query.save);

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: req.polyglot.t("successProductItemDelete"),
    output: result,
  });
});

// interface

const getProduct = catchAsync(async (req, res) => {
  const result = await interfaceProductService.getProduct();

  return res.status(httpStatus.OK).json({
    type: "Success",
    message: req.polyglot.t("successProductGetSingle"),
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
  getProduct,
};
