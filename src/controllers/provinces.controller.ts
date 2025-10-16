import { Request, Response } from "express";
import repository from "../repositories";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import { CityType, Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

interface DeliveryFeeQuery {
   city_id?: string;
   city_name?: string;
   province_id?: string;
   agency_id?: string;
   carrier_id?: string;
}

type CityWithProvince = Prisma.CityGetPayload<{
   include: { province: true };
}>;

interface DeliveryRateResponse {
   city_id: number;
   city_name: string;
   city_type: CityType;
   province_name: string;
   rate_in_cents: number;
   rate_in_usd: number;
   cost_in_cents: number;
   cost_in_usd: number;
   is_inherited: boolean;
   source_agency_id: number | null;
   carrier_name: string;
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
): Promise<{
   rate_in_cents: number;
   cost_in_cents: number;
   is_inherited: boolean;
   source_agency_id: number | null;
}> => {
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
         city_id: null,
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
      throw new AppError(HttpStatusCodes.NOT_FOUND, `Agency with ID ${agency_id} not found`);
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
         HttpStatusCodes.NOT_FOUND,
         `No base delivery rate found for carrier ${carrier_id}, city ${city_id} or city type ${city_type}`
      );
   }

   return {
      rate_in_cents: typeBaseRate.rate_in_cents,
      cost_in_cents: typeBaseRate.cost_in_cents,
      is_inherited: true,
      source_agency_id: null,
   };
};

const provinces = {
   get: async (req: Request, res: Response): Promise<void> => {
      const provinces = await repository.provinces.get();
      res.status(200).json(provinces);
   },

   getDeliveryFee: async (req: Request, res: Response): Promise<void> => {
      const query = req.query as unknown as DeliveryFeeQuery;
      const { city_id, city_name, province_id, agency_id, carrier_id } = query;

      // Validate required parameters
      if (!agency_id || !carrier_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "agency_id and carrier_id are required");
      }

      if (!city_id && !city_name) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Either city_id or city_name is required");
      }

      // Get city information
      let city: CityWithProvince | null = null;
      if (city_id) {
         city = await repository.provinces.getCityById(parseInt(city_id));
      } else if (city_name) {
         city = await repository.provinces.getCityByName(city_name, province_id ? parseInt(province_id) : undefined);
      }

      if (!city) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "City not found");
      }

      // Get carrier information
      const carrier = await prisma.carrier.findUnique({
         where: { id: parseInt(carrier_id) },
      });

      if (!carrier) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Carrier not found");
      }

      // Resolve delivery rate
      const deliveryRate = await resolveEffectiveDeliveryRate(
         parseInt(agency_id),
         parseInt(carrier_id),
         city.id,
         city.city_type
      );

      // Format response
      const response: DeliveryRateResponse = {
         city_id: city.id,
         city_name: city.name,
         city_type: city.city_type,
         province_name: city.province.name,
         rate_in_cents: deliveryRate.rate_in_cents,
         rate_in_usd: deliveryRate.rate_in_cents / 100,
         cost_in_cents: deliveryRate.cost_in_cents,
         cost_in_usd: deliveryRate.cost_in_cents / 100,
         is_inherited: deliveryRate.is_inherited,
         source_agency_id: deliveryRate.source_agency_id,
         carrier_name: carrier.name,
      };

      res.status(200).json(response);
   },
};

export default provinces;
