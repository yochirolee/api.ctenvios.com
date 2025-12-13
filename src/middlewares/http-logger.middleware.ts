import { Request, Response, NextFunction } from "express";
import { createRequestLogger } from "../utils/logger";

/**
 * HTTP Request Logger Middleware
 * Logs all incoming HTTP requests with Winston
 * Should be used early in the middleware chain
 */
export const httpLoggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
   const requestLogger = createRequestLogger(req);

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
      } else if (level === "warn") {
         requestLogger.warn(`Request warning: ${req.method} ${req.path}`, {
            statusCode,
         });
      } else {
         requestLogger.http(`Request completed: ${req.method} ${req.path}`, {
            statusCode,
         });
      }
   });

   next();
};

export default httpLoggerMiddleware;
