import prisma from "../lib/prisma.client";
import { Status } from "@prisma/client";
import { format } from "date-fns";
import { getAdjustedDate, getTodayRangeUTC } from "../utils/utils";

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

export interface PackagesAndWeightInAgenciesResponse {
   agencies: Array<{
      agencyId: number;
      agencyName: string;
      packagesCount: number;
      totalWeight: number;
   }>;
   grandTotalPackages: number;
   grandTotalWeight: number;
}

const analytics = {
   getSalesReport: async (
      year: number,
      agencyId: number,
      startDate: Date | undefined,
      endDate: Date | undefined,
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
      endDate: Date | undefined,
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
      agencyId: number | undefined,
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
      // Get today's date range in EST timezone
      const { start: startOfToday, end: endOfToday } = getTodayRangeUTC();

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

      // Format data for response (using EST date)
      const estNow = getAdjustedDate(new Date());
      const todayFormatted = format(estNow, "yyyy-MM-dd");
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
   /**
    * Packages and total weight per agency for parcels that are in agencies or dispatch-ready
    * (Parcel Status: IN_AGENCY, IN_PALLET, IN_DISPATCH, IN_WAREHOUSE, RECEIVED_IN_DISPATCH).
    */
   getPackagesAndWeightInAgencies: async (agencyId?: number): Promise<PackagesAndWeightInAgenciesResponse> => {
      const statusIn: Status[] = [Status.IN_AGENCY, Status.IN_PALLET, Status.IN_DISPATCH];

      const grouped = await prisma.parcel.groupBy({
         by: ["agency_id"],
         where: {
            deleted_at: null,
            agency_id: agencyId ?? { not: null },
            status: { in: statusIn },
         },
         _count: { id: true },
         _sum: { weight: true },
      });

      const agencyIds = grouped.map((g) => g.agency_id).filter((id): id is number => id != null);
      const agencyMap = new Map<number, string>();
      if (agencyIds.length > 0) {
         const agencies = await prisma.agency.findMany({
            where: { id: { in: agencyIds } },
            select: { id: true, name: true },
         });
         agencies.forEach((a) => agencyMap.set(a.id, a.name));
      }

      const agencies = grouped
         .filter((g) => g.agency_id != null)
         .map((g) => ({
            agencyId: g.agency_id!,
            agencyName: agencyMap.get(g.agency_id!) ?? "",
            packagesCount: g._count.id,
            totalWeight: Number(g._sum.weight ?? 0),
         }))
         .sort((a, b) => b.packagesCount - a.packagesCount || b.totalWeight - a.totalWeight);

      const grandTotalPackages = agencies.reduce((sum, ag) => sum + ag.packagesCount, 0);
      const grandTotalWeight = agencies.reduce((sum, ag) => sum + ag.totalWeight, 0);

      return {
         agencies,
         grandTotalPackages,
         grandTotalWeight,
      };
   },
};

export default analytics;
