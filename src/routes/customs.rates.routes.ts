import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.get("/", controllers.customsRates.get);
router.get("/search", controllers.customsRates.search);
router.get("/:id", controllers.customsRates.getById);
router.post("/", controllers.customsRates.create);
router.put("/:id", controllers.customsRates.update);
router.delete("/:id", controllers.customsRates.delete);

export default router;
