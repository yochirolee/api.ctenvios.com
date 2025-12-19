import prisma from "../lib/prisma.client";
import { Prisma, IssueStatus, IssuePriority, IssueType } from "@prisma/client";

interface CreateLegacyIssueData {
   title: string;
   description: string;
   type: IssueType;
   priority: IssuePriority;
   legacy_invoice_id?: number;
   legacy_order_id?: number;
   legacy_parcel_id?: number;
   legacy_hbl?: string;
   affected_parcel_ids?: Array<number | { legacy_parcel_id: string; legacy_order_id?: number }>; // Parcels afectados del sistema legacy (acepta números o objetos)
   created_by_id: string;
   agency_id?: number | null; // Agencia del usuario creador
   assigned_to_id?: string;
}

interface UpdateLegacyIssueData {
   title?: string;
   description?: string;
   type?: IssueType;
   priority?: IssuePriority;
   status?: IssueStatus;
   assigned_to_id?: string;
   resolution_notes?: string;
}

interface CreateLegacyCommentData {
   issue_id: number;
   user_id: string;
   content: string;
   is_internal?: boolean;
}

interface CreateLegacyAttachmentData {
   issue_id: number;
   file_url: string;
   file_name: string;
   file_type: string;
   file_size?: number;
   uploaded_by_id: string;
   description?: string;
}

