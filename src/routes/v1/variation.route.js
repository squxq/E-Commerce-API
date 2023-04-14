const express = require("express");
const validate = require("../../middlewares/validate");
const variationValidation = require("../../validations/variation.validation");
const { variationController } = require("../../controllers");

const router = express.Router();

router.post("/create", validate(variationValidation.createVariation), variationController.createVariation);
router.patch("/update", validate(variationValidation.updateVariation), variationController.updateVariation);
router.delete("/delete/:variationId", validate(variationValidation.deleteVariation), variationController.deleteVariation);

router.post(
  "/create/option",
  validate(variationValidation.createVariationOptions),
  variationController.createVariationOptions
);
router.patch(
  "/update/option",
  validate(variationValidation.updateVariationOption),
  variationController.updateVariationOption
);
router.delete(
  "/delete/option/:optionId",
  validate(variationValidation.deleteVariationOptions),
  variationController.deleteVariationOptions
);

module.exports = router;
