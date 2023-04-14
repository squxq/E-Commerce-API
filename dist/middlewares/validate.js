"use strict";
const Joi = require("joi");
const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const validate = (schema) => (req, res, next) => {
    const validSchema = pick(schema, ["params", "query", "body"]);
    const object = pick(req, Object.keys(validSchema));
    const { value, error } = Joi.compile(validSchema)
        .prefs({ errors: { label: "key" }, abortEarly: false })
        .validate(object);
    if (error) {
        let errorMessage;
        if (error.details[0].type === "any.required") {
            errorMessage = `${error.details[0].context.label} not provided`;
        }
        else if (error.details[0].type === "string.guid") {
            errorMessage = `${error.details[0].context.label} is not a valid GUID`;
        }
        else {
            errorMessage = error.details.map((details) => details.message).join(", ");
        }
        return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }
    Object.assign(req, value);
    return next();
};
module.exports = validate;
//# sourceMappingURL=validate.js.map