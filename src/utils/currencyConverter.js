const https = require("node:https");
const httpStatus = require("http-status");
const config = require("../config/config");
const logger = require("../config/logger");
const catchAsync = require("./catchAsync");
const ApiError = require("./ApiError");

const convertCurrency = catchAsync((value, currencyStart, currencyEnd) => {
  const options = {
    hostname: `v6.exchangerate-api.com`,
    port: 443,
    protocol: "https:",
    agent: https.globalAgent,
    path: `/v6/${config.exchangeRateKey}/pair/${currencyStart}/${currencyEnd}/${parseFloat(value)}`,
    method: `GET`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  let data;

  const request = https.request(options, (response) => {
    // encoding so the date is not in binary
    response.setEncoding("utf8");
    // as the data streams in add chunks
    response.on("data", (chunk) => {
      data += chunk;
    });
    // the response has been received
    response.on("end", () => {
      logger.info(JSON.parse(data));
    });
  });
  request.on("error", (err) => {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err.message);
  });

  request.end();

  // console.log(Object.values(request)[0]);
});
module.exports = convertCurrency;
