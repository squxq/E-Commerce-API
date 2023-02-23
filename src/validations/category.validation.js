const Joi = require("joi");

const createCategory = {
  body: Joi.object().keys({
    categoryName: Joi.string().required(),
    parentCategoryId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }),
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
    .required(),
};

const updateCategory = {
  body: Joi.object().keys({
    categoryId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] }),
    parentCategoryId: Joi.string(),
    categoryName: Joi.string(),
    categoryDescription: Joi.string(),
  }),
  file: Joi.object().keys({
    fieldname: Joi.string(),
    originalname: Joi.string(),
    encoding: Joi.string(),
    mimetype: Joi.string(),
    buffer: Joi.binary().encoding("base64"),
    size: Joi.number(),
  }),
};

const deleteCategory = {
  params: Joi.object().keys({
    categoryId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] }),
  }),
};

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
};
