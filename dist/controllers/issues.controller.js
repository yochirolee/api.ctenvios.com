"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const repositories_1 = __importDefault(require("../repositories"));
const client_1 = require("@prisma/client");
const permissions_1 = require("../utils/permissions");
const issues = {
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const { title, description, type, priority, order_id, parcel_id, affected_parcel_ids, order_item_hbl, assigned_to_id, } = req.body;
        //verify if the order exist in the order system
        const order = yield repositories_1.default.orders.getById(Number(order_id));
        if (!order) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
        }
        if (!title || !description) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Title and description are required");
        }
        // Los usuarios deben pertenecer a una agencia o carrier
        if (!user.agency_id && !user.carrier_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency or carrier");
        }
        // Check if an issue with this order_id already exists
        if (order_id) {
            const existingIssue = yield repositories_1.default.issues.findByOrderId(order_id);
            if (existingIssue) {
                throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `An issue with order ID ${order_id} already exists`);
            }
        }
        // Si el usuario es de carrier, usar el agency_id de la orden
        // Si el usuario es de agencia, usar su propio agency_id
        const issueAgencyId = user.agency_id || order.agency_id || null;
        const issue = yield repositories_1.default.issues.create({
            title,
            description,
            type: type || client_1.IssueType.COMPLAINT,
            priority: priority || client_1.IssuePriority.MEDIUM,
            order_id,
            parcel_id,
            affected_parcel_ids,
            order_item_hbl,
            created_by_id: user.id,
            agency_id: issueAgencyId,
            assigned_to_id,
        });
        res.status(201).json(issue);
    }),
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        if (page < 1 || limit < 1 || limit > 1000) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid pagination parameters. Page and limit must be positive, limit max is 1000");
        }
        const filters = {};
        // RBAC: Solo ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las incidencias
        if (!(0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_VIEW_ALL)) {
            // Si el usuario es de carrier, puede ver todas las issues
            if (user.carrier_id) {
                // Los usuarios de carrier pueden ver todas las issues (no aplicamos filtro)
            }
            else if (user.agency_id) {
                filters.agency_id = user.agency_id;
            }
            else {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency or carrier");
            }
        }
        else if (req.query.agency_id) {
            filters.agency_id = parseInt(req.query.agency_id);
        }
        if (req.query.status) {
            const validStatuses = Object.values(client_1.IssueStatus);
            if (!validStatuses.includes(req.query.status)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
            }
            filters.status = req.query.status;
        }
        if (req.query.priority) {
            const validPriorities = Object.values(client_1.IssuePriority);
            if (!validPriorities.includes(req.query.priority)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid priority. Must be one of: ${validPriorities.join(", ")}`);
            }
            filters.priority = req.query.priority;
        }
        if (req.query.type) {
            const validTypes = Object.values(client_1.IssueType);
            if (!validTypes.includes(req.query.type)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid type. Must be one of: ${validTypes.join(", ")}`);
            }
            filters.type = req.query.type;
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
        const { issues, total } = yield repositories_1.default.issues.getAll({ page, limit, filters });
        res.status(200).json({
            rows: issues,
            total,
            page,
            limit,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
        });
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const issue = yield repositories_1.default.issues.getById(id);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las issues
        const canViewAll = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_VIEW_ALL);
        if (!canViewAll) {
            // Si el usuario es de carrier, puede ver todas las issues
            if (user.carrier_id) {
                // Los usuarios de carrier pueden ver todas las issues
            }
            else if (!user.agency_id || issue.agency_id !== user.agency_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You don't have permission to view this issue");
            }
        }
        res.status(200).json(issue);
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const { title, description, type, priority, status, assigned_to_id, resolution_notes } = req.body;
        const issue = yield repositories_1.default.issues.getById(id);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Solo el creador, asignado o admin puede actualizar
        const canUpdate = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_MANAGE) ||
            issue.created_by_id === user.id ||
            issue.assigned_to_id === user.id;
        if (!canUpdate) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You don't have permission to update this issue");
        }
        const updatedIssue = yield repositories_1.default.issues.update(id, {
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
    }),
    resolve: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const { resolution_notes } = req.body;
        const issue = yield repositories_1.default.issues.getById(id);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Solo el asignado o admin puede resolver
        const canResolve = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_MANAGE) || issue.assigned_to_id === user.id;
        if (!canResolve) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You don't have permission to resolve this issue");
        }
        const resolvedIssue = yield repositories_1.default.issues.resolve(id, user.id, resolution_notes);
        res.status(200).json({
            status: "success",
            data: resolvedIssue,
        });
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const issue = yield repositories_1.default.issues.getById(id);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Solo admin puede eliminar
        if (!(0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_DELETE)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Only administrators can delete issues");
        }
        yield repositories_1.default.issues.delete(id);
        res.status(200).json({
            status: "success",
            message: "Issue deleted successfully",
        });
    }),
    // Comments
    addComment: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const issueId = parseInt(req.params.id);
        if (isNaN(issueId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const { content, is_internal } = req.body;
        if (!content) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Content is required");
        }
        const issue = yield repositories_1.default.issues.getById(issueId);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden comentar en todas las issues
        const canManageAll = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_MANAGE);
        if (!canManageAll) {
            // Si el usuario es de carrier, puede comentar en todas las issues
            if (user.carrier_id) {
                // Los usuarios de carrier pueden comentar en todas las issues
            }
            else if (!user.agency_id || issue.agency_id !== user.agency_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You don't have permission to comment on this issue");
            }
        }
        const comment = yield repositories_1.default.issues.addComment({
            issue_id: issueId,
            user_id: user.id,
            content,
            is_internal: is_internal !== null && is_internal !== void 0 ? is_internal : false,
        });
        res.status(201).json(comment);
    }),
    getComments: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const issueId = parseInt(req.params.id);
        if (isNaN(issueId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const issue = yield repositories_1.default.issues.getById(issueId);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las issues
        const canViewAll = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_VIEW_ALL);
        if (!canViewAll) {
            // Si el usuario es de carrier, puede ver todas las issues
            if (user.carrier_id) {
                // Los usuarios de carrier pueden ver todas las issues
            }
            else if (!user.agency_id || issue.agency_id !== user.agency_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You don't have permission to view this issue");
            }
        }
        // Solo staff puede ver comentarios internos
        const includeInternal = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_VIEW_ALL);
        const comments = yield repositories_1.default.issues.getComments(issueId, includeInternal);
        res.status(200).json(comments);
    }),
    deleteComment: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid comment ID");
        }
        // Solo admin puede eliminar comentarios
        if (!(0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_DELETE)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Only administrators can delete comments");
        }
        yield repositories_1.default.issues.deleteComment(commentId);
        res.status(200).json("Comment deleted successfully");
    }),
    // Attachments
    addAttachment: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const issueId = parseInt(req.params.id);
        if (isNaN(issueId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const { file_url, file_name, file_type, file_size, description } = req.body;
        if (!file_url || !file_name || !file_type) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "file_url, file_name, and file_type are required");
        }
        const issue = yield repositories_1.default.issues.getById(issueId);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden agregar attachments a todas las issues
        const canManageAll = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_MANAGE);
        if (!canManageAll) {
            // Si el usuario es de carrier, puede agregar attachments a todas las issues
            if (user.carrier_id) {
                // Los usuarios de carrier pueden agregar attachments a todas las issues
            }
            else if (!user.agency_id || issue.agency_id !== user.agency_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You don't have permission to add attachments to this issue");
            }
        }
        const attachment = yield repositories_1.default.issues.addAttachment({
            issue_id: issueId,
            file_url,
            file_name,
            file_type,
            file_size,
            uploaded_by_id: user.id,
            description,
        });
        res.status(201).json(attachment);
    }),
    getAttachments: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const issueId = parseInt(req.params.id);
        if (isNaN(issueId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid issue ID");
        }
        const issue = yield repositories_1.default.issues.getById(issueId);
        if (!issue) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Issue not found");
        }
        // RBAC: Verificar permisos - ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las issues
        const canViewAll = (0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_VIEW_ALL);
        if (!canViewAll) {
            // Si el usuario es de carrier, puede ver todas las issues
            if (user.carrier_id) {
                // Los usuarios de carrier pueden ver todas las issues
            }
            else if (!user.agency_id || issue.agency_id !== user.agency_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You don't have permission to view this issue");
            }
        }
        const attachments = yield repositories_1.default.issues.getAttachments(issueId);
        res.status(200).json(attachments);
    }),
    deleteAttachment: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        const attachmentId = parseInt(req.params.attachmentId);
        if (isNaN(attachmentId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid attachment ID");
        }
        // Solo admin puede eliminar attachments
        if (!(0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_DELETE)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Only administrators can delete attachments");
        }
        yield repositories_1.default.issues.deleteAttachment(attachmentId);
        res.status(200).json({
            status: "success",
            message: "Attachment deleted successfully",
        });
    }),
    getStats: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
        }
        // RBAC: Solo ROOT, ADMINISTRATOR y roles de carrier pueden ver todas las estadísticas
        const filters = {};
        if (!(0, permissions_1.hasPermission)(user.role, permissions_1.Permissions.ISSUE_VIEW_ALL)) {
            // Si el usuario es de carrier, puede ver todas las stats
            if (user.carrier_id) {
                // Los usuarios de carrier pueden ver todas las estadísticas
            }
            else if (user.agency_id) {
                filters.agency_id = user.agency_id;
            }
            else {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency or carrier");
            }
        }
        else if (req.query.agency_id) {
            filters.agency_id = parseInt(req.query.agency_id);
        }
        const stats = yield repositories_1.default.issues.getStats(filters);
        res.status(200).json(stats);
    }),
};
exports.default = issues;
