import { TransformableInfo } from "logform";
import Transport from "winston-transport";
import { LogLevel } from "@prisma/client";
import repository from "../repositories";
import { configService } from "../services/config.service";

interface DatabaseTransportOptions {
   level?: string;
   silent?: boolean;
}

/**
 * Custom Winston transport that writes logs to PostgreSQL database
 * Handles logging failures gracefully to prevent infinite loops
 * Respects logging configuration from AppConfig
 */
export class DatabaseTransport extends Transport {
   constructor(opts?: DatabaseTransportOptions) {
      super(opts);
   }

   log(info: TransformableInfo, callback: () => void): void {
      setImmediate(() => {
         this.emit("logged", info);
      });

      // Check if logging is enabled asynchronously (don't block)
      configService
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
            const source = (info.source as string) || "system";
            const code = info.code as string | undefined;
            const statusCode = info.statusCode as number | undefined;
            const details = info.details || undefined;
            const stack = info.stack as string | undefined;
            const path = info.path as string | undefined;
            const method = info.method as string | undefined;
            const ipAddress = info.ipAddress as string | undefined;
            const userAgent = info.userAgent as string | undefined;
            const userId = info.userId as string | undefined;
            const userEmail = info.userEmail as string | undefined;

            // Log asynchronously (don't await to avoid blocking)
            repository.appLogs
               .create({
                  level,
                  message: typeof message === "string" ? message : JSON.stringify(message),
                  source,
                  code,
                  status_code: statusCode,
                  details: details ? (details as Record<string, unknown>) : undefined,
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
            const source = (info.source as string) || "system";
            const code = info.code as string | undefined;
            const statusCode = info.statusCode as number | undefined;
            const details = info.details || undefined;
            const stack = info.stack as string | undefined;
            const path = info.path as string | undefined;
            const method = info.method as string | undefined;
            const ipAddress = info.ipAddress as string | undefined;
            const userAgent = info.userAgent as string | undefined;
            const userId = info.userId as string | undefined;
            const userEmail = info.userEmail as string | undefined;

            // Log asynchronously (don't await to avoid blocking)
            repository.appLogs
               .create({
                  level,
                  message: typeof message === "string" ? message : JSON.stringify(message),
                  source,
                  code,
                  status_code: statusCode,
                  details: details ? (details as Record<string, unknown>) : undefined,
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
   private mapWinstonLevelToPrisma(level: string): LogLevel {
      const upperLevel = level.toUpperCase();
      switch (upperLevel) {
         case "ERROR":
            return LogLevel.ERROR;
         case "WARN":
         case "WARNING":
            return LogLevel.WARN;
         case "HTTP":
            return LogLevel.HTTP;
         case "DEBUG":
            return LogLevel.DEBUG;
         case "INFO":
         default:
            return LogLevel.INFO;
      }
   }
}
