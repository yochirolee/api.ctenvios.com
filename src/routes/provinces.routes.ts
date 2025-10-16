import { Router } from "express";
import controller from "../controllers";

const router = Router();

router.get("/", controller.provinces.get);
router.get("/delivery-fee", controller.provinces.getDeliveryFee);

export default router;
