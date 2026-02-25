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
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return prisma_client_1.default.appLog.findUnique({
            where: { id: parseInt(id) },
        });
    }),
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
    getAll: (_a) => __awaiter(void 0, [_a], void 0, function* ({ page, limit, filters }) {
        const where = {};
        if (filters === null || filters === void 0 ? void 0 : filters.level) {
            where.level = filters.level;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.source) {
            where.source = filters.source;
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.status_code) !== undefined) {
            where.status_code = filters.status_code;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.user_id) {
            where.user_id = filters.user_id;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.path) {
            where.path = { contains: filters.path, mode: "insensitive" };
        }
        if (filters === null || filters === void 0 ? void 0 : filters.method) {
            where.method = filters.method.toUpperCase();
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
            where.created_at = {};
            if (filters.startDate) {
                where.created_at.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.created_at.lte = filters.endDate;
            }
        }
        const logs = yield prisma_client_1.default.appLog.findMany({
            where,
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
            skip: (page - 1) * limit,
        });
        return logs;
    }),
    countAll: (filters) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {};
        if (filters === null || filters === void 0 ? void 0 : filters.level) {
            where.level = filters.level;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.source) {
            where.source = filters.source;
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.status_code) !== undefined) {
            where.status_code = filters.status_code;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.user_id) {
            where.user_id = filters.user_id;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.path) {
            where.path = { contains: filters.path, mode: "insensitive" };
        }
        if (filters === null || filters === void 0 ? void 0 : filters.method) {
            where.method = filters.method.toUpperCase();
        }
        if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
            where.created_at = {};
            if (filters.startDate) {
                where.created_at.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.created_at.lte = filters.endDate;
            }
        }
        return prisma_client_1.default.appLog.count({ where });
    }),
    getByLevel: (level_1, _a) => __awaiter(void 0, [level_1, _a], void 0, function* (level, { page, limit }) {
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
            skip: (page - 1) * limit,
        });
        return logs;
    }),
    countByLevel: (level) => __awaiter(void 0, void 0, void 0, function* () {
        return prisma_client_1.default.appLog.count({
            where: { level },
        });
    }),
    getBySource: (source_1, _a) => __awaiter(void 0, [source_1, _a], void 0, function* (source, { page, limit }) {
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
            skip: (page - 1) * limit,
        });
        return logs;
    }),
    countBySource: (source) => __awaiter(void 0, void 0, void 0, function* () {
        return prisma_client_1.default.appLog.count({
            where: { source },
        });
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
    deleteAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield prisma_client_1.default.appLog.deleteMany({});
        return result.count;
    }),
    deleteById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.appLog.delete({
            where: { id },
        });
    }),
    deleteByDateRange: (startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield prisma_client_1.default.appLog.deleteMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });
        return result.count;
    }),
    deleteByLevel: (level) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield prisma_client_1.default.appLog.deleteMany({
            where: { level },
        });
        return result.count;
    }),
    deleteBySource: (source) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield prisma_client_1.default.appLog.deleteMany({
            where: { source },
        });
        return result.count;
    }),
    deleteOlderThan: (days) => __awaiter(void 0, void 0, void 0, function* () {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const result = yield prisma_client_1.default.appLog.deleteMany({
            where: {
                created_at: {
                    lt: cutoffDate,
                },
            },
        });
        return result.count;
    }),
};
exports.default = exports.appLogs;
