"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLoggerMiddleware = void 0;
const logger_1 = require("../utils/logger");
/**
 * HTTP Request Logger Middleware
 * Logs all incoming HTTP requests with Winston
 * Should be used early in the middleware chain
 */
const httpLoggerMiddleware = (req, res, next) => {
    const requestLogger = (0, logger_1.createRequestLogger)(req);
    // Log request start
    requestLogger.info(`Incoming request: ${req.method} ${req.path}`, {
        source: "http",
        statusCode: undefined, // Will be set when response is sent
    });
    // Log response when finished
    res.on("finish", () => {
        const statusCode = res.statusCode;
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "http";
        if (level === "error") {
            requestLogger.error(`Request failed: ${req.method} ${req.path}`, {
                statusCode,
            });
        }
        else if (level === "warn") {
            requestLogger.warn(`Request warning: ${req.method} ${req.path}`, {
                statusCode,
            });
        }
        else {
            requestLogger.http(`Request completed: ${req.method} ${req.path}`, {
                statusCode,
            });
        }
    });
    next();
};
exports.httpLoggerMiddleware = httpLoggerMiddleware;
exports.default = exports.httpLoggerMiddleware;
