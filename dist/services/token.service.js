"use strict";
// const jwt = require("jsonwebtoken");
// const moment = require("moment");
// const httpStatus = require("http-status");
// const config = require("../config/config");
// const userService = require("./user.service");
// const { Token } = require("../models");
// const ApiError = require("../utils/ApiError");
// const { tokenTypes } = require("../config/tokens");
// /**
//  * Generate auth tokens
//  * @param {User} user
//  * @returns {Promise<Object>}
//  */
const generateAuthTokens = async (user) => {
    // const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, "minutes");
    // const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS);
    // const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, "days");
    // const refreshToken = generateToken(user.id, refreshTokenExpires, tokenTypes.REFRESH);
    // await saveToken(refreshToken, user.id, refreshTokenExpires, tokenTypes.REFRESH);
    // return {
    //   access: {
    //     token: accessToken,
    //     expires: accessTokenExpires.toDate(),
    //   },
    //   refresh: {
    //     token: refreshToken,
    //     expires: refreshTokenExpires.toDate(),
    //   },
    // };
};
module.exports = {
    generateAuthTokens,
};
//# sourceMappingURL=token.service.js.map