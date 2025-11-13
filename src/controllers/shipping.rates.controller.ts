import { Request, Response } from "express";
import { pricingService } from "../services/pricing.service";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../config/prisma_db";

const shippingRates = {
   create: async (req: Request, res: Response) => {
      const { product_id, buyer_agency_id, seller_agency_id, service_id, price_in_cents, cost_in_cents, is_active } =
         req.body;

      // Create pricing agreement and rate in a transaction (implemented in pricingService)
      const result = await pricingService.createPricingWithRate({
         product_id,
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
   update: async (req: Request, res: Response) => {
      const { id } = req.params;
      const { price_in_cents, cost_in_cents, is_active } = req.body;

      // Execute update in a transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
         // 1. Update the shipping rate
         const shippingRate = await tx.shippingRate.update({
            where: { id: Number(id) },
            data: {
               price_in_cents,
               is_active,
            },
         });

         // 2. Find and validate the pricing agreement
         const agreement = await tx.pricingAgreement.findUnique({
            where: {
               id: shippingRate.pricing_agreement_id,
            },
         });

         if (!agreement) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Agreement not found");
         }

         // 3. Update the pricing agreement cost
         const pricingAgreement = await tx.pricingAgreement.update({
            where: {
               id: agreement.id,
            },
            data: {
               price_in_cents: cost_in_cents,
               is_active,
            },
         });

         return {
            shippingRate,
            pricingAgreement,
         };
      });

      res.status(200).json({
         message: "Shipping rate updated successfully",
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

export default shippingRates;
