const mongoose = require("mongoose");
const { toJSON } = require("./plugins");

const fxRatesSchema = new mongoose.Schema(
  {
    source_currency: {
      type: String,
      required: true,
    },
    target_currency: {
      type: String,
      required: true,
    },
    exchange_rate: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    valid_from_date: {
      type: Date,
      required: true,
    },
    valid_to_date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

fxRatesSchema.plugin(toJSON);

/**
 * @typedef fxRates
 */
const fxRates = mongoose.model("fxRates", fxRatesSchema);

module.exports = fxRates;
