const express = require("express");
const validate = require("../../middlewares/validate");
const authValidation = require("../../validations/auth.validation");
const authController = require("../../../inbound/controllers/auth.controller");
// const auth = require("../../middlewares/auth");

const router = express.Router();

router.post("/register", validate(authValidation.register), authController.register);

module.exports = router;
