const express = require("express");
const helmet = require("helmet");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const cors = require("cors");
const httpStatus = require("http-status");
const createLocaleMiddleware = require("express-locale");
const config = require("./config/config");
const morgan = require("./config/morgan");

const { authLimiter } = require("./middlewares/rateLimiter");
const { errorConverter, errorHandler } = require("./middlewares/error");
const ApiError = require("./utils/ApiError");
const startPolyglot = require("./utils/startPolyglot");
const routes = require("./routes/inbound/v1");

const app = express();
if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json({ limit: "10kb" }));

// parse urlencoded request body
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Get the user's locale, and set a default in case there's none
app.use(
  createLocaleMiddleware({
    priority: ["accept-language", "default"],
    default: "en_US",
  })
);

// Start polyglot and set the language in the req with the phrases to be used
app.use(startPolyglot);

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options("*", cors());

app.disable("x-powered-by");

// limit repeated failed requests to auth endpoints
if (config.env === "production") {
  app.use("/v1/auth", authLimiter);
}

// v1 api routes
app.use("/inbound/api/v1", routes);
// app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(docs));

app.all(`"*"`, (req, res, next) => {
  next(new ApiError(`Can't find ${req.originalUrl} on this server!`, httpStatus[404]));
});

// app.use(errorConverter)
app.use(errorConverter);

// handle errors
app.use(errorHandler);

/**
 * Exports Express
 * @public
 */
module.exports = app;
