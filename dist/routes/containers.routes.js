"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const containers_controller_1 = __importDefault(require("../controllers/containers.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
// Roles that can manage containers (forwarder level)
const CONTAINER_ADMIN_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.FORWARDER_RESELLER,
];
// Roles that can view containers
const CONTAINER_VIEW_ROLES = [
    ...CONTAINER_ADMIN_ROLES,
    client_1.Roles.AGENCY_ADMIN,
    client_1.Roles.AGENCY_SUPERVISOR,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
];
// === Validation Schemas ===
const createContainerSchema = zod_1.z.object({
    container_name: zod_1.z.string().min(1, "Container name is required").max(100),
    container_number: zod_1.z.string().min(1, "Container number is required"),
    bl_number: zod_1.z.string().optional(),
    booking_number: zod_1.z.string().optional(),
    cat_number: zod_1.z.string().optional(),
    seal_number: zod_1.z.string().optional(),
    container_type: zod_1.z.nativeEnum(client_1.ContainerType).default(client_1.ContainerType.DRY_40FT),
    vessel_name: zod_1.z.string().optional(),
    voyage_number: zod_1.z.string().optional(),
    origin_port: zod_1.z.string().min(1, "Origin port is required"),
    destination_port: zod_1.z.string().min(1, "Destination port is required"),
    max_weight_kg: zod_1.z.number().positive().optional(),
    estimated_departure: zod_1.z.string().datetime().optional(),
    estimated_arrival: zod_1.z.string().datetime().optional(),
    provider_id: zod_1.z.number().int().positive("Provider ID is required"),
    notes: zod_1.z.string().optional(),
});
const updateContainerSchema = zod_1.z.object({
    container_name: zod_1.z.string().min(1).max(100).optional(),
    container_number: zod_1.z.string().min(1).optional(),
    bl_number: zod_1.z.string().optional(),
    seal_number: zod_1.z.string().optional(),
    booking_number: zod_1.z.string().optional(),
    cat_number: zod_1.z.string().optional(),
    container_type: zod_1.z.nativeEnum(client_1.ContainerType).optional(),
    vessel_name: zod_1.z.string().optional(),
    voyage_number: zod_1.z.string().optional(),
    origin_port: zod_1.z.string().min(1).optional(),
    destination_port: zod_1.z.string().min(1).optional(),
    max_weight_kg: zod_1.z.number().positive().optional(),
    status: zod_1.z.nativeEnum(client_1.ContainerStatus).optional(),
    estimated_departure: zod_1.z.string().datetime().optional(),
    estimated_arrival: zod_1.z.string().datetime().optional(),
    actual_departure: zod_1.z.string().datetime().optional(),
    actual_arrival: zod_1.z.string().datetime().optional(),
    provider_id: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().optional(),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.ContainerStatus),
    location: zod_1.z.string().optional(),
    seal_number: zod_1.z.string().optional(),
    booking_number: zod_1.z.string().optional(),
    cat_number: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
});
const addParcelSchema = zod_1.z.object({
    tracking_number: zod_1.z.string().min(1, "Tracking number is required"),
});
const addParcelsByOrderSchema = zod_1.z.object({
    order_id: zod_1.z.number().int().positive("Order ID is required"),
});
const addParcelsByDispatchSchema = zod_1.z.object({
    dispatch_id: zod_1.z.number().int().positive("Dispatch ID is required"),
});
const idParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});
const paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
    status: zod_1.z.nativeEnum(client_1.ContainerStatus).optional(),
});
// === Routes ===
// GET /containers - Get all containers
router.get("/", (0, auth_middleware_1.requireRoles)(CONTAINER_VIEW_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), containers_controller_1.default.getAll);
// GET /containers/ready-parcels - Get parcels ready to be added to container
router.get("/ready-for-container", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), containers_controller_1.default.getReadyForContainer);
// GET /containers/by-number/:containerNumber - Get container by container number
router.get("/by-number/:containerNumber", (0, auth_middleware_1.requireRoles)(CONTAINER_VIEW_ROLES), containers_controller_1.default.getByContainerNumber);
// GET /containers/:id - Get container by ID
router.get("/:id", (0, auth_middleware_1.requireRoles)(CONTAINER_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), containers_controller_1.default.getById);
// POST /containers - Create a new container
router.post("/", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ body: createContainerSchema }), containers_controller_1.default.create);
// PUT /containers/:id - Update container
router.put("/:id", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: updateContainerSchema }), containers_controller_1.default.update);
// DELETE /containers/:id - Delete container
router.delete("/:id", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), containers_controller_1.default.delete);
// GET /containers/:id/parcels - Get parcels in container
router.get("/:id/parcels", (0, auth_middleware_1.requireRoles)(CONTAINER_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, query: paginationQuerySchema }), containers_controller_1.default.getParcels);
// POST /containers/:id/parcels - Add parcel to container
router.post("/:id/parcels", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelSchema }), containers_controller_1.default.addParcel);
// POST /containers/:id/parcels/by-order - Add all parcels from an order to container
router.post("/:id/parcels/by-order", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelsByOrderSchema }), containers_controller_1.default.addParcelsByOrderId);
// POST /containers/:id/parcels/by-dispatch - Add all parcels from a dispatch to container
router.post("/:id/parcels/by-dispatch", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelsByDispatchSchema }), containers_controller_1.default.addParcelsByDispatchId);
// DELETE /containers/:id/parcels/:trackingNumber - Remove parcel from container
router.delete("/:id/parcels/:trackingNumber", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), containers_controller_1.default.removeParcel);
// PATCH /containers/:id/status - Update container status
router.patch("/:id/status", (0, auth_middleware_1.requireRoles)(CONTAINER_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: updateStatusSchema }), containers_controller_1.default.updateStatus);
// GET /containers/:id/events - Get container events
router.get("/:id/events", (0, auth_middleware_1.requireRoles)(CONTAINER_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), containers_controller_1.default.getEvents);
// GET /containers/:id/manifest - Get container manifest data (JSON)
router.get("/:id/manifest", (0, auth_middleware_1.requireRoles)(CONTAINER_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), containers_controller_1.default.getManifestData);
// GET /containers/:id/manifest/excel - Export container manifest as Excel
router.get("/:id/manifest/excel", (0, auth_middleware_1.requireRoles)(CONTAINER_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), containers_controller_1.default.exportManifestExcel);
exports.default = router;
