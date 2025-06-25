import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.get("/", controllers.providers.getAll);
router.get("/:id", controllers.providers.getById);
router.post("/", controllers.providers.create);
router.put("/:id", controllers.providers.update);
router.delete("/:id", controllers.providers.delete);

export default router;
