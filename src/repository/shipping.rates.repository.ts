import prisma from "../config/prisma_db";
import { AgencyType, Prisma, RateType } from "@prisma/client";
import agencies from "./agencies.repository";

interface CreateBaseRateData {
   name: string;
   description: string;
   service_id: number;
   cost_in_cents: number;
   rate_in_cents: number;
   rate_type: RateType;
   min_weight: number;
   max_weight: number;
}

export const shippingRates = {
   createBaseRateForForwarderAndChildren: async (
      forwarderAgencyId: number,
      rateData: CreateBaseRateData
   ): Promise<{ baseRate: any; childRates: any[] }> => {
      // Get the forwarder agency
      const forwarderAgency = await prisma.agency.findUnique({
         where: { id: forwarderAgencyId },
      });

      if (!forwarderAgency || forwarderAgency.agency_type !== "FORWARDER") {
         throw new Error("Agency not found or is not a forwarder");
      }

      // Get all child agencies recursively
      const childAgencyIds = await agencies.getAllChildrenRecursively(forwarderAgencyId);

      // Use transaction to ensure all rates are created atomically
      const result = await prisma.$transaction(async (tx) => {
         // Create the base rate for the forwarder
         const baseRate = await tx.shippingRate.create({
            data: {
               agency_id: forwarderAgencyId,
               name: rateData.name,
               description: rateData.description,
               service_id: rateData.service_id,
               cost_in_cents: rateData.cost_in_cents,
               rate_in_cents: rateData.rate_in_cents,
               rate_type: rateData.rate_type,
               forwarder_id: forwarderAgency.forwarder_id,
               is_base_rate: forwarderAgency.agency_type === AgencyType.FORWARDER ? true : false,
               min_weight: rateData.min_weight,
               max_weight: rateData.max_weight,
               is_active: true,
            },
         });

         // Create rates for all child agencies
         const childRates = await Promise.all(
            childAgencyIds.map(async (childAgencyId) => {
               // Get child agency details
               const childAgency = await tx.agency.findUnique({
                  where: { id: childAgencyId },
               });

               if (!childAgency) {
                  throw new Error(`Child agency with id ${childAgencyId} not found`);
               }

               // Calculate child rate based on commission
               const commissionRate = childAgency.commission_rate || 0;
               const childRateInCents = Math.round(rateData.rate_in_cents * (1 + commissionRate / 100));

               return tx.shippingRate.create({
                  data: {
                     agency_id: childAgencyId,
                     name: rateData.name,
                     description: rateData.description,
                     service_id: rateData.service_id,
                     cost_in_cents: rateData.rate_in_cents, // Child's cost is parent's rate
                     rate_in_cents: childRateInCents, // Child's rate includes commission
                     rate_type: rateData.rate_type,
                     forwarder_id: forwarderAgency.forwarder_id,
                     is_base_rate: false,
                     parent_rate_id: baseRate.id, // Link to parent rate
                     min_weight: rateData.min_weight,
                     max_weight: rateData.max_weight,
                     is_active: true,
                  },
               });
            })
         );

         return { baseRate, childRates };
      });

      return result;
   },

   updateBaseRate: async (rateId: number, updateData: Prisma.ShippingRateUpdateInput) => {
      // Use transaction to ensure all updates are atomic
      const result = await prisma.$transaction(async (tx) => {
         // Verify if rate is base rate
         const rate = await tx.shippingRate.findUnique({
            where: { id: rateId },
         });

		 console.log(rate, "rate");
         if (!rate || rate.is_base_rate !== true) {
            throw new Error("Rate is not a base rate");
         }

         // Get all child rates
         const childRates = await tx.shippingRate.findMany({
            where: { parent_rate_id: rateId },
         });

         // Update base rate
         const updatedBaseRate = await tx.shippingRate.update({
            where: { id: rateId },
            data: updateData,
         });

         // Update all child rates with the same data
         const updatedChildRates = await Promise.all(
            childRates.map(async (childRate) => {
               return tx.shippingRate.update({
                  where: { id: childRate.id },
                  data: updateData,
               });
            })
         );

         return { updatedBaseRate, updatedChildRates };
      });

      return result;
   },

  /*  getRatesByAgencyAndService: async (agencyId: number, serviceId: number) => {
      const rates = await prisma.shippingRate.findMany({
         where: {
            agency_id: agencyId,
            service_id: serviceId,
            is_active: true,
         },
         include: {
            forwarder: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });
      return rates;
   }, */

   updateRate: async (rateId: number, updateData: Prisma.ShippingRateUpdateInput) => {
      const updatedRate = await prisma.shippingRate.update({
         where: { id: rateId },
         data: updateData,
      });
      return updatedRate;
   },

   deleteRate: async (rateId: number) => {
      // Use transaction to ensure deletion is atomic
      const result = await prisma.$transaction(async (tx) => {
         // First check if this is a base rate and has children
         const rate = await tx.shippingRate.findUnique({
            where: { id: rateId },
            include: {
               child_rates: true,
            },
         });

         if (!rate) {
            throw new Error("Rate not found");
         }

         // If it's a base rate with children, delete all child rates first
         if (rate.is_base_rate && rate.child_rates.length > 0) {
            await tx.shippingRate.deleteMany({
               where: { parent_rate_id: rateId },
            });
         }

         // Then delete the base rate
         const deletedRate = await tx.shippingRate.delete({
            where: { id: rateId },
         });

         return deletedRate;
      });

      return result;
   },
};

export default shippingRates;
