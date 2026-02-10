"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const delivery_routes_controller_1 = __importDefault(require("../controllers/delivery-routes.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
/**
 * Delivery Routes Routes
 * Following: RESTful API design
 */
const router = (0, express_1.Router)();
// Roles that can manage delivery routes
const DELIVERY_ADMIN_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
];
// Roles that can view delivery routes
const DELIVERY_VIEW_ROLES = [
    ...DELIVERY_ADMIN_ROLES,
    client_1.Roles.CARRIER_WAREHOUSE_WORKER,
    client_1.Roles.CARRIER_ISSUES_MANAGER,
];
// Roles that can record deliveries (messengers)
const MESSENGER_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
    client_1.Roles.MESSENGER,
];
// === Validation Schemas ===
const createRouteSchema = zod_1.z.object({
    carrier_id: zod_1.z.number().int().positive("Carrier ID is required"),
    warehouse_id: zod_1.z.number().int().positive("Warehouse ID is required"),
    messenger_id: zod_1.z.string().uuid("Messenger ID is required"),
    province_id: zod_1.z.number().int().positive("Province ID is required"),
    scheduled_date: zod_1.z.string().datetime("Scheduled date is required"),
    notes: zod_1.z.string().optional(),
});
const updateRouteSchema = zod_1.z.object({
    messenger_id: zod_1.z.string().uuid().optional(),
    scheduled_date: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().optional(),
});
const addParcelSchema = zod_1.z.object({
    parcel_id: zod_1.z.number().int().positive("Parcel ID is required"),
});
const assignToMessengerSchema = zod_1.z.object({
    parcel_id: zod_1.z.number().int().positive("Parcel ID is required"),
    messenger_id: zod_1.z.string().uuid("Messenger ID is required"),
});
const recordDeliverySchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    recipient_name: zod_1.z.string().optional(),
    recipient_ci: zod_1.z.string().optional(),
    signature: zod_1.z.string().url().optional(),
    photo_proof: zod_1.z.string().url().optional(),
    notes: zod_1.z.string().optional(),
});
const rescheduleSchema = zod_1.z.object({
    notes: zod_1.z.string().optional(),
});
const idParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});
const parcelIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
    parcelId: zod_1.z.string().regex(/^\d+$/, "Parcel ID must be a number").transform(Number),
});
const assignmentIdParamSchema = zod_1.z.object({
    assignmentId: zod_1.z.string().regex(/^\d+$/, "Assignment ID must be a number").transform(Number),
});
const paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
    carrier_id: zod_1.z.coerce.number().int().positive().optional(),
    warehouse_id: zod_1.z.coerce.number().int().positive().optional(),
    messenger_id: zod_1.z.string().uuid().optional(),
    status: zod_1.z.nativeEnum(client_1.RouteStatus).optional(),
    scheduled_date: zod_1.z.string().datetime().optional(),
});
const assignmentsQuerySchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.DeliveryStatus).optional(),
});
// === Routes ===
// GET /delivery-routes - Get all routes
router.get("/", (0, auth_middleware_1.requireRoles)(DELIVERY_VIEW_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), delivery_routes_controller_1.default.getAll);
// GET /delivery-routes/my-assignments - Get my assignments (for messenger)
router.get("/my-assignments", (0, auth_middleware_1.requireRoles)(MESSENGER_ROLES), (0, validate_middleware_1.validate)({ query: assignmentsQuerySchema }), delivery_routes_controller_1.default.getMyAssignments);
// GET /delivery-routes/ready-for-delivery - Get parcels ready for delivery
router.get("/ready-for-delivery", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), delivery_routes_controller_1.default.getParcelsReadyForDelivery);
// GET /delivery-routes/:id - Get route by ID
router.get("/:id", (0, auth_middleware_1.requireRoles)(DELIVERY_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), delivery_routes_controller_1.default.getById);
// POST /delivery-routes - Create a new route
router.post("/", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ body: createRouteSchema }), delivery_routes_controller_1.default.create);
// PUT /delivery-routes/:id - Update route
router.put("/:id", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: updateRouteSchema }), delivery_routes_controller_1.default.update);
// DELETE /delivery-routes/:id - Delete route
router.delete("/:id", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), delivery_routes_controller_1.default.delete);
// POST /delivery-routes/:id/parcels - Add parcel to route
router.post("/:id/parcels", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelSchema }), delivery_routes_controller_1.default.addParcel);
// DELETE /delivery-routes/:id/parcels/:parcelId - Remove parcel from route
router.delete("/:id/parcels/:parcelId", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: parcelIdParamSchema }), delivery_routes_controller_1.default.removeParcel);
// POST /delivery-routes/assign-messenger - Assign parcel directly to messenger
router.post("/assign-messenger", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ body: assignToMessengerSchema }), delivery_routes_controller_1.default.assignToMessenger);
// POST /delivery-routes/:id/ready - Mark route as ready
router.post("/:id/ready", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), delivery_routes_controller_1.default.markAsReady);
// POST /delivery-routes/:id/start - Start route
router.post("/:id/start", (0, auth_middleware_1.requireRoles)([...DELIVERY_ADMIN_ROLES, client_1.Roles.MESSENGER]), (0, validate_middleware_1.validate)({ params: idParamSchema }), delivery_routes_controller_1.default.startRoute);
// POST /delivery-routes/assignments/:assignmentId/deliver - Record delivery attempt
router.post("/assignments/:assignmentId/deliver", (0, auth_middleware_1.requireRoles)(MESSENGER_ROLES), (0, validate_middleware_1.validate)({ params: assignmentIdParamSchema, body: recordDeliverySchema }), delivery_routes_controller_1.default.recordDeliveryAttempt);
// POST /delivery-routes/assignments/:assignmentId/reschedule - Reschedule failed delivery
router.post("/assignments/:assignmentId/reschedule", (0, auth_middleware_1.requireRoles)(DELIVERY_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: assignmentIdParamSchema, body: rescheduleSchema }), delivery_routes_controller_1.default.rescheduleDelivery);
exports.default = router;
