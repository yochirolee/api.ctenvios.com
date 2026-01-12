import prisma from "../lib/prisma.client";
import { format } from "date-fns";

interface ReportData {
   day?: string;
   week?: string;
   month?: string;
   total: string;
}

interface SalesReportResponse {
   daily: Array<{ day: string; total: number }>;
   weekly: Array<{ week: string; total: number }>;
   monthly: Array<{ month: string; total: number }>;
}

interface AgencyDailySales {
   agencyId: number;
   agencyName: string;
   daily: Array<{ day: string; total: number }>;
   totalSales: number;
}

interface DailySalesByAgencyResponse {
   agencies: AgencyDailySales[];
   grandTotal: number;
}

const analytics = {
   getSalesReport: async (
      year: number,
      agencyId: number,
      startDate: Date | undefined,
      endDate: Date | undefined
   ): Promise<SalesReportResponse> => {
      const agencyFilter = agencyId ? `AND "agency_id" = ${agencyId}` : "";

      const [dailyRaw, weeklyRaw, monthlyRaw] = await Promise.all([
         prisma.$queryRawUnsafe(`
      SELECT
        DATE("created_at") AS day,
        SUM(total_in_cents) AS total
      	FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        AND "deleted_at" IS NULL
        ${agencyFilter}
      GROUP BY day
      ORDER BY day;
    `) as unknown as ReportData[],

         prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('week', "created_at") AS week,
        SUM(total_in_cents)  AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        AND "deleted_at" IS NULL
        ${agencyFilter}
      GROUP BY week
      ORDER BY week;
    `) as unknown as ReportData[],

         prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('month', "created_at") AS month,
       	SUM(total_in_cents) AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        AND "deleted_at" IS NULL
        ${agencyFilter}
      GROUP BY month
      ORDER BY month;
    `) as unknown as ReportData[],
      ]);

      // Convert string totals to numbers for JSON serialization
      const daily = dailyRaw.map((item) => ({
         day: format(new Date(item.day!), "yyyy-MM-dd"),
         total: Number(item.total) / 100,
      }));

      const weekly = weeklyRaw.map((item) => ({
         week: format(new Date(item.week!), "yyyy-MM-dd"),
         total: Number(item.total) / 100,
      }));

      const monthly = monthlyRaw.map((item) => ({
         month: format(new Date(item.month!), "yyyy-MM-dd"),
         total: Number(item.total) / 100,
      }));

      return { daily, weekly, monthly };
   },
   getSalesReportByAgency: async (
      year: number,
      agencyId: number,
      startDate: Date | undefined,
      endDate: Date | undefined
   ): Promise<SalesReportResponse> => {
      const agencyFilter = agencyId ? `AND "agency_id" = ${agencyId}` : "";

      const [dailyRaw, weeklyRaw, monthlyRaw] = await Promise.all([
         prisma.$queryRawUnsafe(`
      SELECT
        DATE("created_at") AS day,
        SUM(total_in_cents) AS total
      	FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        AND "deleted_at" IS NULL
        ${agencyFilter}
      GROUP BY day
      ORDER BY day;
    `) as unknown as ReportData[],

         prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('week', "created_at") AS week,
        SUM(total_in_cents)  AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        AND "deleted_at" IS NULL
        ${agencyFilter}
      GROUP BY week
      ORDER BY week;
    `) as unknown as ReportData[],

         prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('month', "created_at") AS month,
       	SUM(total_in_cents) AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        AND "deleted_at" IS NULL
        ${agencyFilter}
      GROUP BY month
      ORDER BY month;
    `) as unknown as ReportData[],
      ]);

      // Convert string totals to numbers for JSON serialization
      const daily = dailyRaw.map((item) => ({
         day: format(new Date(item.day!), "yyyy-MM-dd"),
         total: Number(item.total) / 100,
      }));

      return {
         daily: dailyRaw.map((item) => ({
            day: format(new Date(item.day!), "yyyy-MM-dd"),
            total: Number(item.total) / 100,
         })),
         weekly: weeklyRaw.map((item) => ({
            week: format(new Date(item.week!), "yyyy-MM-dd"),
            total: Number(item.total) / 100,
         })),
         monthly: monthlyRaw.map((item) => ({
            month: format(new Date(item.month!), "yyyy-MM-dd"),
            total: Number(item.total) / 100,
         })),
      };
   },

   getDailySalesByAgency: async (
      year: number,
      startDate: Date | undefined,
      endDate: Date | undefined,
      agencyId: number | undefined
   ): Promise<DailySalesByAgencyResponse> => {
      const agencyFilter = agencyId ? `AND o."agency_id" = ${agencyId}` : "";

      // Query to get daily sales grouped by agency (exclude soft-deleted orders)
      const rawData = (await prisma.$queryRawUnsafe(`
         SELECT
            o."agency_id",
            a."name" as agency_name,
            DATE(o."created_at") AS day,
            SUM(o."total_in_cents") AS total
         FROM "Order" o
         INNER JOIN "Agency" a ON a.id = o."agency_id"
         WHERE o."created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
           AND o."created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
           AND o."deleted_at" IS NULL
           ${agencyFilter}
         GROUP BY o."agency_id", a."name", DATE(o."created_at")
         ORDER BY o."agency_id", day;
      `)) as unknown as Array<{
         agency_id: number;
         agency_name: string;
         day: Date;
         total: string;
      }>;

      // Group data by agency
      const agenciesMap = new Map<number, AgencyDailySales>();

      rawData.forEach((row) => {
         const agencyId = Number(row.agency_id);
         const total = Number(row.total) / 100;

         if (!agenciesMap.has(agencyId)) {
            agenciesMap.set(agencyId, {
               agencyId,
               agencyName: row.agency_name,
               daily: [],
               totalSales: 0,
            });
         }

         const agency = agenciesMap.get(agencyId)!;
         agency.daily.push({
            day: format(new Date(row.day), "yyyy-MM-dd"),
            total,
         });
         agency.totalSales += total;
      });

      // Convert map to array and sort by total sales (descending)
      const agencies = Array.from(agenciesMap.values()).sort((a, b) => b.totalSales - a.totalSales);

      // Calculate grand total
      const grandTotal = agencies.reduce((sum, agency) => sum + agency.totalSales, 0);

      return {
         agencies,
         grandTotal,
      };
   },

   getTodaySalesByAgency: async (agencyId?: number): Promise<DailySalesByAgencyResponse> => {
      // Get today's date range (start and end of today)
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      // Build agency filter
      const agencyFilter = agencyId ? `AND o."agency_id" = ${agencyId}` : "";

      // Query to get today's sales grouped by agency (exclude soft-deleted orders)
      const rawData = (await prisma.$queryRawUnsafe(`
         SELECT
            o."agency_id",
            a."name" as agency_name,
            SUM(o."total_in_cents") AS total
         FROM "Order" o
         INNER JOIN "Agency" a ON a.id = o."agency_id"
         WHERE o."created_at" >= '${startOfToday.toISOString()}'
           AND o."created_at" <= '${endOfToday.toISOString()}'
           AND o."deleted_at" IS NULL
           ${agencyFilter}
         GROUP BY o."agency_id", a."name"
         ORDER BY total DESC;
      `)) as unknown as Array<{
         agency_id: number;
         agency_name: string;
         total: string;
      }>;

      // Format data for response
      const todayFormatted = format(today, "yyyy-MM-dd");
      const agencies: AgencyDailySales[] = rawData.map((row) => {
         const totalSales = Number(row.total) / 100;
         return {
            agencyId: Number(row.agency_id),
            agencyName: row.agency_name,
            daily: [
               {
                  day: todayFormatted,
                  total: totalSales,
               },
            ],
            totalSales,
         };
      });

      // Calculate grand total
      const grandTotal = agencies.reduce((sum, agency) => sum + agency.totalSales, 0);

      return {
         agencies,
         grandTotal,
      };
   },
};

export default analytics;
