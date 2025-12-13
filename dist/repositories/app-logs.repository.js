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
exports.appLogs = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
exports.appLogs = {
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.appLog.create({
            data: {
                level: data.level,
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
                user_email: data.user_email,
            },
        });
    }),
    getAll: (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (limit = 100, offset = 0) {
        const logs = yield prisma_client_1.default.appLog.findMany({
            select: {
                id: true,
                level: true,
                message: true,
                source: true,
                code: true,
                status_code: true,
                path: true,
                method: true,
                user_email: true,
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
        return logs;
    }),
    getByLevel: (level_1, ...args_1) => __awaiter(void 0, [level_1, ...args_1], void 0, function* (level, limit = 100, offset = 0) {
        const logs = yield prisma_client_1.default.appLog.findMany({
            where: { level },
            select: {
                id: true,
                level: true,
                message: true,
                source: true,
                code: true,
                status_code: true,
                path: true,
                method: true,
                user_email: true,
                created_at: true,
            },
            orderBy: {
                created_at: "desc",
            },
            take: limit,
            skip: offset,
        });
        return logs;
    }),
    getBySource: (source_1, ...args_1) => __awaiter(void 0, [source_1, ...args_1], void 0, function* (source, limit = 100, offset = 0) {
        const logs = yield prisma_client_1.default.appLog.findMany({
            where: { source },
            select: {
                id: true,
                level: true,
                message: true,
                source: true,
                code: true,
                status_code: true,
                path: true,
                method: true,
                user_email: true,
                created_at: true,
            },
            orderBy: {
                created_at: "desc",
            },
            take: limit,
            skip: offset,
        });
        return logs;
    }),
    getStats: () => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [totalLogs, logsLastHour, logsLastDay, logsLastWeek, logsByLevel, logsBySource] = yield Promise.all([
            prisma_client_1.default.appLog.count(),
            prisma_client_1.default.appLog.count({
                where: {
                    created_at: { gte: oneHourAgo },
                },
            }),
            prisma_client_1.default.appLog.count({
                where: {
                    created_at: { gte: oneDayAgo },
                },
            }),
            prisma_client_1.default.appLog.count({
                where: {
                    created_at: { gte: oneWeekAgo },
                },
            }),
            prisma_client_1.default.appLog.groupBy({
                by: ["level"],
                _count: {
                    id: true,
                },
            }),
            prisma_client_1.default.appLog.groupBy({
                by: ["source"],
                _count: {
                    id: true,
                },
            }),
        ]);
        return {
            total_logs: totalLogs,
            logs_last_hour: logsLastHour,
            logs_last_day: logsLastDay,
            logs_last_week: logsLastWeek,
            logs_by_level: logsByLevel.map((item) => ({
                level: item.level,
                count: item._count.id,
            })),
            logs_by_source: logsBySource.map((item) => ({
                source: item.source,
                count: item._count.id,
            })),
        };
    }),
};
exports.default = exports.appLogs;
