import { Router } from "express";
import { z } from "zod";
import { FlightStatus, Roles } from "@prisma/client";
import flights from "../controllers/flights.controller";
import { requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

// Roles that can manage flights (forwarder level)
const FLIGHT_ADMIN_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.FORWARDER_RESELLER,
];

// Roles that can view flights
const FLIGHT_VIEW_ROLES: Roles[] = [
   ...FLIGHT_ADMIN_ROLES,
   Roles.AGENCY_ADMIN,
   Roles.AGENCY_SUPERVISOR,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
];

// === Validation Schemas ===

const createFlightSchema = z.object({
   awb_number: z.string().min(1, "AWB number is required"),
   flight_number: z.string().optional(),
   airline: z.string().optional(),
   origin_airport: z.string().min(1, "Origin airport is required"),
   destination_airport: z.string().min(1, "Destination airport is required"),
   estimated_departure: z.string().datetime().optional(),
   estimated_arrival: z.string().datetime().optional(),
   provider_id: z.number().int().positive("Provider ID is required"),
   notes: z.string().optional(),
});

const updateFlightSchema = z.object({
   awb_number: z.string().min(1).optional(),
   flight_number: z.string().optional(),
   airline: z.string().optional(),
   origin_airport: z.string().min(1).optional(),
   destination_airport: z.string().min(1).optional(),
   estimated_departure: z.string().datetime().optional(),
   estimated_arrival: z.string().datetime().optional(),
   actual_departure: z.string().datetime().optional(),
   actual_arrival: z.string().datetime().optional(),
   provider_id: z.number().int().positive().optional(),
   notes: z.string().optional(),
});

const updateStatusSchema = z.object({
   status: z.nativeEnum(FlightStatus),
   location: z.string().optional(),
   description: z.string().optional(),
});

const addParcelSchema = z.object({
   tracking_number: z.string().min(1, "Tracking number is required"),
});

const idParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});

const paginationQuerySchema = z.object({
   page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
   limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
   status: z.nativeEnum(FlightStatus).optional(),
});

// === Routes ===

// GET /flights - Get all flights
router.get(
   "/",
   requireRoles(FLIGHT_VIEW_ROLES),
   validate({ query: paginationQuerySchema }),
   flights.getAll
);

// GET /flights/ready-parcels - Get parcels ready to be added to flight
router.get(
   "/ready-parcels",
   requireRoles(FLIGHT_ADMIN_ROLES),
   validate({ query: paginationQuerySchema }),
   flights.getReadyParcels
);

// GET /flights/by-awb/:awbNumber - Get flight by AWB number
router.get("/by-awb/:awbNumber", requireRoles(FLIGHT_VIEW_ROLES), flights.getByAwbNumber);

// GET /flights/:id - Get flight by ID
router.get(
   "/:id",
   requireRoles(FLIGHT_VIEW_ROLES),
   validate({ params: idParamSchema }),
   flights.getById
);

// POST /flights - Create a new flight
router.post(
   "/",
   requireRoles(FLIGHT_ADMIN_ROLES),
   validate({ body: createFlightSchema }),
   flights.create
);

// PUT /flights/:id - Update flight
router.put(
   "/:id",
   requireRoles(FLIGHT_ADMIN_ROLES),
   validate({ params: idParamSchema, body: updateFlightSchema }),
   flights.update
);

// DELETE /flights/:id - Delete flight
router.delete(
   "/:id",
   requireRoles(FLIGHT_ADMIN_ROLES),
   validate({ params: idParamSchema }),
   flights.delete
);

// GET /flights/:id/parcels - Get parcels in flight
router.get(
   "/:id/parcels",
   requireRoles(FLIGHT_VIEW_ROLES),
   validate({ params: idParamSchema, query: paginationQuerySchema }),
   flights.getParcels
);

// POST /flights/:id/parcels - Add parcel to flight
router.post(
   "/:id/parcels",
   requireRoles(FLIGHT_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelSchema }),
   flights.addParcel
);

// DELETE /flights/:id/parcels/:trackingNumber - Remove parcel from flight
router.delete("/:id/parcels/:trackingNumber", requireRoles(FLIGHT_ADMIN_ROLES), flights.removeParcel);

// PATCH /flights/:id/status - Update flight status
router.patch(
   "/:id/status",
   requireRoles(FLIGHT_ADMIN_ROLES),
   validate({ params: idParamSchema, body: updateStatusSchema }),
   flights.updateStatus
);

// GET /flights/:id/events - Get flight events
router.get(
   "/:id/events",
   requireRoles(FLIGHT_VIEW_ROLES),
   validate({ params: idParamSchema }),
   flights.getEvents
);

export default router;
