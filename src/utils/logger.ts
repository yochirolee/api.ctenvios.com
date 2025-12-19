import winston from "winston";
import { DatabaseTransport } from "./database-transport";

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

winston.addColors(logColors);

/**
 * Format for console output (development)
 */
const consoleFormat = winston.format.combine(
   winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
   winston.format.colorize({ all: true }),
   winston.format.printf((info) => {
      const { timestamp, level, message, ...meta } = info;
      let metaString = "";
      if (Object.keys(meta).length > 0 && meta.constructor === Object) {
         metaString = ` ${JSON.stringify(meta)}`;
      }
      return `${timestamp} [${level}]: ${message}${metaString}`;
   })
);

/**
 * Format for database storage (structured)
 */
const databaseFormat = winston.format.combine(
   winston.format.timestamp(),
   winston.format.errors({ stack: true }),
   winston.format.json()
);

/**
 * Determine which logs should be written to database
 * In production, log ERROR, WARN, and HTTP
 * In development, log everything
 */
const getDatabaseLogLevel = (): string => {
   if (process.env.NODE_ENV === "production") {
      return "http"; // Log HTTP and above (HTTP, WARN, ERROR)
   }
   return "debug"; // Log everything in development
};

/**
 * Determine which logs should be written to console
 * Can be overridden with LOG_LEVEL environment variable
 * Valid levels: error, warn, http, info, debug
 */
const getConsoleLogLevel = (): string => {
   // Allow override via environment variable
   if (process.env.LOG_LEVEL) {
      return process.env.LOG_LEVEL.toLowerCase();
   }
   if (process.env.NODE_ENV === "production") {
      return "info"; // Only info and above in production
   }
   return "info"; // Changed from "debug" to reduce HTTP logs in development
};

/**
 * Main logger instance
 * Configured with console and database transports
 */
export const logger = winston.createLogger({
   levels: logLevels,
   level: getConsoleLogLevel(),
   format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.json()),
   transports: [
      // Console transport for development/debugging
      new winston.transports.Console({
         format: consoleFormat,
         level: getConsoleLogLevel(),
      }),
      // Database transport for persistent storage
      new DatabaseTransport({
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
export const createRequestLogger = (req: any) => {
   return {
      error: (message: string, meta?: Record<string, unknown>) => {
         logger.error(message, {
            ...meta,
            source: "http",
            path: req.path || req.url,
            method: req.method,
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
            userId: req.user?.id,
            userEmail: req.user?.email || req.body?.email,
         });
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
         logger.warn(message, {
            ...meta,
            source: "http",
            path: req.path || req.url,
            method: req.method,
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
            userId: req.user?.id,
            userEmail: req.user?.email || req.body?.email,
         });
      },
      http: (message: string, meta?: Record<string, unknown>) => {
         logger.http(message, {
            ...meta,
            source: "http",
            path: req.path || req.url,
            method: req.method,
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
            userId: req.user?.id,
            userEmail: req.user?.email || req.body?.email,
         });
      },
      info: (message: string, meta?: Record<string, unknown>) => {
         logger.info(message, {
            ...meta,
            source: "http",
            path: req.path || req.url,
            method: req.method,
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
            userId: req.user?.id,
            userEmail: req.user?.email || req.body?.email,
         });
      },
      debug: (message: string, meta?: Record<string, unknown>) => {
         logger.debug(message, {
            ...meta,
            source: "http",
            path: req.path || req.url,
            method: req.method,
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
            userId: req.user?.id,
            userEmail: req.user?.email || req.body?.email,
         });
      },
   };
};

export default logger;
