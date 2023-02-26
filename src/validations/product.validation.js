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

module.exports = { createProduct };
