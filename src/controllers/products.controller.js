const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");

/**
 * @desc Create New Product Controller
 * @param {Object} req
 * @param {Object} res
 * @property {Object} req.body
 * @returns { JSON }
 */
const create = catchAsync(async (req, res) => {
  //
});

module.exports = {
  create,
};