export const legacyIssues = {
   create: async (data: CreateLegacyIssueData) => {
      // Validar que haya al menos una referencia legacy
      const hasLegacyReference =
         data.legacy_order_id || (data.affected_parcel_ids && data.affected_parcel_ids.length > 0);

      if (!hasLegacyReference) {
         throw new Error(
            "Must specify at least one legacy reference: legacy_invoice_id, legacy_order_id, legacy_parcel_id, legacy_hbl, or affected_parcel_ids"
         );
      }

      // Si hay affected_parcel_ids, debe haber legacy_order_id o legacy_invoice_id
      if (data.affected_parcel_ids && data.affected_parcel_ids.length > 0 && !data.legacy_order_id) {
         throw new Error("affected_parcel_ids requires legacy_order_id or legacy_invoice_id");
      }

      const createData: Prisma.LegacyIssueCreateInput = {
         title: data.title,
         description: data.description,
         type: data.type,
         priority: data.priority,
         legacy_order_id: data.legacy_order_id,
         created_by: {
            connect: { id: data.created_by_id },
         },
         agency: data.agency_id
            ? {
                 connect: { id: data.agency_id },
              }
            : undefined,
         assigned_to: data.assigned_to_id
            ? {
                 connect: { id: data.assigned_to_id },
              }
            : undefined,
      };

      // Agregar affected_parcels si hay datos
      if (data.affected_parcel_ids && data.affected_parcel_ids.length > 0) {
         // Normalizar el formato: aceptar tanto números como objetos
         const normalizedParcels = data.affected_parcel_ids.map((parcel) => {
            // Si es un número, convertirlo a objeto
            if (typeof parcel === "number") {
               return {
                  legacy_parcel_id: String(parcel),
                  legacy_order_id: data.legacy_order_id,
               };
            }
            // Si ya es un objeto, usarlo tal cual
            return {
               legacy_parcel_id: parcel.legacy_parcel_id,
               legacy_order_id: parcel.legacy_order_id || data.legacy_order_id,
            };
         });

         // Filtrar y validar parcels - legacy_parcel_id es requerido
         const validParcels = normalizedParcels.filter(
            (parcel) => parcel.legacy_parcel_id && parcel.legacy_parcel_id.trim().length > 0
         );

         if (validParcels.length === 0) {
            throw new Error("At least one valid legacy_parcel_id is required in affected_parcel_ids");
         }

         createData.affected_parcels = {
            create: validParcels.map((parcel) => ({
               legacy_parcel_id: parcel.legacy_parcel_id!,
               legacy_order_id: parcel.legacy_order_id || null,
            })),
         };
      }

      return await prisma.legacyIssue.create({
         data: createData,
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
   },

   getById: async (id: number) => {
      return await prisma.legacyIssue.findUnique({
         where: { id },
         include: {
            created_by: {
               select: {
                  id: true,
                  name: true,
                  email: true,
                  agency_id: true,
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
            affected_parcels: {
               orderBy: {
                  created_at: "asc",
               },
            },
            agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });
   },

   findByLegacyOrderId: async (legacy_order_id: number) => {
      return await prisma.legacyIssue.findFirst({
         where: { legacy_order_id },
      });
   },

   getAll: async ({
      page,
      limit,
      filters,
   }: {
      page: number;
      limit: number;
      filters?: {
         status?: IssueStatus;
         priority?: IssuePriority;
         type?: IssueType;
         created_by_id?: string;
         agency_id?: number; // Filtrar por agencia directamente
         assigned_to_id?: string;
         legacy_invoice_id?: number;
         legacy_order_id?: number;
         legacy_parcel_id?: number;
         legacy_hbl?: string;
         issue_id?: number;
      };
   }) => {
      const where: Prisma.LegacyIssueWhereInput = {};

      if (filters?.status) {
         where.status = filters.status;
      }

      if (filters?.priority) {
         where.priority = filters.priority;
      }

      if (filters?.type) {
         where.type = filters.type;
      }

      if (filters?.created_by_id) {
         where.created_by_id = filters.created_by_id;
      }

      if (filters?.agency_id) {
         where.agency_id = filters.agency_id;
      }

      if (filters?.assigned_to_id) {
         where.assigned_to_id = filters.assigned_to_id;
      }

      if (filters?.legacy_invoice_id) {
         where.legacy_invoice_id = filters.legacy_invoice_id;
      }

      if (filters?.legacy_order_id) {
         where.legacy_order_id = filters.legacy_order_id;
      }

      if (filters?.legacy_parcel_id) {
         where.legacy_parcel_id = filters.legacy_parcel_id;
      }

      if (filters?.legacy_hbl) {
         where.legacy_hbl = filters.legacy_hbl;
      }

      if (filters?.issue_id) {
         where.id = filters.issue_id;
      }

      const [legacyIssues, total] = await Promise.all([
         prisma.legacyIssue.findMany({
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
                     affected_parcels: true,
                  },
               },
            },
            orderBy: {
               created_at: "desc",
            },
            take: limit,
            skip: (page - 1) * limit,
         }),
         prisma.legacyIssue.count({ where }),
      ]);

      return { legacyIssues, total };
   },

   update: async (id: number, data: UpdateLegacyIssueData) => {
      const updateData: Prisma.LegacyIssueUpdateInput = {};

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.assigned_to_id !== undefined) {
         updateData.assigned_to = data.assigned_to_id ? { connect: { id: data.assigned_to_id } } : { disconnect: true };
      }
      if (data.resolution_notes !== undefined) updateData.resolution_notes = data.resolution_notes;

      // Si se marca como resuelta, actualizar resolved_at y resolved_by
      if (data.status === IssueStatus.RESOLVED) {
         updateData.resolved_at = new Date();
      } else if (data.status !== undefined) {
         updateData.resolved_at = null;
         updateData.resolved_by = { disconnect: true };
      }

      return await prisma.legacyIssue.update({
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
            agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });
   },

   resolve: async (id: number, resolved_by_id: string, resolution_notes?: string) => {
      return await prisma.legacyIssue.update({
         where: { id },
         data: {
            status: IssueStatus.RESOLVED,
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
            agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });
   },

   delete: async (id: number): Promise<void> => {
      await prisma.legacyIssue.delete({
         where: { id },
      });
   },

   // Comments
   addComment: async (data: CreateLegacyCommentData) => {
      return await prisma.legacyIssueComment.create({
         data: {
            issue_id: data.issue_id,
            user_id: data.user_id,
            content: data.content,
            is_internal: data.is_internal ?? false,
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
   },

   getComments: async (issueId: number, includeInternal: boolean = false) => {
      const where: Prisma.LegacyIssueCommentWhereInput = {
         issue_id: issueId,
      };

      if (!includeInternal) {
         where.is_internal = false;
      }

      return await prisma.legacyIssueComment.findMany({
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
   },

   deleteComment: async (id: number): Promise<void> => {
      await prisma.legacyIssueComment.delete({
         where: { id },
      });
   },

   // Attachments
   addAttachment: async (data: CreateLegacyAttachmentData) => {
      return await prisma.legacyIssueAttachment.create({
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
   },

   getAttachments: async (issueId: number) => {
      return await prisma.legacyIssueAttachment.findMany({
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
   },

   deleteAttachment: async (id: number): Promise<void> => {
      await prisma.legacyIssueAttachment.delete({
         where: { id },
      });
   },

   getStats: async (filters?: { created_by_id?: string; agency_id?: number }) => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const where: Prisma.LegacyIssueWhereInput = {};
      if (filters?.created_by_id) {
         where.created_by_id = filters.created_by_id;
      }

      if (filters?.agency_id) {
         where.agency_id = filters.agency_id;
      }

      const [total, byStatus, byPriority, byType, last24Hours, last7Days, last30Days, resolvedIssues] =
         await Promise.all([
            prisma.legacyIssue.count({ where }),
            prisma.legacyIssue.groupBy({
               by: ["status"],
               where,
               _count: { status: true },
            }),
            prisma.legacyIssue.groupBy({
               by: ["priority"],
               where,
               _count: { priority: true },
            }),
            prisma.legacyIssue.groupBy({
               by: ["type"],
               where,
               _count: { type: true },
            }),
            prisma.legacyIssue.count({
               where: {
                  ...where,
                  created_at: { gte: oneDayAgo },
               },
            }),
            prisma.legacyIssue.count({
               where: {
                  ...where,
                  created_at: { gte: sevenDaysAgo },
               },
            }),
            prisma.legacyIssue.count({
               where: {
                  ...where,
                  created_at: { gte: thirtyDaysAgo },
               },
            }),
            prisma.legacyIssue.findMany({
               where: {
                  ...where,
                  status: IssueStatus.RESOLVED,
                  resolved_at: { not: null },
               },
               select: {
                  created_at: true,
                  resolved_at: true,
               },
            }),
         ]);

      // Calculate average resolution time in hours
      let avgResolutionHours: number | null = null;
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
      const statsByStatus: Record<string, number> = {};
      byStatus.forEach((item) => {
         statsByStatus[item.status] = item._count.status;
      });

      const statsByPriority: Record<string, number> = {};
      byPriority.forEach((item) => {
         statsByPriority[item.priority] = item._count.priority;
      });

      const statsByType: Record<string, number> = {};
      byType.forEach((item) => {
         statsByType[item.type] = item._count.type;
      });

      return {
         total,
         by_status: statsByStatus,
         by_priority: statsByPriority,
         by_type: statsByType,
         recent: {
            last_24_hours: last24Hours,
            last_7_days: last7Days,
            last_30_days: last30Days,
         },
         resolution: {
            resolved_count: resolvedIssues.length,
            average_resolution_hours: avgResolutionHours ? Math.round(avgResolutionHours * 100) / 100 : null,
         },
      };
   },
};

export default legacyIssues;
