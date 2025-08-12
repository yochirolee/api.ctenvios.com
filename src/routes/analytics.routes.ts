import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.get("/sales", controllers.analytics.getSalesReport);

export default router;