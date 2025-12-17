import prisma from "../lib/prisma.client";
import { Prisma, IssueStatus, IssuePriority, IssueType } from "@prisma/client";

interface CreateIssueData {
   title: string;
   description: string;
   type: IssueType;
   priority: IssuePriority;
   order_id?: number;
   parcel_id?: number;
   affected_parcel_ids?: number[]; // IDs de parcels afectados (para casos como "2 de 3 parcels no entregados")
   order_item_hbl?: string;
   created_by_id: string;
   agency_id: number;
   assigned_to_id?: string;
}

interface UpdateIssueData {
   title?: string;
   description?: string;
   type?: IssueType;
   priority?: IssuePriority;
   status?: IssueStatus;
   assigned_to_id?: string;
   resolution_notes?: string;
}

interface CreateCommentData {
   issue_id: number;
   user_id: string;
   content: string;
   is_internal?: boolean;
}

interface CreateAttachmentData {
   issue_id: number;
   file_url: string;
   file_name: string;
   file_type: string;
   file_size?: number;
   uploaded_by_id: string;
   description?: string;
}

export const issues = {
   create: async (data: CreateIssueData) => {
      // Validar que solo uno de order_id o parcel_id esté presente (pero order_id puede tener affected_parcel_ids)
      if (data.order_id && data.parcel_id) {
         throw new Error("Cannot specify both order_id and parcel_id");
      }
      if (!data.order_id && !data.parcel_id && !data.affected_parcel_ids?.length) {
         throw new Error("Must specify either order_id, parcel_id, or affected_parcel_ids");
      }

      // Si hay affected_parcel_ids, debe haber order_id
      if (data.affected_parcel_ids && data.affected_parcel_ids.length > 0 && !data.order_id) {
         throw new Error("affected_parcel_ids requires order_id");
      }

      const createData: any = {
         title: data.title,
         description: data.description,
         type: data.type,
         priority: data.priority,
         order_id: data.order_id,
         parcel_id: data.parcel_id,
         order_item_hbl: data.order_item_hbl,
         created_by_id: data.created_by_id,
         agency_id: data.agency_id,
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

      const includeClause: any = {
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

      return await prisma.issue.create({
         data: createData,
         include: includeClause,
      });
   },

   getById: async (id: number) => {
      return await prisma.issue.findUnique({
         where: { id },
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
   },

   findByOrderId: async (order_id: number) => {
      return await prisma.issue.findFirst({
         where: { order_id },
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
         agency_id?: number;
         created_by_id?: string;
         assigned_to_id?: string;
         order_id?: number;
         parcel_id?: number;
      };
   }) => {
      const where: Prisma.IssueWhereInput = {};

      if (filters?.status) {
         where.status = filters.status;
      }

      if (filters?.priority) {
         where.priority = filters.priority;
      }

      if (filters?.type) {
         where.type = filters.type;
      }

      if (filters?.agency_id) {
         where.agency_id = filters.agency_id;
      }

      if (filters?.created_by_id) {
         where.created_by_id = filters.created_by_id;
      }

      if (filters?.assigned_to_id) {
         where.assigned_to_id = filters.assigned_to_id;
      }

      if (filters?.order_id) {
         where.order_id = filters.order_id;
      }

      if (filters?.parcel_id) {
         where.parcel_id = filters.parcel_id;
      }

      const [issues, total] = await Promise.all([
         prisma.issue.findMany({
            where,
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
         prisma.issue.count({ where }),
      ]);

      return { issues, total };
   },

   update: async (id: number, data: UpdateIssueData) => {
      const updateData: Prisma.IssueUpdateInput = {};

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

      return await prisma.issue.update({
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
   },

   resolve: async (id: number, resolved_by_id: string, resolution_notes?: string) => {
      return await prisma.issue.update({
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
         },
      });
   },

   delete: async (id: number): Promise<void> => {
      await prisma.issue.delete({
         where: { id },
      });
   },

   // Comments
   addComment: async (data: CreateCommentData) => {
      return await prisma.issueComment.create({
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
      const where: Prisma.IssueCommentWhereInput = {
         issue_id: issueId,
      };

      if (!includeInternal) {
         where.is_internal = false;
      }

      return await prisma.issueComment.findMany({
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
      await prisma.issueComment.delete({
         where: { id },
      });
   },

   // Attachments
   addAttachment: async (data: CreateAttachmentData) => {
      return await prisma.issueAttachment.create({
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
      return await prisma.issueAttachment.findMany({
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
      await prisma.issueAttachment.delete({
         where: { id },
      });
   },

   // Affected Parcels
   addAffectedParcels: async (issueId: number, parcelIds: number[]): Promise<void> => {
      await prisma.issueParcel.createMany({
         data: parcelIds.map((parcel_id) => ({
            issue_id: issueId,
            parcel_id,
         })),
         skipDuplicates: true,
      });
   },

   removeAffectedParcel: async (issueId: number, parcelId: number): Promise<void> => {
      await prisma.issueParcel.deleteMany({
         where: {
            issue_id: issueId,
            parcel_id: parcelId,
         },
      });
   },

   getAffectedParcels: async (issueId: number) => {
      return await prisma.issueParcel.findMany({
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
   },

   getStats: async (filters?: { agency_id?: number }) => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const where: Prisma.IssueWhereInput = {};
      if (filters?.agency_id) {
         where.agency_id = filters.agency_id;
      }

      const [total, byStatus, byPriority, byType, last24Hours, last7Days, last30Days, resolvedIssues, byAgency] =
         await Promise.all([
            prisma.issue.count({ where }),
            prisma.issue.groupBy({
               by: ["status"],
               where,
               _count: { status: true },
            }),
            prisma.issue.groupBy({
               by: ["priority"],
               where,
               _count: { priority: true },
            }),
            prisma.issue.groupBy({
               by: ["type"],
               where,
               _count: { type: true },
            }),
            prisma.issue.count({
               where: {
                  ...where,
                  created_at: { gte: oneDayAgo },
               },
            }),
            prisma.issue.count({
               where: {
                  ...where,
                  created_at: { gte: sevenDaysAgo },
               },
            }),
            prisma.issue.count({
               where: {
                  ...where,
                  created_at: { gte: thirtyDaysAgo },
               },
            }),
            prisma.issue.findMany({
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
            filters?.agency_id
               ? null
               : prisma.issue.groupBy({
                    by: ["agency_id"],
                    where,
                    _count: { agency_id: true },
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

      const statsByAgency: Array<{ agency_id: number; count: number }> | null = byAgency
         ? byAgency
              .filter((item) => item.agency_id !== null)
              .map((item) => ({
                 agency_id: item.agency_id!,
                 count: item._count.agency_id,
              }))
         : null;

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
         ...(statsByAgency && { by_agency: statsByAgency }),
      };
   },
};

export default issues;
