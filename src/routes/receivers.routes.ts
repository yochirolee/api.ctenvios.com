import { Router } from "express";
import controllers from "../controllers";
import { validate } from "../middlewares/validate.middleware";
import { z } from "zod";
import { createReceiverSchema } from "../types/types";

const ciSchema = z.object({
   ci: z.string().length(11, "CI must be 11 characters long"),
});
const router = Router();

router.get("/", controllers.receivers.get);
router.get("/search", controllers.receivers.search);
router.get("/ci/:ci", validate({ params: ciSchema }), controllers.receivers.getByCi);
router.post("/", validate({ body: createReceiverSchema }), controllers.receivers.create);
router.put("/:id", controllers.receivers.edit);

export default router;
