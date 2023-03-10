const express = require("express");
const validate = require("../../middlewares/validate");
const productController = require("../../controllers/product.controller");
const productValidation = require("../../validations/product.validation");
const { anyFile } = require("../../utils/multer");

const router = express.Router();

router.post("/create", anyFile(), validate(productValidation.createProduct), productController.createProduct);
router.post("/create/item", anyFile(), validate(productValidation.createProductItem), productController.createProductItem);

module.exports = router;
