const express = require("express");
const validate = require("../../../middlewares/validate");
const productController = require("../../../controllers/product.controller");
const productValidation = require("../../../validations/product.validation");

const router = express.Router();

router.get("/get", validate(productValidation.getProducts), productController.getProducts);
router.get("/get/item/:productItemId", validate(productValidation.getProductItem), productController.getProductItem);

module.exports = router;
