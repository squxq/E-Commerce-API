const Joi = require("joi");

const createProduct = {
  body: Joi.object().keys({
    categoryId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Category Id"),
    name: Joi.string().required().label("Name"),
    description: Joi.string().required().label("Description"),
    // quantity: Joi.number().required().greater(0).label("Quantity in Stock"),
    // price: Joi.number().required().greater(0).label("Price"),
  }),
  // files: Joi.array().items(Joi.object().required().label("Image")).required().max(10).label("Images"),
};

module.exports = { createProduct };
