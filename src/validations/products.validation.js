const Joi = require("joi");

const createCategory = {
  body: Joi.object().keys({
    categoryName: Joi.string().required(),
    parentCategoryId: Joi.string(),
  }),
};

module.exports = {
  createCategory,
};
