const express = require("express");
const validate = require("../../middlewares/validate");
const productController = require("../../../inbound/controllers/product.controller");
const productValidation = require("../../validations/product.validation");
const { anyFile, singleFile } = require("../../utils/multer");

const router = express.Router();

router.post("/create", anyFile(), validate(productValidation.createProduct), productController.createProduct);
router.patch("/update", singleFile("image"), validate(productValidation.updateProduct), productController.updateProduct);
router.delete("/delete/:productId", validate(productValidation.deleteProduct), productController.deleteProduct);

router.post("/create/item", anyFile(), validate(productValidation.createProductItem), productController.createProductItem);
router.patch("/update/item", anyFile(), validate(productValidation.updateProductItem), productController.updateProductItem);
router.delete(
  "/delete/item/:productItemId",
  validate(productValidation.deleteProductItem),
  productController.deleteProductItem
);

module.exports = router;
