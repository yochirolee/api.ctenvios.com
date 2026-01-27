import { Router } from "express";
import { z } from "zod";
import { ContainerStatus, ContainerType, Roles } from "@prisma/client";
import containers from "../controllers/containers.controller";
import { requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

// Roles that can manage containers (forwarder level)
const CONTAINER_ADMIN_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.FORWARDER_RESELLER,
];

// Roles that can view containers
const CONTAINER_VIEW_ROLES: Roles[] = [
   ...CONTAINER_ADMIN_ROLES,
   Roles.AGENCY_ADMIN,
   Roles.AGENCY_SUPERVISOR,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
];

// === Validation Schemas ===

const createContainerSchema = z.object({
   container_name: z.string().min(1, "Container name is required").max(100),
   container_number: z.string().min(1, "Container number is required"),
   bl_number: z.string().optional(),
   seal_number: z.string().optional(),
   container_type: z.nativeEnum(ContainerType).default(ContainerType.DRY_40FT),
   vessel_name: z.string().optional(),
   voyage_number: z.string().optional(),
   origin_port: z.string().min(1, "Origin port is required"),
   destination_port: z.string().min(1, "Destination port is required"),
   max_weight_kg: z.number().positive().optional(),
   estimated_departure: z.string().datetime().optional(),
   estimated_arrival: z.string().datetime().optional(),
   provider_id: z.number().int().positive("Provider ID is required"),
   notes: z.string().optional(),
});

const updateContainerSchema = z.object({
   container_name: z.string().min(1).max(100).optional(),
   container_number: z.string().min(1).optional(),
   bl_number: z.string().optional(),
   seal_number: z.string().optional(),
   container_type: z.nativeEnum(ContainerType).optional(),
   vessel_name: z.string().optional(),
   voyage_number: z.string().optional(),
   origin_port: z.string().min(1).optional(),
   destination_port: z.string().min(1).optional(),
   max_weight_kg: z.number().positive().optional(),
   estimated_departure: z.string().datetime().optional(),
   estimated_arrival: z.string().datetime().optional(),
   actual_departure: z.string().datetime().optional(),
   actual_arrival: z.string().datetime().optional(),
   provider_id: z.number().int().positive().optional(),
   notes: z.string().optional(),
});

const updateStatusSchema = z.object({
   status: z.nativeEnum(ContainerStatus),
   location: z.string().optional(),
   description: z.string().optional(),
});

const addParcelSchema = z.object({
   tracking_number: z.string().min(1, "Tracking number is required"),
});

const addParcelsByOrderSchema = z.object({
   order_id: z.number().int().positive("Order ID is required"),
});

const addParcelsByDispatchSchema = z.object({
   dispatch_id: z.number().int().positive("Dispatch ID is required"),
});

const idParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});

const paginationQuerySchema = z.object({
   page: z.coerce.number().int().positive().optional().default(1),
   limit: z.coerce.number().int().positive().max(100).optional().default(20),
   status: z.nativeEnum(ContainerStatus).optional(),
});

// === Routes ===

// GET /containers - Get all containers
router.get("/", requireRoles(CONTAINER_VIEW_ROLES), validate({ query: paginationQuerySchema }), containers.getAll);

// GET /containers/ready-parcels - Get parcels ready to be added to container
router.get(
   "/ready-for-container",
   requireRoles(CONTAINER_ADMIN_ROLES),
   validate({ query: paginationQuerySchema }),
   containers.getReadyForContainer
);

// GET /containers/by-number/:containerNumber - Get container by container number
router.get("/by-number/:containerNumber", requireRoles(CONTAINER_VIEW_ROLES), containers.getByContainerNumber);

// GET /containers/:id - Get container by ID
router.get("/:id", requireRoles(CONTAINER_VIEW_ROLES), validate({ params: idParamSchema }), containers.getById);

// POST /containers - Create a new container
router.post("/", requireRoles(CONTAINER_ADMIN_ROLES), validate({ body: createContainerSchema }), containers.create);

// PUT /containers/:id - Update container
router.put(
   "/:id",
   requireRoles(CONTAINER_ADMIN_ROLES),
   validate({ params: idParamSchema, body: updateContainerSchema }),
   containers.update
);

// DELETE /containers/:id - Delete container
router.delete("/:id", requireRoles(CONTAINER_ADMIN_ROLES), validate({ params: idParamSchema }), containers.delete);

// GET /containers/:id/parcels - Get parcels in container
router.get(
   "/:id/parcels",
   requireRoles(CONTAINER_VIEW_ROLES),
   validate({ params: idParamSchema, query: paginationQuerySchema }),
   containers.getParcels
);

// POST /containers/:id/parcels - Add parcel to container
router.post(
   "/:id/parcels",
   requireRoles(CONTAINER_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelSchema }),
   containers.addParcel
);

// POST /containers/:id/parcels/by-order - Add all parcels from an order to container
router.post(
   "/:id/parcels/by-order",
   requireRoles(CONTAINER_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelsByOrderSchema }),
   containers.addParcelsByOrderId
);

// POST /containers/:id/parcels/by-dispatch - Add all parcels from a dispatch to container
router.post(
   "/:id/parcels/by-dispatch",
   requireRoles(CONTAINER_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelsByDispatchSchema }),
   containers.addParcelsByDispatchId
);       

// DELETE /containers/:id/parcels/:trackingNumber - Remove parcel from container
router.delete("/:id/parcels/:trackingNumber", requireRoles(CONTAINER_ADMIN_ROLES), containers.removeParcel);

// PATCH /containers/:id/status - Update container status
router.patch(
   "/:id/status",
   requireRoles(CONTAINER_ADMIN_ROLES),
   validate({ params: idParamSchema, body: updateStatusSchema }),
   containers.updateStatus
);

// GET /containers/:id/events - Get container events
router.get(
   "/:id/events",
   requireRoles(CONTAINER_VIEW_ROLES),
   validate({ params: idParamSchema }),
   containers.getEvents
);

// GET /containers/:id/manifest - Get container manifest data (JSON)
router.get(
   "/:id/manifest",
   requireRoles(CONTAINER_VIEW_ROLES),
   validate({ params: idParamSchema }),
   containers.getManifestData
);

// GET /containers/:id/manifest/excel - Export container manifest as Excel
router.get(
   "/:id/manifest/excel",
   requireRoles(CONTAINER_VIEW_ROLES),
   validate({ params: idParamSchema }),
   containers.exportManifestExcel
);

export default router;
