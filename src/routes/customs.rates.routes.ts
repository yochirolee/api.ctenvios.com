import { Router } from "express";
import controllers from "../controllers";
import { validate } from "../middlewares/validate.middleware";
import { z } from "zod";
import { customsRatesSchema } from "../types/types";
const router = Router();

router.get("/", controllers.customsRates.get);
router.get("/search", controllers.customsRates.search);
router.get("/:id", controllers.customsRates.getById);
router.post("/", validate({ body: customsRatesSchema }), controllers.customsRates.create);
router.put(
   "/:id",
   validate({ params: z.object({ id: z.coerce.number() }), body: customsRatesSchema }),
   controllers.customsRates.update
);
router.delete("/:id", validate({ params: z.object({ id: z.coerce.number() }) }), controllers.customsRates.delete);

export default router;
