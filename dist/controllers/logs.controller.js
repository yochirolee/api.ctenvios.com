"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const client_1 = require("@prisma/client");
const repositories_1 = __importDefault(require("../repositories"));
const logs = {
    getLogs: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        if (page < 1 || limit < 1 || limit > 1000) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid pagination parameters. Page and limit must be positive, limit max is 1000");
        }
        // Parse and validate filters
        const filters = {};
        // Validate level filter
        if (req.query.level) {
            const validLevels = Object.values(client_1.LogLevel);
            if (!validLevels.includes(req.query.level)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid level. Must be one of: ${validLevels.join(", ")}`);
            }
            filters.level = req.query.level;
        }
        // Validate source filter
        if (req.query.source) {
            filters.source = req.query.source;
        }
        // Validate status_code filter
        if (req.query.status_code) {
            const statusCode = parseInt(req.query.status_code);
            if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid status_code. Must be a valid HTTP status code (100-599)");
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
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid method. Must be one of: ${validMethods.join(", ")}`);
            }
            filters.method = method;
        }
        // Validate date range filters
        if (req.query.startDate) {
            const startDate = new Date(req.query.startDate);
            if (isNaN(startDate.getTime())) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid startDate format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)");
            }
            filters.startDate = startDate;
        }
        if (req.query.endDate) {
            const endDate = new Date(req.query.endDate);
            if (isNaN(endDate.getTime())) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid endDate format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)");
            }
            filters.endDate = endDate;
        }
        if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "startDate must be before endDate");
        }
        const [rows, total] = yield Promise.all([
            repositories_1.default.appLogs.getAll({ page, limit, filters: Object.keys(filters).length > 0 ? filters : undefined }),
            repositories_1.default.appLogs.countAll(Object.keys(filters).length > 0 ? filters : undefined),
        ]);
        res.status(200).json({
            rows,
            total,
            page,
            limit,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
        });
    }),
    getLogById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        if (!id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Log ID is required");
        }
        const log = yield repositories_1.default.appLogs.getById(id);
        if (!log) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Log not found");
        }
        res.status(200).json(log);
    }),
    getLogsStats: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const stats = yield repositories_1.default.appLogs.getStats();
        res.status(200).json(stats);
    }),
    getLogsByLevel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { level } = req.query;
        if (!level) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "level query parameter is required");
        }
        const validLevels = Object.values(client_1.LogLevel);
        if (!validLevels.includes(level)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid level. Must be one of: ${validLevels.join(", ")}`);
        }
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        if (page < 1 || limit < 1 || limit > 1000) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid pagination parameters. Page and limit must be positive, limit max is 1000");
        }
        const [logs, total] = yield Promise.all([
            repositories_1.default.appLogs.getByLevel(level, { page, limit }),
            repositories_1.default.appLogs.countByLevel(level),
        ]);
        res.status(200).json({
            rows: logs,
            total,
        });
    }),
    getLogsBySource: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { source } = req.query;
        if (!source) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "source query parameter is required");
        }
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        if (page < 1 || limit < 1 || limit > 1000) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid pagination parameters. Page and limit must be positive, limit max is 1000");
        }
        const [logs, total] = yield Promise.all([
            repositories_1.default.appLogs.getBySource(source, { page, limit }),
            repositories_1.default.appLogs.countBySource(source),
        ]);
        res.status(200).json({
            rows: logs,
            total,
        });
    }),
    deleteAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const deletedCount = yield repositories_1.default.appLogs.deleteAll();
        res.status(200).json({
            message: "All logs deleted successfully",
            deleted_count: deletedCount,
        });
    }),
    deleteById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid log ID");
        }
        yield repositories_1.default.appLogs.deleteById(id);
        res.status(200).json({
            message: "Log deleted successfully",
            id,
        });
    }),
    deleteByDateRange: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "startDate and endDate are required");
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid date format. Use ISO 8601 format");
        }
        if (start > end) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "startDate must be before endDate");
        }
        const deletedCount = yield repositories_1.default.appLogs.deleteByDateRange(start, end);
        res.status(200).json({
            message: "Logs deleted successfully",
            deleted_count: deletedCount,
            start_date: startDate,
            end_date: endDate,
        });
    }),
    deleteByLevel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { level } = req.body;
        if (!level) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "level is required");
        }
        const validLevels = Object.values(client_1.LogLevel);
        if (!validLevels.includes(level)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid level. Must be one of: ${validLevels.join(", ")}`);
        }
        const deletedCount = yield repositories_1.default.appLogs.deleteByLevel(level);
        res.status(200).json({
            message: "Logs deleted successfully",
            deleted_count: deletedCount,
            level,
        });
    }),
    deleteBySource: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { source } = req.body;
        if (!source) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "source is required");
        }
        const deletedCount = yield repositories_1.default.appLogs.deleteBySource(source);
        res.status(200).json({
            message: "Logs deleted successfully",
            deleted_count: deletedCount,
            source,
        });
    }),
    deleteOlderThan: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { olderThanDays } = req.body;
        if (!olderThanDays || typeof olderThanDays !== "number" || olderThanDays <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "olderThanDays must be a positive number");
        }
        const deletedCount = yield repositories_1.default.appLogs.deleteOlderThan(olderThanDays);
        res.status(200).json({
            message: "Logs deleted successfully",
            deleted_count: deletedCount,
            older_than_days: olderThanDays,
        });
    }),
};
exports.default = logs;
