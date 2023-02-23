const Joi = require("joi");

const createVariation = {
  body: Joi.object().keys({
    categoryId: Joi.string()
      .required()
      .label("Category Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    name: Joi.string().required().label("Name"),
  }),
};

const updateVariation = {
  body: Joi.object().keys({
    variationId: Joi.string()
      .required()
      .label("Variation Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    name: Joi.string().label("Name"),
    categoryId: Joi.string().label("Category Id"),
  }),
};

const deleteVariation = {
  params: Joi.object().keys({
    variationId: Joi.string()
      .required()
      .label("Variation Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
  }),
};

const createVariationOptions = {
  body: Joi.object().keys({
    variationId: Joi.string()
      .required()
      .label("Variation Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    values: Joi.array()
      .items(Joi.string().label("Variation Option").required(), Joi.string().label("Variation Option"))
      .required()
      .label("Values"),
  }),
};

const updateVariationOption = {
  body: Joi.object().keys({
    optionId: Joi.string()
      .required()
      .label("Option Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    variationId: Joi.string()
      .label("Variation Id")
      .guid({ version: ["uuidv4", "uuidv5"] }),
    value: Joi.string().label("New option value"),
  }),
};

const deleteVariationOptions = {
  body: Joi.object().keys({
    ids: Joi.array()
      .items(
        Joi.string()
          .required()
          .label("Variation Option Id")
          .guid({ version: ["uuidv4", "uuidv5"] }),
        Joi.string()
          .label("Variation Option Id")
          .guid({ version: ["uuidv4", "uuidv5"] })
      )
      .required()
      .label("Variation Option Ids"),
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
