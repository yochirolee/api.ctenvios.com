import { z } from "zod";
import { Router } from "express";
import controllers from "../controllers";
import { validate } from "../middlewares/validate.middleware";

export const shippingRatesRoutes = Router();

const createShippingRateSchema = z
   .object({
      product_id: z.number(),
      buyer_agency_id: z.number(),
      seller_agency_id: z.number(),
      service_id: z.number(),
      price_in_cents: z.number(),
      cost_in_cents: z.number(),
      min_weight: z.number().optional(),
      max_weight: z.number().optional(),
      is_active: z.boolean().optional().default(true),
   })
   .refine((data) => data.price_in_cents >= data.cost_in_cents, {
      message: "Price must be greater than or equal to cost",
      path: ["price_in_cents"],
   });

const updateShippingRateSchema = z
   .object({
      price_in_cents: z.number().min(0, "Price in cents must be greater than 0"),
      cost_in_cents: z.number().min(0, "Cost in cents must be greater than 0"),
      min_weight: z.number().optional(),
      max_weight: z.number().optional(),
      is_active: z.boolean().optional().default(true),
   })
   .refine((data) => data.price_in_cents >= data.cost_in_cents, {
      message: "Price must be greater than or equal to cost",
      path: ["price_in_cents"],
   });
shippingRatesRoutes.post("/", validate({ body: createShippingRateSchema }), controllers.shippingRates.create);
shippingRatesRoutes.get("/service/:service_id/agency/:agency_id", controllers.shippingRates.getByServiceIdAndAgencyId);
shippingRatesRoutes.put("/:id", validate({ body: updateShippingRateSchema }), controllers.shippingRates.update);
export default shippingRatesRoutes;
