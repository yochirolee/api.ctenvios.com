"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const pallets_controller_1 = __importDefault(require("../controllers/pallets.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_2 = require("../middlewares/auth.middleware");
/**
 * Pallets Routes
 * Following: RESTful API design
 */
const router = (0, express_1.Router)();
// Roles that can manage pallets (agency level)
const PALLET_ADMIN_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.FORWARDER_RESELLER,
    client_1.Roles.AGENCY_ADMIN,
    client_1.Roles.AGENCY_SUPERVISOR,
];
// Roles that can view pallets
const PALLET_VIEW_ROLES = [...PALLET_ADMIN_ROLES, client_1.Roles.AGENCY_SALES];
// === Validation Schemas ===
const updatePalletSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
});
const addParcelSchema = zod_1.z.object({
    tracking_number: zod_1.z.string().min(1, "Tracking number is required"),
});
const addParcelsByOrderSchema = zod_1.z.object({
    order_id: zod_1.z.number().int().positive("Order ID is required"),
});
const idParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});
const paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
    status: zod_1.z.nativeEnum(client_1.PalletStatus).optional(),
});
// === Routes ===
// GET /pallets - Get all pallets
router.get("/", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_VIEW_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), pallets_controller_1.default.getAll);
// GET /pallets/ready-for-pallet - Get parcels ready to be added to pallet
router.get("/ready-for-pallet", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), pallets_controller_1.default.getReadyForPallet);
// GET /pallets/by-number/:palletNumber - Get pallet by pallet number
router.get("/by-number/:palletNumber", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_VIEW_ROLES), pallets_controller_1.default.getByPalletNumber);
// GET /pallets/:id - Get pallet by ID
router.get("/:id", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), pallets_controller_1.default.getById);
// GET /pallets/:id/label-pdf - Generate pallet label PDF (4x6)
router.get("/:id/label-pdf", (0, validate_middleware_1.validate)({ params: idParamSchema }), pallets_controller_1.default.generateLabelPdf);
// POST /pallets - Create a new pallet
router.post("/", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), pallets_controller_1.default.create);
// PUT /pallets/:id - Update pallet
router.put("/:id", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: updatePalletSchema }), pallets_controller_1.default.update);
// DELETE /pallets/:id - Delete pallet
router.delete("/:id", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), pallets_controller_1.default.delete);
// GET /pallets/:id/parcels - Get parcels in pallet
router.get("/:id/parcels", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, query: paginationQuerySchema }), pallets_controller_1.default.getParcels);
// POST /pallets/:id/parcels - Add parcel to pallet (canonical)
router.post("/:id/parcels", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelSchema }), pallets_controller_1.default.addParcel);
// POST /pallets/:id/parcels/by-order - Add all parcels from an order to pallet
router.post("/:id/parcels/by-order", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelsByOrderSchema }), pallets_controller_1.default.addParcelsByOrderId);
// POST /pallets/:id/add-parcel - Backward-compatible alias
router.post("/:id/add-parcel", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelSchema }), pallets_controller_1.default.addParcel);
// Backward-compatible alias (some clients call without "/parcels")
// DELETE /pallets/:id/remove-parcel/:trackingNumber
router.delete("/:id/remove-parcel/:trackingNumber", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
        trackingNumber: zod_1.z.string().min(1, "Tracking number is required"),
    }),
}), pallets_controller_1.default.removeParcel);
// POST /pallets/:id/seal - Seal pallet
router.post("/:id/seal", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), pallets_controller_1.default.seal);
// POST /pallets/:id/unseal - Unseal pallet
router.post("/:id/unseal", auth_middleware_2.authMiddleware, (0, auth_middleware_1.requireRoles)(PALLET_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), pallets_controller_1.default.unseal);
exports.default = router;
