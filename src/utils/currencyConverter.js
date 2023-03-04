const https = require("https");
const httpStatus = require("http-status");
const config = require("../config/config");
const catchAsync = require("./catchAsync");
const ApiError = require("./ApiError");
const { FxRates } = require("../models");

const convertCurrency = catchAsync(async (currencyStart, currencyEnd) => {
  const options = {
    hostname: `v6.exchangerate-api.com`,
    port: 443,
    protocol: "https:",
    agent: https.globalAgent,
    path: `/v6/${config.exchangeRateKey}/pair/${currencyStart}/${currencyEnd}`,
    method: `GET`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  let output;

  function makeRequest() {
    return new Promise((resolve) => {
      const request = https.request(options, (response) => {
        // the response has been received
        response.on("data", (chunk) => {
          output = JSON.parse(chunk.toString());
        });

        response.on(
          "end",
          catchAsync(async () => {
            if (output.result === "success") {
              // create a new fx_rates record in mongoose
              await FxRates.create({
                source_currency: output.base_code,
                target_currency: output.target_code,
                exchange_rate: output.conversion_rate,
                valid_from_date: output.time_last_update_utc,
                valid_to_date: output.time_next_update_utc,
              });

              resolve(output.conversion_rate);
            } else {
              throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Currency conversion was not successful");
            }
          })
        );
      });
      request.on("error", (err) => {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err.message);
      });

      request.end();
    });
  }

  return makeRequest().then((res) => {
    return res;
  });
});
module.exports = convertCurrency;
