import { RateType, ShippingRate } from "@prisma/client";
import prisma from "../config/prisma_db";
import AppError from "../utils/app.error";
import repository from "../repositories";

/**
 * Shipping Rates Service - Implements hierarchical rate inheritance system
 *
 * Core Philosophy: "Master Templates" with Selective Override
 * - Forwarders create base rates (is_base_rate = true) that act as templates
 * - Agencies inherit parent rates by default (no DB records needed)
 * - Agencies only create DB records when customizing/overriding a rate
 * - rate_in_cents of parent becomes cost_in_cents of child (price cascade)
 *
 * Following: TypeScript strict typing, Repository pattern, Functional programming
 */

interface RateResolutionResult {
   rate: ShippingRate;
   is_inherited: boolean;
   source_agency_id: number;
   margin_in_cents?: number;
}

interface CreateCustomRateInput {
   parent_rate_id: number;
   agency_id: number;
   rate_in_cents: number;
   description?: string;
}

interface BulkCustomizeRatesInput {
   agency_id: number;
   service_id: number;
   margin_percentage: number; // e.g., 15 for 15% markup
}

interface CreateBaseRateInput {
   name: string;
   description?: string;
   service_id: number;
   forwarder_id: number;
   cost_in_cents: number; // Forwarder's internal cost
   rate_in_cents: number; // Price to direct agencies
   rate_type: RateType;
   min_weight?: number;
   max_weight?: number;
}

