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
Object.defineProperty(exports, "__esModule", { value: true });
const repositories_1 = require("../repositories");
const analytics = {
    getSalesReport: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        let { year, agencyId, startDate, endDate } = req.query;
        // Validate required year parameter
        if (!year) {
            const currentYear = new Date().getFullYear().toString();
            year = currentYear;
        }
        const yearNum = Number(year);
        const agencyIdNum = agencyId ? Number(agencyId) : 0;
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
        const yearNum = Number(year);
        const agencyIdNum = agencyId ? Number(agencyId) : 0;
        const report = yield repositories_1.repository.analytics.getSalesReport(yearNum, agencyIdNum, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.status(200).json(report);
    }),
    getDailySalesByAgency: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        let { year, startDate, endDate } = req.query;
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
        const report = yield repositories_1.repository.analytics.getDailySalesByAgency(yearNum, parsedStartDate || defaultStartDate, parsedEndDate || defaultEndDate);
        res.status(200).json(report);
    }),
    getTodaySalesByAgency: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const report = yield repositories_1.repository.analytics.getTodaySalesByAgency();
        res.status(200).json(report);
    }),
};
exports.default = analytics;
