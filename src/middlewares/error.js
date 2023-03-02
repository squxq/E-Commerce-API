const mongoose = require("mongoose");
const httpStatus = require("http-status");
const { Prisma } = require("@prisma/client");
const config = require("../config/config");
const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof mongoose.Error || error instanceof Prisma.PrismaClientKnownRequestError
        ? httpStatus.BAD_REQUEST
        : httpStatus.INTERNAL_SERVER_ERROR;
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.meta.message.charAt(0).toUpperCase() + error.meta.message.substring(1)
        : error.message.replace(/"/g, "'") || httpStatus[statusCode];

    const isOperational = !!(error instanceof mongoose.Error || error instanceof Prisma.PrismaClientKnownRequestError);
    error = new ApiError(statusCode, message, isOperational, err.stack);
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === "production" && err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }
  message = message.replace(/"/g, "'");

  res.locals.errorMessage = err.message;

  const response = {
    type: "Error",
    code: statusCode,
    message,
    ...(config.env === "development" && { isOperational: err.isOperational }),
    ...(config.env === "development" && { stack: err.stack.replace(/"/g, "'") }),
  };

  if (config.env === "development") {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