export const shippingRatesService = {
   /**
    * 🔥 CORE RESOLVER: Finds the effective rate for an agency by climbing the hierarchy
    *
    * Algorithm:
    * 1. Check if agency has a customized rate for this exact rate configuration
    * 2. If not found, climb up to parent agency and repeat
    * 3. Continue until finding a rate or reaching the base rate
    *
    * @returns The effective rate with metadata about inheritance
    */
   resolveEffectiveRate: async (agency_id: number, service_id: number): Promise<RateResolutionResult[]> => {
      // Build base where clause for rate matching
      const baseWhere: any = {
         service_id,

         is_active: true,
      };

      // Try to find customized rates for this agency
      const customizedRates = await prisma.shippingRate.findMany({
         where: {
            agency_id,
            ...baseWhere,
         },
         orderBy: { id: "asc" },
      });

      if (customizedRates.length > 0) {
         // Agency has customized rates
         return customizedRates.map((rate) => ({
            rate,
            is_inherited: false,
            source_agency_id: agency_id,
            margin_in_cents: rate.rate_in_cents - rate.cost_in_cents,
         }));
      }

      // No customized rates found, climb up the hierarchy
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
         const parentRates = await shippingRatesService.resolveEffectiveRate(agency.parent_agency_id, service_id);

         return parentRates.map((result) => ({
            ...result,
            is_inherited: true,
         }));
      }

      // If no parent, this must be a forwarder agency - get base rates
      const baseRates = await prisma.shippingRate.findMany({
         where: {
            forwarder_id: agency.forwarder_id,
            is_base_rate: true,
            ...baseWhere,
         },
         orderBy: { id: "asc" },
      });

      if (baseRates.length === 0) {
         throw new AppError(`No base rates found for service ${service_id}`, 404);
      }

      return baseRates.map((rate) => ({
         rate,
         is_inherited: true,
         source_agency_id: agency_id,
         margin_in_cents: rate.rate_in_cents - rate.cost_in_cents,
      }));
   },

   /**
    * Creates a base rate (master template) - Only for Forwarders
    */
   createBaseRate: async (input: CreateBaseRateInput): Promise<ShippingRate> => {
      // Validate that the forwarder exists
      const forwarder = await prisma.forwarder.findUnique({
         where: { id: input.forwarder_id },
      });

      if (!forwarder) {
         throw new AppError(`Forwarder with ID ${input.forwarder_id} not found`, 404);
      }

      // Validate service belongs to forwarder
      const service = await prisma.service.findFirst({
         where: {
            id: input.service_id,
            forwarder_id: input.forwarder_id,
         },
      });

      if (!service) {
         throw new AppError(`Service ${input.service_id} not found for forwarder ${input.forwarder_id}`, 404);
      }

      // Create base rate
      const baseRate = await prisma.shippingRate.create({
         data: {
            name: input.name,
            description: input.description,
            service_id: input.service_id,
            forwarder_id: input.forwarder_id,
            cost_in_cents: input.cost_in_cents,
            rate_in_cents: input.rate_in_cents,
            rate_type: input.rate_type,
            min_weight: input.min_weight,
            max_weight: input.max_weight,
            is_base_rate: true,
            is_active: true,
            parent_rate_id: null,
            agency_id: null, // Base rates don't belong to an agency
         },
      });

      return baseRate;
   },

   /**
    * Creates a customized rate for an agency
    * - Validates parent rate exists
    * - Sets cost_in_cents = parent's rate_in_cents (price cascade)
    * - Validates agency is in the hierarchy chain
    */
   createCustomRate: async (input: CreateCustomRateInput): Promise<ShippingRate> => {
      // Get parent rate with validation
      const parentRate = await prisma.shippingRate.findUnique({
         where: { id: input.parent_rate_id },
         include: {
            agency: true,
         },
      });

      if (!parentRate) {
         throw new AppError(`Parent rate with ID ${input.parent_rate_id} not found`, 404);
      }

      if (!parentRate.is_active) {
         throw new AppError(`Parent rate with ID ${input.parent_rate_id} is not active`, 400);
      }

      // Get agency with its hierarchy
      const agency = await prisma.agency.findUnique({
         where: { id: input.agency_id },
         include: {
            parent_agency: true,
         },
      });

      if (!agency) {
         throw new AppError(`Agency with ID ${input.agency_id} not found`, 404);
      }

      // Validate rate_in_cents is greater than cost (parent's rate)
      if (input.rate_in_cents <= parentRate.rate_in_cents) {
         throw new AppError(
            `Custom rate (${input.rate_in_cents}) must be greater than parent rate (${parentRate.rate_in_cents})`,
            400
         );
      }

      // Check if custom rate already exists for this parent and agency
      const existingCustomRate = await prisma.shippingRate.findFirst({
         where: {
            parent_rate_id: input.parent_rate_id,
            agency_id: input.agency_id,
         },
      });

      if (existingCustomRate) {
         throw new AppError(`Custom rate already exists for this agency and parent rate. Use update instead.`, 409);
      }

      // Create custom rate with price cascade
      const customRate = await prisma.shippingRate.create({
         data: {
            name: input.description || parentRate.name,
            description: input.description || parentRate.description,
            service_id: parentRate.service_id,
            agency_id: input.agency_id,
            forwarder_id: parentRate.forwarder_id,
            parent_rate_id: input.parent_rate_id,
            cost_in_cents: parentRate.rate_in_cents, // 🔥 Price cascade: parent's rate = child's cost
            rate_in_cents: input.rate_in_cents,
            rate_type: parentRate.rate_type,
            min_weight: parentRate.min_weight,
            max_weight: parentRate.max_weight,
            is_base_rate: false,
            is_active: false,
         },
      });

      return customRate;
   },

   /**
    * Bulk customize rates for an agency by applying a margin percentage
    * - Gets all base/parent rates for a service
    * - Creates custom rates with calculated margin
    * - Uses transaction for atomicity
    */
   bulkCustomizeRates: async (input: BulkCustomizeRatesInput): Promise<ShippingRate[]> => {
      const { agency_id, service_id, margin_percentage } = input;

      // Validate margin is positive
      if (margin_percentage <= 0) {
         throw new AppError("Margin percentage must be greater than 0", 400);
      }

      // Get agency to determine parent
      const agency = await prisma.agency.findUnique({
         where: { id: agency_id },
         include: {
            parent_agency: true,
         },
      });

      if (!agency) {
         throw new AppError(`Agency with ID ${agency_id} not found`, 404);
      }

      // Resolve which rates to customize (from parent or base)
      const parentRates = await shippingRatesService.resolveEffectiveRate(
         agency.parent_agency_id || agency_id,
         service_id
      );

      if (parentRates.length === 0) {
         throw new AppError(`No rates found to customize for service ${service_id}`, 404);
      }

      // Use transaction to create all custom rates atomically
      const customRates = await prisma.$transaction(async (tx) => {
         const createdRates: ShippingRate[] = [];

         for (const { rate: parentRate } of parentRates) {
            // Calculate new rate with margin
            const newRateInCents = Math.round(parentRate.rate_in_cents * (1 + margin_percentage / 100));

            // Check if custom rate already exists
            const existingRate = await tx.shippingRate.findFirst({
               where: {
                  parent_rate_id: parentRate.id,
                  agency_id: agency_id,
               },
            });

            if (existingRate) {
               // Update existing rate
               const updated = await tx.shippingRate.update({
                  where: { id: existingRate.id },
                  data: {
                     rate_in_cents: newRateInCents,
                  },
               });
               createdRates.push(updated);
            } else {
               // Create new custom rate
               const customRate = await tx.shippingRate.create({
                  data: {
                     name: parentRate.name,
                     description: `${parentRate.description || ""} (+${margin_percentage}%)`,
                     service_id: parentRate.service_id,
                     agency_id: agency_id,
                     forwarder_id: parentRate.forwarder_id,
                     parent_rate_id: parentRate.id,
                     cost_in_cents: parentRate.rate_in_cents,
                     rate_in_cents: newRateInCents,
                     rate_type: parentRate.rate_type,
                     min_weight: parentRate.min_weight,
                     max_weight: parentRate.max_weight,
                     is_base_rate: false,
                     is_active: true,
                  },
               });
               createdRates.push(customRate);
            }
         }

         return createdRates;
      });

      return customRates;
   },

   /**
    * Gets all available rates for an agency (inherited + custom)
    * Shows which rates are inherited and which are customized
    */
   getAvailableRates: async (agency_id: number, service_id: number): Promise<RateResolutionResult[]> => {
      return shippingRatesService.resolveEffectiveRate(agency_id, service_id);
   },

   /**
    * Updates a custom rate
    * - Validates it's not a base rate (base rates updated separately)
    * - Maintains price cascade validation
    */
   updateCustomRate: async (rate_id: number, rate_in_cents: number, description?: string): Promise<ShippingRate> => {
      const rate = await prisma.shippingRate.findUnique({
         where: { id: rate_id },
         include: {
            parent_rate: true,
         },
      });

      if (!rate) {
         throw new AppError(`Rate with ID ${rate_id} not found`, 404);
      }

      if (rate.is_base_rate) {
         throw new AppError("Cannot update base rate through this method. Use updateBaseRate instead.", 400);
      }

      // Validate new rate is greater than cost
      if (rate_in_cents <= rate.cost_in_cents) {
         throw new AppError(`Rate (${rate_in_cents}) must be greater than cost (${rate.cost_in_cents})`, 400);
      }

      const updated = await prisma.shippingRate.update({
         where: { id: rate_id },
         data: {
            rate_in_cents,
            description: description || rate.description,
         },
      });

      return updated;
   },

   /**
    * Updates a base rate and optionally cascades changes to children
    * - Only updates base rate properties
    * - Child rates maintain their custom margins
    */
   updateBaseRate: async (
      rate_id: number,
      updates: {
         name?: string;
         description?: string;
         rate_in_cents?: number;
         cost_in_cents?: number;
         min_weight?: number;
         max_weight?: number;
         is_active?: boolean;
      },
      cascade_to_children: boolean = false
   ): Promise<{ baseRate: ShippingRate; updatedChildren?: number }> => {
      const baseRate = await prisma.shippingRate.findUnique({
         where: { id: rate_id },
      });

      if (!baseRate) {
         throw new AppError(`Rate with ID ${rate_id} not found`, 404);
      }

      if (!baseRate.is_base_rate) {
         throw new AppError("This rate is not a base rate", 400);
      }

      return prisma.$transaction(async (tx) => {
         // Update base rate
         const updated = await tx.shippingRate.update({
            where: { id: rate_id },
            data: updates,
         });

         let updatedChildrenCount = 0;

         // Cascade updates to children if requested
         if (cascade_to_children) {
            // Get all child rates (direct and indirect through recursion)
            const childRates = await tx.shippingRate.findMany({
               where: {
                  parent_rate_id: rate_id,
               },
            });

            // Update children with new cost (parent's new rate)
            if (updates.rate_in_cents) {
               for (const child of childRates) {
                  await tx.shippingRate.update({
                     where: { id: child.id },
                     data: {
                        cost_in_cents: updates.rate_in_cents,
                     },
                  });
                  updatedChildrenCount++;
               }
            }

            // Update other properties that should cascade
            const cascadeUpdates: any = {};
            if (updates.name) cascadeUpdates.name = updates.name;
            if (updates.min_weight !== undefined) cascadeUpdates.min_weight = updates.min_weight;
            if (updates.max_weight !== undefined) cascadeUpdates.max_weight = updates.max_weight;
            if (updates.is_active !== undefined) cascadeUpdates.is_active = updates.is_active;

            if (Object.keys(cascadeUpdates).length > 0) {
               const result = await tx.shippingRate.updateMany({
                  where: { parent_rate_id: rate_id },
                  data: cascadeUpdates,
               });
               updatedChildrenCount = Math.max(updatedChildrenCount, result.count);
            }
         }

         return {
            baseRate: updated,
            updatedChildren: cascade_to_children ? updatedChildrenCount : undefined,
         };
      });
   },

   /**
    * Deactivates a rate and all its children
    * - Soft delete (sets is_active = false)
    * - Cascades to all child rates
    */
   deactivateRate: async (rate_id: number): Promise<{ deactivatedCount: number }> => {
      return prisma.$transaction(async (tx) => {
         const rate = await tx.shippingRate.findUnique({
            where: { id: rate_id },
         });

         if (!rate) {
            throw new AppError(`Rate with ID ${rate_id} not found`, 404);
         }

         // Deactivate the rate
         await tx.shippingRate.update({
            where: { id: rate_id },
            data: { is_active: false },
         });

         // Deactivate all child rates
         const childResult = await tx.shippingRate.updateMany({
            where: { parent_rate_id: rate_id },
            data: { is_active: false },
         });

         return { deactivatedCount: 1 + childResult.count };
      });
   },

   /**
    * Gets the rate hierarchy tree for auditing
    * Shows the complete chain from base rate to final customizations
    */
   getRateHierarchy: async (rate_id: number): Promise<any> => {
      const rate = await prisma.shippingRate.findUnique({
         where: { id: rate_id },
         include: {
            parent_rate: true,
            child_rates: {
               include: {
                  agency: {
                     select: {
                        id: true,
                        name: true,
                     },
                  },
               },
            },
            agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });

      if (!rate) {
         throw new AppError(`Rate with ID ${rate_id} not found`, 404);
      }

      return {
         rate: {
            id: rate.id,
            name: rate.name,
            cost_in_cents: rate.cost_in_cents,
            rate_in_cents: rate.rate_in_cents,
            margin_in_cents: rate.rate_in_cents - rate.cost_in_cents,
            is_base_rate: rate.is_base_rate,
            agency: rate.agency,
         },
         parent: rate.parent_rate,
         children: rate.child_rates.map((child) => ({
            id: child.id,
            name: child.name,
            cost_in_cents: child.cost_in_cents,
            rate_in_cents: child.rate_in_cents,
            margin_in_cents: child.rate_in_cents - child.cost_in_cents,
            agency: child.agency,
         })),
      };
   },
};
