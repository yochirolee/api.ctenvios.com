import { Router } from "express";
import { z } from "zod";
import { Status, Roles } from "@prisma/client";
import parcels from "../controllers/parcels.controller";
import { requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

// Roles that can manage parcels
const PARCEL_ADMIN_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.FORWARDER_RESELLER,
   Roles.AGENCY_ADMIN,
   Roles.AGENCY_SUPERVISOR,
   Roles.AGENCY_SALES,
];

// Roles that can view parcels
const PARCEL_VIEW_ROLES: Roles[] = [...PARCEL_ADMIN_ROLES, Roles.CARRIER_OWNER, Roles.CARRIER_ADMIN, Roles.MESSENGER];

// === Validation Schemas ===

const paginationQuerySchema = z.object({
   page: z.coerce.number().int().positive().optional().default(1),
   limit: z.coerce.number().int().positive().max(100).optional().default(25),
   status: z.nativeEnum(Status).optional(),
});

const hblParamSchema = z.object({
   hbl: z.string().min(1, "HBL is required"),
});

const orderIdParamSchema = z.object({
   orderId: z.string().regex(/^\d+$/, "Order ID must be a number"),
});

const updateStatusSchema = z.object({
   status: z.nativeEnum(Status),
   notes: z.string().optional(),
});

// === Routes ===

// GET /parcels - Get all parcels with pagination
router.get("/", requireRoles(PARCEL_VIEW_ROLES), validate({ query: paginationQuerySchema }), parcels.getAll);

// GET /parcels/in-agency - Get parcels in user's agency (not dispatched)
router.get(
   "/in-agency",
   requireRoles(PARCEL_ADMIN_ROLES),
   validate({ query: paginationQuerySchema }),
   parcels.getInAgency
);

// GET /parcels/track/:hbl - Public tracking (no auth)
router.get("/track/:hbl", validate({ params: hblParamSchema }), parcels.track);

// GET /parcels/order/:orderId - Get parcels by order ID
router.get(
   "/order/:orderId",
   requireRoles(PARCEL_VIEW_ROLES),
   validate({ params: orderIdParamSchema }),
   parcels.getByOrderId
);

// GET /parcels/:hbl - Get parcel by HBL
router.get("/:hbl", requireRoles(PARCEL_VIEW_ROLES), validate({ params: hblParamSchema }), parcels.getByHbl);

// GET /parcels/:hbl/events - Get parcel events/history
router.get("/:hbl/events", requireRoles(PARCEL_VIEW_ROLES), validate({ params: hblParamSchema }), parcels.getEvents);

// PATCH /parcels/:hbl/status - Update parcel status
router.patch(
   "/:hbl/status",
   requireRoles(PARCEL_ADMIN_ROLES),
   validate({ params: hblParamSchema, body: updateStatusSchema }),
   parcels.updateStatus
);

export default router;
