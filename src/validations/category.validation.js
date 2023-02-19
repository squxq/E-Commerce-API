const Joi = require("joi");

const createCategory = {
  body: Joi.object().keys({
    categoryName: Joi.string().required(),
    parentCategoryId: Joi.string(),
  }),
  file: Joi.object(),
};

module.exports = {
  createCategory,
};
