import { Router } from "express";
import { z } from "zod";
import { PalletStatus, Roles } from "@prisma/client";
import pallets from "../controllers/pallets.controller";
import { requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

/**
 * Pallets Routes
 * Following: RESTful API design
 */

const router = Router();

// Roles that can manage pallets (agency level)
const PALLET_ADMIN_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.FORWARDER_RESELLER,
   Roles.AGENCY_ADMIN,
   Roles.AGENCY_SUPERVISOR,
];

// Roles that can view pallets
const PALLET_VIEW_ROLES: Roles[] = [...PALLET_ADMIN_ROLES, Roles.AGENCY_SALES];

// === Validation Schemas ===

const createPalletSchema = z.object({
   notes: z.string().optional(),
});

const updatePalletSchema = z.object({
   notes: z.string().optional(),
});

const addParcelSchema = z.object({
   tracking_number: z.string().min(1, "Tracking number is required"),
});

const addParcelsByOrderSchema = z.object({
   order_id: z.number().int().positive("Order ID is required"),
});

const idParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});

const paginationQuerySchema = z.object({
   page: z.coerce.number().int().positive().optional().default(1),
   limit: z.coerce.number().int().positive().max(100).optional().default(20),
   status: z.nativeEnum(PalletStatus).optional(),
});

// === Routes ===

// GET /pallets - Get all pallets
router.get("/", requireRoles(PALLET_VIEW_ROLES), validate({ query: paginationQuerySchema }), pallets.getAll);

// GET /pallets/ready-for-pallet - Get parcels ready to be added to pallet
router.get(
   "/ready-for-pallet",
   requireRoles(PALLET_ADMIN_ROLES),
   validate({ query: paginationQuerySchema }),
   pallets.getReadyForPallet
);

// GET /pallets/by-number/:palletNumber - Get pallet by pallet number
router.get("/by-number/:palletNumber", requireRoles(PALLET_VIEW_ROLES), pallets.getByPalletNumber);

// GET /pallets/:id - Get pallet by ID
router.get("/:id", requireRoles(PALLET_VIEW_ROLES), validate({ params: idParamSchema }), pallets.getById);

// POST /pallets - Create a new pallet
router.post("/", requireRoles(PALLET_ADMIN_ROLES), pallets.create);

// PUT /pallets/:id - Update pallet
router.put(
   "/:id",
   requireRoles(PALLET_ADMIN_ROLES),
   validate({ params: idParamSchema, body: updatePalletSchema }),
   pallets.update
);

// DELETE /pallets/:id - Delete pallet
router.delete("/:id", requireRoles(PALLET_ADMIN_ROLES), validate({ params: idParamSchema }), pallets.delete);

// GET /pallets/:id/parcels - Get parcels in pallet
router.get(
   "/:id/parcels",
   requireRoles(PALLET_VIEW_ROLES),
   validate({ params: idParamSchema, query: paginationQuerySchema }),
   pallets.getParcels
);

// POST /pallets/:id/parcels - Add parcel to pallet (canonical)
router.post(
   "/:id/parcels",
   requireRoles(PALLET_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelSchema }),
   pallets.addParcel
);

// POST /pallets/:id/parcels/by-order - Add all parcels from an order to pallet
router.post(
   "/:id/parcels/by-order",
   requireRoles(PALLET_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelsByOrderSchema }),
   pallets.addParcelsByOrderId
);

// POST /pallets/:id/add-parcel - Backward-compatible alias
router.post(
   "/:id/add-parcel",
   requireRoles(PALLET_ADMIN_ROLES),
   validate({ params: idParamSchema, body: addParcelSchema }),
   pallets.addParcel
);


// Backward-compatible alias (some clients call without "/parcels")
// DELETE /pallets/:id/remove-parcel/:trackingNumber
router.delete(
   "/:id/remove-parcel/:trackingNumber",
   requireRoles(PALLET_ADMIN_ROLES),
   validate({
      params: z.object({
         id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
         trackingNumber: z.string().min(1, "Tracking number is required"),
      }),
   }),
   pallets.removeParcel
);

// POST /pallets/:id/seal - Seal pallet
router.post("/:id/seal", requireRoles(PALLET_ADMIN_ROLES), validate({ params: idParamSchema }), pallets.seal);

// POST /pallets/:id/unseal - Unseal pallet
router.post("/:id/unseal", requireRoles(PALLET_ADMIN_ROLES), validate({ params: idParamSchema }), pallets.unseal);

export default router;
