const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { productService } = require("../services");

/**
 * @desc Create a new Product Controller
 * @param { Object } req
 * @param { Object } res
 * @property { Object } req.body
 * @property { Object } req.files
 * @returns { JSON }
 */
const createProduct = catchAsync(async (req, res) => {
  const result = await productService.createProduct(req.body, req.files);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: [req.polyglot.t("successfulProductCreate")],
    output: result,
  });
});

module.exports = {
  createProduct,
};
