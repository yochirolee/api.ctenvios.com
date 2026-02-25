"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLoggerMiddleware = void 0;
const logger_1 = require("../utils/logger");
/**
 * HTTP Request Logger Middleware
 * Logs all incoming HTTP requests with Winston
 * Should be used early in the middleware chain
 * In development, only logs errors and warnings (skips HTTP level logs)
 */
const httpLoggerMiddleware = (req, res, next) => {
    const isDevelopment = process.env.NODE_ENV === "development";
    const requestLogger = (0, logger_1.createRequestLogger)(req);
    // Log request start (only in production)
    if (!isDevelopment) {
        requestLogger.info(`Incoming request: ${req.method} ${req.path}`, {
            source: "http",
            statusCode: undefined, // Will be set when response is sent
        });
    }
    // Log response when finished
    res.on("finish", () => {
        const statusCode = res.statusCode;
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "http";
        // In development, skip HTTP level logs (only log errors and warnings)
        if (isDevelopment && level === "http") {
            return;
        }
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
