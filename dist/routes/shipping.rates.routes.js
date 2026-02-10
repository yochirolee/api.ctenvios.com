"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shippingRatesRoutes = void 0;
const zod_1 = require("zod");
const express_1 = require("express");
const controllers_1 = __importDefault(require("../controllers"));
const validate_middleware_1 = require("../middlewares/validate.middleware");
exports.shippingRatesRoutes = (0, express_1.Router)();
const createShippingRateSchema = zod_1.z
    .object({
    product_id: zod_1.z.number(),
    buyer_agency_id: zod_1.z.number(),
    seller_agency_id: zod_1.z.number(),
    service_id: zod_1.z.number(),
    price_in_cents: zod_1.z.number(),
    cost_in_cents: zod_1.z.number(),
    min_weight: zod_1.z.number().optional(),
    max_weight: zod_1.z.number().optional(),
    is_active: zod_1.z.boolean().optional().default(true),
})
    .refine((data) => data.price_in_cents >= data.cost_in_cents, {
    message: "Price must be greater than or equal to cost",
    path: ["price_in_cents"],
});
// Update schema - prices only, is_active is now a separate endpoint
const updateShippingRateSchema = zod_1.z
    .object({
    price_in_cents: zod_1.z.number().min(0, "Price in cents must be greater than 0"),
    cost_in_cents: zod_1.z.number().min(0, "Cost in cents must be greater than 0").optional(),
    min_weight: zod_1.z.number().optional(),
    max_weight: zod_1.z.number().optional(),
})
    .refine((data) => !data.cost_in_cents || data.price_in_cents >= data.cost_in_cents, {
    message: "Price must be greater than or equal to cost",
    path: ["price_in_cents"],
});
// Change status schema
const toggleStatusSchema = zod_1.z.object({
    is_active: zod_1.z.boolean(),
});
// Routes
exports.shippingRatesRoutes.post("/", (0, validate_middleware_1.validate)({ body: createShippingRateSchema }), controllers_1.default.shippingRates.create);
exports.shippingRatesRoutes.get("/service/:service_id/agency/:agency_id", controllers_1.default.shippingRates.getByServiceIdAndAgencyId);
exports.shippingRatesRoutes.put("/:id", (0, validate_middleware_1.validate)({ body: updateShippingRateSchema }), controllers_1.default.shippingRates.update);
exports.shippingRatesRoutes.patch("/:id/change-status", (0, validate_middleware_1.validate)({ body: toggleStatusSchema }), controllers_1.default.shippingRates.toggleStatus);
exports.default = exports.shippingRatesRoutes;
