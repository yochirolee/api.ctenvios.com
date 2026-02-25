"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const warehouses_controller_1 = __importDefault(require("../controllers/warehouses.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
/**
 * Warehouses Routes
 * Following: RESTful API design
 */
const router = (0, express_1.Router)();
// Roles that can manage warehouses
const WAREHOUSE_ADMIN_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
];
// Roles that can view warehouses
const WAREHOUSE_VIEW_ROLES = [
    ...WAREHOUSE_ADMIN_ROLES,
    client_1.Roles.CARRIER_WAREHOUSE_WORKER,
    client_1.Roles.CARRIER_ISSUES_MANAGER,
];
// Roles that can receive/transfer parcels
const WAREHOUSE_WORKER_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
    client_1.Roles.CARRIER_WAREHOUSE_WORKER,
];
// === Validation Schemas ===
const createWarehouseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required").max(100),
    address: zod_1.z.string().min(1, "Address is required"),
    carrier_id: zod_1.z.number().int().positive("Carrier ID is required"),
    province_id: zod_1.z.number().int().positive("Province ID is required"),
    is_main: zod_1.z.boolean().optional().default(false),
    manager_id: zod_1.z.string().uuid().optional(),
});
const updateWarehouseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    address: zod_1.z.string().min(1).optional(),
    is_main: zod_1.z.boolean().optional(),
    is_active: zod_1.z.boolean().optional(),
    manager_id: zod_1.z.string().uuid().nullable().optional(),
});
const receiveParcelSchema = zod_1.z.object({
    tracking_number: zod_1.z.string().min(1, "Tracking number is required"),
});
const transferParcelSchema = zod_1.z.object({
    to_warehouse_id: zod_1.z.number().int().positive("Destination warehouse ID is required"),
    tracking_number: zod_1.z.string().min(1, "Tracking number is required"),
});
const idParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});
const paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
    carrier_id: zod_1.z.coerce.number().int().positive().optional(),
    province_id: zod_1.z.coerce.number().int().positive().optional(),
    is_active: zod_1.z.enum(["true", "false"]).optional(),
});
// === Routes ===
// GET /warehouses - Get all warehouses
router.get("/", (0, auth_middleware_1.requireRoles)(WAREHOUSE_VIEW_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), warehouses_controller_1.default.getAll);
// GET /warehouses/my - Get my carrier's warehouses
router.get("/my", (0, auth_middleware_1.requireRoles)(WAREHOUSE_VIEW_ROLES), warehouses_controller_1.default.getMyWarehouses);
// GET /warehouses/carrier/:id - Get warehouses by carrier
router.get("/carrier/:id", (0, auth_middleware_1.requireRoles)(WAREHOUSE_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), warehouses_controller_1.default.getByCarrier);
// GET /warehouses/:id - Get warehouse by ID
router.get("/:id", (0, auth_middleware_1.requireRoles)(WAREHOUSE_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), warehouses_controller_1.default.getById);
// POST /warehouses - Create a new warehouse
router.post("/", (0, auth_middleware_1.requireRoles)(WAREHOUSE_ADMIN_ROLES), (0, validate_middleware_1.validate)({ body: createWarehouseSchema }), warehouses_controller_1.default.create);
// PUT /warehouses/:id - Update warehouse
router.put("/:id", (0, auth_middleware_1.requireRoles)(WAREHOUSE_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: updateWarehouseSchema }), warehouses_controller_1.default.update);
// DELETE /warehouses/:id - Delete warehouse
router.delete("/:id", (0, auth_middleware_1.requireRoles)(WAREHOUSE_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), warehouses_controller_1.default.delete);
// GET /warehouses/:id/parcels - Get parcels in warehouse
router.get("/:id/parcels", (0, auth_middleware_1.requireRoles)(WAREHOUSE_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, query: paginationQuerySchema }), warehouses_controller_1.default.getParcels);
// POST /warehouses/:id/receive - Receive parcel in warehouse
router.post("/:id/receive", (0, auth_middleware_1.requireRoles)(WAREHOUSE_WORKER_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: receiveParcelSchema }), warehouses_controller_1.default.receiveParcel);
// POST /warehouses/:id/transfer - Transfer parcel to another warehouse
router.post("/:id/transfer", (0, auth_middleware_1.requireRoles)(WAREHOUSE_WORKER_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: transferParcelSchema }), warehouses_controller_1.default.transferParcel);
exports.default = router;
