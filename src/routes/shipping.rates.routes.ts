import { z } from "zod";
import { Router } from "express";
import { Unit } from "@prisma/client";
import { shippingRatesController } from "../controllers/shipping.rates.controller";
import { validate } from "../middlewares/validate.middleware";

export const shippingRatesRoutes = Router();

const createShippingRateSchema = z.object({
   product_id: z.number(),
   name: z.string(),
   description: z.string(),
   buyer_agency_id: z.number(),
   seller_agency_id: z.number(),
   service_id: z.number(),
   price_in_cents: z.number(),
   cost_in_cents: z.number(),
   is_active: z.boolean(),
   unit: z.nativeEnum(Unit),
   min_weight: z.number(),
   max_weight: z.number(),
});

shippingRatesRoutes.post("/", validate({ body: createShippingRateSchema }), shippingRatesController.create);
export default shippingRatesRoutes;
