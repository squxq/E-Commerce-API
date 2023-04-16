// eslint-disable-next-line import/no-unresolved
const { Search } = require("./interface.product.service");

module.exports.tokenService = require("./token.service");
module.exports.userService = require("./user.service");
module.exports.categoryService = require("./category.service");
module.exports.inboundProductService = require("./inbound.product.service");
module.exports.variationService = require("./variation.service");

module.exports.InterfaceProductService = Search;
