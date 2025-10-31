import { Request, Response } from "express";
import { pricingService } from "../services/pricing.service";

export const shippingRatesController = {
   create: async (req: Request, res: Response) => {
      const {
         product_id,
         name,
         buyer_agency_id,
         seller_agency_id,
         service_id,
         price_in_cents,
         cost_in_cents,
         is_active,
      } = req.body;

      const result = await pricingService.createPricingWithRate({
         product_id,
         name,
         buyer_agency_id,
         seller_agency_id,
         service_id,
         price_in_cents,
         cost_in_cents,
         is_active,
      });
      res.status(201).json({
         message: "Shipping rate created successfully",
         data: result,
      });
   },
   getByServiceIdAndAgencyId: async (req: Request, res: Response) => {
      const { service_id, agency_id } = req.params;
      const result = await pricingService.getRatesByServiceIdAndAgencyId(Number(service_id), Number(agency_id));
      res.status(200).json(result);
   },
   //create a rate for the current agency and is child of the parent agency
};
