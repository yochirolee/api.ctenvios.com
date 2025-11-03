import { PricingAgreement, ShippingRate, RateScope } from "@prisma/client";
import prisma from "../config/prisma_db";
import AppError from "../utils/app.error";
import { CreatePricingInput } from "../types/types";
import StatusCodes from "../common/https-status-codes";

interface PricingResult {
   agreement: PricingAgreement;
   rate: ShippingRate;
   is_internal: boolean;
}

export const pricingService = {
   getRatesByServiceIdAndAgencyId: async (service_id: number, agency_id: number): Promise<any[]> => {
      const rates = await prisma.shippingRate.findMany({
         where: { service_id, agency_id },
         select: {
            id: true,
            price_in_cents: true,
            is_active: true,
            product: {
               select: {
                  id: true,
                  name: true,
                  description: true,
                  unit: true,
               },
            },
            pricing_agreement: {
               select: {
                  id: true,

                  price_in_cents: true,
               },
            },
         },
      });
      if (rates.length === 0) {
         return [];
      }
      return rates.map((rate) => {
         return {
            id: rate.id,
            name: rate.product.name,
            description: rate.product.description,
            unit: rate.product.unit,
            price_in_cents: rate.price_in_cents,
            cost_in_cents: rate.pricing_agreement.price_in_cents,
            is_active: rate.is_active,
         };
      });
   },
   /**
    * Creates a PricingAgreement and associated ShippingRate atomically
    * Handles both external agreements (seller != buyer) and internal agreements (seller == buyer)
    */
   createPricingWithRate: async (input: CreatePricingInput): Promise<PricingResult> => {
      const {
         product_id,
         service_id,
         seller_agency_id,
         buyer_agency_id,
         cost_in_cents,
         price_in_cents,
         is_active = true,
      } = input;

      // Validate required fields
      if (!product_id || !service_id || !seller_agency_id || !buyer_agency_id) {
         throw new AppError("Missing required fields", StatusCodes.BAD_REQUEST);
      }

      if (cost_in_cents === undefined || cost_in_cents < 0) {
         throw new AppError("cost_in_cents must be a non-negative number", StatusCodes.BAD_REQUEST);
      }

      if (price_in_cents === undefined || price_in_cents < 0) {
         throw new AppError("price_in_cents must be a non-negative number", StatusCodes.BAD_REQUEST);
      }

      // Determine if this is an internal agreement
      const is_internal = seller_agency_id === buyer_agency_id;

      // Execute within transaction for atomicity
      const result = await prisma.$transaction(async (tx) => {
         // 1. Validate product exists and is active
         const product = await tx.product.findUnique({
            where: { id: product_id },
            include: { provider: true, service: true },
         });

         if (!product) {
            throw new AppError(`Product with id ${product_id} not found`, StatusCodes.NOT_FOUND);
         }

         if (!product.is_active) {
            throw new AppError(`Product with id ${product_id} is not active`, StatusCodes.BAD_REQUEST);
         }

         // 2. Validate service exists
         const service = await tx.service.findUnique({
            where: { id: service_id },
         });

         if (!service) {
            throw new AppError(`Service with id ${service_id} not found`, StatusCodes.NOT_FOUND);
         }

         if (!service.is_active) {
            throw new AppError(`Service with id ${service_id} is not active`, StatusCodes.BAD_REQUEST);
         }

         // 3. Validate seller agency exists
         const sellerAgency = await tx.agency.findUnique({
            where: { id: seller_agency_id },
         });

         if (!sellerAgency) {
            throw new AppError(`Seller agency with id ${seller_agency_id} not found`, StatusCodes.NOT_FOUND);
         }

         // 4. Validate buyer agency exists
         const buyerAgency = await tx.agency.findUnique({
            where: { id: buyer_agency_id },
         });

         if (!buyerAgency) {
            throw new AppError(`Buyer agency with id ${buyer_agency_id} not found`, StatusCodes.NOT_FOUND);
         }

         // 5. Check for existing PricingAgreement (handle unique constraint)
         const existingAgreement = await tx.pricingAgreement.findUnique({
            where: {
               seller_agency_id_buyer_agency_id_product_id_service_id: {
                  seller_agency_id,
                  buyer_agency_id,
                  product_id,
                  service_id,
               },
            },
         });

         if (existingAgreement) {
            throw new AppError(
               `Pricing agreement already exists for seller ${seller_agency_id}, buyer ${buyer_agency_id}, and product ${product_id}`,
               StatusCodes.CONFLICT
            );
         }

         // 6. Create PricingAgreement
         const agreement = await tx.pricingAgreement.create({
            data: {
               seller_agency_id,
               buyer_agency_id,
               product_id,
               service_id,
               price_in_cents: cost_in_cents, // cost_in_cents becomes the agreement price
               is_active,
               effective_from: new Date(),
            },
         });

         // 7. Create ShippingRate linked to the agreement
         const rate = await tx.shippingRate.create({
            data: {
               product_id,
               service_id,
               agency_id: buyer_agency_id, // Buyer agency uses this rate
               pricing_agreement_id: agreement.id,
               scope: RateScope.PUBLIC,
               price_in_cents, // Selling price for the buyer agency
               effective_from: new Date(),
               is_active,
            },
         });

         return { agreement, rate, is_internal };
      });

      return result;
   },


   /**
    * Gets all pricing agreements for a specific product
    */
   getProductPricing: async (product_id: number): Promise<any[]> => {
      const agreements = await prisma.pricingAgreement.findMany({
         where: { product_id },
         include: {
            product: true,
            service: true,
            shipping_rates: {
               include: {
                  agency: true,
                  tiers: true,
               },
            },
         },
         orderBy: { created_at: "desc" },
      });

      return agreements;
   },

   /**
    * Gets pricing agreements for a specific agency (as buyer or seller)
    */
   getAgencyPricing: async (agency_id: number, role: "buyer" | "seller" = "buyer"): Promise<any[]> => {
      const where_clause = role === "buyer" ? { buyer_agency_id: agency_id } : { seller_agency_id: agency_id };

      const agreements = await prisma.pricingAgreement.findMany({
         where: where_clause,
         include: {
            product: true,
            service: true,
            shipping_rates: {
               include: {
                  agency: true,
                  tiers: true,
               },
            },
         },
         orderBy: { created_at: "desc" },
      });

      return agreements;
   },
};
