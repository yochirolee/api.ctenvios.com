import prisma from "../config/prisma_db";
import AppError from "./app.error";
import { CityType } from "@prisma/client";

/**
 * Delivery Fee Calculator - Hybrid system with city-specific and city_type rates
 *
 * Business Rules:
 * - Delivery fees only apply if order.requires_home_delivery = true
 * - PRIORITY 1: City-specific rates (e.g., "Los Palacios" = $12)
 * - PRIORITY 2: City type rates (e.g., all CITY tier = $15)
 * - Agencies can override forwarder's delivery rates (hierarchical inheritance)
 * - Returns rate_in_cents (what customer pays)
 *
 * Example use case:
 * - Default: All CITY type cities in Pinar del Rio = $15
 * - Exception: Carrier raises price for "Los Palacios" specifically = $12
 * - Exception: Carrier raises price for "Viñales" specifically = $18
 *
 * Following: TypeScript strict typing, Functional programming, No try/catch
 */

interface DeliveryFeeResult {
   rate_in_cents: number;
   cost_in_cents: number;
   is_inherited: boolean;
   source_agency_id: number | null;
}

/**
 * Resolves effective delivery rate for an agency using hierarchical inheritance
 * Supports hybrid system: city-specific rates take precedence over city_type rates
 */
const resolveEffectiveDeliveryRate = async (
   agency_id: number,
   carrier_id: number,
   city_id: number,
   city_type: CityType
): Promise<DeliveryFeeResult> => {
   // PRIORITY 1: Try city-specific rate for this agency
   const citySpecificRate = await prisma.deliveryRate.findFirst({
      where: {
         agency_id,
         carrier_id,
         city_id,
         is_active: true,
      },
   });

   if (citySpecificRate) {
      return {
         rate_in_cents: citySpecificRate.rate_in_cents,
         cost_in_cents: citySpecificRate.cost_in_cents,
         is_inherited: false,
         source_agency_id: agency_id,
      };
   }

   // PRIORITY 2: Try city_type-based rate for this agency
   const typeBasedRate = await prisma.deliveryRate.findFirst({
      where: {
         agency_id,
         carrier_id,
         city_type,
         city_id: null, // Type-based rates don't have specific city
         is_active: true,
      },
   });

   if (typeBasedRate) {
      return {
         rate_in_cents: typeBasedRate.rate_in_cents,
         cost_in_cents: typeBasedRate.cost_in_cents,
         is_inherited: false,
         source_agency_id: agency_id,
      };
   }

   // No customized rate found, climb up the hierarchy
   const agency = await prisma.agency.findUnique({
      where: { id: agency_id },
      select: {
         parent_agency_id: true,
         forwarder_id: true,
      },
   });

   if (!agency) {
      throw new AppError(`Agency with ID ${agency_id} not found`, 404);
   }

   // If agency has a parent, recursively resolve from parent
   if (agency.parent_agency_id) {
      const parentRate = await resolveEffectiveDeliveryRate(agency.parent_agency_id, carrier_id, city_id, city_type);

      return {
         ...parentRate,
         is_inherited: true,
      };
   }

   // If no parent, this must be a forwarder agency - get base rates
   // PRIORITY 1: City-specific base rate
   const citySpecificBaseRate = await prisma.deliveryRate.findFirst({
      where: {
         forwarder_id: agency.forwarder_id,
         carrier_id,
         city_id,
         is_base_rate: true,
         is_active: true,
         agency_id: null,
      },
   });

   if (citySpecificBaseRate) {
      return {
         rate_in_cents: citySpecificBaseRate.rate_in_cents,
         cost_in_cents: citySpecificBaseRate.cost_in_cents,
         is_inherited: true,
         source_agency_id: null,
      };
   }

   // PRIORITY 2: City type base rate
   const typeBaseRate = await prisma.deliveryRate.findFirst({
      where: {
         forwarder_id: agency.forwarder_id,
         carrier_id,
         city_type,
         city_id: null,
         is_base_rate: true,
         is_active: true,
         agency_id: null,
      },
   });

   if (!typeBaseRate) {
      throw new AppError(
         `No base delivery rate found for carrier ${carrier_id}, city ${city_id} or city type ${city_type}`,
         404
      );
   }

   return {
      rate_in_cents: typeBaseRate.rate_in_cents,
      cost_in_cents: typeBaseRate.cost_in_cents,
      is_inherited: true,
      source_agency_id: null,
   };
};

/**
 * Calculates total delivery fee for an order
 *
 * @param receiver_id - ID of the receiver (determines city_id and city_type)
 * @param service_id - ID of the service (determines carrier)
 * @param agency_id - ID of the agency (for rate resolution)
 * @param requires_home_delivery - Whether customer wants home delivery
 * @returns Total delivery fee in cents (0 if pickup)
 */
export const calculateDeliveryFee = async ({
   receiver_id,
   service_id,
   agency_id,
   requires_home_delivery,
}: {
   receiver_id: number;
   service_id: number;
   agency_id: number;
   requires_home_delivery: boolean;
}): Promise<number> => {
   // If customer doesn't want home delivery (pickup), no fee
   if (!requires_home_delivery) {
      return 0;
   }

   // Get receiver's city to determine both city_id and city_type
   const receiver = await prisma.receiver.findUnique({
      where: { id: receiver_id },
      select: {
         city_id: true,
         city: {
            select: {
               city_type: true,
            },
         },
      },
   });

   if (!receiver) {
      throw new AppError(`Receiver with ID ${receiver_id} not found`, 404);
   }

   // Get service's carrier
   const service = await prisma.service.findUnique({
      where: { id: service_id },
      select: {
         carrier_id: true,
      },
   });

   if (!service) {
      throw new AppError(`Service with ID ${service_id} not found`, 404);
   }

   if (!service.carrier_id) {
      // No carrier assigned to service, no delivery fee
      return 0;
   }

   // Resolve effective delivery rate for this agency (checks city-specific first, then city_type)
   const deliveryRate = await resolveEffectiveDeliveryRate(
      agency_id,
      service.carrier_id,
      receiver.city_id,
      receiver.city.city_type
   );

   // Return the rate customer pays (not the cost)
   return deliveryRate.rate_in_cents;
};

/**
 * Calculates heavy item handling charge
 *
 * Business Rule: Items > 100 lbs require 30 USD handling fee if home delivery requested
 *
 * @param weight - Item weight in pounds
 * @param requires_home_delivery - Whether customer wants home delivery
 * @returns Handling charge in cents (3000 = 30 USD, or 0)
 */
export const calculateHeavyItemCharge = (weight: number, requires_home_delivery: boolean): number => {
   const HEAVY_ITEM_THRESHOLD = 100; // lbs
   const HEAVY_ITEM_FEE = 3000; // 30 USD in cents

   if (!requires_home_delivery) {
      return 0;
   }

   if (weight > HEAVY_ITEM_THRESHOLD) {
      return HEAVY_ITEM_FEE;
   }

   return 0;
};

export const calculateTotalDeliveryFee = (province: string, city: string) => {
   // calculate the total delivery fee from the receiver province and city
   //if province name is equal to La Habana, Artemisa or Mayabeque the delivery fee is 6000
   //if province name is equal to City name, then the city is capital and the delivery fee is 1200
   //if not return 18000

   if (province === "La Habana" || province === "Artemisa" || province === "Mayabeque") {
      return 600;
   }
   if (city === province) {
      return 1200;
   }
   if (city === "Santa Clara" || city === "Bayamo") {
      return 1200;
   }
   return 1800;
};
