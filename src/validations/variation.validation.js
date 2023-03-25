const Joi = require("joi");

const createVariation = {
  body: Joi.object().keys({
    categoryId: Joi.string()
      .required()
      .label("Category Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    name: Joi.string().required().label("Name"),
    value: Joi.string().label("Variation Option"),
    values: Joi.array()
      .items(Joi.string().required().label("Variation Option"), Joi.string().label("Variation Option"))
      .label("Variation Options"),
  }),
};

const updateVariation = {
  body: Joi.object().keys({
    variationId: Joi.string()
      .required()
      .label("Variation Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    name: Joi.string().label("Name"),
  }),
};

const deleteVariation = {
  params: Joi.object().keys({
    variationId: Joi.string()
      .required()
      .label("Variation Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
  }),
  query: Joi.object().keys({
    save: Joi.boolean().default(true).label("Save Products"),
  }),
};

const createVariationOptions = {
  body: Joi.object().keys({
    variationId: Joi.string()
      .required()
      .label("Variation Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    value: Joi.string().label("Variation Option"),
    values: Joi.array()
      .items(Joi.string().label("Variation Option").required(), Joi.string().label("Variation Option"))
      .label("Values"),
  }),
};

const updateVariationOption = {
  body: Joi.object().keys({
    optionId: Joi.string()
      .required()
      .label("Option Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    value: Joi.string().label("New Variation Option value"),
  }),
};

const deleteVariationOptions = {
  params: Joi.object().keys({
    optionId: Joi.string()
      .required()
      .label("Option Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
  }),
  query: Joi.object().keys({
    save: Joi.boolean().default(true).label("Save Products"),
  }),
};

module.exports = {
  createVariation,
  updateVariation,
  deleteVariation,
  createVariationOptions,
  updateVariationOption,
  deleteVariationOptions,
};
