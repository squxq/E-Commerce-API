"use strict";
const express = require("express");
const validate = require("../../../middlewares/validate");
const productController = require("../../../controllers/product.controller");
const productValidation = require("../../../validations/product.validation");
const router = express.Router();
router.get("/get/:productId", validate(productValidation.getProduct), productController.getProduct);
module.exports = router;
//# sourceMappingURL=product.route.js.map