const Joi = require("joi");

const createCategory = {
  body: Joi.object().keys({
    categoryName: Joi.string().required(),
    parentCategoryId: Joi.string(),
  }),
  file: Joi.object().keys({
    fieldname: Joi.string().required(),
    originalname: Joi.string(),
    encoding: Joi.string().required(),
    mimetype: Joi.string().required(),
    buffer: Joi.binary().encoding("base64").required(),
    size: Joi.number().required(),
  }),
};

module.exports = {
  createCategory,
};
