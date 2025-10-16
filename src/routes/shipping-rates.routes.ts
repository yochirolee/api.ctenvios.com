import { Router } from "express";
import prisma from "../config/prisma_db";
import { AgencyType, RateType, Roles } from "@prisma/client";
import { z } from "zod";
import repository from "../repositories/index";
import services from "../services";

const shipping_rates_routes = Router();

const shipping_ratesSchema = z
   .object({
      agency_id: z.number().optional(),
      name: z.string().min(1, "Name is required"),
      description: z.string().min(1, "Description is required"),
      service_id: z.number().min(1, "Service is required"),
      cost_in_cents: z.number().min(0, "Cost is required"),
      rate_in_cents: z.number().min(0, "Rate is required"),
      rate_type: z.nativeEnum(RateType),
      min_weight: z.number().min(0, "Min weight is required"),
      max_weight: z.number().min(0, "Max weight is required"),
      is_active: z.boolean().default(false),
   })
   .refine((data) => data.rate_in_cents >= data.cost_in_cents, {
      message: "Rate must be equal to or greater than cost",
      path: ["rate_in_cents"],
   });

/**
 * @openapi
 * /shipping-rates:
 *   get:
 *     summary: Get all shipping rates
 *     description: Get all shipping rates
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShippingRate'
 */
shipping_rates_routes.get("/", async (req, res) => {
   const rates = await prisma.shippingRate.findMany({
      include: {
         service: {
            select: {
               id: true,
               name: true,
               service_type: true,
               provider: {
                  select: { id: true, name: true },
               },
            },
         },
         agency: {
            select: {
               id: true,
               name: true,
               agency_type: true,
            },
         },
      },
      orderBy: {
         created_at: "desc",
      },
   });
   res.status(200).json(rates);
});



/* shipping_rates_routes.get("/agency/:agency_id", async (req, res) => {
   const { agency_id } = req.params;

   try {
      const rates = await repository.shippingRates.getRatesByAgency(parseInt(agency_id));
      res.status(200).json(rates);
   } catch (error) {
      res.status(500).json({
         message: "Error fetching rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
}); */

/* shipping_rates_routes.get("/agency/:agency_id/service/:service_id", async (req, res) => {
   const { agency_id, service_id } = req.params;

   try {
      const rates = await repository.shippingRates.getRatesByAgencyAndService(
         parseInt(agency_id),
         parseInt(service_id)
      );
      res.status(200).json(rates);
   } catch (error) {
      res.status(500).json({
         message: "Error fetching rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
}); */

