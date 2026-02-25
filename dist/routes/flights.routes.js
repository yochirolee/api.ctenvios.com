"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const flights_controller_1 = __importDefault(require("../controllers/flights.controller"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
// Roles that can manage flights (forwarder level)
const FLIGHT_ADMIN_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.FORWARDER_RESELLER,
];
// Roles that can view flights
const FLIGHT_VIEW_ROLES = [
    ...FLIGHT_ADMIN_ROLES,
    client_1.Roles.AGENCY_ADMIN,
    client_1.Roles.AGENCY_SUPERVISOR,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
];
// === Validation Schemas ===
const createFlightSchema = zod_1.z.object({
    awb_number: zod_1.z.string().min(1, "AWB number is required"),
    flight_number: zod_1.z.string().optional(),
    airline: zod_1.z.string().optional(),
    origin_airport: zod_1.z.string().min(1, "Origin airport is required"),
    destination_airport: zod_1.z.string().min(1, "Destination airport is required"),
    estimated_departure: zod_1.z.string().datetime().optional(),
    estimated_arrival: zod_1.z.string().datetime().optional(),
    provider_id: zod_1.z.number().int().positive("Provider ID is required"),
    notes: zod_1.z.string().optional(),
});
const updateFlightSchema = zod_1.z.object({
    awb_number: zod_1.z.string().min(1).optional(),
    flight_number: zod_1.z.string().optional(),
    airline: zod_1.z.string().optional(),
    origin_airport: zod_1.z.string().min(1).optional(),
    destination_airport: zod_1.z.string().min(1).optional(),
    estimated_departure: zod_1.z.string().datetime().optional(),
    estimated_arrival: zod_1.z.string().datetime().optional(),
    actual_departure: zod_1.z.string().datetime().optional(),
    actual_arrival: zod_1.z.string().datetime().optional(),
    provider_id: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().optional(),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.FlightStatus),
    location: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
});
const addParcelSchema = zod_1.z.object({
    tracking_number: zod_1.z.string().min(1, "Tracking number is required"),
});
const idParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});
const paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
    status: zod_1.z.nativeEnum(client_1.FlightStatus).optional(),
});
// === Routes ===
// GET /flights - Get all flights
router.get("/", (0, auth_middleware_1.requireRoles)(FLIGHT_VIEW_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), flights_controller_1.default.getAll);
// GET /flights/ready-parcels - Get parcels ready to be added to flight
router.get("/ready-parcels", (0, auth_middleware_1.requireRoles)(FLIGHT_ADMIN_ROLES), (0, validate_middleware_1.validate)({ query: paginationQuerySchema }), flights_controller_1.default.getReadyParcels);
// GET /flights/by-awb/:awbNumber - Get flight by AWB number
router.get("/by-awb/:awbNumber", (0, auth_middleware_1.requireRoles)(FLIGHT_VIEW_ROLES), flights_controller_1.default.getByAwbNumber);
// GET /flights/:id - Get flight by ID
router.get("/:id", (0, auth_middleware_1.requireRoles)(FLIGHT_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), flights_controller_1.default.getById);
// POST /flights - Create a new flight
router.post("/", (0, auth_middleware_1.requireRoles)(FLIGHT_ADMIN_ROLES), (0, validate_middleware_1.validate)({ body: createFlightSchema }), flights_controller_1.default.create);
// PUT /flights/:id - Update flight
router.put("/:id", (0, auth_middleware_1.requireRoles)(FLIGHT_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: updateFlightSchema }), flights_controller_1.default.update);
// DELETE /flights/:id - Delete flight
router.delete("/:id", (0, auth_middleware_1.requireRoles)(FLIGHT_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), flights_controller_1.default.delete);
// GET /flights/:id/parcels - Get parcels in flight
router.get("/:id/parcels", (0, auth_middleware_1.requireRoles)(FLIGHT_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, query: paginationQuerySchema }), flights_controller_1.default.getParcels);
// POST /flights/:id/parcels - Add parcel to flight
router.post("/:id/parcels", (0, auth_middleware_1.requireRoles)(FLIGHT_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: addParcelSchema }), flights_controller_1.default.addParcel);
// DELETE /flights/:id/parcels/:trackingNumber - Remove parcel from flight
router.delete("/:id/parcels/:trackingNumber", (0, auth_middleware_1.requireRoles)(FLIGHT_ADMIN_ROLES), flights_controller_1.default.removeParcel);
// PATCH /flights/:id/status - Update flight status
router.patch("/:id/status", (0, auth_middleware_1.requireRoles)(FLIGHT_ADMIN_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema, body: updateStatusSchema }), flights_controller_1.default.updateStatus);
// GET /flights/:id/events - Get flight events
router.get("/:id/events", (0, auth_middleware_1.requireRoles)(FLIGHT_VIEW_ROLES), (0, validate_middleware_1.validate)({ params: idParamSchema }), flights_controller_1.default.getEvents);
exports.default = router;
