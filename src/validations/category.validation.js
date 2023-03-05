const Joi = require("joi");

const createCategory = {
  body: Joi.object().keys({
    name: Joi.string().required().label("Category Name"),
    parentId: Joi.string()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Parent Id"),
    description: Joi.string().label("Category Description"),
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
    .required()
    .label("Category Image"),
};

const updateCategory = {
  body: Joi.object().keys({
    categoryId: Joi.string()
      .required()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .label("Category Id"),
    parentId: Joi.string().label("Parent Id"),
    name: Joi.string().label("Category Name"),
    description: Joi.string().label("Category Description"),
  }),
  file: Joi.object()
    .keys({
      fieldname: Joi.string(),
      originalname: Joi.string(),
      encoding: Joi.string(),
      mimetype: Joi.string(),
      buffer: Joi.binary().encoding("base64"),
      size: Joi.number(),
    })
    .label("Category Image"),
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
