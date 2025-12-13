"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const repositories_1 = __importDefault(require("../repositories"));
/**
 * Resolves effective delivery rate for an agency using hierarchical inheritance
 * Supports hybrid system: city-specific rates take precedence over city_type rates
 */
/* const resolveEffectiveDeliveryRate = async (
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
}; */
const provinces = {
    get: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const provinces = yield repositories_1.default.provinces.get();
        res.status(200).json(provinces);
    }),
};
exports.default = provinces;
