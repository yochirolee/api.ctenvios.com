import { Response } from "express";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import repository from "../repositories";
import { IssueType, IssuePriority, IssueStatus, Roles } from "@prisma/client";
import { legacy_db_service } from "../services/legacy-myslq-db";
import { Permissions, hasPermission } from "../utils/permissions";

interface LegacyIssuesRequest {
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
      legacy_order_id?: string;
      legacy_parcel_id?: string;
      legacy_hbl?: string;
      assigned_to_id?: string;
      issue_id?: string;
   };
   body: {
      title?: string;
      description?: string;
      type?: IssueType;
      priority?: IssuePriority;
      status?: IssueStatus;
      legacy_order_id?: number;
      legacy_parcel_id?: number;
      legacy_hbl?: string;
      affected_parcel_ids: Array<{ legacy_parcel_id: string }>;
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

const legacyIssues = {
   create: async (req: LegacyIssuesRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const { title, description, type, priority, legacy_order_id, affected_parcel_ids, assigned_to_id } = req.body;

      if (!title || !description) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Title and description are required");
      }

      // Los usuarios deben pertenecer a una agencia o carrier
      if (!user.agency_id && !user.carrier_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
      }

      // Verify if the legacy order exists in the legacy system (only if legacy_order_id is provided)
      if (legacy_order_id) {
         const order = await legacy_db_service.getParcelsByOrderId(Number(legacy_order_id));
         console.log(order, "order");
         if (!order) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Order not found");
         }

         // Check if an issue with this legacy_order_id already exists
         const existingIssue = await repository.legacyIssues.findByLegacyOrderId(legacy_order_id);
         if (existingIssue) {
            throw new AppError(HttpStatusCodes.CONFLICT, `An issue with order ID ${legacy_order_id} already exists`);
         }
      }

      const issue = await repository.legacyIssues.create({
         title,
         description,
         type: type || IssueType.COMPLAINT,
         priority: priority || IssuePriority.MEDIUM,
         legacy_order_id,
         affected_parcel_ids,
         created_by_id: user.id,
         agency_id: user.agency_id || undefined, // Puede ser undefined si es creada por un carrier
         assigned_to_id,
      });

      res.status(201).json(issue);
   },

   getAll: async (req: LegacyIssuesRequest, res: Response): Promise<void> => {
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
         created_by_id?: string;
         agency_id?: number;
         assigned_to_id?: string;
         legacy_invoice_id?: number;
         legacy_order_id?: number;
         legacy_parcel_id?: number;
         legacy_hbl?: string;
         issue_id?: number;
      } = {};

      // RBAC: Solo ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las incidencias legacy
      // Otros roles solo ven las de su agencia
      const canViewAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      if (!canViewAll) {
         // Si el usuario es de carrier, puede ver todas las issues (los carriers resuelven issues de agencias)
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las legacy issues
            // No aplicamos filtro de agency_id
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else {
            filters.agency_id = user.agency_id; // Filtrar por agencia directamente
         }
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

      if (req.query.legacy_order_id) {
         filters.legacy_order_id = parseInt(req.query.legacy_order_id);
      }

      if (req.query.legacy_parcel_id) {
         filters.legacy_parcel_id = parseInt(req.query.legacy_parcel_id);
      }

      if (req.query.legacy_hbl) {
         filters.legacy_hbl = req.query.legacy_hbl;
      }

      if (req.query.issue_id) {
         filters.issue_id = parseInt(req.query.issue_id);
      }

      const { legacyIssues, total } = await repository.legacyIssues.getAll({ page, limit, filters });

      res.status(200).json({
         rows: legacyIssues,
         total,
         page,
         limit,
         filters: Object.keys(filters).length > 0 ? filters : undefined,
      });
   },

   getById: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.legacyIssues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las legacy issues
      const canViewAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      if (!canViewAll) {
         // Si el usuario es de carrier, puede ver todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las legacy issues
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else {
            // Verificar que el creador de la issue pertenezca a la misma agencia
            if (!issue.created_by?.agency_id || issue.created_by.agency_id !== user.agency_id) {
               throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to view this legacy issue");
            }
         }
      }

      res.status(200).json(issue);
   },

   update: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const { title, description, type, priority, status, assigned_to_id, resolution_notes } = req.body;

      const issue = await repository.legacyIssues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Solo el creador, asignado o admin puede actualizar
      // ROOT, ADMINISTRATOR y roles de carrier pueden actualizar todas
      const canManageAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      const isCreator = issue.created_by_id === user.id;
      const isAssigned = issue.assigned_to_id === user.id;

      if (!canManageAll && !isCreator && !isAssigned) {
         // Si el usuario es de carrier, puede actualizar todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden actualizar todas las legacy issues
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else if (!issue.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to update this legacy issue");
         }
      }

      const updatedIssue = await repository.legacyIssues.update(id, {
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

   resolve: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const { resolution_notes } = req.body;

      const issue = await repository.legacyIssues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Solo el asignado o admin puede resolver
      // ROOT, ADMINISTRATOR y roles de carrier pueden resolver todas
      const canManageAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      const isAssigned = issue.assigned_to_id === user.id;

      if (!canManageAll && !isAssigned) {
         // Si el usuario es de carrier, puede resolver todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden resolver todas las legacy issues
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else if (!issue.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to resolve this legacy issue");
         }
      }

      const resolvedIssue = await repository.legacyIssues.resolve(id, user.id, resolution_notes);

      res.status(200).json({
         status: "success",
         data: resolvedIssue,
      });
   },

   delete: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.legacyIssues.getById(id);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Solo ROOT y ADMINISTRATOR pueden eliminar
      const adminRoles: Roles[] = [Roles.ROOT, Roles.ADMINISTRATOR];
      if (!adminRoles.includes(user.role as Roles)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only administrators can delete legacy issues");
      }

      await repository.legacyIssues.delete(id);

      res.status(200).json({
         status: "success",
         message: "Legacy issue deleted successfully",
      });
   },

   // Comments
   addComment: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
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

      const issue = await repository.legacyIssues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Solo el creador o admin puede comentar
      // ROOT, ADMINISTRATOR y roles de carrier pueden comentar en todas
      const canManageAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      const isCreator = issue.created_by_id === user.id;

      if (!canManageAll && !isCreator) {
         // Si el usuario es de carrier, puede comentar en todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden comentar en todas las legacy issues
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else if (!issue.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to comment on this legacy issue");
         }
      }

      const comment = await repository.legacyIssues.addComment({
         issue_id: issueId,
         user_id: user.id,
         content,
         is_internal: is_internal ?? false,
      });

      res.status(201).json({
         status: "success",
         data: comment,
      });
   },

   getComments: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const issueId = parseInt(req.params.id);
      if (isNaN(issueId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.legacyIssues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las legacy issues
      const canViewAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      if (!canViewAll && issue.created_by_id !== user.id) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to view this legacy issue");
      }

      // Solo staff puede ver comentarios internos
      const includeInternal = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);

      const comments = await repository.legacyIssues.getComments(issueId, includeInternal);

      res.status(200).json({
         status: "success",
         data: comments,
      });
   },

   deleteComment: async (
      req: LegacyIssuesRequest & { params: { id: string; commentId: string } },
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

      // Solo ROOT, ADMINISTRATOR y roles de carrier pueden eliminar comentarios
      if (!hasPermission(user.role as Roles, Permissions.ISSUE_DELETE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only administrators can delete comments");
      }

      await repository.legacyIssues.deleteComment(commentId);

      res.status(200).json({
         status: "success",
         message: "Comment deleted successfully",
      });
   },

   // Attachments
   addAttachment: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
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

      const issue = await repository.legacyIssues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Solo el creador o admin puede agregar attachments
      // ROOT, ADMINISTRATOR y roles de carrier pueden agregar attachments a todas
      const canManageAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      const isCreator = issue.created_by_id === user.id;

      if (!canManageAll && !isCreator) {
         // Si el usuario es de carrier, puede agregar attachments a todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden agregar attachments a todas las legacy issues
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else if (!issue.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(
               HttpStatusCodes.FORBIDDEN,
               "You don't have permission to add attachments to this legacy issue"
            );
         }
      }

      const attachment = await repository.legacyIssues.addAttachment({
         issue_id: issueId,
         file_url,
         file_name,
         file_type,
         file_size,
         uploaded_by_id: user.id,
         description,
      });

      res.status(201).json({
         status: "success",
         data: attachment,
      });
   },

   getAttachments: async (req: LegacyIssuesRequest & { params: { id: string } }, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const issueId = parseInt(req.params.id);
      if (isNaN(issueId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid issue ID");
      }

      const issue = await repository.legacyIssues.getById(issueId);
      if (!issue) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Legacy issue not found");
      }

      // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las legacy issues
      const canViewAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      if (!canViewAll) {
         // Si el usuario es de carrier, puede ver todas las issues
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las legacy issues
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else if (!issue.agency_id || issue.agency_id !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to view this legacy issue");
         }
      }

      const attachments = await repository.legacyIssues.getAttachments(issueId);

      res.status(200).json({
         status: "success",
         data: attachments,
      });
   },

   deleteAttachment: async (
      req: LegacyIssuesRequest & { params: { id: string; attachmentId: string } },
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

      // Solo ROOT, ADMINISTRATOR y roles de carrier pueden eliminar attachments
      if (!hasPermission(user.role as Roles, Permissions.ISSUE_DELETE)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only administrators can delete attachments");
      }

      await repository.legacyIssues.deleteAttachment(attachmentId);

      res.status(200).json({
         status: "success",
         message: "Attachment deleted successfully",
      });
   },

   getStats: async (req: LegacyIssuesRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      // RBAC: Solo ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las estadísticas
      const canViewAll = hasPermission(user.role as Roles, Permissions.LEGACY_ISSUE_VIEW_ALL);
      const filters: { created_by_id?: string; agency_id?: number } = {};

      if (!canViewAll) {
         // Si el usuario es de carrier, puede ver todas las stats
         if (user.carrier_id) {
            // Los usuarios de carrier pueden ver todas las estadísticas
         } else if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency or carrier");
         } else {
            filters.agency_id = user.agency_id; // Usuarios regulares solo ven las stats de su agencia
         }
      }

      const stats = await repository.legacyIssues.getStats(filters);

      res.status(200).json({
         status: "success",
         data: stats,
      });
   },
};

export default legacyIssues;
