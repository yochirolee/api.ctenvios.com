import { Router } from "express";
import controllers from "../controllers";
import { validate } from "../middlewares/validate.middleware";
import { createCustomerSchema } from "../types/types";

const router = Router();

router.get("/", controllers.customers.get);
router.get("/search", controllers.customers.search);
router.post("/",validate({ body: createCustomerSchema }), controllers.customers.create);
router.get("/:id", controllers.customers.getById);
router.get("/:id/receivers", controllers.customers.getReceivers);
router.put("/:id", controllers.customers.edit);

export default router;
