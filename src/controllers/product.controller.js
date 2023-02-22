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
  const { categoryId, name, description } = req.body;

  const result = await productService.createProduct(categoryId, name, description);

  return res.status(httpStatus.CREATED).json({
    type: "Success",
    message: [
      req.polyglot.t("successfulProductCreate"),
      "Please create your product variants, such that it can be released to public.",
    ],
    output: result,
  });
});

module.exports = {
  createProduct,
};
