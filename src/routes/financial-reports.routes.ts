import { Router } from "express";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import financialReportsController from "../controllers/financial-reports.controller";
import { Roles } from "@prisma/client";

const router = Router();

// Roles that can access financial reports
const FINANCIAL_ROLES: Roles[] = [
   Roles.ROOT,
   Roles.ADMINISTRATOR,
   Roles.AGENCY_ADMIN,
   Roles.AGENCY_SUPERVISOR,
   Roles.FORWARDER_ADMIN,
   Roles.CARRIER_OWNER,
   Roles.CARRIER_ADMIN,
];

/**
 * Financial Reports Routes
 * Following: RESTful API design
 */

// Dashboard - Quick overview
router.get("/dashboard", authMiddleware, requireRoles(FINANCIAL_ROLES), financialReportsController.getDashboard);

// Detailed Orders Report
router.get("/orders", authMiddleware, requireRoles(FINANCIAL_ROLES), financialReportsController.getOrdersReport);

// Daily Closing by User
router.get("/daily-closing", authMiddleware, requireRoles(FINANCIAL_ROLES), financialReportsController.getDailyClosing);

// Daily Sales Report (simple list)
router.get(
   "/daily-sales",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getDailySalesReport
);

// Sales Report PDF - printer friendly
router.get(
   "/sales-report/pdf",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getSalesReportPdf
);

// Sales Reports
router.get("/sales/agency", authMiddleware, requireRoles(FINANCIAL_ROLES), financialReportsController.getSalesByAgency);

router.get("/sales/user", authMiddleware, requireRoles(FINANCIAL_ROLES), financialReportsController.getSalesByUser);

// Daily breakdown for a specific month
router.get(
   "/daily/:year/:month",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getDailySales
);

// Payment breakdown
router.get(
   "/payments/breakdown",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getPaymentBreakdown
);

// Customer debts
router.get(
   "/debts/customers",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getCustomerDebts
);

router.get(
   "/debts/customers/:customer_id",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getCustomerPendingOrders
);

// Agency summary
router.get(
   "/agency/:agency_id/summary",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getAgencySummary
);

// Monthly comparison
router.get(
   "/comparison/monthly",
   authMiddleware,
   requireRoles(FINANCIAL_ROLES),
   financialReportsController.getMonthlyComparison
);

export default router;