shipping_rates_routes.post("/base-rate", async (req: any, res: any) => {
   const user = req?.user;

   const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR];
   if (!permited_roles.includes(user.role)) {
      return res.status(403).json({ message: "You are not authorized to create rates" });
   }

   const result = shipping_ratesSchema.safeParse(req.body);
   if (!result.success) {
      console.log(result.error);
      return res.status(400).json({ message: result.error.issues[0].message });
   }

   const { name, description, service_id, cost_in_cents, rate_in_cents, rate_type, min_weight, max_weight } =
      result.data;

   const agency = await prisma.agency.findUnique({
      where: { id: user.agency_id },
   });

   if (!agency || agency?.agency_type !== AgencyType.FORWARDER) {
      return res.status(404).json({ message: "Agency not found or is not a forwarder" });
   }

   try {
      // ✅ Create base rate and distribute to all child agencies (inactive by default)
      const result = await repository.shippingRates.createBaseRateForForwarderAndChildren(agency.id, {
         name,
         description,
         service_id,
         cost_in_cents,
         rate_in_cents,
         rate_type,
         min_weight,
         max_weight,
      });

      res.status(201).json({
         message: "Base rate created and distributed to all agencies (inactive by default)",
         base_rate: result.baseRate,
         forwarder_rate: result.forwarderRate,
         child_rates_created: result.childRates.length,
         explanation: {
            distribution: "All child agencies received this rate as INACTIVE",
            activation: "Use PUT /shipping-rates/activate/:rate_id to activate for specific agencies",
            cascade_deactivation: "Deactivating base rate will deactivate all child rates",
         },
      });
   } catch (error) {
      console.error("Error creating base rate and distributing:", error);
      res.status(500).json({
         message: "Error creating rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});
shipping_rates_routes.put("/base-rate/:id", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR];
      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to create rates" });
      }
      const { id } = req.params;
      if (!id) {
         return res.status(400).json({ message: "Id is required" });
      }
      const { name, description, cost_in_cents, rate_in_cents, rate_type, min_weight, max_weight, is_active } =
         req.body;
      const rate = await repository.shippingRates.updateBaseRate(parseInt(id), {
         name,
         description,
         cost_in_cents,
         rate_in_cents,
         rate_type,
         min_weight,
         max_weight,
         is_active,
      });
      res.status(200).json(rate);
   } catch (error) {
      res.status(500).json({
         message: "Error updating rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

shipping_rates_routes.put("/:id", async (req: any, res: any) => {
   try {
      const { id } = req.params;
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN, Roles.AGENCY_SUPERVISOR];
      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to update rates" });
      }

      const { name, description, cost_in_cents, rate_in_cents, rate_type, min_weight, max_weight, is_active } =
         req.body;

      const rate = await repository.shippingRates.updateRate(parseInt(id), {
         name,
         description,
         cost_in_cents,
         rate_in_cents,
         is_active,
         rate_type,
         min_weight,
         max_weight,
      });
      res.status(200).json(rate);
   } catch (error) {
      res.status(500).json({
         message: "Error updating rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});
shipping_rates_routes.delete("/:id", async (req: any, res: any) => {
   try {
      const { id } = req.params;
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR];
      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to delete rates" });
      }
      if (!id) {
         return res.status(400).json({ message: "Id is required" });
      }

      await repository.shippingRates.deleteRate(parseInt(id));
      res.status(200).json({ message: "Rate deleted successfully" });
   } catch (error) {
      res.status(500).json({
         message: "Error deleting rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

// ============= NEW HIERARCHICAL RATE SYSTEM ENDPOINTS =============

/**
 * @openapi
 * /shipping-rates/resolve/{agency_id}/{service_id}:
 *   get:
 *     summary: Resolve effective rates for an agency
 *     description: Gets the effective rates for an agency (inherited or customized) using the resolver algorithm
 */
shipping_rates_routes.get("/resolve/:agency_id/:service_id", async (req: any, res: any) => {
   try {
      const { agency_id, service_id } = req.params;

      const effectiveRates = await services.shippingRates.resolveEffectiveRate(
         parseInt(agency_id),
         parseInt(service_id)
      );

      res.status(200).json({
         agency_id: parseInt(agency_id),
         service_id: parseInt(service_id),
         rates: effectiveRates,
      });
   } catch (error) {
      res.status(500).json({
         message: "Error resolving rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/custom-rate:
 *   post:
 *     summary: Create a custom rate for an agency
 *     description: Allows an agency to customize/override a parent rate with their own pricing
 */
shipping_rates_routes.post("/custom-rate", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN];

      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to create custom rates" });
      }

      const { parent_rate_id, agency_id, rate_in_cents, description } = req.body;

      if (!parent_rate_id || !agency_id || !rate_in_cents) {
         return res.status(400).json({
            message: "parent_rate_id, agency_id, and rate_in_cents are required",
         });
      }

      const customRate = await services.shippingRates.createCustomRate({
         parent_rate_id: parseInt(parent_rate_id),
         agency_id: parseInt(agency_id),
         rate_in_cents: parseInt(rate_in_cents),
         description,
      });

      res.status(201).json({
         message: "Custom rate created successfully",
         rate: customRate,
      });
   } catch (error) {
      res.status(500).json({
         message: "Error creating custom rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/bulk-customize:
 *   post:
 *     summary: Bulk customize rates with a margin percentage
 *     description: Creates custom rates for all service rates applying a margin percentage
 */
shipping_rates_routes.post("/bulk-customize", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN];

      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to bulk customize rates" });
      }

      const { agency_id, service_id, margin_percentage } = req.body;

      if (!agency_id || !service_id || margin_percentage === undefined) {
         return res.status(400).json({
            message: "agency_id, service_id, and margin_percentage are required",
         });
      }

      const customRates = await services.shippingRates.bulkCustomizeRates({
         agency_id: parseInt(agency_id),
         service_id: parseInt(service_id),
         margin_percentage: parseFloat(margin_percentage),
      });

      res.status(200).json({
         message: "Rates customized successfully",
         count: customRates.length,
         rates: customRates,
      });
   } catch (error) {
      res.status(500).json({
         message: "Error bulk customizing rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/available/{agency_id}/{service_id}:
 *   get:
 *     summary: Get all available rates for an agency
 *     description: Shows all available rates (inherited and custom) for an agency
 */
shipping_rates_routes.get("/available/:agency_id/:service_id", async (req: any, res: any) => {
   try {
      const { agency_id, service_id } = req.params;
      const availableRates = await services.shippingRates.getAvailableRates(parseInt(agency_id), parseInt(service_id));

      res.status(200).json({
         agency_id: parseInt(agency_id),
         service_id: parseInt(service_id),
         rates: availableRates,
      });
   } catch (error) {
      res.status(500).json({
         message: "Error getting available rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/hierarchy/{rate_id}:
 *   get:
 *     summary: Get rate hierarchy for auditing
 *     description: Shows the complete hierarchy chain from base rate to customizations
 */
shipping_rates_routes.get("/hierarchy/:rate_id", async (req: any, res: any) => {
   try {
      const { rate_id } = req.params;

      const hierarchy = await services.shippingRates.getRateHierarchy(parseInt(rate_id));

      res.status(200).json(hierarchy);
   } catch (error) {
      res.status(500).json({
         message: "Error getting rate hierarchy",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/update-custom/{rate_id}:
 *   put:
 *     summary: Update a custom rate
 *     description: Updates a custom rate's price, maintaining hierarchy validation
 */
shipping_rates_routes.put("/update-custom/:rate_id", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN];

      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to update custom rates" });
      }

      const { rate_id } = req.params;
      const { rate_in_cents, description } = req.body;

      if (!rate_in_cents) {
         return res.status(400).json({ message: "rate_in_cents is required" });
      }

      const updatedRate = await services.shippingRates.updateCustomRate(
         parseInt(rate_id),
         parseInt(rate_in_cents),
         description
      );

      res.status(200).json({
         message: "Custom rate updated successfully",
         rate: updatedRate,
      });
   } catch (error) {
      res.status(500).json({
         message: "Error updating custom rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/update-base-rate/{rate_id}:
 *   put:
 *     summary: Update a base rate with cascade option
 *     description: Updates a base rate and optionally cascades changes to children
 */
shipping_rates_routes.put("/update-base-rate/:rate_id", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR];

      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to update base rates" });
      }

      const { rate_id } = req.params;
      const { cascade_to_children, ...updates } = req.body;

      const result = await services.shippingRates.updateBaseRate(
         parseInt(rate_id),
         updates,
         cascade_to_children || false
      );

      res.status(200).json({
         message: "Base rate updated successfully",
         ...result,
      });
   } catch (error) {
      res.status(500).json({
         message: "Error updating base rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/activate/{rate_id}:
 *   put:
 *     summary: Activate a rate for an agency
 *     description: Activates a rate that was created inactive, optionally updating rate_in_cents
 */
shipping_rates_routes.put("/activate/:rate_id", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN];

      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to activate rates" });
      }

      const { rate_id } = req.params;
      const { rate_in_cents } = req.body;

      // Get the rate to verify it exists
      const rate = await prisma.shippingRate.findUnique({
         where: { id: parseInt(rate_id) },
         include: {
            agency: { select: { id: true, name: true } },
         },
      });

      if (!rate) {
         return res.status(404).json({ message: "Rate not found" });
      }

      // Verify agency admin can only activate their own agency's rates
      if (user.role === Roles.AGENCY_ADMIN && rate.agency_id !== user.agency_id) {
         return res.status(403).json({ message: "You can only activate rates for your agency" });
      }

      // Validate new rate if provided
      if (rate_in_cents !== undefined && rate_in_cents <= rate.cost_in_cents) {
         return res.status(400).json({
            message: `Rate (${rate_in_cents}) must be greater than cost (${rate.cost_in_cents})`,
         });
      }

      // Update the rate
      const updateData: any = { is_active: true };
      if (rate_in_cents !== undefined) {
         updateData.rate_in_cents = rate_in_cents;
      }

      const updatedRate = await prisma.shippingRate.update({
         where: { id: parseInt(rate_id) },
         data: updateData,
      });

      res.status(200).json({
         message: "Rate activated successfully",
         rate: updatedRate,
      });
   } catch (error) {
      console.error("Error activating rate:", error);
      res.status(500).json({
         message: "Error activating rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/configure/{rate_id}:
 *   put:
 *     summary: Configure/update a rate for an agency
 *     description: Updates rate_in_cents and/or description for an agency rate
 */
shipping_rates_routes.put("/configure/:rate_id", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN];

      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to configure rates" });
      }

      const { rate_id } = req.params;
      const { rate_in_cents, description, is_active } = req.body;

      if (!rate_in_cents && !description && is_active === undefined) {
         return res.status(400).json({
            message: "At least one field (rate_in_cents, description, is_active) is required",
         });
      }

      // Get the rate to verify it exists
      const rate = await prisma.shippingRate.findUnique({
         where: { id: parseInt(rate_id) },
         include: {
            agency: { select: { id: true, name: true } },
         },
      });

      if (!rate) {
         return res.status(404).json({ message: "Rate not found" });
      }

      if (!rate.agency_id) {
         return res.status(400).json({ message: "Cannot configure base rates. Use /update-base-rate instead." });
      }

      // Verify agency admin can only configure their own agency's rates
      if (user.role === Roles.AGENCY_ADMIN && rate.agency_id !== user.agency_id) {
         return res.status(403).json({ message: "You can only configure rates for your agency" });
      }

      // Validate new rate if provided
      if (rate_in_cents !== undefined && rate_in_cents <= rate.cost_in_cents) {
         return res.status(400).json({
            message: `Rate (${rate_in_cents}) must be greater than cost (${rate.cost_in_cents})`,
         });
      }

      // Update the rate
      const updateData: any = {};
      if (rate_in_cents !== undefined) updateData.rate_in_cents = rate_in_cents;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      const updatedRate = await prisma.shippingRate.update({
         where: { id: parseInt(rate_id) },
         data: updateData,
      });

      res.status(200).json({
         message: "Rate configured successfully",
         rate: updatedRate,
      });
   } catch (error) {
      console.error("Error configuring rate:", error);
      res.status(500).json({
         message: "Error configuring rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/agency/{agency_id}/service/{service_id}:
 *   get:
 *     summary: Get all rates for an agency and service (active and inactive)
 *     description: Returns all rates for a specific agency and service
 */
shipping_rates_routes.get("/agency/:agency_id/service/:service_id", async (req: any, res: any) => {
   try {
      const { agency_id, service_id } = req.params;
      const { active_only } = req.query;

      const whereClause: any = {
         agency_id: parseInt(agency_id),
         service_id: parseInt(service_id),
      };

      if (active_only === "true") {
         whereClause.is_active = true;
      }

      const rates = await prisma.shippingRate.findMany({
         where: whereClause,
         include: {
            service: {
               select: { id: true, name: true },
            },
         },
         orderBy: [{ min_weight: "asc" }, { created_at: "desc" }],
      });

      res.status(200).json({
         agency_id: parseInt(agency_id),
         service_id: parseInt(service_id),
         count: rates.length,
         rates,
      });
   } catch (error) {
      console.error("Error fetching agency rates:", error);
      res.status(500).json({
         message: "Error fetching rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

/**
 * @openapi
 * /shipping-rates/deactivate/{rate_id}:
 *   put:
 *     summary: Deactivate a rate and all children
 *     description: Soft deletes a rate and cascades to all child rates
 */
shipping_rates_routes.put("/deactivate/:rate_id", async (req: any, res: any) => {
   try {
      const user = req?.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR];

      if (!permited_roles.includes(user.role)) {
         return res.status(403).json({ message: "You are not authorized to deactivate rates" });
      }

      const { rate_id } = req.params;

      const result = await services.shippingRates.deactivateRate(parseInt(rate_id));

      res.status(200).json({
         message: "Rate deactivated successfully",
         ...result,
      });
   } catch (error) {
      res.status(500).json({
         message: "Error deactivating rate",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

export default shipping_rates_routes;
