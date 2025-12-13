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
exports.errorLogs = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
exports.errorLogs = {
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        const errorLog = yield prisma_client_1.default.errorLog.create({
            data: {
                message: data.message,
                source: data.source,
                code: data.code,
                status_code: data.status_code,
                details: data.details ? data.details : undefined,
                stack: data.stack,
                path: data.path,
                method: data.method,
                ip_address: data.ip_address,
                user_agent: data.user_agent,
                user_id: data.user_id,
            },
        });
        return errorLog;
    }),
    getAll: (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (limit = 100, offset = 0) {
        const errorLogs = yield prisma_client_1.default.errorLog.findMany({
            select: {
                id: true,
                message: true,
                source: true,
                code: true,
                status_code: true,
                path: true,
                method: true,
                created_at: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
            take: limit,
            skip: offset,
        });
        return errorLogs;
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const errorLog = yield prisma_client_1.default.errorLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        return errorLog;
    }),
    getBySource: (source_1, ...args_1) => __awaiter(void 0, [source_1, ...args_1], void 0, function* (source, limit = 100, offset = 0) {
        const errorLogs = yield prisma_client_1.default.errorLog.findMany({
            where: { source },
            select: {
                id: true,
                message: true,
                source: true,
                code: true,
                status_code: true,
                path: true,
                method: true,
                created_at: true,
            },
            orderBy: {
                created_at: "desc",
            },
            take: limit,
            skip: offset,
        });
        return errorLogs;
    }),
    getByStatusCode: (statusCode_1, ...args_1) => __awaiter(void 0, [statusCode_1, ...args_1], void 0, function* (statusCode, limit = 100, offset = 0) {
        const errorLogs = yield prisma_client_1.default.errorLog.findMany({
            where: { status_code: statusCode },
            select: {
                id: true,
                message: true,
                source: true,
                code: true,
                status_code: true,
                path: true,
                method: true,
                created_at: true,
            },
            orderBy: {
                created_at: "desc",
            },
            take: limit,
            skip: offset,
        });
        return errorLogs;
    }),
    getByUserId: (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, limit = 100, offset = 0) {
        const errorLogs = yield prisma_client_1.default.errorLog.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                message: true,
                source: true,
                code: true,
                status_code: true,
                path: true,
                method: true,
                created_at: true,
            },
            orderBy: {
                created_at: "desc",
            },
            take: limit,
            skip: offset,
        });
        return errorLogs;
    }),
    getStats: () => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [totalErrors, errorsLastHour, errorsLastDay, errorsLastWeek, errorsBySource, errorsByStatusCode] = yield Promise.all([
            prisma_client_1.default.errorLog.count(),
            prisma_client_1.default.errorLog.count({
                where: {
                    created_at: { gte: oneHourAgo },
                },
            }),
            prisma_client_1.default.errorLog.count({
                where: {
                    created_at: { gte: oneDayAgo },
                },
            }),
            prisma_client_1.default.errorLog.count({
                where: {
                    created_at: { gte: oneWeekAgo },
                },
            }),
            prisma_client_1.default.errorLog.groupBy({
                by: ["source"],
                _count: {
                    id: true,
                },
            }),
            prisma_client_1.default.errorLog.groupBy({
                by: ["status_code"],
                _count: {
                    id: true,
                },
            }),
        ]);
        return {
            total_errors: totalErrors,
            errors_last_hour: errorsLastHour,
            errors_last_day: errorsLastDay,
            errors_last_week: errorsLastWeek,
            errors_by_source: errorsBySource.map((item) => ({
                source: item.source,
                count: item._count.id,
            })),
            errors_by_status_code: errorsByStatusCode.map((item) => ({
                status_code: item.status_code,
                count: item._count.id,
            })),
        };
    }),
};
exports.default = exports.errorLogs;
