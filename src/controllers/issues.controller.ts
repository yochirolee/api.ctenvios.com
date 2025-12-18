import { Response } from "express";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import repository from "../repositories";
import { IssueType, IssuePriority, IssueStatus, Roles } from "@prisma/client";
import { Permissions, canViewOwnResource, canViewResource, hasPermission } from "../utils/permissions";

interface IssuesRequest {
   user?: {
      id: string;
      email: string;
      role: string;
      agency_id?: number;
      carrier_id?: number;
   };
   query: {
      page?: string;
      limit?: string;
      status?: string;
      priority?: string;
      type?: string;
      order_id?: string;
      parcel_id?: string;
      assigned_to_id?: string;
      agency_id?: string;
   };
   body: {
      title?: string;
      description?: string;
      type?: IssueType;
      priority?: IssuePriority;
      status?: IssueStatus;
      order_id?: number;
      parcel_id?: number;
      affected_parcel_ids?: number[];
      order_item_hbl?: string;
      assigned_to_id?: string;
      resolution_notes?: string;
      content?: string;
      is_internal?: boolean;
      file_url?: string;
      file_name?: string;
      file_type?: string;
      file_size?: number;
   };
   params: {
      id?: string;
      commentId?: string;
      attachmentId?: string;
   };
}

const issues = {
   create: async (req: IssuesRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const {
         title,
         description,
         type,
         priority,
         order_id,
         parcel_id,
         affected_parcel_ids,
         order_item_hbl,
         assigned_to_id,
      } = req.body;

      //verify if the order exist in the order system
      const order = await repository.orders.getById(Number(order_id));
      if (!order) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Order not found");
      }

      if (!title || !description) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Title and description are required");
      }

      // Los usuarios deben pertenecer a una agencia o carrier
      if (!user.agency_id && !user.carrier_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
      }

      // Check if an issue with this order_id already exists
      if (order_id) {
         const existingIssue = await repository.issues.findByOrderId(order_id);
         if (existingIssue) {
            throw new AppError(HttpStatusCodes.CONFLICT, `An issue with order ID ${order_id} already exists`);
         }
      }

      // Si el usuario es de carrier, usar el agency_id de la orden
      // Si el usuario es de agencia, usar su propio agency_id
      const issueAgencyId = user.agency_id || order.agency_id || null;

      const issue = await repository.issues.create({
         title,
         description,
         type: type || IssueType.COMPLAINT,
         priority: priority || IssuePriority.MEDIUM,
         order_id,
         parcel_id,
         affected_parcel_ids,
         order_item_hbl,
         created_by_id: user.id,
         agency_id: issueAgencyId,
         assigned_to_id,
      });

      res.status(201).json(issue);
   },

   getAll: async (req: IssuesRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const page = req.query.page ? parseInt(req.query.page) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;

      if (page < 1 || limit < 1 || limit > 1000) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Invalid pagination parameters. Page and limit must be positive, limit max is 1000"
         );
      }

      const filters: {
         status?: IssueStatus;
         priority?: IssuePriority;
         type?: IssueType;
         agency_id?: number;
         assigned_to_id?: string;
         order_id?: number;
         parcel_id?: number;
      } = {};

      // RBAC: Solo ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las incidencias
      if (!hasPermission(user.role as Roles, Permissions.ISSUE_VIEW_ALL)) {
         // Si el usuario es de carrier, puede ver todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las issues (no aplicamos filtro)
         } else if (user.agency_id) {
            filters.agency_id = user.agency_id;
         } else {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         }
      } else if (req.query.agency_id) {
         filters.agency_id = parseInt(req.query.agency_id);
      }

      if (req.query.status) {
         const validStatuses = Object.values(IssueStatus);
         if (!validStatuses.includes(req.query.status as IssueStatus)) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Invalid status. Must be one of: ${validStatuses.join(", ")}`
            );
         }
         filters.status = req.query.status as IssueStatus;
      }

      if (req.query.priority) {
         const validPriorities = Object.values(IssuePriority);
         if (!validPriorities.includes(req.query.priority as IssuePriority)) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Invalid priority. Must be one of: ${validPriorities.join(", ")}`
            );
         }
         filters.priority = req.query.priority as IssuePriority;
      }

      if (req.query.type) {
         const validTypes = Object.values(IssueType);
         if (!validTypes.includes(req.query.type as IssueType)) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid type. Must be one of: ${validTypes.join(", ")}`);
         }
         filters.type = req.query.type as IssueType;
      }

      if (req.query.assigned_to_id) {
         filters.assigned_to_id = req.query.assigned_to_id;
      }

      if (req.query.order_id) {
         filters.order_id = parseInt(req.query.order_id);
      }

      if (req.query.parcel_id) {
         filters.parcel_id = parseInt(req.query.parcel_id);
      }

      const { issues, total } = await repository.issues.getAll({ page, limit, filters });

      res.status(200).json({
         rows: issues,
         total,
         page,
         limit,
         filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
   },

   getById: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.issues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las issues
      const canViewAll = hasPermission(user.role as Roles, Permissions.ISSUE_VIEW_ALL);
      if (!canViewAll) {
         // Si el usuario es de carrier, puede ver todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las issues
         } else if (!user.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to view this issue");
         }
      }

      res.status(200).json(issue);
   },

   update: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const { title, description, type, priority, status, assigned_to_id, resolution_notes } = req.body;

      const issue = await repository.issues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Solo el creador, asignado o admin puede actualizar
      const canUpdate =
         hasPermission(user.role as Roles, Permissions.ISSUE_MANAGE) ||
         issue.created_by_id === user.id ||
         issue.assigned_to_id === user.id;

      if (!canUpdate) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to update this issue");
      }

      const updatedIssue = await repository.issues.update(id, {
         title,
         description,
         type,
         priority,
         status,
         assigned_to_id,
         resolution_notes,
      });

      res.status(200).json({
         status: "success",
         data: updatedIssue,
      });
   },

   resolve: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const { resolution_notes } = req.body;

      const issue = await repository.issues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Solo el asignado o admin puede resolver
      const canResolve = hasPermission(user.role as Roles, Permissions.ISSUE_MANAGE) || issue.assigned_to_id === user.id;

      if (!canResolve) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to resolve this issue");
      }

      const resolvedIssue = await repository.issues.resolve(id, user.id, resolution_notes);

      res.status(200).json({
         status: "success",
         data: resolvedIssue,
      });
   },

   delete: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.issues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Solo admin puede eliminar
      if (!hasPermission(user.role as Roles, Permissions.ISSUE_DELETE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only administrators can delete issues");
      }

      await repository.issues.delete(id);

      res.status(200).json({
         status: "success",
         message: "Issue deleted successfully",
      });
   },

   // Comments
   addComment: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const issueId = parseInt(req.params.id);
      if (isNaN(issueId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const { content, is_internal } = req.body;

      if (!content) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Content is required");
      }

      const issue = await repository.issues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden comentar en todas las issues
      const canManageAll = hasPermission(user.role as Roles, Permissions.ISSUE_MANAGE);
      if (!canManageAll) {
         // Si el usuario es de carrier, puede comentar en todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden comentar en todas las issues
         } else if (!user.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to comment on this issue");
         }
      }

      const comment = await repository.issues.addComment({
         issue_id: issueId,
         user_id: user.id,
         content,
         is_internal: is_internal ?? false,
      });

      res.status(201).json(comment);
   },

   getComments: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const issueId = parseInt(req.params.id);
      if (isNaN(issueId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.issues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las issues
      const canViewAll = hasPermission(user.role as Roles, Permissions.ISSUE_VIEW_ALL);
      if (!canViewAll) {
         // Si el usuario es de carrier, puede ver todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las issues
         } else if (!user.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to view this issue");
         }
      }

      // Solo staff puede ver comentarios internos
      const includeInternal = hasPermission(user.role as Roles, Permissions.ISSUE_VIEW_ALL);

      const comments = await repository.issues.getComments(issueId, includeInternal);

      res.status(200).json(comments);
   },

   deleteComment: async (
      req: IssuesRequest & { params: { id: string; commentId: string } },
      res: Response
   ): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const commentId = parseInt(req.params.commentId);
      if (isNaN(commentId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid comment ID");
      }

      // Solo admin puede eliminar comentarios
      if (!hasPermission(user.role as Roles, Permissions.ISSUE_DELETE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only administrators can delete comments");
      }

      await repository.issues.deleteComment(commentId);

      res.status(200).json("Comment deleted successfully");
   },

   // Attachments
   addAttachment: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const issueId = parseInt(req.params.id);
      if (isNaN(issueId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const { file_url, file_name, file_type, file_size, description } = req.body;

      if (!file_url || !file_name || !file_type) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "file_url, file_name, and file_type are required");
      }

      const issue = await repository.issues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden agregar attachments a todas las issues
      const canManageAll = hasPermission(user.role as Roles, Permissions.ISSUE_MANAGE);
      if (!canManageAll) {
         // Si el usuario es de carrier, puede agregar attachments a todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden agregar attachments a todas las issues
         } else if (!user.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to add attachments to this issue");
         }
      }

      const attachment = await repository.issues.addAttachment({
         issue_id: issueId,
         file_url,
         file_name,
         file_type,
         file_size,
         uploaded_by_id: user.id,
         description,
      });

      res.status(201).json(attachment);
   },

   getAttachments: async (req: IssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const issueId = parseInt(req.params.id);
      if (isNaN(issueId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.issues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las issues
      const canViewAll = hasPermission(user.role as Roles, Permissions.ISSUE_VIEW_ALL);
      if (!canViewAll) {
         // Si el usuario es de carrier, puede ver todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las issues
         } else if (!user.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to view this issue");
         }
      }

      const attachments = await repository.issues.getAttachments(issueId);

      res.status(200).json(attachments);
   },

   deleteAttachment: async (
      req: IssuesRequest & { params: { id: string; attachmentId: string } },
      res: Response
   ): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const attachmentId = parseInt(req.params.attachmentId);
      if (isNaN(attachmentId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid attachment ID");
      }

      // Solo admin puede eliminar attachments
      if (!hasPermission(user.role as Roles, Permissions.ISSUE_DELETE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only administrators can delete attachments");
      }

      await repository.issues.deleteAttachment(attachmentId);

      res.status(200).json({
         status: "success",
         message: "Attachment deleted successfully",
      });
   },

   getStats: async (req: IssuesRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      // RBAC: Solo ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las estadísticas
      const filters: { agency_id?: number } = {};

      if (!hasPermission(user.role as Roles, Permissions.ISSUE_VIEW_ALL)) {
         // Si el usuario es de carrier, puede ver todas las stats
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las estadísticas
         } else if (user.agency_id) {
            filters.agency_id = user.agency_id;
         } else {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         }
      } else if (req.query.agency_id) {
         filters.agency_id = parseInt(req.query.agency_id);
      }

      const stats = await repository.issues.getStats(filters);

      res.status(200).json(stats);
   },
};

export default issues;
