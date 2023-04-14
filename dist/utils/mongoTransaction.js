"use strict";
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("./ApiError");
const runInTransaction = async (callback) => {
    let result;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        result = await callback(session);
        await session.commitTransaction();
    }
    catch (err) {
        await session.abortTransaction();
        throw new ApiError(httpStatus.BAD_REQUEST, err.message);
    }
    finally {
        session.endSession();
    }
    return result;
};
module.exports = runInTransaction;
//# sourceMappingURL=mongoTransaction.js.map