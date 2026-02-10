"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const financial_reports_controller_1 = __importDefault(require("../controllers/financial-reports.controller"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Roles that can access financial reports
const FINANCIAL_ROLES = [
    client_1.Roles.ROOT,
    client_1.Roles.ADMINISTRATOR,
    client_1.Roles.AGENCY_SALES,
    client_1.Roles.AGENCY_ADMIN,
    client_1.Roles.AGENCY_SUPERVISOR,
    client_1.Roles.FORWARDER_ADMIN,
    client_1.Roles.CARRIER_OWNER,
    client_1.Roles.CARRIER_ADMIN,
];
/**
 * Financial Reports Routes
 * Following: RESTful API design
 */
// Dashboard - Quick overview
router.get("/dashboard", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getDashboard);
// Detailed Orders Report
router.get("/orders", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getOrdersReport);
// Daily Closing by User
router.get("/daily-closing", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getDailyClosing);
// Daily Sales Report (simple list)
router.get("/daily-sales", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getDailySalesReport);
// Sales Report PDF - printer friendly
router.get("/sales-report/pdf", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getSalesReportPdf);
// Sales Reports
router.get("/sales/agency", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getSalesByAgency);
router.get("/sales/user", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getSalesByUser);
// Daily breakdown for a specific month
router.get("/daily/:year/:month", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getDailySales);
// Payment breakdown
router.get("/payments/breakdown", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getPaymentBreakdown);
// Customer debts
router.get("/debts/customers", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getCustomerDebts);
router.get("/debts/customers/:customer_id", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getCustomerPendingOrders);
// Agency summary
router.get("/agency/:agency_id/summary", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getAgencySummary);
// Monthly comparison
router.get("/comparison/monthly", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(FINANCIAL_ROLES), financial_reports_controller_1.default.getMonthlyComparison);
exports.default = router;
