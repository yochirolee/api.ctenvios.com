import { Router } from "express";
import { z } from "zod";
import { DeliveryStatus, Roles, RouteStatus } from "@prisma/client";
import deliveryRoutes from "../controllers/delivery-routes.controller";
import { requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

/**
 * Delivery Routes Routes
 * Following: RESTful API design
 */

const router = Router();

// Roles that can manage delivery routes
const DELIVERY_ADMIN_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
];

// Roles that can view delivery routes
const DELIVERY_VIEW_ROLES: Roles[] = [
   ...DELIVERY_ADMIN_ROLES,
   Roles.CARRIER_WAREHOUSE_WORKER,
   Roles.CARRIER_ISSUES_MANAGER,
];

// Roles that can record deliveries (messengers)
const MESSENGER_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
   Roles.MESSENGER,
];

// === Validation Schemas ===

const createRouteSchema = z.object({
   carrier_id: z.number().int().positive("Carrier ID is required"),
   warehouse_id: z.number().int().positive("Warehouse ID is required"),
   messenger_id: z.string().uuid("Messenger ID is required"),
   province_id: z.number().int().positive("Province ID is required"),
   scheduled_date: z.string().datetime("Scheduled date is required"),
   notes: z.string().optional(),
});

const updateRouteSchema = z.object({
   messenger_id: z.string().uuid().optional(),
   scheduled_date: z.string().datetime().optional(),
   notes: z.string().optional(),
});

const addParcelSchema = z.object({
   parcel_id: z.number().int().positive("Parcel ID is required"),
});

const assignToMessengerSchema = z.object({
   parcel_id: z.number().int().positive("Parcel ID is required"),
   messenger_id: z.string().uuid("Messenger ID is required"),
});

const recordDeliverySchema = z.object({
   success: z.boolean(),
   recipient_name: z.string().optional(),
   recipient_ci: z.string().optional(),
   signature: z.string().url().optional(),
   photo_proof: z.string().url().optional(),
   notes: z.string().optional(),
});

const rescheduleSchema = z.object({
   notes: z.string().optional(),
});

const idParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});

const parcelIdParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
   parcelId: z.string().regex(/^\d+$/, "Parcel ID must be a number").transform(Number),
});

const assignmentIdParamSchema = z.object({
   assignmentId: z.string().regex(/^\d+$/, "Assignment ID must be a number").transform(Number),
});

const paginationQuerySchema = z.object({
   page: z.coerce.number().int().positive().optional().default(1),
   limit: z.coerce.number().int().positive().max(100).optional().default(20),
   carrier_id: z.coerce.number().int().positive().optional(),
   warehouse_id: z.coerce.number().int().positive().optional(),
   messenger_id: z.string().uuid().optional(),
   status: z.nativeEnum(RouteStatus).optional(),
   scheduled_date: z.string().datetime().optional(),
});

const assignmentsQuerySchema = z.object({
   status: z.nativeEnum(DeliveryStatus).optional(),
});

// === Routes ===

// GET /delivery-routes - Get all routes
router.get(
   "/",
   requireRoles(DELIVERY_VIEW_ROLES),
   validate({ query: paginationQuerySchema }),
   deliveryRoutes.getAll
);

// GET /delivery-routes/my-assignments - Get my assignments (for messenger)
router.get(
   "/my-assignments",
   requireRoles(MESSENGER_ROLES),
   validate({ query: assignmentsQuerySchema }),
   deliveryRoutes.getMyAssignments
);

// GET /delivery-routes/ready-for-delivery - Get parcels ready for delivery
router.get(
   "/ready-for-delivery",
   requireRoles(DELIVERY_ADMIN_ROLES),
   validate({ query: paginationQuerySchema }),
   deliveryRoutes.getParcelsReadyForDelivery
);

// GET /delivery-routes/:id - Get route by ID
router.get("/:id", requireRoles(DELIVERY_VIEW_ROLES), validate({ params: idParamSchema }), deliveryRoutes.getById);

// POST /delivery-routes - Create a new route
router.post("/", requireRoles(DELIVERY_ADMIN_ROLES), validate({ body: createRouteSchema }), deliveryRoutes.create);

// PUT /delivery-routes/:id - Update route
router.put(
   "/:id",
   requireRoles(DELIVERY_ADMIN_ROLES),
   validate({ params: idParamSchema, body: updateRouteSchema }),
   deliveryRoutes.update
);

// DELETE /delivery-routes/:id - Delete route
router.delete("/:id", requireRoles(DELIVERY_ADMIN_ROLES), validate({ params: idParamSchema }), deliveryRoutes.delete);

// POST /delivery-routes/:id/parcels - Add parcel to route
router.post(
   "/:id/parcels",
   requireRoles(DELIVERY_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelSchema }),
   deliveryRoutes.addParcel
);

// DELETE /delivery-routes/:id/parcels/:parcelId - Remove parcel from route
router.delete(
   "/:id/parcels/:parcelId",
   requireRoles(DELIVERY_ADMIN_ROLES),
   validate({ params: parcelIdParamSchema }),
   deliveryRoutes.removeParcel
);

// POST /delivery-routes/assign-messenger - Assign parcel directly to messenger
router.post(
   "/assign-messenger",
   requireRoles(DELIVERY_ADMIN_ROLES),
   validate({ body: assignToMessengerSchema }),
   deliveryRoutes.assignToMessenger
);

// POST /delivery-routes/:id/ready - Mark route as ready
router.post(
   "/:id/ready",
   requireRoles(DELIVERY_ADMIN_ROLES),
   validate({ params: idParamSchema }),
   deliveryRoutes.markAsReady
);

// POST /delivery-routes/:id/start - Start route
router.post(
   "/:id/start",
   requireRoles([...DELIVERY_ADMIN_ROLES, Roles.MESSENGER]),
   validate({ params: idParamSchema }),
   deliveryRoutes.startRoute
);

// POST /delivery-routes/assignments/:assignmentId/deliver - Record delivery attempt
router.post(
   "/assignments/:assignmentId/deliver",
   requireRoles(MESSENGER_ROLES),
   validate({ params: assignmentIdParamSchema, body: recordDeliverySchema }),
   deliveryRoutes.recordDeliveryAttempt
);

// POST /delivery-routes/assignments/:assignmentId/reschedule - Reschedule failed delivery
router.post(
   "/assignments/:assignmentId/reschedule",
   requireRoles(DELIVERY_ADMIN_ROLES),
   validate({ params: assignmentIdParamSchema, body: rescheduleSchema }),
   deliveryRoutes.rescheduleDelivery
);

export default router;
