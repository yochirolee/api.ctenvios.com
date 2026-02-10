"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseTransport = void 0;
const winston_transport_1 = __importDefault(require("winston-transport"));
const client_1 = require("@prisma/client");
const repositories_1 = __importDefault(require("../repositories"));
const config_service_1 = require("../services/config.service");
/**
 * Custom Winston transport that writes logs to PostgreSQL database
 * Handles logging failures gracefully to prevent infinite loops
 * Respects logging configuration from AppConfig
 */
class DatabaseTransport extends winston_transport_1.default {
    constructor(opts) {
        super(opts);
    }
    log(info, callback) {
        setImmediate(() => {
            this.emit("logged", info);
        });
        // Check if logging is enabled asynchronously (don't block)
        config_service_1.configService
            .getBoolean("logging_enabled", true)
            .then((loggingEnabled) => {
            // If logging is disabled, skip database write
            if (!loggingEnabled) {
                callback();
                return;
            }
            // Extract log information
            const level = this.mapWinstonLevelToPrisma(info.level);
            const message = info.message || "No message";
            const source = info.source || "system";
            const code = info.code;
            const statusCode = info.statusCode;
            const details = info.details || undefined;
            const stack = info.stack;
            const path = info.path;
            const method = info.method;
            const ipAddress = info.ipAddress;
            const userAgent = info.userAgent;
            const userId = info.userId;
            const userEmail = info.userEmail;
            // Log asynchronously (don't await to avoid blocking)
            repositories_1.default.appLogs
                .create({
                level,
                message: typeof message === "string" ? message : JSON.stringify(message),
                source,
                code,
                status_code: statusCode,
                details: details ? details : undefined,
                stack: stack ? stack.substring(0, 2000) : undefined,
                path,
                method,
                ip_address: ipAddress,
                user_agent: userAgent,
                user_id: userId,
                user_email: userEmail,
            })
                .catch((error) => {
                // Silently fail logging to prevent infinite loops
                // Only log to console if it's a critical error
                if (process.env.NODE_ENV === "development") {
                    console.error("Failed to log to database:", error);
                }
            });
            callback();
        })
            .catch(() => {
            // If config check fails, default to logging (fail open)
            // Extract log information
            const level = this.mapWinstonLevelToPrisma(info.level);
            const message = info.message || "No message";
            const source = info.source || "system";
            const code = info.code;
            const statusCode = info.statusCode;
            const details = info.details || undefined;
            const stack = info.stack;
            const path = info.path;
            const method = info.method;
            const ipAddress = info.ipAddress;
            const userAgent = info.userAgent;
            const userId = info.userId;
            const userEmail = info.userEmail;
            // Log asynchronously (don't await to avoid blocking)
            repositories_1.default.appLogs
                .create({
                level,
                message: typeof message === "string" ? message : JSON.stringify(message),
                source,
                code,
                status_code: statusCode,
                details: details ? details : undefined,
                stack: stack ? stack.substring(0, 2000) : undefined,
                path,
                method,
                ip_address: ipAddress,
                user_agent: userAgent,
                user_id: userId,
                user_email: userEmail,
            })
                .catch((error) => {
                if (process.env.NODE_ENV === "development") {
                    console.error("Failed to log to database:", error);
                }
            });
            callback();
        });
    }
    /**
     * Maps Winston log levels to Prisma LogLevel enum
     */
    mapWinstonLevelToPrisma(level) {
        const upperLevel = level.toUpperCase();
        switch (upperLevel) {
            case "ERROR":
                return client_1.LogLevel.ERROR;
            case "WARN":
            case "WARNING":
                return client_1.LogLevel.WARN;
            case "HTTP":
                return client_1.LogLevel.HTTP;
            case "DEBUG":
                return client_1.LogLevel.DEBUG;
            case "INFO":
            default:
                return client_1.LogLevel.INFO;
        }
    }
}
exports.DatabaseTransport = DatabaseTransport;
