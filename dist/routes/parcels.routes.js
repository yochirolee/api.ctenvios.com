"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const parcels_controller_1 = __importDefault(require("../controllers/parcels.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
// Roles that can manage parcels
const PARCEL_ADMIN_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.FORWARDER_RESELLER,
    client_1.Roles.AGENCY_ADMIN,
    client_1.Roles.AGENCY_SUPERVISOR,
    client_1.Roles.AGENCY_SALES,
];
// Roles that can view parcels
const PARCEL_VIEW_ROLES = [...PARCEL_ADMIN_ROLES, client_1.Roles.CARRIER_OWNER, client_1.Roles.CARRIER_ADMIN, client_1.Roles.MESSENGER];
// === Validation Schemas ===
const listQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(25),
    status: zod_1.z.nativeEnum(client_1.Status).optional(),
    hbl: zod_1.z.string().optional(),
    q: zod_1.z.string().optional(),
    order_id: zod_1.z.coerce.number().int().positive().optional(),
    description: zod_1.z.string().optional(),
    customer: zod_1.z.string().optional(),
    receiver: zod_1.z.string().optional(),
    agency_id: zod_1.z.coerce.number().int().positive().optional(),
    dispatch_id_null: zod_1.z.enum(["true", "false", "1", "0"]).optional(),
    container_id_null: zod_1.z.enum(["true", "false", "1", "0"]).optional(),
    flight_id_null: zod_1.z.enum(["true", "false", "1", "0"]).optional(),
    forwarder_id: zod_1.z.coerce.number().int().positive().optional(),
    scope: zod_1.z.enum(["agency", "forwarder"]).optional(),
    ready_for: zod_1.z.enum(["dispatch", "container"]).optional(),
});
const hblParamSchema = zod_1.z.object({
    hbl: zod_1.z.string().min(1, "HBL is required"),
});
const orderIdParamSchema = zod_1.z.object({
    orderId: zod_1.z.string().regex(/^\d+$/, "Order ID must be a number"),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.Status),
    notes: zod_1.z.string().optional(),
});
// === Routes ===
// GET /parcels - Unified list: filter by status, search by hbl or q, filter by order_id; optional ready_for=dispatch|container
router.get("/", (0, auth_middleware_1.requireRoles)(PARCEL_VIEW_ROLES), (0, validate_middleware_1.validate)({ query: listQuerySchema }), parcels_controller_1.default.getAll);
// GET /parcels/in-agency - Get parcels in user's agency (not dispatched) – kept for backward compatibility
router.get("/in-agency", (0, auth_middleware_1.requireRoles)(PARCEL_ADMIN_ROLES), (0, validate_middleware_1.validate)({ query: listQuerySchema.pick({ page: true, limit: true }) }), parcels_controller_1.default.getInAgency);
// GET /parcels/track/:hbl - Public tracking (no auth)
router.get("/track/:hbl", (0, validate_middleware_1.validate)({ params: hblParamSchema }), parcels_controller_1.default.track);
// GET /parcels/order/:orderId - Get parcels by order ID
router.get("/order/:orderId", (0, auth_middleware_1.requireRoles)(PARCEL_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: orderIdParamSchema }), parcels_controller_1.default.getByOrderId);
// GET /parcels/:hbl - Get parcel by HBL
router.get("/:hbl", (0, auth_middleware_1.requireRoles)(PARCEL_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: hblParamSchema }), parcels_controller_1.default.getByHbl);
// GET /parcels/:hbl/events - Get parcel events/history
router.get("/:hbl/events", (0, auth_middleware_1.requireRoles)(PARCEL_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: hblParamSchema }), parcels_controller_1.default.getEvents);
// PATCH /parcels/:hbl/status - Update parcel status
router.patch("/:hbl/status", (0, auth_middleware_1.requireRoles)(PARCEL_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: hblParamSchema, body: updateStatusSchema }), parcels_controller_1.default.updateStatus);
exports.default = router;
