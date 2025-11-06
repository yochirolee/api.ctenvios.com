import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.get("/sales", controllers.analytics.getSalesReport);
router.get("/sales/agency", controllers.analytics.getSalesReportByAgency);
router.get("/sales/daily/agency", controllers.analytics.getDailySalesByAgency);
router.get("/daily-sales-by-agency", controllers.analytics.getTodaySalesByAgency);

export default router;
