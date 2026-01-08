import { z } from "zod";
import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import controllers from "../controllers";
import { createOrderSchema, paymentSchema, searchSchema, discountSchema } from "../types/types";

const router = Router();

// GET /orders/:id/pdf - Get order PDF
router.get("/:id/pdf", controllers.orders.generateOrderPdf);

router.get("/:id/labels-pdf", controllers.orders.generateOrderLabelsPdf);

router.get("/:id/hbls-pdf", controllers.orders.generateOrderHblPdf);

// GET /orders - List and search orders (RESTful pattern)
router.get("/", authMiddleware, validate({ query: searchSchema }), controllers.orders.search);

// GET /orders/:id/parcels - Get parcels by order ID
router.get("/:id/parcels", authMiddleware, controllers.orders.getParcelsByOrderId);

// GET /orders/:id/status-summary - Get order status summary with parcel breakdown
router.get("/:id/status-summary", authMiddleware, controllers.orders.getStatusSummary);

// GET /orders/:id - Get order by ID

router.get("/:id", authMiddleware, controllers.orders.getById);

// POST /orders - Create new order
router.post("/", authMiddleware, validate({ body: createOrderSchema }), controllers.orders.create);

// POST /orders/:id/discounts - Add discount to order (MUST be before /:id routes)
router.post(
   "/:id/discounts",
   authMiddleware,
   validate({
      body: discountSchema,
      params: z.object({ id: z.string().transform(Number).pipe(z.number().positive()) }),
   }),
   controllers.orders.addDiscount
);

// DELETE /orders/:id/discounts/:discount_id - Delete discount from order
router.delete(
   "/:id/discounts",
   authMiddleware,
   validate({
      params: z.object({
         id: z.string().transform(Number).pipe(z.number().positive()),
      }),
   }),
   controllers.orders.removeDiscount
);

// POST /orders/:id/payments - Create new payment
router.post(
   "/:id/payments",
   authMiddleware,

   validate({
      body: paymentSchema,
      params: z.object({ id: z.string().transform(Number).pipe(z.number().positive()) }),
   }),
   controllers.orders.payOrder
);

// DELETE /orders/:id/payments - Delete payment
router.delete(
   "/:id/payments",
   validate({ params: z.object({ id: z.string().transform(Number).pipe(z.number().positive()) }) }),
   authMiddleware,
   controllers.orders.removePayment
);

// DELETE /orders/:id - Delete order
router.delete("/:id", authMiddleware, controllers.orders.delete);

export default router;
