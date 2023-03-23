const Joi = require("joi");

const createProduct = {
  body: Joi.object().keys({
    categoryId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Category Id"),
    name: Joi.string().required().label("Name"),
    description: Joi.string().required().label("Description"),
    quantity: Joi.number().integer().required().greater(0).label("Quantity in Stock"),
    price: Joi.object()
      .keys({
        value: Joi.string().required().label("Price value"),
        currency: Joi.string().required().label("Currency ISO"),
      })
      .required()
      .label("Product's price"),
    options: Joi.object().required().label("Variation Options"),
  }),
  files: Joi.array()
    .items(
      Joi.object()
        .keys({
          fieldname: Joi.string().required(),
          originalname: Joi.string(),
          encoding: Joi.string().required(),
          mimetype: Joi.string().required(),
          buffer: Joi.binary().encoding("base64").required(),
          size: Joi.number().required(),
        })
        .required()
        .label("Image")
    )
    .required()
    .max(10)
    .label("Images"),
};

const updateProduct = {
  body: Joi.object().keys({
    productId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Product Id"),
    categoryId: Joi.string()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Category Id"),
    name: Joi.string().label("Product Name"),
    description: Joi.string().label("Product Description"),
  }),
  file: Joi.object()
    .keys({
      fieldname: Joi.string().required(),
      originalname: Joi.string(),
      encoding: Joi.string().required(),
      mimetype: Joi.string().required(),
      buffer: Joi.binary().encoding("base64").required(),
      size: Joi.number().required(),
    })
    .label("Product Image"),
  query: Joi.object().keys({
    save: Joi.boolean().default(true).label("Save Resources"),
  }),
};

// its not possible to save resources when deleting a product
const deleteProduct = {
  params: Joi.object().keys({
    productId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Product Id"),
  }),
};

const createProductItem = {
  body: Joi.object().keys({
    productId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Product Id"),
    quantity: Joi.number().integer().required().greater(0).label("Quantity in Stock"),
    price: Joi.object()
      .keys({
        value: Joi.string().required().label("Price value"),
        currency: Joi.string().required().label("Currency ISO"),
      })
      .required()
      .label("Product's price"),
    options: Joi.object().required().label("Variation Options"),
  }),
  files: Joi.array()
    .items(
      Joi.object()
        .keys({
          fieldname: Joi.string().required(),
          originalname: Joi.string(),
          encoding: Joi.string().required(),
          mimetype: Joi.string().required(),
          buffer: Joi.binary().encoding("base64").required(),
          size: Joi.number().required(),
        })
        .required()
        .label("Image")
    )
    .required()
    .label("Images"),
};

const updateProductItem = {
  body: Joi.object().keys({
    productItemId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Product Item Id"),
    produductId: Joi.string()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Product Id"),
    quantity: Joi.number().integer().greater(0).label("Quantity in Stock"),
    price: Joi.object()
      .keys({
        value: Joi.string().required().label("Price value"),
        currency: Joi.string().required().label("Currency ISO"),
      })
      .label("Product's price"),
    options: Joi.object().label("Variation Options"),
  }),
  files: Joi.array()
    .items(
      Joi.object()
        .keys({
          fieldname: Joi.string().required(),
          originalname: Joi.string(),
          encoding: Joi.string().required(),
          mimetype: Joi.string().required(),
          buffer: Joi.binary().encoding("base64").required(),
          size: Joi.number().required(),
        })
        .required()
        .label("Image")
    )
    .label("Images"),
  query: Joi.object().keys({
    images: Joi.string().default("add").valid("add", "replace").label("Add or Replace Images"),
    quantity: Joi.string().default("add").valid("add", "replace").label("Add or Replace Quantity in Stock"),
    save: Joi.boolean().default(true).label("Save Product Item"),
  }),
};

const deleteProductItem = {
  params: Joi.object().keys({
    productItemId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Product Item Id"),
  }),
  query: Joi.object().keys({
    save: Joi.boolean().default(true).label("Save Product"),
  }),
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  createProductItem,
  updateProductItem,
  deleteProductItem,
};
