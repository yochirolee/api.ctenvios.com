"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const database_transport_1 = require("./database-transport");
/**
 * Custom log levels for the application
 */
const logLevels = {
    error: 0,
    warn: 1,
    http: 2,
    info: 3,
    debug: 4,
};
/**
 * Custom log colors for better readability
 */
const logColors = {
    error: "red",
    warn: "yellow",
    http: "magenta",
    info: "green",
    debug: "blue",
};
winston_1.default.addColors(logColors);
/**
 * Format for console output (development)
 */
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => {
    const { timestamp, level, message } = info, meta = __rest(info, ["timestamp", "level", "message"]);
    let metaString = "";
    if (Object.keys(meta).length > 0 && meta.constructor === Object) {
        metaString = ` ${JSON.stringify(meta)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaString}`;
}));
/**
 * Format for database storage (structured)
 */
const databaseFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
/**
 * Determine which logs should be written to database
 * In production, log ERROR, WARN, and HTTP
 * In development, log everything
 */
const getDatabaseLogLevel = () => {
    if (process.env.NODE_ENV === "production") {
        return "http"; // Log HTTP and above (HTTP, WARN, ERROR)
    }
    return "debug"; // Log everything in development
};
/**
 * Determine which logs should be written to console
 */
const getConsoleLogLevel = () => {
    if (process.env.NODE_ENV === "production") {
        return "info"; // Only info and above in production
    }
    return "debug"; // Everything in development
};
/**
 * Main logger instance
 * Configured with console and database transports
 */
exports.logger = winston_1.default.createLogger({
    levels: logLevels,
    level: getConsoleLogLevel(),
    format: winston_1.default.format.combine(winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        // Console transport for development/debugging
        new winston_1.default.transports.Console({
            format: consoleFormat,
            level: getConsoleLogLevel(),
        }),
        // Database transport for persistent storage
        new database_transport_1.DatabaseTransport({
            level: getDatabaseLogLevel(),
        }),
    ],
    // Don't exit on handled exceptions
    exitOnError: false,
});
/**
 * Helper function to create a logger with request context
 * Use this in middleware to automatically include request information
 */
const createRequestLogger = (req) => {
    return {
        error: (message, meta) => {
            var _a, _b, _c;
            exports.logger.error(message, Object.assign(Object.assign({}, meta), { source: "http", path: req.path || req.url, method: req.method, ipAddress: req.headers["x-forwarded-for"] || req.socket.remoteAddress, userAgent: req.headers["user-agent"], userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id, userEmail: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.email) }));
        },
        warn: (message, meta) => {
            var _a, _b, _c;
            exports.logger.warn(message, Object.assign(Object.assign({}, meta), { source: "http", path: req.path || req.url, method: req.method, ipAddress: req.headers["x-forwarded-for"] || req.socket.remoteAddress, userAgent: req.headers["user-agent"], userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id, userEmail: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.email) }));
        },
        http: (message, meta) => {
            var _a, _b, _c;
            exports.logger.http(message, Object.assign(Object.assign({}, meta), { source: "http", path: req.path || req.url, method: req.method, ipAddress: req.headers["x-forwarded-for"] || req.socket.remoteAddress, userAgent: req.headers["user-agent"], userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id, userEmail: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.email) }));
        },
        info: (message, meta) => {
            var _a, _b, _c;
            exports.logger.info(message, Object.assign(Object.assign({}, meta), { source: "http", path: req.path || req.url, method: req.method, ipAddress: req.headers["x-forwarded-for"] || req.socket.remoteAddress, userAgent: req.headers["user-agent"], userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id, userEmail: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.email) }));
        },
        debug: (message, meta) => {
            var _a, _b, _c;
            exports.logger.debug(message, Object.assign(Object.assign({}, meta), { source: "http", path: req.path || req.url, method: req.method, ipAddress: req.headers["x-forwarded-for"] || req.socket.remoteAddress, userAgent: req.headers["user-agent"], userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id, userEmail: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email) || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.email) }));
        },
    };
};
exports.createRequestLogger = createRequestLogger;
exports.default = exports.logger;
