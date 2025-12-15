import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import controllers from "../controllers";
import { IssueType, IssuePriority, IssueStatus } from "@prisma/client";

const router = Router();

// Schemas de validación
const createIssueSchema = z
   .object({
      title: z.string().min(1, "Title is required"),
      description: z.string().min(1, "Description is required"),
      type: z.nativeEnum(IssueType).optional(),
      priority: z.nativeEnum(IssuePriority).optional(),
      order_id: z.number().positive().optional(),
      parcel_id: z.number().positive().optional(),
      affected_parcel_ids: z.array(z.number().positive()).optional(),
      order_item_hbl: z.string().optional(),
      assigned_to_id: z.string().uuid().optional(),
   })
   .refine(
      (data) => data.order_id || data.parcel_id || (data.affected_parcel_ids && data.affected_parcel_ids.length > 0),
      { message: "Either order_id, parcel_id, or affected_parcel_ids must be provided" }
   )
   .refine((data) => !data.affected_parcel_ids || data.order_id, { message: "affected_parcel_ids requires order_id" });

const updateIssueSchema = z.object({
   title: z.string().min(1).optional(),
   description: z.string().min(1).optional(),
   type: z.nativeEnum(IssueType).optional(),
   priority: z.nativeEnum(IssuePriority).optional(),
   status: z.nativeEnum(IssueStatus).optional(),
   assigned_to_id: z.string().uuid().nullable().optional(),
   resolution_notes: z.string().optional(),
});

const resolveIssueSchema = z.object({
   resolution_notes: z.string().optional(),
});

const addCommentSchema = z.object({
   content: z.string().min(1, "Content is required"),
   is_internal: z.boolean().optional(),
});

const addAttachmentSchema = z.object({
   file_url: z.string().url("Invalid file URL"),
   file_name: z.string().min(1, "File name is required"),
   file_type: z.string().min(1, "File type is required"),
   file_size: z.number().positive().optional(),
   description: z.string().optional(),
});

// Routes
/**
 * GET /api/v1/issues/stats
 * Get issues statistics
 * Query params: agency_id (admin only)
 */
router.get(
   "/stats",
   authMiddleware,
   validate({
      query: z.object({
         agency_id: z.string().optional(),
      }),
   }),
   controllers.issues.getStats
);

/**
 * GET /api/v1/issues
 * Get all issues with optional filters
 * Query params: page, limit, status, priority, type, order_id, parcel_id, assigned_to_id
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
         order_id: z.string().optional(),
         parcel_id: z.string().optional(),
         assigned_to_id: z.string().uuid().optional(),
      }),
   }),
   controllers.issues.getAll
);

/**
 * GET /api/v1/issues/:id
 * Get issue by ID
 */
router.get(
   "/:id",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.issues.getById
);

/**
 * POST /api/v1/issues
 * Create new issue
 */
router.post("/", authMiddleware, validate({ body: createIssueSchema }), controllers.issues.create);

/**
 * PATCH /api/v1/issues/:id
 * Update issue
 */
router.patch(
   "/:id",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: updateIssueSchema,
   }),
   controllers.issues.update
);

/**
 * POST /api/v1/issues/:id/resolve
 * Resolve issue
 */
router.post(
   "/:id/resolve",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: resolveIssueSchema,
   }),
   controllers.issues.resolve
);

/**
 * DELETE /api/v1/issues/:id
 * Delete issue (admin only)
 */
router.delete(
   "/:id",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.issues.delete
);

// Comments routes
/**
 * GET /api/v1/issues/:id/comments
 * Get all comments for an issue
 */
router.get(
   "/:id/comments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.issues.getComments
);

/**
 * POST /api/v1/issues/:id/comments
 * Add comment to issue
 */
router.post(
   "/:id/comments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: addCommentSchema,
   }),
   controllers.issues.addComment
);

/**
 * DELETE /api/v1/issues/:id/comments/:commentId
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
   controllers.issues.deleteComment
);

// Attachments routes
/**
 * GET /api/v1/issues/:id/attachments
 * Get all attachments for an issue
 */
router.get(
   "/:id/attachments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.issues.getAttachments
);

/**
 * POST /api/v1/issues/:id/attachments
 * Add attachment to issue
 */
router.post(
   "/:id/attachments",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
      body: addAttachmentSchema,
   }),
   controllers.issues.addAttachment
);

/**
 * DELETE /api/v1/issues/:id/attachments/:attachmentId
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
   controllers.issues.deleteAttachment
);

export default router;
