import { Router } from "express";
import controllers from "../controllers";
const router = Router();

router.get("/", controllers.forwarders.getAll);
router.get("/:id", controllers.forwarders.getById);
router.post("/", controllers.forwarders.create);
router.put("/:id", controllers.forwarders.update);
router.delete("/:id", controllers.forwarders.delete);

export default router;
