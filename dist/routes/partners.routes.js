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
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const partner_auth_middleware_1 = require("../middlewares/partner.auth.middleware");
const controllers_1 = __importDefault(require("../controllers"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const zod_1 = require("zod");
const app_errors_1 = require("../common/app-errors");
const client_1 = require("@prisma/client");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const types_1 = require("../types/types");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const utils_1 = require("../utils/utils");
const router = (0, express_1.Router)();
// ============================================
// ADMIN ROUTES - Partner Management
// ============================================
/**
 * GET /partners
 * Get all partners (admin only)
 */
/**Find partner by agency id */
router.get("/admin/agency/:agencyId", auth_middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { agencyId } = req.params;
    const partners = yield prisma_client_1.default.partner.findMany({
        where: {
            agency_id: parseInt(agencyId),
        },
    });
    res.status(200).json(partners);
}));
router.get("/admin", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.getAll(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * GET /partners/:id
 * Get partner by ID (admin or partner's agency)
 */
router.get("/admin/:id", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.getById(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * POST /partners
 * Create a new partner (admin or agency admin)
 */
router.post("/admin", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.create(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * PUT /partners/:id
 * Update partner (admin or partner's agency)
 */
router.put("/admin/:id", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.update(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * DELETE /partners/:id
 * Delete partner (admin only)
 */
router.delete("/admin/:id", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.delete(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * POST /partners/:id/api-keys
 * Create a new API key for a partner
 * Body: { name?: string, environment?: "live" | "test", expires_in_days?: number }
 */
router.post("/admin/:id/api-keys", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.createApiKey(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * GET /partners/:id/api-keys
 * Get all API keys for a partner (metadata only, not actual keys)
 */
router.get("/admin/:id/api-keys", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.getApiKeys(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * POST /partners/:id/api-keys/:keyId/revoke
 * Revoke (soft delete) an API key
 */
router.post("/admin/:id/api-keys/:keyId/revoke", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.revokeApiKey(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * DELETE /partners/:id/api-keys/:keyId
 * Permanently delete an API key (ROOT only)
 */
router.delete("/admin/:id/api-keys/:keyId", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.deleteApiKey(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * GET /partners/:id/logs
 * Get partner request logs
 */
router.get("/admin/:id/logs", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.getLogs(req, res);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * GET /partners/:id/stats
 * Get partner statistics
 */
router.get("/admin/:id/stats", auth_middleware_1.authMiddleware, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield controllers_1.default.partners.getStats(req, res);
    }
    catch (error) {
        next(error);
    }
}));
// ============================================
// PARTNER API ROUTES - External Integration
// ============================================
const partnerOrderItemSchema = zod_1.z.object({
    description: zod_1.z.string().min(1),
    rate_id: zod_1.z.number().positive(),
    weight: zod_1.z.number().positive(),
    price_in_cents: zod_1.z.number().optional(),
    unit: zod_1.z.nativeEnum(client_1.Unit).optional().default(client_1.Unit.PER_LB),
    insurance_fee_in_cents: zod_1.z.number().optional(),
    delivery_fee_in_cents: zod_1.z.number().optional(),
    customs_fee_in_cents: zod_1.z.number().optional(),
    charge_fee_in_cents: zod_1.z.number().optional(),
    external_reference: zod_1.z.string().optional(),
});
const partnerReceiverSchema = zod_1.z
    .object({
    first_name: zod_1.z.optional(zod_1.z.string({ required_error: "First name is required" }).min(1)),
    middle_name: zod_1.z.string().nullish(),
    last_name: zod_1.z.optional(zod_1.z.string({ required_error: "Last name is required" }).min(1)),
    second_last_name: zod_1.z.string().nullish(),
    ci: zod_1.z.optional(zod_1.z.string({ required_error: "CI is required" }).length(11, "Receiver CI must be 11 characters long.")), // Carnet de Identidad
    passport: zod_1.z.string().nullish(),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal("")]).nullish(),
    mobile: zod_1.z.string().nullish(),
    phone: zod_1.z.string().nullish(),
    address: zod_1.z.string().nullish(),
    province: zod_1.z.string().nullish(),
    city: zod_1.z.string().nullish(),
    province_id: zod_1.z.number().int().positive().optional().nullable(),
    city_id: zod_1.z.number().int().positive().optional().nullable(),
})
    .refine((data) => !data.ci || (typeof data.ci === "string" && data.ci.length === 11 && (0, utils_1.isValidCubanCI)(data.ci)), {
    message: "CI (Carnet de Identidad) format or check digit is invalid",
    path: ["ci"],
});
const partnerOrderSchema = zod_1.z.object({
    partner_order_id: zod_1.z.string().optional(),
    partner_id: zod_1.z.number().optional(),
    customer_id: zod_1.z.number().optional(),
    customer: types_1.createCustomerSchema.optional(),
    receiver_id: zod_1.z.number().optional(),
    receiver: partnerReceiverSchema.optional(),
    service_id: zod_1.z.number().positive(),
    order_items: zod_1.z.array(partnerOrderItemSchema).min(1).optional(),
    total_delivery_fee_in_cents: zod_1.z.number().int().min(0).optional().default(0),
    requires_home_delivery: zod_1.z.boolean().optional().default(true),
});
/**
 * POST /partners/api/orders
 * Create order via Partner API
 * Requires API key authentication
 */
/**
 * POST /partners/api/orders
 * Create order via Partner API
 * Requires API key authentication
 */
router.post("/orders", partner_auth_middleware_1.partnerAuthMiddleware, partner_auth_middleware_1.partnerLogMiddleware, (0, validate_middleware_1.validate)({ body: partnerOrderSchema }), controllers_1.default.partners.createOrder);
/**
 * GET /partners/api/rates
 * Get rates via Partner API
 * Requires API key authentication
 */
router.get("/services", partner_auth_middleware_1.partnerAuthMiddleware, partner_auth_middleware_1.partnerLogMiddleware, controllers_1.default.partners.getServices);
router.get("/customs-rates", partner_auth_middleware_1.partnerAuthMiddleware, partner_auth_middleware_1.partnerLogMiddleware, controllers_1.default.customsRates.search);
/**
 * GET /partners/api/orders/:id
 * Get order details via Partner API
 * Requires API key authentication
 */
router.get("/orders/:id", partner_auth_middleware_1.partnerAuthMiddleware, partner_auth_middleware_1.partnerLogMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const partner = req.partner;
        const { id } = req.params;
        if (!partner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "Partner authentication required");
        }
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid order ID is required");
        }
        // Get order and verify it belongs to partner
        const order = yield prisma_client_1.default.order.findFirst({
            where: {
                id: parseInt(id),
                agency_id: partner.agency_id,
            },
            include: {
                customer: {
                    select: {
                        first_name: true,
                        last_name: true,
                        mobile: true,
                        email: true,
                    },
                },
                receiver: {
                    select: {
                        first_name: true,
                        last_name: true,
                        mobile: true,
                        address: true,
                        province: { select: { name: true } },
                        city: { select: { name: true } },
                    },
                },
                service: {
                    select: {
                        name: true,
                        service_type: true,
                    },
                },
                order_items: {
                    select: {
                        hbl: true,
                        description: true,
                        weight: true,
                        price_in_cents: true,
                        charge_fee_in_cents: true,
                        delivery_fee_in_cents: true,
                        insurance_fee_in_cents: true,
                        customs_fee_in_cents: true,
                        unit: true,
                        parcel: {
                            select: { external_reference: true },
                        },
                    },
                    orderBy: { hbl: "asc" },
                },
            },
        });
        if (!order) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
        }
        res.status(200).json({
            status: "success",
            data: order,
        });
    }
    catch (error) {
        console.error("Partner API get order error:", error);
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({
                status: "error",
                message: error.message,
            });
        }
        res.status(500).json({
            status: "error",
            message: "Error retrieving order",
            error: error.message || error,
        });
    }
}));
/**
 * GET /partners/api/tracking/:hbl
 * Track package by HBL via Partner API
 * Requires API key authentication
 */
router.get("/tracking/:hbl", partner_auth_middleware_1.partnerAuthMiddleware, partner_auth_middleware_1.partnerLogMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const partner = req.partner;
        const { hbl } = req.params;
        if (!partner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "Partner authentication required");
        }
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "HBL tracking number is required");
        }
        // Get item with invoice info
        const item = yield prisma_client_1.default.orderItem.findFirst({
            where: {
                hbl: hbl,
                agency_id: partner.agency_id,
            },
            select: {
                hbl: true,
                description: true,
                weight: true,
                status: true,
                created_at: true,
                updated_at: true,
                order: {
                    select: {
                        id: true,
                        status: true,
                        payment_status: true,
                        created_at: true,
                        receiver: {
                            select: {
                                first_name: true,
                                last_name: true,
                                city: { select: { name: true } },
                                province: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!item) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Tracking number not found");
        }
        res.status(200).json({
            status: "success",
            data: item,
        });
    }
    catch (error) {
        console.error("Partner API tracking error:", error);
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({
                status: "error",
                message: error.message,
            });
        }
        res.status(500).json({
            status: "error",
            message: "Error tracking package",
            error: error.message || error,
        });
    }
}));
exports.default = router;
