import { z } from "zod";
import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import controllers from "../controllers";
import { createOrderSchema, paymentSchema, searchSchema } from "../types/types";

const router = Router();

// GET /orders - List and search orders (RESTful pattern)
router.get("/", authMiddleware, validate({ query: searchSchema }), controllers.orders.search);

// GET /orders/:id - Get order by ID
router.get("/:id", authMiddleware, controllers.orders.getById);

// POST /orders - Create new order
router.post("/", authMiddleware, validate({ body: createOrderSchema }), controllers.orders.create);

// POST /orders/payment - Create new payment
router.post(
   "/:id/payments",
   authMiddleware,
   validate({
      body: paymentSchema,
      params: z.object({ id: z.string().transform(Number).pipe(z.number().positive()) }),
   }),
   controllers.orders.payOrder
);

// DELETE /orders/payment/:id - Delete payment
router.delete(
   "/:id/payments",
   validate({ params: z.object({ id: z.string().transform(Number).pipe(z.number().positive()) }) }),
   authMiddleware,
   controllers.orders.removePayment
);
export default router;
