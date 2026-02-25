"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = __importDefault(require("../controllers"));
const router = (0, express_1.Router)();
router.get("/sales", controllers_1.default.analytics.getSalesReport);
router.get("/sales/agency", controllers_1.default.analytics.getSalesReportByAgency);
router.get("/sales/daily/agency", controllers_1.default.analytics.getDailySalesByAgency);
router.get("/daily-sales-by-agency", controllers_1.default.analytics.getTodaySalesByAgency);
router.get("/packages-weight-in-agencies", controllers_1.default.analytics.getPackagesAndWeightInAgencies);
exports.default = router;
