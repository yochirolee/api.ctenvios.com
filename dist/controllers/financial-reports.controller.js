"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.financialReportsController = void 0;
const financial_reports_repository_1 = __importDefault(require("../repositories/financial-reports.repository"));
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const client_1 = require("@prisma/client");
const utils_1 = require("../utils/utils");
/**
 * Financial Reports Controller
 * Following: Controller pattern, RESTful API design
 */
exports.financialReportsController = {
    /**
     * GET /financial-reports/sales/agency
     * Get sales report by agency
     */
    getSalesByAgency: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { period = "today", agency_id, start_date, end_date } = req.query;
            const user = req.user;
            // If not admin, restrict to user's agency
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            const customStart = start_date ? new Date(start_date) : undefined;
            const customEnd = end_date ? new Date(end_date) : undefined;
            const report = yield financial_reports_repository_1.default.getSalesByAgency(period, agencyFilter, customStart, customEnd);
            res.status(200).json({
                period,
                agency_id: agencyFilter,
                data: report,
            });
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/sales/user
     * Get sales report by user
     */
    getSalesByUser: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { period = "today", agency_id, start_date, end_date } = req.query;
            const user = req.user;
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            const customStart = start_date ? new Date(start_date) : undefined;
            const customEnd = end_date ? new Date(end_date) : undefined;
            const report = yield financial_reports_repository_1.default.getSalesByUser(period, agencyFilter, customStart, customEnd);
            res.status(200).json({
                period,
                agency_id: agencyFilter,
                data: report,
            });
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/payments/breakdown
     * Get payment method breakdown
     */
    getPaymentBreakdown: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { period = "today", agency_id, start_date, end_date } = req.query;
            const user = req.user;
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            const customStart = start_date ? new Date(start_date) : undefined;
            const customEnd = end_date ? new Date(end_date) : undefined;
            const report = yield financial_reports_repository_1.default.getPaymentMethodBreakdown(period, agencyFilter, customStart, customEnd);
            res.status(200).json({
                period,
                agency_id: agencyFilter,
                data: report,
            });
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/debts/customers
     * Get customer debts
     */
    getCustomerDebts: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { agency_id, limit = 50 } = req.query;
            const user = req.user;
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            const report = yield financial_reports_repository_1.default.getCustomerDebts(agencyFilter, parseInt(limit));
            res.status(200).json({
                agency_id: agencyFilter,
                total_customers: report.length,
                total_debt_cents: report.reduce((sum, c) => sum + c.total_debt_cents, 0),
                data: report,
            });
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/debts/customers/:customer_id
     * Get specific customer pending orders
     */
    getCustomerPendingOrders: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { customer_id } = req.params;
            const report = yield financial_reports_repository_1.default.getCustomerPendingOrders(parseInt(customer_id));
            res.status(200).json(report);
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/daily/:year/:month
     * Get daily sales breakdown for a month
     */
    getDailySales: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { year, month } = req.params;
            const { agency_id } = req.query;
            const user = req.user;
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            const report = yield financial_reports_repository_1.default.getDailySalesBreakdown(parseInt(year), parseInt(month), agencyFilter);
            const totals = report.reduce((acc, day) => {
                acc.total_orders += day.total_orders;
                acc.total_billed_cents += day.total_billed_cents;
                acc.total_paid_cents += day.total_paid_cents;
                acc.total_pending_cents += day.total_pending_cents;
                return acc;
            }, { total_orders: 0, total_billed_cents: 0, total_paid_cents: 0, total_pending_cents: 0 });
            res.status(200).json({
                year: parseInt(year),
                month: parseInt(month),
                agency_id: agencyFilter,
                totals,
                daily_breakdown: report,
            });
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/agency/:agency_id/summary
     * Get complete financial summary for an agency
     */
    getAgencySummary: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { agency_id } = req.params;
            const { period = "month", start_date, end_date } = req.query;
            const user = req.user;
            // Validate access
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            if (!isAdmin && user.agency_id !== parseInt(agency_id)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Access denied to this agency's data");
            }
            const customStart = start_date ? new Date(start_date) : undefined;
            const customEnd = end_date ? new Date(end_date) : undefined;
            const report = yield financial_reports_repository_1.default.getAgencyFinancialSummary(parseInt(agency_id), period, customStart, customEnd);
            res.status(200).json(report);
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/comparison/monthly
     * Get monthly comparison (current vs previous)
     */
    getMonthlyComparison: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { agency_id } = req.query;
            const user = req.user;
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            const report = yield financial_reports_repository_1.default.getMonthlyComparison(agencyFilter);
            res.status(200).json(Object.assign({ agency_id: agencyFilter }, report));
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/dashboard
     * Get dashboard summary (quick overview)
     */
    getDashboard: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const user = req.user;
            const isAdmin = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR].includes(user.role);
            const agencyFilter = isAdmin ? undefined : user.agency_id;
            const [today, month, paymentBreakdown, customerDebts, comparison] = yield Promise.all([
                financial_reports_repository_1.default.getSalesByAgency("today", agencyFilter),
                financial_reports_repository_1.default.getSalesByAgency("month", agencyFilter),
                financial_reports_repository_1.default.getPaymentMethodBreakdown("month", agencyFilter),
                financial_reports_repository_1.default.getCustomerDebts(agencyFilter, 10),
                financial_reports_repository_1.default.getMonthlyComparison(agencyFilter),
            ]);
            const todayTotals = today.reduce((acc, a) => {
                acc.orders += a.total_orders;
                acc.billed += a.total_billed_cents;
                acc.paid += a.total_paid_cents;
                return acc;
            }, { orders: 0, billed: 0, paid: 0 });
            console.log(todayTotals);
            const monthTotals = month.reduce((acc, a) => {
                acc.orders += a.total_orders;
                acc.billed += a.total_billed_cents;
                acc.paid += a.total_paid_cents;
                acc.pending += a.total_pending_cents;
                return acc;
            }, { orders: 0, billed: 0, paid: 0, pending: 0 });
            res.status(200).json({
                today: {
                    total_orders: todayTotals.orders,
                    total_billed_cents: todayTotals.billed,
                    total_paid_cents: todayTotals.paid,
                },
                month: {
                    total_orders: monthTotals.orders,
                    total_billed_cents: monthTotals.billed,
                    total_paid_cents: monthTotals.paid,
                    total_pending_cents: monthTotals.pending,
                },
                growth_percentage: comparison.growth_percentage,
                payment_breakdown: paymentBreakdown,
                top_debtors: customerDebts.slice(0, 5),
            });
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/daily-closing
     * Get daily closing report by user
     * Query params: date, agency_id, user_id
     */
    getDailyClosing: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { date, agency_id, user_id } = req.query;
            const user = req.user;
            // Default to today if no date provided
            // Parse date as local date (YYYY-MM-DD) to avoid timezone issues
            let reportDate;
            if (date) {
                const [year, month, day] = String(date).split("-").map(Number);
                reportDate = new Date(year, month - 1, day);
            }
            else {
                reportDate = new Date();
            }
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            // User filter - admins can filter by any user, others can only see their own or all in their agency
            const userFilter = user_id ? String(user_id) : undefined;
            const report = yield financial_reports_repository_1.default.getDailyClosingByUser(reportDate, agencyFilter, userFilter);
            res.status(200).json(report);
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/orders
     * Get detailed orders report
     */
    getOrdersReport: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { period = "today", agency_id, payment_status, start_date, end_date, page = 1, limit = 50 } = req.query;
            const user = req.user;
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;
            const customStart = start_date ? new Date(start_date) : undefined;
            const customEnd = end_date ? new Date(end_date) : undefined;
            const report = yield financial_reports_repository_1.default.getOrdersDetailedReport(period, agencyFilter, payment_status || undefined, customStart, customEnd, parseInt(page), Math.min(parseInt(limit), 100));
            res.status(200).json(Object.assign({ period, agency_id: agencyFilter }, report));
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/daily-sales
     * Get daily sales report for agency, optionally filtered by user
     */
    getDailySalesReport: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { date, user_id } = req.query;
            const user = req.user;
            // Default to today if no date provided
            // Parse date as UTC date-only (YYYY-MM-DD) to avoid server timezone drift
            let reportDate;
            if (date) {
                const [year, month, day] = String(date).split("-").map(Number);
                reportDate = new Date(Date.UTC(year, month - 1, day));
            }
            else {
                const adjustedNow = (0, utils_1.getAdjustedDate)(new Date());
                reportDate = new Date(Date.UTC(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate()));
            }
            // Use user's agency (non-admins can only see their agency)
            const agencyId = user.agency_id;
            if (!agencyId) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency");
            }
            const report = yield financial_reports_repository_1.default.getDailySalesReport(reportDate, agencyId, user_id || undefined);
            const formattedReport = Object.assign(Object.assign({}, report), { date: (0, utils_1.formatDateLocal)(reportDate), billing: Object.assign(Object.assign({}, report.billing), { orders: report.billing.orders.map((order) => (Object.assign(Object.assign({}, order), { created_at: (0, utils_1.formatDateTimeLocal)(order.created_at) }))) }), collections: Object.assign(Object.assign({}, report.collections), { payments: report.collections.payments.map((payment) => (Object.assign(Object.assign({}, payment), { order_date: (0, utils_1.formatDateTimeLocal)(payment.order_date), payment_date: (0, utils_1.formatDateTimeLocal)(payment.payment_date) }))) }) });
            res.status(200).json(formattedReport);
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * GET /financial-reports/sales-report/pdf
     * Generate PDF sales report
     * Query params: date, start_date, end_date, user_id, agency_id
     */
    getSalesReportPdf: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { date, start_date, end_date, user_id, agency_id } = req.query;
            const user = req.user;
            // Determine agency - admins can filter by any agency, others use their own
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            let agencyId;
            if (agency_id && isAdmin) {
                agencyId = parseInt(agency_id);
            }
            else {
                agencyId = user.agency_id;
                if (!agencyId) {
                    throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency");
                }
            }
            // Determine date range
            let startDate;
            let endDate;
            if (start_date && end_date) {
                // Date range provided
                const [startYear, startMonth, startDay] = String(start_date).split("-").map(Number);
                const [endYear, endMonth, endDay] = String(end_date).split("-").map(Number);
                startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
                endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
            }
            else if (date) {
                // Single date
                const [year, month, day] = String(date).split("-").map(Number);
                startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
                endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
            }
            else {
                // Default to today
                const today = new Date();
                startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
                endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
            }
            // User filter (optional)
            const userIdFilter = user_id ? String(user_id) : undefined;
            const { generateSalesReportPdf } = yield Promise.resolve().then(() => __importStar(require("../utils/pdf/generate-sales-report-pdf")));
            const buffer = yield generateSalesReportPdf(startDate, endDate, agencyId, userIdFilter);
            const dateStr = start_date && end_date ? `${start_date}_${end_date}` : date || new Date().toISOString().split("T")[0];
            const filename = `Reporte_Ventas_${dateStr}.pdf`;
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Length", buffer.length);
            res.send(buffer);
        }
        catch (error) {
            next(error);
        }
    }),
};
exports.default = exports.financialReportsController;
