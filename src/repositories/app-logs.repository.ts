import prisma from "../lib/prisma.client";
import { Prisma, LogLevel, AppLog } from "@prisma/client";

interface CreateAppLogData {
   level: LogLevel;
   message: string;
   source: string;
   code?: string;
   status_code?: number;
   details?: unknown;
   stack?: string;
   path?: string;
   method?: string;
   ip_address?: string;
   user_agent?: string;
   user_id?: string;
   user_email?: string;
}

interface GetAllFilters {
   level?: LogLevel;
   source?: string;
   status_code?: number;
   user_id?: string;
   path?: string;
   method?: string;
   startDate?: Date;
   endDate?: Date;
}

export const appLogs = {
   getById: async (id: string): Promise<AppLog | null> => {
      return prisma.appLog.findUnique({
         where: { id: parseInt(id) },
      });
   },
   create: async (data: CreateAppLogData): Promise<void> => {
      await prisma.appLog.create({
         data: {
            level: data.level,
            message: data.message,
            source: data.source,
            code: data.code,
            status_code: data.status_code,
            details: data.details ? (data.details as Prisma.InputJsonValue) : undefined,
            stack: data.stack,
            path: data.path,
            method: data.method,
            ip_address: data.ip_address,
            user_agent: data.user_agent,
            user_id: data.user_id,
            user_email: data.user_email,
         },
      });
   },

   getAll: async ({ page, limit, filters }: { page: number; limit: number; filters?: GetAllFilters }) => {
      const where: Prisma.AppLogWhereInput = {};

      if (filters?.level) {
         where.level = filters.level;
      }

      if (filters?.source) {
         where.source = filters.source;
      }

      if (filters?.status_code !== undefined) {
         where.status_code = filters.status_code;
      }

      if (filters?.user_id) {
         where.user_id = filters.user_id;
      }

      if (filters?.path) {
         where.path = { contains: filters.path, mode: "insensitive" };
      }

      if (filters?.method) {
         where.method = filters.method.toUpperCase();
      }

      if (filters?.startDate || filters?.endDate) {
         where.created_at = {};
         if (filters.startDate) {
            where.created_at.gte = filters.startDate;
         }
         if (filters.endDate) {
            where.created_at.lte = filters.endDate;
         }
      }

      const logs = await prisma.appLog.findMany({
         where,
         select: {
            id: true,
            level: true,
            message: true,
            source: true,
            code: true,
            status_code: true,
            path: true,
            method: true,
            user_email: true,
            created_at: true,
            user: {
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
         take: limit,
         skip: (page - 1) * limit,
      });
      return logs;
   },

   countAll: async (filters?: GetAllFilters): Promise<number> => {
      const where: Prisma.AppLogWhereInput = {};

      if (filters?.level) {
         where.level = filters.level;
      }

      if (filters?.source) {
         where.source = filters.source;
      }

      if (filters?.status_code !== undefined) {
         where.status_code = filters.status_code;
      }

      if (filters?.user_id) {
         where.user_id = filters.user_id;
      }

      if (filters?.path) {
         where.path = { contains: filters.path, mode: "insensitive" };
      }

      if (filters?.method) {
         where.method = filters.method.toUpperCase();
      }

      if (filters?.startDate || filters?.endDate) {
         where.created_at = {};
         if (filters.startDate) {
            where.created_at.gte = filters.startDate;
         }
         if (filters.endDate) {
            where.created_at.lte = filters.endDate;
         }
      }

      return prisma.appLog.count({ where });
   },

   getByLevel: async (level: LogLevel, { page, limit }: { page: number; limit: number }) => {
      const logs = await prisma.appLog.findMany({
         where: { level },
         select: {
            id: true,
            level: true,
            message: true,
            source: true,
            code: true,
            status_code: true,
            path: true,
            method: true,
            user_email: true,
            created_at: true,
         },
         orderBy: {
            created_at: "desc",
         },
         take: limit,
         skip: (page - 1) * limit,
      });
      return logs;
   },

   countByLevel: async (level: LogLevel): Promise<number> => {
      return prisma.appLog.count({
         where: { level },
      });
   },

   getBySource: async (source: string, { page, limit }: { page: number; limit: number }) => {
      const logs = await prisma.appLog.findMany({
         where: { source },
         select: {
            id: true,
            level: true,
            message: true,
            source: true,
            code: true,
            status_code: true,
            path: true,
            method: true,
            user_email: true,
            created_at: true,
         },
         orderBy: {
            created_at: "desc",
         },
         take: limit,
         skip: (page - 1) * limit,
      });
      return logs;
   },

   countBySource: async (source: string): Promise<number> => {
      return prisma.appLog.count({
         where: { source },
      });
   },

   getStats: async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [totalLogs, logsLastHour, logsLastDay, logsLastWeek, logsByLevel, logsBySource] = await Promise.all([
         prisma.appLog.count(),
         prisma.appLog.count({
            where: {
               created_at: { gte: oneHourAgo },
            },
         }),
         prisma.appLog.count({
            where: {
               created_at: { gte: oneDayAgo },
            },
         }),
         prisma.appLog.count({
            where: {
               created_at: { gte: oneWeekAgo },
            },
         }),
         prisma.appLog.groupBy({
            by: ["level"],
            _count: {
               id: true,
            },
         }),
         prisma.appLog.groupBy({
            by: ["source"],
            _count: {
               id: true,
            },
         }),
      ]);

      return {
         total_logs: totalLogs,
         logs_last_hour: logsLastHour,
         logs_last_day: logsLastDay,
         logs_last_week: logsLastWeek,
         logs_by_level: logsByLevel.map((item) => ({
            level: item.level,
            count: item._count.id,
         })),
         logs_by_source: logsBySource.map((item) => ({
            source: item.source,
            count: item._count.id,
         })),
      };
   },

   deleteAll: async (): Promise<number> => {
      const result = await prisma.appLog.deleteMany({});
      return result.count;
   },

   deleteById: async (id: number): Promise<void> => {
      await prisma.appLog.delete({
         where: { id },
      });
   },

   deleteByDateRange: async (startDate: Date, endDate: Date): Promise<number> => {
      const result = await prisma.appLog.deleteMany({
         where: {
            created_at: {
               gte: startDate,
               lte: endDate,
            },
         },
      });
      return result.count;
   },

   deleteByLevel: async (level: LogLevel): Promise<number> => {
      const result = await prisma.appLog.deleteMany({
         where: { level },
      });
      return result.count;
   },

   deleteBySource: async (source: string): Promise<number> => {
      const result = await prisma.appLog.deleteMany({
         where: { source },
      });
      return result.count;
   },

   deleteOlderThan: async (days: number): Promise<number> => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const result = await prisma.appLog.deleteMany({
         where: {
            created_at: {
               lt: cutoffDate,
            },
         },
      });
      return result.count;
   },
};

export default appLogs;
