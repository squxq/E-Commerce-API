"use strict";
const express = require("express");
const validate = require("../../../middlewares/validate");
const categoryValidation = require("../../../validations/category.validation");
const { categoryController } = require("../../../controllers");
const { singleFile } = require("../../../utils/multer");
const router = express.Router();
router.post("/create", singleFile("image"), validate(categoryValidation.createCategory), categoryController.createCategory);
router.patch("/update", singleFile("image"), validate(categoryValidation.updateCategory), categoryController.updateCategory);
router.delete("/delete/:categoryId", validate(categoryValidation.deleteCategory), categoryController.deleteCategory);
module.exports = router;
//# sourceMappingURL=category.route.js.map