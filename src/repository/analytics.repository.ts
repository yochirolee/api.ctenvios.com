import prisma from "../config/prisma_db";
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

export const analytics = {
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
        SUM(total_amount) AS total
      FROM "Invoice"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY day
      ORDER BY day;
    `) as unknown as ReportData[],

			prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('week', "created_at") AS week,
        SUM(total_amount)  AS total
      FROM "Invoice"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY week
      ORDER BY week;
    `) as unknown as ReportData[],

			prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('month', "created_at") AS month,
       SUM(total_amount) AS total
      FROM "Invoice"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
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
};
