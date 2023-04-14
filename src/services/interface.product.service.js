const catchAsync = require("../utils/catchAsync");

const getProduct = catchAsync(async () => {
  return { product: "someproduct" };
});

module.exports = {
  getProduct,
};
