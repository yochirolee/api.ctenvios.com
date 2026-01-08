import { Router } from "express";
import { z } from "zod";
import { Roles, VerificationStatus } from "@prisma/client";
import manifestVerification from "../controllers/manifest-verification.controller";
import { requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

/**
 * Manifest Verification Routes
 * Following: RESTful API design
 */

const router = Router();

// Roles that can manage verifications
const VERIFICATION_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.FORWARDER_ADMIN,
   Roles.FORWARDER_RESELLER,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
   Roles.CARRIER_WAREHOUSE_WORKER,
];

// === Validation Schemas ===

const startContainerVerificationSchema = z.object({
   container_id: z.number().int().positive("Container ID is required"),
});

const startFlightVerificationSchema = z.object({
   flight_id: z.number().int().positive("Flight ID is required"),
});

const scanParcelSchema = z.object({
   tracking_number: z.string().min(1, "Tracking number is required"),
});

const completeVerificationSchema = z.object({
   notes: z.string().optional(),
});

const reportDamageSchema = z.object({
   tracking_number: z.string().min(1, "Tracking number is required"),
   notes: z.string().optional(),
});

const resolveDiscrepancySchema = z.object({
   resolution: z.string().min(1, "Resolution is required"),
});

const idParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});

const discrepancyIdParamSchema = z.object({
   discrepancyId: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
});

const paginationQuerySchema = z.object({
   page: z.coerce.number().int().positive().optional().default(1),
   limit: z.coerce.number().int().positive().max(100).optional().default(20),
   status: z.nativeEnum(VerificationStatus).optional(),
   container_id: z.coerce.number().int().positive().optional(),
   flight_id: z.coerce.number().int().positive().optional(),
});

// === Routes ===

// GET /manifest-verifications - Get all verifications
router.get(
   "/",
   requireRoles(VERIFICATION_ROLES),
   validate({ query: paginationQuerySchema }),
   manifestVerification.getAll
);

// GET /manifest-verifications/:id - Get verification by ID
router.get(
   "/:id",
   requireRoles(VERIFICATION_ROLES),
   validate({ params: idParamSchema }),
   manifestVerification.getById
);

// POST /manifest-verifications/container - Start container verification
router.post(
   "/container",
   requireRoles(VERIFICATION_ROLES),
   validate({ body: startContainerVerificationSchema }),
   manifestVerification.startContainerVerification
);

// POST /manifest-verifications/flight - Start flight verification
router.post(
   "/flight",
   requireRoles(VERIFICATION_ROLES),
   validate({ body: startFlightVerificationSchema }),
   manifestVerification.startFlightVerification
);

// POST /manifest-verifications/:id/scan - Scan parcel for verification
router.post(
   "/:id/scan",
   requireRoles(VERIFICATION_ROLES),
   validate({ params: idParamSchema, body: scanParcelSchema }),
   manifestVerification.scanParcel
);

// POST /manifest-verifications/:id/complete - Complete verification
router.post(
   "/:id/complete",
   requireRoles(VERIFICATION_ROLES),
   validate({ params: idParamSchema, body: completeVerificationSchema }),
   manifestVerification.complete
);

// POST /manifest-verifications/:id/damage - Report damaged parcel
router.post(
   "/:id/damage",
   requireRoles(VERIFICATION_ROLES),
   validate({ params: idParamSchema, body: reportDamageSchema }),
   manifestVerification.reportDamage
);

// GET /manifest-verifications/:id/discrepancies - Get discrepancies for verification
router.get(
   "/:id/discrepancies",
   requireRoles(VERIFICATION_ROLES),
   validate({ params: idParamSchema }),
   manifestVerification.getDiscrepancies
);

// PATCH /manifest-verifications/discrepancies/:discrepancyId/resolve - Resolve discrepancy
router.patch(
   "/discrepancies/:discrepancyId/resolve",
   requireRoles(VERIFICATION_ROLES),
   validate({ params: discrepancyIdParamSchema, body: resolveDiscrepancySchema }),
   manifestVerification.resolveDiscrepancy
);

export default router;
