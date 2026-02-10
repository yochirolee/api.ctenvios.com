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
const repositories_1 = require("../repositories");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const client_1 = require("@prisma/client");
// Admin roles that can see all agencies
const ADMIN_ROLES = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
// Helper to check if user is admin
const isAdminUser = (role) => {
    return ADMIN_ROLES.includes(role);
};
const analytics = {
    getSalesReport: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        let { year, agencyId, startDate, endDate } = req.query;
        const user = req.user;
        const isAdmin = isAdminUser(user.role);
        // Non-admin users can only see their agency
        if (!isAdmin && !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency");
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
        const parsedStartDate = startDate ? new Date(startDate) : undefined;
        const parsedEndDate = endDate ? new Date(endDate) : undefined;
        // Default date range if not provided
        const defaultStartDate = new Date(`${yearNum}-01-01`);
        const defaultEndDate = new Date(`${yearNum}-12-31`);
        const report = yield repositories_1.repository.analytics.getSalesReport(yearNum, agencyIdNum, parsedStartDate || defaultStartDate, parsedEndDate || defaultEndDate);
        res.status(200).json(report);
    }),
    getSalesReportByAgency: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        let { year, agencyId, startDate, endDate } = req.query;
        const user = req.user;
        const isAdmin = isAdminUser(user.role);
        // Non-admin users can only see their agency
        if (!isAdmin && !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency");
        }
        const yearNum = Number(year);
        // Admin can specify agencyId or get all (0), non-admin always uses their agency
        const agencyIdNum = isAdmin ? (agencyId ? Number(agencyId) : 0) : user.agency_id;
        const report = yield repositories_1.repository.analytics.getSalesReport(yearNum, agencyIdNum, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.status(200).json(report);
    }),
    getDailySalesByAgency: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        let { year, startDate, endDate } = req.query;
        const user = req.user;
        const isAdmin = isAdminUser(user.role);
        if (!isAdmin && !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency");
        }
        // Default to current year if not provided
        if (!year) {
            const currentYear = new Date().getFullYear().toString();
            year = currentYear;
        }
        const yearNum = Number(year);
        // Parse optional date parameters
        const parsedStartDate = startDate ? new Date(startDate) : undefined;
        const parsedEndDate = endDate ? new Date(endDate) : undefined;
        // Default date range if not provided
        const defaultStartDate = new Date(`${yearNum}-01-01`);
        const defaultEndDate = new Date(`${yearNum}-12-31`);
        const report = yield repositories_1.repository.analytics.getDailySalesByAgency(yearNum, parsedStartDate || defaultStartDate, parsedEndDate || defaultEndDate, isAdmin ? undefined : user.agency_id);
        res.status(200).json(report);
    }),
    getTodaySalesByAgency: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const isAdmin = isAdminUser(user.role);
        if (!isAdmin && !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must belong to an agency");
        }
        const report = yield repositories_1.repository.analytics.getTodaySalesByAgency(isAdmin ? undefined : user.agency_id);
        res.status(200).json(report);
    }),
};
exports.default = analytics;
