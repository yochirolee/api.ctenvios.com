import { Router } from "express";
import controllers from "../controllers";

const router = Router();

router.get("/", controllers.receivers.get);
router.get("/search", controllers.receivers.search);
router.get("/ci/:ci", controllers.receivers.getByCi);
router.post("/", controllers.receivers.create);
router.put("/:id", controllers.receivers.edit);

export default router;
