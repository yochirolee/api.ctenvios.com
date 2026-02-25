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
exports.partners = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
const apiKeyUtils_1 = require("../utils/apiKeyUtils");
exports.partners = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const partners = yield prisma_client_1.default.partner.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                contact_name: true,
                phone: true,
                is_active: true,
                rate_limit: true,
                agency_id: true,
                agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                forwarder: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                created_at: true,
                updated_at: true,
                _count: {
                    select: {
                        orders: true,
                        partner_logs: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });
        return partners;
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const partner = yield prisma_client_1.default.partner.findUnique({
            select: {
                id: true,
                name: true,
                email: true,
                contact_name: true,
                phone: true,
                is_active: true,
                rate_limit: true,
                agency_id: true,
                forwarder_id: true,
                agency: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                forwarder: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                api_keys: {
                    select: {
                        id: true,
                        prefix: true,
                        name: true,
                        is_active: true,
                        expires_at: true,
                        created_at: true,
                        last_used: true,
                    },
                    where: {
                        is_active: true,
                    },
                },
                created_at: true,
                updated_at: true,
                _count: {
                    select: {
                        partner_logs: true,
                        api_keys: true,
                    },
                },
            },
            where: { id },
        });
        return partner;
    }),
    getByApiKey: (apiKey) => __awaiter(void 0, void 0, void 0, function* () {
        // Hash the provided API key to compare with stored hash
        const keyHash = (0, apiKeyUtils_1.hashApiKey)(apiKey);
        // Find the API key record
        const apiKeyRecord = yield prisma_client_1.default.apiKey.findUnique({
            where: {
                key_hash: keyHash,
            },
            include: {
                partner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        contact_name: true,
                        phone: true,
                        is_active: true,
                        rate_limit: true,
                        agency_id: true,
                        forwarder_id: true,
                        agency: {
                            select: {
                                id: true,
                                name: true,
                                forwarder_id: true,
                            },
                        },
                        forwarder: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        if (!apiKeyRecord || !apiKeyRecord.is_active || !apiKeyRecord.partner.is_active) {
            return null;
        }
        // Check if API key is expired
        if (apiKeyRecord.expires_at && new Date() > apiKeyRecord.expires_at) {
            return null;
        }
        // Update last_used timestamp asynchronously (don't block the request)
        prisma_client_1.default.apiKey
            .update({
            where: { id: apiKeyRecord.id },
            data: { last_used: new Date() },
        })
            .catch((err) => console.error("Failed to update API key last_used:", err));
        return Object.assign(Object.assign({}, apiKeyRecord.partner), { api_key_id: apiKeyRecord.id });
    }),
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        const partner = yield prisma_client_1.default.partner.create({
            data,
            select: {
                id: true,
                name: true,
                email: true,
                contact_name: true,
                phone: true,
                is_active: true,
                rate_limit: true,
                agency_id: true,
                forwarder_id: true,
            },
        });
        return partner;
    }),
    update: (id, data) => __awaiter(void 0, void 0, void 0, function* () {
        const partner = yield prisma_client_1.default.partner.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                contact_name: true,
                phone: true,
                is_active: true,
                rate_limit: true,
                agency_id: true,
                forwarder_id: true,
                updated_at: true,
            },
        });
        return partner;
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const partner = yield prisma_client_1.default.partner.delete({
            where: { id },
            select: {
                id: true,
                name: true,
            },
        });
        return partner;
    }),
    createApiKey: (partnerId_1, ...args_1) => __awaiter(void 0, [partnerId_1, ...args_1], void 0, function* (partnerId, options = {}) {
        const { name, environment = "live", expiresAt } = options;
        // Generate secure API key
        const { displayKey, hashedKey, prefix } = (0, apiKeyUtils_1.generateApiKey)(environment);
        // Store in database (including plain key for retrieval)
        const apiKey = yield prisma_client_1.default.apiKey.create({
            data: {
                key_hash: hashedKey,
                key_plain: displayKey,
                prefix,
                name,
                expires_at: expiresAt,
                partner: {
                    connect: { id: partnerId },
                },
            },
            select: {
                id: true,
                prefix: true,
            },
        });
        return {
            id: apiKey.id,
            displayKey,
            prefix: apiKey.prefix,
        };
    }),
    getApiKeys: (partnerId) => __awaiter(void 0, void 0, void 0, function* () {
        const apiKeys = yield prisma_client_1.default.apiKey.findMany({
            where: { partner_id: partnerId },
            select: {
                id: true,
                prefix: true,
                key_plain: true,
                name: true,
                is_active: true,
                expires_at: true,
                created_at: true,
                last_used: true,
            },
            orderBy: { created_at: "desc" },
        });
        return apiKeys;
    }),
    revokeApiKey: (apiKeyId) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.apiKey.update({
            where: { id: apiKeyId },
            data: { is_active: false },
        });
    }),
    deleteApiKey: (apiKeyId) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.apiKey.delete({
            where: { id: apiKeyId },
        });
    }),
    logRequest: (data) => __awaiter(void 0, void 0, void 0, function* () {
        const log = yield prisma_client_1.default.partnerLog.create({
            data: {
                partner_id: data.partner_id,
                api_key_id: data.api_key_id,
                endpoint: data.endpoint,
                method: data.method,
                status_code: data.status_code,
                request_body: data.request_body || client_1.Prisma.JsonNull,
                response_body: data.response_body || client_1.Prisma.JsonNull,
                ip_address: data.ip_address,
                user_agent: data.user_agent,
            },
        });
        return log;
    }),
    getLogs: (partnerId_1, ...args_1) => __awaiter(void 0, [partnerId_1, ...args_1], void 0, function* (partnerId, limit = 100, offset = 0) {
        const logs = yield prisma_client_1.default.partnerLog.findMany({
            where: { partner_id: partnerId },
            select: {
                id: true,
                endpoint: true,
                method: true,
                status_code: true,
                ip_address: true,
                created_at: true,
            },
            orderBy: { created_at: "desc" },
            take: limit,
            skip: offset,
        });
        return logs;
    }),
    getStats: (partnerId) => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const [requestsLastHour, requestsLastDay, totalInvoices, totalRequests] = yield Promise.all([
            prisma_client_1.default.partnerLog.count({
                where: {
                    partner_id: partnerId,
                    created_at: { gte: oneHourAgo },
                },
            }),
            prisma_client_1.default.partnerLog.count({
                where: {
                    partner_id: partnerId,
                    created_at: { gte: oneDayAgo },
                },
            }),
            prisma_client_1.default.order.count({
                where: { partner_id: partnerId },
            }),
            prisma_client_1.default.partnerLog.count({
                where: { partner_id: partnerId },
            }),
        ]);
        return {
            requests_last_hour: requestsLastHour,
            requests_last_day: requestsLastDay,
            total_invoices: totalInvoices,
            total_requests: totalRequests,
        };
    }),
};
exports.default = exports.partners;
