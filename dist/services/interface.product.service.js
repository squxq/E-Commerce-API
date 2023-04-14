"use strict";
const catchAsync = require("../utils/catchAsync");
const getProduct = catchAsync(async () => {
    return { product: "someproduct" };
});
module.exports = {
    getProduct,
};
//# sourceMappingURL=interface.product.service.js.map