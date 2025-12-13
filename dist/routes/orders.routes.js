"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const express_1 = require("express");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const controllers_1 = __importDefault(require("../controllers"));
const types_1 = require("../types/types");
const router = (0, express_1.Router)();
// GET /orders/:id/pdf - Get order PDF
router.get("/:id/pdf", controllers_1.default.orders.generateOrderPdf);
router.get("/:id/labels-pdf", controllers_1.default.orders.generateOrderLabelsPdf);
router.get("/:id/hbls-pdf", controllers_1.default.orders.generateOrderHblPdf);
// GET /orders - List and search orders (RESTful pattern)
router.get("/", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({ query: types_1.searchSchema }), controllers_1.default.orders.search);
// GET /orders/:id - Get order by ID
router.get("/:id", auth_middleware_1.authMiddleware, controllers_1.default.orders.getById);
// POST /orders - Create new order
router.post("/", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({ body: types_1.createOrderSchema }), controllers_1.default.orders.create);
// POST /orders/:id/discounts - Add discount to order (MUST be before /:id routes)
router.post("/:id/discounts", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    body: types_1.discountSchema,
    params: zod_1.z.object({ id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()) }),
}), controllers_1.default.orders.addDiscount);
// DELETE /orders/:id/discounts/:discount_id - Delete discount from order
router.delete("/:id/discounts", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    params: zod_1.z.object({
        id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()),
    }),
}), controllers_1.default.orders.removeDiscount);
// POST /orders/:id/payments - Create new payment
router.post("/:id/payments", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({
    body: types_1.paymentSchema,
    params: zod_1.z.object({ id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()) }),
}), controllers_1.default.orders.payOrder);
// DELETE /orders/:id/payments - Delete payment
router.delete("/:id/payments", (0, validate_middleware_1.validate)({ params: zod_1.z.object({ id: zod_1.z.string().transform(Number).pipe(zod_1.z.number().positive()) }) }), auth_middleware_1.authMiddleware, controllers_1.default.orders.removePayment);
// DELETE /orders/:id - Delete order
router.delete("/:id", auth_middleware_1.authMiddleware, controllers_1.default.orders.delete);
exports.default = router;
