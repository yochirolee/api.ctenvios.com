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
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
const utils_1 = require("../utils/utils");
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
        AND "deleted_at" IS NULL
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
        AND "deleted_at" IS NULL
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
        AND "deleted_at" IS NULL
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
        AND "deleted_at" IS NULL
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
        AND "deleted_at" IS NULL
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
        AND "deleted_at" IS NULL
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
    getDailySalesByAgency: (year, startDate, endDate, agencyId) => __awaiter(void 0, void 0, void 0, function* () {
        const agencyFilter = agencyId ? `AND o."agency_id" = ${agencyId}` : "";
        // Query to get daily sales grouped by agency (exclude soft-deleted orders)
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
           AND o."deleted_at" IS NULL
           ${agencyFilter}
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
    getTodaySalesByAgency: (agencyId) => __awaiter(void 0, void 0, void 0, function* () {
        // Get today's date range in EST timezone
        const { start: startOfToday, end: endOfToday } = (0, utils_1.getTodayRangeUTC)();
        // Build agency filter
        const agencyFilter = agencyId ? `AND o."agency_id" = ${agencyId}` : "";
        // Query to get today's sales grouped by agency (exclude soft-deleted orders)
        const rawData = (yield prisma_client_1.default.$queryRawUnsafe(`
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
      `));
        // Format data for response (using EST date)
        const estNow = (0, utils_1.getAdjustedDate)(new Date());
        const todayFormatted = (0, date_fns_1.format)(estNow, "yyyy-MM-dd");
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
    /**
     * Packages and total weight per agency for parcels filtered by status.
     * When statusIn is omitted, defaults to in-agencies / dispatch-ready statuses.
     */
    getPackagesAndWeightInAgencies: (agencyId, statusIn) => __awaiter(void 0, void 0, void 0, function* () {
        const statusFilter = statusIn && statusIn.length > 0 ? statusIn : [client_1.Status.IN_AGENCY, client_1.Status.IN_PALLET, client_1.Status.IN_DISPATCH];
        const grouped = yield prisma_client_1.default.parcel.groupBy({
            by: ["agency_id"],
            where: {
                deleted_at: null,
                agency_id: agencyId !== null && agencyId !== void 0 ? agencyId : { not: null },
                status: { in: statusFilter },
            },
            _count: { id: true },
            _sum: { weight: true },
        });
        const agencyIds = grouped.map((g) => g.agency_id).filter((id) => id != null);
        const agencyMap = new Map();
        if (agencyIds.length > 0) {
            const agencies = yield prisma_client_1.default.agency.findMany({
                where: { id: { in: agencyIds } },
                select: { id: true, name: true },
            });
            agencies.forEach((a) => agencyMap.set(a.id, a.name));
        }
        const agencies = grouped
            .filter((g) => g.agency_id != null)
            .map((g) => {
            var _a, _b;
            return ({
                agencyId: g.agency_id,
                agencyName: (_a = agencyMap.get(g.agency_id)) !== null && _a !== void 0 ? _a : "",
                packagesCount: g._count.id,
                totalWeight: Number((_b = g._sum.weight) !== null && _b !== void 0 ? _b : 0),
            });
        })
            .sort((a, b) => b.packagesCount - a.packagesCount || b.totalWeight - a.totalWeight);
        const grandTotalPackages = agencies.reduce((sum, ag) => sum + ag.packagesCount, 0);
        const grandTotalWeight = agencies.reduce((sum, ag) => sum + ag.totalWeight, 0);
        return {
            agencies,
            grandTotalPackages,
            grandTotalWeight,
        };
    }),
};
exports.default = analytics;
