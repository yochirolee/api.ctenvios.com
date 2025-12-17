import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import controllers from "../controllers";
import { IssueType, IssuePriority, IssueStatus } from "@prisma/client";

const router = Router();

// Schemas de validación
const createLegacyIssueSchema = z
   .object({
      title: z.string().min(1, "Title is required"),
      description: z.string().min(1, "Description is required"),
      type: z.nativeEnum(IssueType).optional(),
      priority: z.nativeEnum(IssuePriority).optional(),
      legacy_invoice_id: z.number().positive().optional(),
      legacy_order_id: z.number().positive().optional(),
      legacy_parcel_id: z.number().positive().optional(),
      legacy_hbl: z.string().optional(),
      affected_parcel_ids: z.array(z.number().positive()).optional(),
      assigned_to_id: z.string().uuid().optional(),
   })
   .refine(
      (data) =>
         data.legacy_invoice_id ||
         data.legacy_order_id ||
         data.legacy_parcel_id ||
         data.legacy_hbl ||
         (data.affected_parcel_ids && data.affected_parcel_ids.length > 0),
      {
         message:
            "At least one legacy reference must be provided: legacy_invoice_id, legacy_order_id, legacy_parcel_id, legacy_hbl, or affected_parcel_ids",
      }
   )
   .refine((data) => !data.affected_parcel_ids || data.legacy_order_id || data.legacy_invoice_id, {
      message: "affected_parcel_ids requires legacy_order_id or legacy_invoice_id",
   });

const updateLegacyIssueSchema = z.object({
   title: z.string().min(1).optional(),
   description: z.string().min(1).optional(),
   type: z.nativeEnum(IssueType).optional(),
   priority: z.nativeEnum(IssuePriority).optional(),
   status: z.nativeEnum(IssueStatus).optional(),
   assigned_to_id: z.string().uuid().nullable().optional(),
   resolution_notes: z.string().optional(),
});

const resolveLegacyIssueSchema = z.object({
   resolution_notes: z.string().optional(),
});

const addLegacyCommentSchema = z.object({
   content: z.string().min(1, "Content is required"),
   is_internal: z.boolean().optional(),
});

const addLegacyAttachmentSchema = z.object({
   file_url: z.string().url("Invalid file URL"),
   file_name: z.string().min(1, "File name is required"),
   file_type: z.string().min(1, "File type is required"),
   file_size: z.number().positive().optional(),
   description: z.string().optional(),
});

// Routes
/**
 * GET /api/v1/legacy-issues/stats
 * Get legacy issues statistics
 */
router.get(
   "/stats",
   authMiddleware,
   validate({
      query: z.object({}),
   }),
   controllers.legacyIssues.getStats
);

/**
 * GET /api/v1/legacy-issues
 * Get all legacy issues with optional filters
 * Query params: page, limit, status, priority, type, legacy_invoice_id, legacy_order_id, legacy_parcel_id, legacy_hbl, assigned_to_id
 */
router.get(
   "/",
   authMiddleware,
   validate({
      query: z.object({
         page: z.string().optional(),
         limit: z.string().optional(),
         status: z.nativeEnum(IssueStatus).optional(),
         priority: z.nativeEnum(IssuePriority).optional(),
         type: z.nativeEnum(IssueType).optional(),
         legacy_invoice_id: z.string().optional(),
         legacy_order_id: z.string().optional(),
         legacy_parcel_id: z.string().optional(),
         legacy_hbl: z.string().optional(),
         assigned_to_id: z.string().uuid().optional(),
      }),
   }),
   controllers.legacyIssues.getAll
);

/**
 * GET /api/v1/legacy-issues/:id
 * Get legacy issue by ID
 */
router.get(
   "/:id",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.legacyIssues.getById
);

/**
 * POST /api/v1/legacy-issues
 * Create new legacy issue
 */
router.post("/", authMiddleware, validate({ body: createLegacyIssueSchema }), controllers.legacyIssues.create);

/**
 * PATCH /api/v1/legacy-issues/:id
 * Update legacy issue
 */
router.patch(
   "/:id",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: updateLegacyIssueSchema,
   }),
   controllers.legacyIssues.update
);

/**
 * POST /api/v1/legacy-issues/:id/resolve
 * Resolve legacy issue
 */
router.post(
   "/:id/resolve",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: resolveLegacyIssueSchema,
   }),
   controllers.legacyIssues.resolve
);

/**
 * DELETE /api/v1/legacy-issues/:id
 * Delete legacy issue (admin only)
 */
router.delete(
   "/:id",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.legacyIssues.delete
);

// Comments routes
/**
 * GET /api/v1/legacy-issues/:id/comments
 * Get all comments for a legacy issue
 */
router.get(
   "/:id/comments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.legacyIssues.getComments
);

/**
 * POST /api/v1/legacy-issues/:id/comments
 * Add comment to legacy issue
 */
router.post(
   "/:id/comments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: addLegacyCommentSchema,
   }),
   controllers.legacyIssues.addComment
);

/**
 * DELETE /api/v1/legacy-issues/:id/comments/:commentId
 * Delete comment (admin only)
 */
router.delete(
   "/:id/comments/:commentId",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
         commentId: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.legacyIssues.deleteComment
);

// Attachments routes
/**
 * GET /api/v1/legacy-issues/:id/attachments
 * Get all attachments for a legacy issue
 */
router.get(
   "/:id/attachments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.legacyIssues.getAttachments
);

/**
 * POST /api/v1/legacy-issues/:id/attachments
 * Add attachment to legacy issue
 */
router.post(
   "/:id/attachments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: addLegacyAttachmentSchema,
   }),
   controllers.legacyIssues.addAttachment
);

/**
 * DELETE /api/v1/legacy-issues/:id/attachments/:attachmentId
 * Delete attachment (admin only)
 */
router.delete(
   "/:id/attachments/:attachmentId",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
         attachmentId: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.legacyIssues.deleteAttachment
);

export default router;
