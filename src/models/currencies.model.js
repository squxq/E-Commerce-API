const mongoose = require("mongoose");
const { toJSON } = require("./plugins");

const currenciesSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    currency_name: {
      type: String,
      required: true,
    },
    subunit_name: {
      type: String,
      required: true,
    },
    base: {
      type: [
        {
          type: Number,
        },
      ],
      default: undefined,
    },
    exponent: {
      type: Number,
      required: true,
    },
    tied_to: String,
  },
  { timestamps: true }
);

currenciesSchema.plugin(toJSON);

/**
 * @typedef currencies
 */
const currencies = mongoose.model("currencies", currenciesSchema);

module.exports = currencies;
