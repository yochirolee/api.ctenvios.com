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
exports.issues = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
exports.issues = {
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        // Validar que solo uno de order_id o parcel_id esté presente (pero order_id puede tener affected_parcel_ids)
        if (data.order_id && data.parcel_id) {
            throw new Error("Cannot specify both order_id and parcel_id");
        }
        if (!data.order_id && !data.parcel_id && !((_a = data.affected_parcel_ids) === null || _a === void 0 ? void 0 : _a.length)) {
            throw new Error("Must specify either order_id, parcel_id, or affected_parcel_ids");
        }
        // Si hay affected_parcel_ids, debe haber order_id
        if (data.affected_parcel_ids && data.affected_parcel_ids.length > 0 && !data.order_id) {
            throw new Error("affected_parcel_ids requires order_id");
        }
        const createData = {
            title: data.title,
            description: data.description,
            type: data.type,
            priority: data.priority,
            order_id: data.order_id,
            parcel_id: data.parcel_id,
            order_item_hbl: data.order_item_hbl,
            created_by_id: data.created_by_id,
            agency_id: (_b = data.agency_id) !== null && _b !== void 0 ? _b : null,
            assigned_to_id: data.assigned_to_id,
        };
        // Solo agregar affected_parcels si hay datos
        if (data.affected_parcel_ids && data.affected_parcel_ids.length > 0) {
            createData.affected_parcels = {
                create: data.affected_parcel_ids.map((parcel_id) => ({
                    parcel_id,
                })),
            };
        }
        const includeClause = {
            created_by: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    agency: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    carrier: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            assigned_to: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            order: {
                select: {
                    id: true,
                    customer: {
                        select: {
                            first_name: true,
                            last_name: true,
                        },
                    },
                },
            },
            parcel: {
                select: {
                    id: true,
                    tracking_number: true,
                },
            },
            agency: {
                select: {
                    id: true,
                    name: true,
                },
            },
        };
        // Solo incluir affected_parcels si hay datos (evita error si Prisma no está regenerado)
        if (data.affected_parcel_ids && data.affected_parcel_ids.length > 0) {
            includeClause.affected_parcels = {
                include: {
                    parcel: {
                        select: {
                            id: true,
                            tracking_number: true,
                            description: true,
                            status: true,
                        },
                    },
                },
            };
        }
        return yield prisma_client_1.default.issue.create({
            data: createData,
            include: includeClause,
        });
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.issue.findUnique({
            where: { id },
            include: {
                created_by: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        agency: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        carrier: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                assigned_to: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                resolved_by: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                order: {
                    select: {
                        id: true,
                        customer: {
                            select: {
                                first_name: true,
                                last_name: true,
                                email: true,
                                mobile: true,
                            },
                        },
                    },
                },
                parcel: {
                    select: {
                        id: true,
                        tracking_number: true,
                        description: true,
                    },
                },
                order_item: {
                    select: {
                        hbl: true,
                        description: true,
                    },
                },
                affected_parcels: {
                    include: {
                        parcel: {
                            select: {
                                id: true,
                                tracking_number: true,
                                description: true,
                                status: true,
                            },
                        },
                    },
                },
                agency: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        created_at: "asc",
                    },
                },
                attachments: {
                    include: {
                        uploaded_by: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        created_at: "desc",
                    },
                },
            },
        });
    }),
    findByOrderId: (order_id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.issue.findFirst({
            where: { order_id },
        });
    }),
    getAll: (_a) => __awaiter(void 0, [_a], void 0, function* ({ page, limit, filters, }) {
        const where = {};
        if (filters === null || filters === void 0 ? void 0 : filters.status) {
            where.status = filters.status;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.priority) {
            where.priority = filters.priority;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.type) {
            where.type = filters.type;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.agency_id) {
            where.agency_id = filters.agency_id;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.created_by_id) {
            where.created_by_id = filters.created_by_id;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.assigned_to_id) {
            where.assigned_to_id = filters.assigned_to_id;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.order_id) {
            where.order_id = filters.order_id;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.parcel_id) {
            where.parcel_id = filters.parcel_id;
        }
        const [issues, total] = yield Promise.all([
            prisma_client_1.default.issue.findMany({
                where,
                include: {
                    created_by: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            agency: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                            carrier: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    assigned_to: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    order: {
                        select: {
                            id: true,
                        },
                    },
                    parcel: {
                        select: {
                            id: true,
                            tracking_number: true,
                        },
                    },
                    affected_parcels: {
                        include: {
                            parcel: {
                                select: {
                                    id: true,
                                    tracking_number: true,
                                    description: true,
                                },
                            },
                        },
                    },
                    agency: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                            attachments: true,
                        },
                    },
                },
                orderBy: {
                    created_at: "desc",
                },
                take: limit,
                skip: (page - 1) * limit,
            }),
            prisma_client_1.default.issue.count({ where }),
        ]);
        return { issues, total };
    }),
    update: (id, data) => __awaiter(void 0, void 0, void 0, function* () {
        const updateData = {};
        if (data.title !== undefined)
            updateData.title = data.title;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.type !== undefined)
            updateData.type = data.type;
        if (data.priority !== undefined)
            updateData.priority = data.priority;
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.assigned_to_id !== undefined) {
            updateData.assigned_to = data.assigned_to_id ? { connect: { id: data.assigned_to_id } } : { disconnect: true };
        }
        if (data.resolution_notes !== undefined)
            updateData.resolution_notes = data.resolution_notes;
        // Si se marca como resuelta, actualizar resolved_at y resolved_by
        if (data.status === client_1.IssueStatus.RESOLVED) {
            updateData.resolved_at = new Date();
        }
        else if (data.status !== undefined) {
            updateData.resolved_at = null;
            updateData.resolved_by = { disconnect: true };
        }
        return yield prisma_client_1.default.issue.update({
            where: { id },
            data: updateData,
            include: {
                created_by: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                assigned_to: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }),
    resolve: (id, resolved_by_id, resolution_notes) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.issue.update({
            where: { id },
            data: {
                status: client_1.IssueStatus.RESOLVED,
                resolved_at: new Date(),
                resolved_by_id,
                resolution_notes,
            },
            include: {
                resolved_by: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.issue.delete({
            where: { id },
        });
    }),
    // Comments
    addComment: (data) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        return yield prisma_client_1.default.issueComment.create({
            data: {
                issue_id: data.issue_id,
                user_id: data.user_id,
                content: data.content,
                is_internal: (_a = data.is_internal) !== null && _a !== void 0 ? _a : false,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }),
    getComments: (issueId_1, ...args_1) => __awaiter(void 0, [issueId_1, ...args_1], void 0, function* (issueId, includeInternal = false) {
        const where = {
            issue_id: issueId,
        };
        if (!includeInternal) {
            where.is_internal = false;
        }
        return yield prisma_client_1.default.issueComment.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                created_at: "asc",
            },
        });
    }),
    deleteComment: (id) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.issueComment.delete({
            where: { id },
        });
    }),
    // Attachments
    addAttachment: (data) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.issueAttachment.create({
            data: {
                issue_id: data.issue_id,
                file_url: data.file_url,
                file_name: data.file_name,
                file_type: data.file_type,
                file_size: data.file_size,
                uploaded_by_id: data.uploaded_by_id,
                description: data.description,
            },
            include: {
                uploaded_by: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }),
    getAttachments: (issueId) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.issueAttachment.findMany({
            where: { issue_id: issueId },
            include: {
                uploaded_by: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        });
    }),
    deleteAttachment: (id) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.issueAttachment.delete({
            where: { id },
        });
    }),
    // Affected Parcels
    addAffectedParcels: (issueId, parcelIds) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.issueParcel.createMany({
            data: parcelIds.map((parcel_id) => ({
                issue_id: issueId,
                parcel_id,
            })),
            skipDuplicates: true,
        });
    }),
    removeAffectedParcel: (issueId, parcelId) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.issueParcel.deleteMany({
            where: {
                issue_id: issueId,
                parcel_id: parcelId,
            },
        });
    }),
    getAffectedParcels: (issueId) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.issueParcel.findMany({
            where: { issue_id: issueId },
            include: {
                parcel: {
                    select: {
                        id: true,
                        tracking_number: true,
                        description: true,
                        status: true,
                        created_at: true,
                    },
                },
            },
        });
    }),
    getStats: (filters) => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const where = {};
        if (filters === null || filters === void 0 ? void 0 : filters.agency_id) {
            where.agency_id = filters.agency_id;
        }
        const [total, byStatus, byPriority, byType, last24Hours, last7Days, last30Days, resolvedIssues, byAgency] = yield Promise.all([
            prisma_client_1.default.issue.count({ where }),
            prisma_client_1.default.issue.groupBy({
                by: ["status"],
                where,
                _count: { status: true },
            }),
            prisma_client_1.default.issue.groupBy({
                by: ["priority"],
                where,
                _count: { priority: true },
            }),
            prisma_client_1.default.issue.groupBy({
                by: ["type"],
                where,
                _count: { type: true },
            }),
            prisma_client_1.default.issue.count({
                where: Object.assign(Object.assign({}, where), { created_at: { gte: oneDayAgo } }),
            }),
            prisma_client_1.default.issue.count({
                where: Object.assign(Object.assign({}, where), { created_at: { gte: sevenDaysAgo } }),
            }),
            prisma_client_1.default.issue.count({
                where: Object.assign(Object.assign({}, where), { created_at: { gte: thirtyDaysAgo } }),
            }),
            prisma_client_1.default.issue.findMany({
                where: Object.assign(Object.assign({}, where), { status: client_1.IssueStatus.RESOLVED, resolved_at: { not: null } }),
                select: {
                    created_at: true,
                    resolved_at: true,
                },
            }),
            (filters === null || filters === void 0 ? void 0 : filters.agency_id)
                ? null
                : prisma_client_1.default.issue.groupBy({
                    by: ["agency_id"],
                    where,
                    _count: { agency_id: true },
                }),
        ]);
        // Calculate average resolution time in hours
        let avgResolutionHours = null;
        if (resolvedIssues.length > 0) {
            const totalResolutionTime = resolvedIssues.reduce((sum, issue) => {
                if (issue.resolved_at && issue.created_at) {
                    const resolutionTime = issue.resolved_at.getTime() - issue.created_at.getTime();
                    return sum + resolutionTime;
                }
                return sum;
            }, 0);
            avgResolutionHours = totalResolutionTime / resolvedIssues.length / (1000 * 60 * 60); // Convert to hours
        }
        // Format stats
        const statsByStatus = {};
        byStatus.forEach((item) => {
            statsByStatus[item.status] = item._count.status;
        });
        const statsByPriority = {};
        byPriority.forEach((item) => {
            statsByPriority[item.priority] = item._count.priority;
        });
        const statsByType = {};
        byType.forEach((item) => {
            statsByType[item.type] = item._count.type;
        });
        const statsByAgency = byAgency
            ? byAgency
                .filter((item) => item.agency_id !== null)
                .map((item) => ({
                agency_id: item.agency_id,
                count: item._count.agency_id,
            }))
            : null;
        return Object.assign({ total, by_status: statsByStatus, by_priority: statsByPriority, by_type: statsByType, recent: {
                last_24_hours: last24Hours,
                last_7_days: last7Days,
                last_30_days: last30Days,
            }, resolution: {
                resolved_count: resolvedIssues.length,
                average_resolution_hours: avgResolutionHours ? Math.round(avgResolutionHours * 100) / 100 : null,
            } }, (statsByAgency && { by_agency: statsByAgency }));
    }),
};
exports.default = exports.issues;
