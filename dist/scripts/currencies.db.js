"use strict";
/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
const XLSX = require("xlsx");
const { Currencies } = require("../models");
const config = require("../config/config");
const catchAsync = require("../utils/catchAsync");
const { connectMongo } = require("../config/db");
const postCurrencies = catchAsync(async () => {
    const workbook = XLSX.readFile(config.csvFilePath);
    // sheet name = "format_currencies"
    const worksheets = {};
    workbook.SheetNames.forEach((sheetName) => {
        worksheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    });
    // data as JSON - JSON.stringify()
    // console.log("json\n", JSON.stringify(worksheets, null, 2));
    connectMongo()
        .then(() => {
        const data = worksheets.Sheet1;
        const currencies = [];
        data.forEach((currency) => {
            let newBase;
            if (typeof currency.Base === "string") {
                newBase = JSON.parse(currency.Base.replace(/'/g, '"')).map(Number);
            }
            else {
                newBase = [Number(currency.Base)];
            }
            currencies.push({
                code: currency.ISO,
                currency_name: currency.Currency,
                subunit_name: currency["Sub Units"],
                base: newBase,
                exponent: Number(currency.Exponent),
                countries: currency["Used in"].split(", ").reduce((acc, cur) => {
                    if (cur.includes(" and ")) {
                        // eslint-disable-next-line no-param-reassign
                        acc = acc.concat(cur.split(" and "));
                    }
                    else {
                        acc.push(cur);
                    }
                    return acc;
                }, []),
                tied_to: currency["Tied To"],
            });
        });
        currencies.forEach(async (currency) => {
            if (Number.isNaN(currency.exponent)) {
                currency.exponent = 2;
                currency.base = [10];
            }
            const newCurrency = await Currencies.create({
                code: currency.code,
                currency_name: currency.currency_name,
                subunit_name: currency.subunit_name,
                base: currency.base,
                exponent: currency.exponent,
                tied_to: currency.tied_to,
            });
            console.log(newCurrency);
        });
    })
        .catch((err) => console.log(err));
});
postCurrencies();
const createMongo = () => {
    connectMongo().then(async () => {
        const currency = await Currencies.create({
            code: "EUR",
            currency_name: "Euro",
            subunit_name: "1 EUR = 100 Cents",
            base: [10],
            exponent: 2,
        });
        console.log(currency);
    });
};
createMongo();
// to check some of the different currencies
const getUncommonCurrencies = async () => {
    connectMongo().then(async () => {
        const currency = await Currencies.findOne({ code: "EUR" });
        console.log(currency);
    });
};
getUncommonCurrencies();
//# sourceMappingURL=currencies.db.js.map