import { Router } from "express";
import { z } from "zod";
import { Roles } from "@prisma/client";
import tracking from "../controllers/tracking.controller";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

/**
 * Tracking Routes
 * Following: RESTful API design
 *
 * Public endpoints (no auth):
 * - GET /tracking/:trackingNumber - Public tracking view
 *
 * Internal endpoints (auth required):
 * - GET /tracking/:trackingNumber/full - Full internal tracking
 * - GET /tracking/search - Search parcels
 * - GET /tracking/:trackingNumber/history - Location history
 * - GET /tracking/:trackingNumber/last-scan - Last scan info
 */

const router = Router();

// Roles that can view internal tracking
const INTERNAL_VIEW_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.FORWARDER_RESELLER,
   Roles.AGENCY_ADMIN,
   Roles.AGENCY_SUPERVISOR,
   Roles.AGENCY_SALES,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
   Roles.CARRIER_WAREHOUSE_WORKER,
   Roles.CARRIER_ISSUES_MANAGER,
   Roles.MESSENGER,
];

// === Validation Schemas ===

const trackingNumberParamSchema = z.object({
   trackingNumber: z.string().min(1, "Tracking number is required"),
});

const searchQuerySchema = z.object({
   q: z.string().optional().default(""),
   page: z.coerce.number().int().positive().optional().default(1),
   limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// === Public Routes (No Auth) ===

// GET /tracking/:trackingNumber - Public tracking (customer view)
router.get("/:trackingNumber", validate({ params: trackingNumberParamSchema }), tracking.getPublicTracking);

// === Internal Routes (Auth Required) ===

// GET /tracking/search - Search parcels by tracking number
router.get(
   "/",
   authMiddleware,
   requireRoles(INTERNAL_VIEW_ROLES),
   validate({ query: searchQuerySchema }),
   tracking.search
);

// GET /tracking/:trackingNumber/full - Full internal tracking (staff only)
router.get(
   "/:trackingNumber/full",
   authMiddleware,
   requireRoles(INTERNAL_VIEW_ROLES),
   validate({ params: trackingNumberParamSchema }),
   tracking.getInternalTracking
);

// GET /tracking/:trackingNumber/history - Location history
router.get(
   "/:trackingNumber/history",
   authMiddleware,
   requireRoles(INTERNAL_VIEW_ROLES),
   validate({ params: trackingNumberParamSchema }),
   tracking.getLocationHistory
);

// GET /tracking/:trackingNumber/last-scan - Last scan info
router.get(
   "/:trackingNumber/last-scan",
   authMiddleware,
   requireRoles(INTERNAL_VIEW_ROLES),
   validate({ params: trackingNumberParamSchema }),
   tracking.getLastScan
);

export default router;
