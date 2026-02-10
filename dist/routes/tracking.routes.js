"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const tracking_controller_1 = __importDefault(require("../controllers/tracking.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
/**
 * Tracking Routes
 * Following: RESTful API design
 *
 * Public endpoints (no auth):
 * - GET /tracking/:trackingNumber - Public tracking view
 *
 * Internal endpoints (auth required):
 * - GET /tracking/:trackingNumber/full - Full internal tracking
 * - GET /tracking/search - Search parcels
 * - GET /tracking/:trackingNumber/history - Location history
 * - GET /tracking/:trackingNumber/last-scan - Last scan info
 */
const router = (0, express_1.Router)();
// Roles that can view internal tracking
const INTERNAL_VIEW_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.FORWARDER_RESELLER,
    client_1.Roles.AGENCY_ADMIN,
    client_1.Roles.AGENCY_SUPERVISOR,
    client_1.Roles.AGENCY_SALES,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
    client_1.Roles.CARRIER_WAREHOUSE_WORKER,
    client_1.Roles.CARRIER_ISSUES_MANAGER,
    client_1.Roles.MESSENGER,
];
// === Validation Schemas ===
const trackingNumberParamSchema = zod_1.z.object({
    trackingNumber: zod_1.z.string().min(1, "Tracking number is required"),
});
const searchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional().default(""),
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
});
// === Public Routes (No Auth) ===
// GET /tracking/:trackingNumber - Public tracking (customer view)
router.get("/:trackingNumber", (0, validate_middleware_1.validate)({ params: trackingNumberParamSchema }), tracking_controller_1.default.getPublicTracking);
// === Internal Routes (Auth Required) ===
// GET /tracking/search - Search parcels by tracking number
router.get("/", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(INTERNAL_VIEW_ROLES), (0, validate_middleware_1.validate)({ query: searchQuerySchema }), tracking_controller_1.default.search);
// GET /tracking/:trackingNumber/full - Full internal tracking (staff only)
router.get("/:trackingNumber/full", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(INTERNAL_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: trackingNumberParamSchema }), tracking_controller_1.default.getInternalTracking);
// GET /tracking/:trackingNumber/history - Location history
router.get("/:trackingNumber/history", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(INTERNAL_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: trackingNumberParamSchema }), tracking_controller_1.default.getLocationHistory);
// GET /tracking/:trackingNumber/last-scan - Last scan info
router.get("/:trackingNumber/last-scan", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(INTERNAL_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: trackingNumberParamSchema }), tracking_controller_1.default.getLastScan);
exports.default = router;
