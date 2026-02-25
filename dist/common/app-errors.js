"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationErr = exports.AppError = void 0;
const https_status_codes_1 = __importDefault(require("./https-status-codes"));
/**
 * Error with status code and message.
 */
class AppError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.AppError = AppError;
/**
 * Validation in route layer errors.
 */
class ValidationErr extends AppError {
    constructor(parameter, value, moreInfo) {
        const msgObj = {
            error: ValidationErr.MSG,
            parameter,
            value,
        };
        if (!!moreInfo) {
            msgObj["more-info"] = moreInfo;
        }
        super(https_status_codes_1.default.BAD_REQUEST, JSON.stringify(msgObj));
    }
}
exports.ValidationErr = ValidationErr;
ValidationErr.MSG = "The following parameter was missing or invalid.";
