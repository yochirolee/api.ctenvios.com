import { Response } from "express";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import { LogLevel } from "@prisma/client";
import repository from "../repositories";

interface LogsRequest {
   user?: {
      id: string;
      email: string;
      role: string;
   };
   query: {
      page?: string;
      limit?: string;
      level?: string;
      source?: string;
      status_code?: string;
      user_id?: string;
      path?: string;
      method?: string;
      startDate?: string;
      endDate?: string;
   };
   body: {
      startDate?: string;
      endDate?: string;
      level?: LogLevel;
      source?: string;
      olderThanDays?: number;
   };
   params: {
      id?: string;
   };
}

const logs = {
   getLogs: async (req: LogsRequest, res: Response): Promise<void> => {
      const page = req.query.page ? parseInt(req.query.page) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;

      if (page < 1 || limit < 1 || limit > 1000) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Invalid pagination parameters. Page and limit must be positive, limit max is 1000"
         );
      }

      // Parse and validate filters
      const filters: {
         level?: LogLevel;
         source?: string;
         status_code?: number;
         user_id?: string;
         path?: string;
         method?: string;
         startDate?: Date;
         endDate?: Date;
      } = {};

      // Validate level filter
      if (req.query.level) {
         const validLevels = Object.values(LogLevel);
         if (!validLevels.includes(req.query.level as LogLevel)) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid level. Must be one of: ${validLevels.join(", ")}`);
         }
         filters.level = req.query.level as LogLevel;
      }

      // Validate source filter
      if (req.query.source) {
         filters.source = req.query.source;
      }

      // Validate status_code filter
      if (req.query.status_code) {
         const statusCode = parseInt(req.query.status_code);
         if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               "Invalid status_code. Must be a valid HTTP status code (100-599)"
            );
         }
         filters.status_code = statusCode;
      }

      // Validate user_id filter
      if (req.query.user_id) {
         filters.user_id = req.query.user_id;
      }

      // Validate path filter (partial match)
      if (req.query.path) {
         filters.path = req.query.path;
      }

      // Validate method filter
      if (req.query.method) {
         const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
         const method = req.query.method.toUpperCase();
         if (!validMethods.includes(method)) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Invalid method. Must be one of: ${validMethods.join(", ")}`
            );
         }
         filters.method = method;
      }

      // Validate date range filters
      if (req.query.startDate) {
         const startDate = new Date(req.query.startDate);
         if (isNaN(startDate.getTime())) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               "Invalid startDate format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)"
            );
         }
         filters.startDate = startDate;
      }

      if (req.query.endDate) {
         const endDate = new Date(req.query.endDate);
         if (isNaN(endDate.getTime())) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               "Invalid endDate format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)"
            );
         }
         filters.endDate = endDate;
      }

      if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "startDate must be before endDate");
      }

      const [rows, total] = await Promise.all([
         repository.appLogs.getAll({ page, limit, filters: Object.keys(filters).length > 0 ? filters : undefined }),
         repository.appLogs.countAll(Object.keys(filters).length > 0 ? filters : undefined),
      ]);

      res.status(200).json({
         rows,
         total,
         page,
         limit,
         filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
   },
   getLogsStats: async (req: LogsRequest, res: Response): Promise<void> => {
      const stats = await repository.appLogs.getStats();
      res.status(200).json(stats);
   },

   getLogsByLevel: async (req: LogsRequest, res: Response): Promise<void> => {
      const { level } = req.query;
      if (!level) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "level query parameter is required");
      }
      const validLevels = Object.values(LogLevel);
      if (!validLevels.includes(level as LogLevel)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid level. Must be one of: ${validLevels.join(", ")}`);
      }

      const page = req.query.page ? parseInt(req.query.page) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;

      if (page < 1 || limit < 1 || limit > 1000) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Invalid pagination parameters. Page and limit must be positive, limit max is 1000"
         );
      }

      const [logs, total] = await Promise.all([
         repository.appLogs.getByLevel(level as LogLevel, { page, limit }),
         repository.appLogs.countByLevel(level as LogLevel),
      ]);

      res.status(200).json({
         rows: logs,
         total,
      });
   },

   getLogsBySource: async (req: LogsRequest, res: Response): Promise<void> => {
      const { source } = req.query;
      if (!source) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "source query parameter is required");
      }

      const page = req.query.page ? parseInt(req.query.page) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;

      if (page < 1 || limit < 1 || limit > 1000) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Invalid pagination parameters. Page and limit must be positive, limit max is 1000"
         );
      }

      const [logs, total] = await Promise.all([
         repository.appLogs.getBySource(source, { page, limit }),
         repository.appLogs.countBySource(source),
      ]);

      res.status(200).json({
         rows: logs,
         total,
      });
   },

   deleteAll: async (req: LogsRequest, res: Response): Promise<void> => {
      const deletedCount = await repository.appLogs.deleteAll();
      res.status(200).json({
         message: "All logs deleted successfully",
         deleted_count: deletedCount,
      });
   },

   deleteById: async (req: LogsRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid log ID");
      }
      await repository.appLogs.deleteById(id);
      res.status(200).json({
         message: "Log deleted successfully",
         id,
      });
   },

   deleteByDateRange: async (req: LogsRequest, res: Response): Promise<void> => {
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "startDate and endDate are required");
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid date format. Use ISO 8601 format");
      }
      if (start > end) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "startDate must be before endDate");
      }
      const deletedCount = await repository.appLogs.deleteByDateRange(start, end);
      res.status(200).json({
         message: "Logs deleted successfully",
         deleted_count: deletedCount,
         start_date: startDate,
         end_date: endDate,
      });
   },

   deleteByLevel: async (req: LogsRequest, res: Response): Promise<void> => {
      const { level } = req.body;
      if (!level) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "level is required");
      }
      const validLevels = Object.values(LogLevel);
      if (!validLevels.includes(level as LogLevel)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid level. Must be one of: ${validLevels.join(", ")}`);
      }
      const deletedCount = await repository.appLogs.deleteByLevel(level as LogLevel);
      res.status(200).json({
         message: "Logs deleted successfully",
         deleted_count: deletedCount,
         level,
      });
   },

   deleteBySource: async (req: LogsRequest, res: Response): Promise<void> => {
      const { source } = req.body;
      if (!source) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "source is required");
      }
      const deletedCount = await repository.appLogs.deleteBySource(source);
      res.status(200).json({
         message: "Logs deleted successfully",
         deleted_count: deletedCount,
         source,
      });
   },

   deleteOlderThan: async (req: LogsRequest, res: Response): Promise<void> => {
      const { olderThanDays } = req.body;
      if (!olderThanDays || typeof olderThanDays !== "number" || olderThanDays <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "olderThanDays must be a positive number");
      }
      const deletedCount = await repository.appLogs.deleteOlderThan(olderThanDays);
      res.status(200).json({
         message: "Logs deleted successfully",
         deleted_count: deletedCount,
         older_than_days: olderThanDays,
      });
   },
};

export default logs;
