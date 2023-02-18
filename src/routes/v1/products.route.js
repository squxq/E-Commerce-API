const express = require("express");
const validate = require("../../middlewares/validate");
const productsValidation = require("../../validations/products.validation");
const productsController = require("../../controllers/products.controller");

const router = express.Router();

router.post("/create", validate(productsValidation.createCategory), productsController.createCategory);

module.exports = router;
