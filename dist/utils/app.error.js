"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
// utils/AppError.ts
class AppError extends Error {
    constructor(message, statusCode = 400, details, type) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.type = type;
    }
}
exports.AppError = AppError;
exports.default = AppError;
