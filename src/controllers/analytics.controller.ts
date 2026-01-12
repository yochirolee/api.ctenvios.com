import { Response } from "express";
import { repository } from "../repositories";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import { Roles } from "@prisma/client";

// Admin roles that can see all agencies
const ADMIN_ROLES: Roles[] = [Roles.ROOT, Roles.ADMINISTRATOR];

// Helper to check if user is admin
const isAdminUser = (role: Roles): boolean => {
   return ADMIN_ROLES.includes(role);
};

const analytics = {
   getSalesReport: async (req: any, res: Response): Promise<void> => {
      let { year, agencyId, startDate, endDate } = req.query;
      const user = req.user;
      const isAdmin = isAdminUser(user.role);

      // Non-admin users can only see their agency
      if (!isAdmin && !user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency");
      }

      // Validate required year parameter
      if (!year) {
         const currentYear = new Date().getFullYear().toString();
         year = currentYear;
      }

      const yearNum = Number(year);
      // Admin can specify agencyId or get all (0), non-admin always uses their agency
      const agencyIdNum = isAdmin ? (agencyId ? Number(agencyId) : 0) : user.agency_id;

      // Parse optional date parameters
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      // Default date range if not provided
      const defaultStartDate = new Date(`${yearNum}-01-01`);
      const defaultEndDate = new Date(`${yearNum}-12-31`);

      const report = await repository.analytics.getSalesReport(
         yearNum,
         agencyIdNum,
         parsedStartDate || defaultStartDate,
         parsedEndDate || defaultEndDate
      );

      res.status(200).json(report);
   },

   getSalesReportByAgency: async (req: any, res: Response): Promise<void> => {
      let { year, agencyId, startDate, endDate } = req.query;
      const user = req.user;
      const isAdmin = isAdminUser(user.role);

      // Non-admin users can only see their agency
      if (!isAdmin && !user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency");
      }

      const yearNum = Number(year);
      // Admin can specify agencyId or get all (0), non-admin always uses their agency
      const agencyIdNum = isAdmin ? (agencyId ? Number(agencyId) : 0) : user.agency_id;

      const report = await repository.analytics.getSalesReport(
         yearNum,
         agencyIdNum,
         startDate ? new Date(startDate as string) : undefined,
         endDate ? new Date(endDate as string) : undefined
      );

      res.status(200).json(report);
   },

   getDailySalesByAgency: async (req: any, res: Response): Promise<void> => {
      let { year, startDate, endDate } = req.query;
      const user = req.user;
      const isAdmin = isAdminUser(user.role);

      if (!isAdmin && !user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency");
      }

      // Default to current year if not provided
      if (!year) {
         const currentYear = new Date().getFullYear().toString();
         year = currentYear;
      }

      const yearNum = Number(year);

      // Parse optional date parameters
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      // Default date range if not provided
      const defaultStartDate = new Date(`${yearNum}-01-01`);
      const defaultEndDate = new Date(`${yearNum}-12-31`);

      const report = await repository.analytics.getDailySalesByAgency(
         yearNum,
         parsedStartDate || defaultStartDate,
         parsedEndDate || defaultEndDate,
         isAdmin ? undefined : user.agency_id
      );

      res.status(200).json(report);
   },

   getTodaySalesByAgency: async (req: any, res: Response): Promise<void> => {
      const user = req.user;
      const isAdmin = isAdminUser(user.role);

      if (!isAdmin && !user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must belong to an agency");
      }

      const report = await repository.analytics.getTodaySalesByAgency(isAdmin ? undefined : user.agency_id);

      res.status(200).json(report);
   },
};

export default analytics;
