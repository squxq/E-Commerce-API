const express = require("express");
const validate = require("../../middlewares/validate");
const categoryValidation = require("../../validations/category.validation");
const categoryController = require("../../controllers/category.controller");
const { singleFile } = require("../../utils/multer");

const router = express.Router();

router.post("/create", singleFile("image"), validate(categoryValidation.createCategory), categoryController.createCategory);

module.exports = router;