import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.get("/", controllers.receipts.get);
router.get("/search", controllers.receipts.search);
router.get("/ci/:ci", controllers.receipts.getByCi);
router.post("/", controllers.receipts.create);
router.put("/:id", controllers.receipts.edit);

export default router;
