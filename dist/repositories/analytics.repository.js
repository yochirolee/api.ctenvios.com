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
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const date_fns_1 = require("date-fns");
const analytics = {
    getSalesReport: (year, agencyId, startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
        const agencyFilter = agencyId ? `AND "agency_id" = ${agencyId}` : "";
        const [dailyRaw, weeklyRaw, monthlyRaw] = yield Promise.all([
            prisma_client_1.default.$queryRawUnsafe(`
      SELECT
        DATE("created_at") AS day,
        SUM(total_in_cents) AS total
      	FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY day
      ORDER BY day;
    `),
            prisma_client_1.default.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('week', "created_at") AS week,
        SUM(total_in_cents)  AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY week
      ORDER BY week;
    `),
            prisma_client_1.default.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('month', "created_at") AS month,
       	SUM(total_in_cents) AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY month
      ORDER BY month;
    `),
        ]);
        // Convert string totals to numbers for JSON serialization
        const daily = dailyRaw.map((item) => ({
            day: (0, date_fns_1.format)(new Date(item.day), "yyyy-MM-dd"),
            total: Number(item.total) / 100,
        }));
        const weekly = weeklyRaw.map((item) => ({
            week: (0, date_fns_1.format)(new Date(item.week), "yyyy-MM-dd"),
            total: Number(item.total) / 100,
        }));
        const monthly = monthlyRaw.map((item) => ({
            month: (0, date_fns_1.format)(new Date(item.month), "yyyy-MM-dd"),
            total: Number(item.total) / 100,
        }));
        return { daily, weekly, monthly };
    }),
    getSalesReportByAgency: (year, agencyId, startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
        const agencyFilter = agencyId ? `AND "agency_id" = ${agencyId}` : "";
        const [dailyRaw, weeklyRaw, monthlyRaw] = yield Promise.all([
            prisma_client_1.default.$queryRawUnsafe(`
      SELECT
        DATE("created_at") AS day,
        SUM(total_in_cents) AS total
      	FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY day
      ORDER BY day;
    `),
            prisma_client_1.default.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('week', "created_at") AS week,
        SUM(total_in_cents)  AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY week
      ORDER BY week;
    `),
            prisma_client_1.default.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('month', "created_at") AS month,
       	SUM(total_in_cents) AS total
      FROM "Order"
      WHERE  "created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
        AND "created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
        ${agencyFilter}
      GROUP BY month
      ORDER BY month;
    `),
        ]);
        // Convert string totals to numbers for JSON serialization
        const daily = dailyRaw.map((item) => ({
            day: (0, date_fns_1.format)(new Date(item.day), "yyyy-MM-dd"),
            total: Number(item.total) / 100,
        }));
        return {
            daily: dailyRaw.map((item) => ({
                day: (0, date_fns_1.format)(new Date(item.day), "yyyy-MM-dd"),
                total: Number(item.total) / 100,
            })),
            weekly: weeklyRaw.map((item) => ({
                week: (0, date_fns_1.format)(new Date(item.week), "yyyy-MM-dd"),
                total: Number(item.total) / 100,
            })),
            monthly: monthlyRaw.map((item) => ({
                month: (0, date_fns_1.format)(new Date(item.month), "yyyy-MM-dd"),
                total: Number(item.total) / 100,
            })),
        };
    }),
    getDailySalesByAgency: (year, startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
        // Query to get daily sales grouped by agency
        const rawData = (yield prisma_client_1.default.$queryRawUnsafe(`
         SELECT
            o."agency_id",
            a."name" as agency_name,
            DATE(o."created_at") AS day,
            SUM(o."total_in_cents") AS total
         FROM "Order" o
         INNER JOIN "Agency" a ON a.id = o."agency_id"
         WHERE o."created_at" >= '${startDate ? startDate.toISOString() : `${year}-01-01`}'
           AND o."created_at" < '${endDate ? endDate.toISOString() : `${year}-12-31`}'
         GROUP BY o."agency_id", a."name", DATE(o."created_at")
         ORDER BY o."agency_id", day;
      `));
        // Group data by agency
        const agenciesMap = new Map();
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
            const agency = agenciesMap.get(agencyId);
            agency.daily.push({
                day: (0, date_fns_1.format)(new Date(row.day), "yyyy-MM-dd"),
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
    }),
    getTodaySalesByAgency: () => __awaiter(void 0, void 0, void 0, function* () {
        // Get today's date range (start and end of today)
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        // Query to get today's sales grouped by agency
        const rawData = (yield prisma_client_1.default.$queryRawUnsafe(`
         SELECT
            o."agency_id",
            a."name" as agency_name,
            SUM(o."total_in_cents") AS total
         FROM "Order" o
         INNER JOIN "Agency" a ON a.id = o."agency_id"
         WHERE o."created_at" >= '${startOfToday.toISOString()}'
           AND o."created_at" <= '${endOfToday.toISOString()}'
         GROUP BY o."agency_id", a."name"
         ORDER BY total DESC;
      `));
        // Format data for response
        const todayFormatted = (0, date_fns_1.format)(today, "yyyy-MM-dd");
        const agencies = rawData.map((row) => {
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
    }),
};
exports.default = analytics;
