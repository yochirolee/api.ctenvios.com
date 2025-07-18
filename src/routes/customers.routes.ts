import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.get("/", controllers.customers.get);
router.get("/search", controllers.customers.search);
router.post("/", controllers.customers.create);
router.get("/:id", controllers.customers.getById);
router.get("/:id/receipts", controllers.customers.getReceipts);
router.put("/:id", controllers.customers.edit);

export default router;
