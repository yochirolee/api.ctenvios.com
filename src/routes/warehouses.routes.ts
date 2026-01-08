import { Router } from "express";
import { z } from "zod";
import { Roles } from "@prisma/client";
import warehouses from "../controllers/warehouses.controller";
import { requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

/**
 * Warehouses Routes
 * Following: RESTful API design
 */

const router = Router();

// Roles that can manage warehouses
const WAREHOUSE_ADMIN_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
];

// Roles that can view warehouses
const WAREHOUSE_VIEW_ROLES: Roles[] = [
   ...WAREHOUSE_ADMIN_ROLES,
   Roles.CARRIER_WAREHOUSE_WORKER,
   Roles.CARRIER_ISSUES_MANAGER,
];

// Roles that can receive/transfer parcels
const WAREHOUSE_WORKER_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
   Roles.CARRIER_WAREHOUSE_WORKER,
];

// === Validation Schemas ===

const createWarehouseSchema = z.object({
   name: z.string().min(1, "Name is required").max(100),
   address: z.string().min(1, "Address is required"),
   carrier_id: z.number().int().positive("Carrier ID is required"),
   province_id: z.number().int().positive("Province ID is required"),
   is_main: z.boolean().optional().default(false),
   manager_id: z.string().uuid().optional(),
});

const updateWarehouseSchema = z.object({
   name: z.string().min(1).max(100).optional(),
   address: z.string().min(1).optional(),
   is_main: z.boolean().optional(),
   is_active: z.boolean().optional(),
   manager_id: z.string().uuid().nullable().optional(),
});

const receiveParcelSchema = z.object({
   tracking_number: z.string().min(1, "Tracking number is required"),
});

const transferParcelSchema = z.object({
   to_warehouse_id: z.number().int().positive("Destination warehouse ID is required"),
   tracking_number: z.string().min(1, "Tracking number is required"),
});

const idParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});

const paginationQuerySchema = z.object({
   page: z.coerce.number().int().positive().optional().default(1),
   limit: z.coerce.number().int().positive().max(100).optional().default(20),
   carrier_id: z.coerce.number().int().positive().optional(),
   province_id: z.coerce.number().int().positive().optional(),
   is_active: z.enum(["true", "false"]).optional(),
});

// === Routes ===

// GET /warehouses - Get all warehouses
router.get("/", requireRoles(WAREHOUSE_VIEW_ROLES), validate({ query: paginationQuerySchema }), warehouses.getAll);

// GET /warehouses/my - Get my carrier's warehouses
router.get("/my", requireRoles(WAREHOUSE_VIEW_ROLES), warehouses.getMyWarehouses);

// GET /warehouses/carrier/:id - Get warehouses by carrier
router.get(
   "/carrier/:id",
   requireRoles(WAREHOUSE_VIEW_ROLES),
   validate({ params: idParamSchema }),
   warehouses.getByCarrier
);

// GET /warehouses/:id - Get warehouse by ID
router.get("/:id", requireRoles(WAREHOUSE_VIEW_ROLES), validate({ params: idParamSchema }), warehouses.getById);

// POST /warehouses - Create a new warehouse
router.post("/", requireRoles(WAREHOUSE_ADMIN_ROLES), validate({ body: createWarehouseSchema }), warehouses.create);

// PUT /warehouses/:id - Update warehouse
router.put(
   "/:id",
   requireRoles(WAREHOUSE_ADMIN_ROLES),
   validate({ params: idParamSchema, body: updateWarehouseSchema }),
   warehouses.update
);

// DELETE /warehouses/:id - Delete warehouse
router.delete("/:id", requireRoles(WAREHOUSE_ADMIN_ROLES), validate({ params: idParamSchema }), warehouses.delete);

// GET /warehouses/:id/parcels - Get parcels in warehouse
router.get(
   "/:id/parcels",
   requireRoles(WAREHOUSE_VIEW_ROLES),
   validate({ params: idParamSchema, query: paginationQuerySchema }),
   warehouses.getParcels
);

// POST /warehouses/:id/receive - Receive parcel in warehouse
router.post(
   "/:id/receive",
   requireRoles(WAREHOUSE_WORKER_ROLES),
   validate({ params: idParamSchema, body: receiveParcelSchema }),
   warehouses.receiveParcel
);

// POST /warehouses/:id/transfer - Transfer parcel to another warehouse
router.post(
   "/:id/transfer",
   requireRoles(WAREHOUSE_WORKER_ROLES),
   validate({ params: idParamSchema, body: transferParcelSchema }),
   warehouses.transferParcel
);

export default router;
