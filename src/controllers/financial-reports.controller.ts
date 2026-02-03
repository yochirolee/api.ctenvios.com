import { Response, NextFunction } from "express";
import financialReportsRepository from "../repositories/financial-reports.repository";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import { Roles } from "@prisma/client";

/**
 * Financial Reports Controller
 * Following: Controller pattern, RESTful API design
 */

export const financialReportsController = {
   /**
    * GET /financial-reports/sales/agency
    * Get sales report by agency
    */
   getSalesByAgency: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { period = "today", agency_id, start_date, end_date } = req.query;
         const user = req.user;

         // If not admin, restrict to user's agency
         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         const customStart = start_date ? new Date(start_date) : undefined;
         const customEnd = end_date ? new Date(end_date) : undefined;

         const report = await financialReportsRepository.getSalesByAgency(period, agencyFilter, customStart, customEnd);

         res.status(200).json({
            period,
            agency_id: agencyFilter,
            data: report,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/sales/user
    * Get sales report by user
    */
   getSalesByUser: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { period = "today", agency_id, start_date, end_date } = req.query;
         const user = req.user;

         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         const customStart = start_date ? new Date(start_date) : undefined;
         const customEnd = end_date ? new Date(end_date) : undefined;

         const report = await financialReportsRepository.getSalesByUser(period, agencyFilter, customStart, customEnd);

         res.status(200).json({
            period,
            agency_id: agencyFilter,
            data: report,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/payments/breakdown
    * Get payment method breakdown
    */
   getPaymentBreakdown: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { period = "today", agency_id, start_date, end_date } = req.query;
         const user = req.user;

         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         const customStart = start_date ? new Date(start_date) : undefined;
         const customEnd = end_date ? new Date(end_date) : undefined;

         const report = await financialReportsRepository.getPaymentMethodBreakdown(
            period,
            agencyFilter,
            customStart,
            customEnd
         );

         res.status(200).json({
            period,
            agency_id: agencyFilter,
            data: report,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/debts/customers
    * Get customer debts
    */
   getCustomerDebts: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { agency_id, limit = 50 } = req.query;
         const user = req.user;

         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         const report = await financialReportsRepository.getCustomerDebts(agencyFilter, parseInt(limit));

         res.status(200).json({
            agency_id: agencyFilter,
            total_customers: report.length,
            total_debt_cents: report.reduce((sum, c) => sum + c.total_debt_cents, 0),
            data: report,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/debts/customers/:customer_id
    * Get specific customer pending orders
    */
   getCustomerPendingOrders: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { customer_id } = req.params;

         const report = await financialReportsRepository.getCustomerPendingOrders(parseInt(customer_id));

         res.status(200).json(report);
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/daily/:year/:month
    * Get daily sales breakdown for a month
    */
   getDailySales: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { year, month } = req.params;
         const { agency_id } = req.query;
         const user = req.user;

         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         const report = await financialReportsRepository.getDailySalesBreakdown(
            parseInt(year),
            parseInt(month),
            agencyFilter
         );

         const totals = report.reduce(
            (acc, day) => {
               acc.total_orders += day.total_orders;
               acc.total_billed_cents += day.total_billed_cents;
               acc.total_paid_cents += day.total_paid_cents;
               acc.total_pending_cents += day.total_pending_cents;
               return acc;
            },
            { total_orders: 0, total_billed_cents: 0, total_paid_cents: 0, total_pending_cents: 0 }
         );

         res.status(200).json({
            year: parseInt(year),
            month: parseInt(month),
            agency_id: agencyFilter,
            totals,
            daily_breakdown: report,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/agency/:agency_id/summary
    * Get complete financial summary for an agency
    */
   getAgencySummary: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { agency_id } = req.params;
         const { period = "month", start_date, end_date } = req.query;
         const user = req.user;

         // Validate access
         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         if (!isAdmin && user.agency_id !== parseInt(agency_id)) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "Access denied to this agency's data");
         }

         const customStart = start_date ? new Date(start_date) : undefined;
         const customEnd = end_date ? new Date(end_date) : undefined;

         const report = await financialReportsRepository.getAgencyFinancialSummary(
            parseInt(agency_id),
            period,
            customStart,
            customEnd
         );

         res.status(200).json(report);
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/comparison/monthly
    * Get monthly comparison (current vs previous)
    */
   getMonthlyComparison: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { agency_id } = req.query;
         const user = req.user;

         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         const report = await financialReportsRepository.getMonthlyComparison(agencyFilter);

         res.status(200).json({
            agency_id: agencyFilter,
            ...report,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/dashboard
    * Get dashboard summary (quick overview)
    */
   getDashboard: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const user = req.user;
         const isAdmin = [Roles.ROOT, Roles.ADMINISTRATOR].includes(user.role);
         const agencyFilter = isAdmin ? undefined : user.agency_id;

         const [today, month, paymentBreakdown, customerDebts, comparison] = await Promise.all([
            financialReportsRepository.getSalesByAgency("today", agencyFilter),
            financialReportsRepository.getSalesByAgency("month", agencyFilter),
            financialReportsRepository.getPaymentMethodBreakdown("month", agencyFilter),
            financialReportsRepository.getCustomerDebts(agencyFilter, 10),
            financialReportsRepository.getMonthlyComparison(agencyFilter),
         ]);

         const todayTotals = today.reduce(
            (acc, a) => {
               acc.orders += a.total_orders;
               acc.billed += a.total_billed_cents;
               acc.paid += a.total_paid_cents;
               return acc;
            },
            { orders: 0, billed: 0, paid: 0 }
         );

         const monthTotals = month.reduce(
            (acc, a) => {
               acc.orders += a.total_orders;
               acc.billed += a.total_billed_cents;
               acc.paid += a.total_paid_cents;
               acc.pending += a.total_pending_cents;
               return acc;
            },
            { orders: 0, billed: 0, paid: 0, pending: 0 }
         );

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
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/daily-closing
    * Get daily closing report by user
    * Query params: date, agency_id, user_id
    */
   getDailyClosing: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { date, agency_id, user_id } = req.query;
         const user = req.user;

         // Default to today if no date provided
         // Parse date as local date (YYYY-MM-DD) to avoid timezone issues
         let reportDate: Date;
         if (date) {
            const [year, month, day] = String(date).split("-").map(Number);
            reportDate = new Date(year, month - 1, day);
         } else {
            reportDate = new Date();
         }

         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         // User filter - admins can filter by any user, others can only see their own or all in their agency
         const userFilter = user_id ? String(user_id) : undefined;

         const report = await financialReportsRepository.getDailyClosingByUser(reportDate, agencyFilter, userFilter);

         res.status(200).json(report);
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/orders
    * Get detailed orders report
    */
   getOrdersReport: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { period = "today", agency_id, payment_status, start_date, end_date, page = 1, limit = 50 } = req.query;
         const user = req.user;

         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         const agencyFilter = isAdmin ? (agency_id ? parseInt(agency_id) : undefined) : user.agency_id;

         const customStart = start_date ? new Date(start_date) : undefined;
         const customEnd = end_date ? new Date(end_date) : undefined;

         const report = await financialReportsRepository.getOrdersDetailedReport(
            period,
            agencyFilter,
            payment_status || undefined,
            customStart,
            customEnd,
            parseInt(page),
            Math.min(parseInt(limit), 100) // Max 100 per page
         );

         res.status(200).json({
            period,
            agency_id: agencyFilter,
            ...report,
         });
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/daily-sales
    * Get daily sales report for agency, optionally filtered by user
    */
   getDailySalesReport: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { date, user_id } = req.query;
         const user = req.user;

         // Default to today if no date provided
         // Parse date as local date (YYYY-MM-DD) to avoid timezone issues
         let reportDate: Date;
         if (date) {
            const [year, month, day] = String(date).split("-").map(Number);
            reportDate = new Date(year, month - 1, day);
         } else {
            reportDate = new Date();
         }

         // Use user's agency (non-admins can only see their agency)
         const agencyId = user.agency_id;

         if (!agencyId) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency");
         }

         const report = await financialReportsRepository.getDailySalesReport(
            reportDate,
            agencyId,
            user_id || undefined
         );

         res.status(200).json(report);
      } catch (error) {
         next(error);
      }
   },

   /**
    * GET /financial-reports/sales-report/pdf
    * Generate PDF sales report
    * Query params: date, start_date, end_date, user_id, agency_id
    */
   getSalesReportPdf: async (req: any, res: Response, next: NextFunction): Promise<void> => {
      try {
         const { date, start_date, end_date, user_id, agency_id } = req.query;
         const user = req.user;

         // Determine agency - admins can filter by any agency, others use their own
         const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
         let agencyId: number;

         if (agency_id && isAdmin) {
            agencyId = parseInt(agency_id);
         } else {
            agencyId = user.agency_id;
            if (!agencyId) {
               throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency");
            }
         }

         // Determine date range
         let startDate: Date;
         let endDate: Date;

         if (start_date && end_date) {
            // Date range provided
            const [startYear, startMonth, startDay] = String(start_date).split("-").map(Number);
            const [endYear, endMonth, endDay] = String(end_date).split("-").map(Number);
            startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
            endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
         } else if (date) {
            // Single date
            const [year, month, day] = String(date).split("-").map(Number);
            startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
         } else {
            // Default to today
            const today = new Date();
            startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
         }

         // User filter (optional)
         const userIdFilter = user_id ? String(user_id) : undefined;

         const { generateSalesReportPdf } = await import("../utils/pdf/generate-sales-report-pdf");
         const buffer = await generateSalesReportPdf(startDate, endDate, agencyId, userIdFilter);

         const dateStr =
            start_date && end_date ? `${start_date}_${end_date}` : date || new Date().toISOString().split("T")[0];
         const filename = `Reporte_Ventas_${dateStr}.pdf`;

         res.setHeader("Content-Type", "application/pdf");
         res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
         res.setHeader("Content-Length", buffer.length);
         res.send(buffer);
      } catch (error) {
         next(error);
      }
   },
};

export default financialReportsController;
