import prisma from "../config/prisma_db";
import { Prisma, RateType } from "@prisma/client";
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
   ): Promise<{ baseRate: any; forwarderRate: any; childRates: any[] }> => {
      // Get the forwarder agency
      const forwarderAgency = await prisma.agency.findUnique({
         where: { id: forwarderAgencyId },
      });

      if (!forwarderAgency || forwarderAgency.agency_type !== "FORWARDER") {
         throw new Error("Agency not found or is not a forwarder");
      }

      // Get all child agencies recursively
      const childAgencyIds = await agencies.getAllChildrenRecursively(forwarderAgencyId);

      console.log(`🔍 Forwarder Agency ID: ${forwarderAgencyId}`);
      console.log(`🔍 Found ${childAgencyIds.length} child agencies:`, childAgencyIds);

      // Use transaction to ensure all rates are created atomically
      const result = await prisma.$transaction(async (tx) => {
         // 1. Create the base rate (no agency_id - base rates are templates)
         const baseRate = await tx.shippingRate.create({
            data: {
               agency_id: null, // Base rates don't belong to an agency
               name: rateData.name,
               description: rateData.description,
               service_id: rateData.service_id,
               cost_in_cents: rateData.cost_in_cents,
               rate_in_cents: rateData.rate_in_cents,
               rate_type: rateData.rate_type,
               forwarder_id: forwarderAgency.forwarder_id,
               is_base_rate: true, // Always true for base rates
               min_weight: rateData.min_weight,
               max_weight: rateData.max_weight,
               is_active: true,
            },
         });

         // 2. Create rate for the forwarder agency itself (same as base rate)
         const forwarderRate = await tx.shippingRate.create({
            data: {
               agency_id: forwarderAgencyId,
               name: rateData.name,
               description: rateData.description,
               service_id: rateData.service_id,
               cost_in_cents: rateData.cost_in_cents, // Same cost as base
               rate_in_cents: rateData.rate_in_cents, // Same rate as base
               rate_type: rateData.rate_type,
               forwarder_id: forwarderAgency.forwarder_id,
               is_base_rate: false,
               parent_rate_id: baseRate.id, // Link to base rate
               min_weight: rateData.min_weight,
               max_weight: rateData.max_weight,
               is_active: false,
            },
         });

         // 3. Create rates for all child agencies (cascaded from forwarder rate)
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
                     cost_in_cents: rateData.rate_in_cents, // Child's cost is forwarder's rate
                     rate_in_cents: childRateInCents, // Child's rate includes commission
                     rate_type: rateData.rate_type,
                     forwarder_id: forwarderAgency.forwarder_id,
                     is_base_rate: false,
                     parent_rate_id: forwarderRate.id, // Link to forwarder rate (not base!)
                     min_weight: rateData.min_weight,
                     max_weight: rateData.max_weight,
                     is_active: false, // 🔒 Inactive by default - admin must activate
                  },
               });
            })
         );

         return { baseRate, forwarderRate, childRates };
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

   getById: async (rateId: number) => {
      const rate = await prisma.shippingRate.findUnique({
         where: { id: rateId },
         select: {
            id: true,
            name: true,
            rate_in_cents: true,
            cost_in_cents: true,
            rate_type: true,
            is_active: true,
            min_weight: true,
            max_weight: true,
         },
      });
      return rate;
   },
   getRates: async (agencyId: number, serviceId?: number) => {
      // Build dynamic where clause
      const whereClause: Prisma.ShippingRateWhereInput = {
         agency_id: agencyId,
         is_active: true, // Only return active rates
      };

      // Add service_id filter only if provided
      if (serviceId !== undefined && !isNaN(serviceId)) {
         whereClause.service_id = serviceId;
      }

      const rates = await prisma.shippingRate.findMany({
         select: {
            id: true,
            name: true,
            description: true,
            rate_in_cents: true,
            cost_in_cents: true,
            rate_type: true,
            is_active: true,
         },
         where: whereClause,
         orderBy: [{ service_id: "asc" }, { min_weight: "asc" }],
      });
      return rates;
   },

   /**
    * Creates rates for a new agency based on parent's rates or base rates
    * - If agency has parent: Copy parent's rates
    * - If agency has no parent: Copy base rates from forwarder
    * - All rates are created as INACTIVE by default
    * - Applies commission_rate to calculate child rate_in_cents
    * - Can accept external transaction context for atomic operations
    */
   createRatesForNewAgency: async (
      newAgencyId: number,
      parentAgencyId: number | null,
      forwarderId: number,
      commissionRate: number = 0,
      tx?: any // Optional transaction context
   ): Promise<{ createdRates: any[] }> => {
      const executeRateCreation = async (txContext: any) => {
         let ratesToCopy: any[] = [];

         if (parentAgencyId) {
            // Copy from parent agency
            ratesToCopy = await txContext.shippingRate.findMany({
               where: {
                  agency_id: parentAgencyId,
               },
            });

            console.log(`📋 Copying ${ratesToCopy.length} rates from parent agency ${parentAgencyId}`);
         } else {
            // Copy from base rates if no parent
            ratesToCopy = await txContext.shippingRate.findMany({
               where: {
                  forwarder_id: forwarderId,
                  is_base_rate: true,
               },
            });

            console.log(`📋 Copying ${ratesToCopy.length} base rates for new root agency`);
         }

         if (ratesToCopy.length === 0) {
            console.log(`⚠️ No rates found to copy for agency ${newAgencyId}`);
            return { createdRates: [] };
         }

         // Create rates for new agency
         const createdRates = await Promise.all(
            ratesToCopy.map(async (parentRate) => {
               // Calculate new rate based on commission
               // cost = parent's rate (what they pay to parent)
               // rate = cost + commission (what they charge customers)
               const childCostInCents = parentRate.rate_in_cents;
               const childRateInCents = Math.round(childCostInCents * (1 + commissionRate / 100));

               return txContext.shippingRate.create({
                  data: {
                     agency_id: newAgencyId,
                     name: parentRate.name,
                     description: parentRate.description,
                     service_id: parentRate.service_id,
                     cost_in_cents: childCostInCents, // Parent's rate becomes child's cost
                     rate_in_cents: childRateInCents, // Child's rate with commission
                     rate_type: parentRate.rate_type,
                     forwarder_id: forwarderId,
                     is_base_rate: false,
                     parent_rate_id: parentRate.id, // Link to parent rate
                     min_weight: parentRate.min_weight,
                     max_weight: parentRate.max_weight,
                     length: parentRate.length,
                     width: parentRate.width,
                     height: parentRate.height,
                     is_active: false, // 🔒 Inactive by default - admin must activate
                  },
               });
            })
         );

         console.log(`✅ Created ${createdRates.length} rates for new agency ${newAgencyId}`);

         return { createdRates };
      };

      // If transaction context provided, use it; otherwise create new transaction
      if (tx) {
         return executeRateCreation(tx);
      } else {
         return prisma.$transaction(async (newTx) => executeRateCreation(newTx));
      }
   },
};

export default shippingRates;
