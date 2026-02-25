"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const controllers_1 = __importDefault(require("../controllers"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Schemas de validación
const createIssueSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().min(1, "Description is required"),
    type: zod_1.z.nativeEnum(client_1.IssueType).optional(),
    priority: zod_1.z.nativeEnum(client_1.IssuePriority).optional(),
    order_id: zod_1.z.number().positive().optional(),
    parcel_id: zod_1.z.number().positive().optional(),
    affected_parcel_ids: zod_1.z.array(zod_1.z.number().positive()).optional(),
    order_item_hbl: zod_1.z.string().optional(),
    assigned_to_id: zod_1.z.string().uuid().optional(),
})
    .refine((data) => data.order_id || data.parcel_id || (data.affected_parcel_ids && data.affected_parcel_ids.length > 0), { message: "Either order_id, parcel_id, or affected_parcel_ids must be provided" })
    .refine((data) => !data.affected_parcel_ids || data.order_id, { message: "affected_parcel_ids requires order_id" });
const updateIssueSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().min(1).optional(),
    type: zod_1.z.nativeEnum(client_1.IssueType).optional(),
    priority: zod_1.z.nativeEnum(client_1.IssuePriority).optional(),
    status: zod_1.z.nativeEnum(client_1.IssueStatus).optional(),
    assigned_to_id: zod_1.z.string().uuid().nullable().optional(),
    resolution_notes: zod_1.z.string().optional(),
});
const resolveIssueSchema = zod_1.z.object({
    resolution_notes: zod_1.z.string().optional(),
});
const addCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, "Content is required"),
    is_internal: zod_1.z.boolean().optional(),
});
const addAttachmentSchema = zod_1.z.object({
    file_url: zod_1.z.string().url("Invalid file URL"),
    file_name: zod_1.z.string().min(1, "File name is required"),
    file_type: zod_1.z.string().min(1, "File type is required"),
    file_size: zod_1.z.number().positive().optional(),
    description: zod_1.z.string().optional(),
});
// Routes
/**
 * GET /api/v1/issues/stats
 * Get issues statistics
 * Query params: agency_id (admin only)
 */
router.get("/stats", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    query: zod_1.z.object({
        agency_id: zod_1.z.string().optional(),
    }),
}), controllers_1.default.issues.getStats);
/**
 * GET /api/v1/issues
 * Get all issues with optional filters
 * Query params: page, limit, status, priority, type, order_id, parcel_id, assigned_to_id
 */
router.get("/", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    query: zod_1.z.object({
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.IssueStatus).optional(),
        priority: zod_1.z.nativeEnum(client_1.IssuePriority).optional(),
        type: zod_1.z.nativeEnum(client_1.IssueType).optional(),
        order_id: zod_1.z.string().optional(),
        parcel_id: zod_1.z.string().optional(),
        assigned_to_id: zod_1.z.string().uuid().optional(),
    }),
}), controllers_1.default.issues.getAll);
/**
 * GET /api/v1/issues/:id
 * Get issue by ID
 */
router.get("/:id", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
}), controllers_1.default.issues.getById);
/**
 * POST /api/v1/issues
 * Create new issue
 */
router.post("/", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({ body: createIssueSchema }), controllers_1.default.issues.create);
/**
 * PATCH /api/v1/issues/:id
 * Update issue
 */
router.patch("/:id", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
    body: updateIssueSchema,
}), controllers_1.default.issues.update);
/**
 * POST /api/v1/issues/:id/resolve
 * Resolve issue
 */
router.post("/:id/resolve", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
    body: resolveIssueSchema,
}), controllers_1.default.issues.resolve);
/**
 * DELETE /api/v1/issues/:id
 * Delete issue (admin only)
 */
router.delete("/:id", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
}), controllers_1.default.issues.delete);
// Comments routes
/**
 * GET /api/v1/issues/:id/comments
 * Get all comments for an issue
 */
router.get("/:id/comments", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
}), controllers_1.default.issues.getComments);
/**
 * POST /api/v1/issues/:id/comments
 * Add comment to issue
 */
router.post("/:id/comments", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
    body: addCommentSchema,
}), controllers_1.default.issues.addComment);
/**
 * DELETE /api/v1/issues/:id/comments/:commentId
 * Delete comment (admin only)
 */
router.delete("/:id/comments/:commentId", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
        commentId: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
}), controllers_1.default.issues.deleteComment);
// Attachments routes
/**
 * GET /api/v1/issues/:id/attachments
 * Get all attachments for an issue
 */
router.get("/:id/attachments", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
}), controllers_1.default.issues.getAttachments);
/**
 * POST /api/v1/issues/:id/attachments
 * Add attachment to issue
 */
router.post("/:id/attachments", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
    body: addAttachmentSchema,
}), controllers_1.default.issues.addAttachment);
/**
 * DELETE /api/v1/issues/:id/attachments/:attachmentId
 * Delete attachment (admin only)
 */
router.delete("/:id/attachments/:attachmentId", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
        attachmentId: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
}), controllers_1.default.issues.deleteAttachment);
exports.default = router;
