"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const manifest_verification_controller_1 = __importDefault(require("../controllers/manifest-verification.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
/**
 * Manifest Verification Routes
 * Following: RESTful API design
 */
const router = (0, express_1.Router)();
// Roles that can manage verifications
const VERIFICATION_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.FORWARDER_RESELLER,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
    client_1.Roles.CARRIER_WAREHOUSE_WORKER,
];
// === Validation Schemas ===
const startContainerVerificationSchema = zod_1.z.object({
    container_id: zod_1.z.number().int().positive("Container ID is required"),
});
const startFlightVerificationSchema = zod_1.z.object({
    flight_id: zod_1.z.number().int().positive("Flight ID is required"),
});
const scanParcelSchema = zod_1.z.object({
    tracking_number: zod_1.z.string().min(1, "Tracking number is required"),
});
const completeVerificationSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
});
const reportDamageSchema = zod_1.z.object({
    tracking_number: zod_1.z.string().min(1, "Tracking number is required"),
    notes: zod_1.z.string().optional(),
});
const resolveDiscrepancySchema = zod_1.z.object({
    resolution: zod_1.z.string().min(1, "Resolution is required"),
});
const idParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});
const discrepancyIdParamSchema = zod_1.z.object({
    discrepancyId: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});
const paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
    status: zod_1.z.nativeEnum(client_1.VerificationStatus).optional(),
    container_id: zod_1.z.coerce.number().int().positive().optional(),
    flight_id: zod_1.z.coerce.number().int().positive().optional(),
});
// === Routes ===
// GET /manifest-verifications - Get all verifications
router.get("/", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), manifest_verification_controller_1.default.getAll);
// GET /manifest-verifications/:id - Get verification by ID
router.get("/:id", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), manifest_verification_controller_1.default.getById);
// POST /manifest-verifications/container - Start container verification
router.post("/container", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ body: startContainerVerificationSchema }), manifest_verification_controller_1.default.startContainerVerification);
// POST /manifest-verifications/flight - Start flight verification
router.post("/flight", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ body: startFlightVerificationSchema }), manifest_verification_controller_1.default.startFlightVerification);
// POST /manifest-verifications/:id/scan - Scan parcel for verification
router.post("/:id/scan", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: scanParcelSchema }), manifest_verification_controller_1.default.scanParcel);
// POST /manifest-verifications/:id/complete - Complete verification
router.post("/:id/complete", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: completeVerificationSchema }), manifest_verification_controller_1.default.complete);
// POST /manifest-verifications/:id/damage - Report damaged parcel
router.post("/:id/damage", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: reportDamageSchema }), manifest_verification_controller_1.default.reportDamage);
// GET /manifest-verifications/:id/discrepancies - Get discrepancies for verification
router.get("/:id/discrepancies", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), manifest_verification_controller_1.default.getDiscrepancies);
// PATCH /manifest-verifications/discrepancies/:discrepancyId/resolve - Resolve discrepancy
router.patch("/discrepancies/:discrepancyId/resolve", (0, auth_middleware_1.requireRoles)(VERIFICATION_ROLES), (0, validate_middleware_1.validate)({ params: discrepancyIdParamSchema, body: resolveDiscrepancySchema }), manifest_verification_controller_1.default.resolveDiscrepancy);
exports.default = router;
