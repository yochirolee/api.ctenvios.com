import { Router } from "express";
import prisma from "../config/prisma_db";
import { AgencyType, RateType, Roles } from "@prisma/client";
import { authMiddleware } from "../middlewares/auth-midleware";
import { z } from "zod";
import repository from "../repository/index";

const shipping_rates_routes = Router();

const shipping_ratesSchema = z
   .object({
      agency_id: z.number().min(1, "Agency is required"),
      name: z.string().min(1, "Name is required"),
      description: z.string().min(1, "Description is required"),
      service_id: z.number().min(1, "Service is required"),
      cost_in_cents: z.number().min(0, "Cost is required"),
      rate_in_cents: z.number().min(0, "Rate is required"),
      rate_type: z.nativeEnum(RateType),
      min_weight: z.number().min(0, "Min weight is required"),
      max_weight: z.number().min(0, "Max weight is required"),
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

shipping_rates_routes.get("/agency/:agency_id", async (req, res) => {
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
});

shipping_rates_routes.get("/agency/:agency_id/service/:service_id", async (req, res) => {
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
});

shipping_rates_routes.post("/", authMiddleware, async (req: any, res: any) => {
   const user = req?.user;
   const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR];
   if (!permited_roles.includes(user.role)) {
      return res.status(403).json({ message: "You are not authorized to create rates" });
   }

   const result = shipping_ratesSchema.safeParse(req.body);
   if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
   }

   const { agency_id, name, description, service_id, cost_in_cents, rate_in_cents, rate_type, min_weight, max_weight } =
      result.data;

   const agency = await prisma.agency.findUnique({
      where: { id: agency_id },
   });
   if (!agency || agency?.agency_type !== AgencyType.FORWARDER) {
      return res.status(404).json({ message: "Agency not found or is not a forwarder" });
   }

   try {
      // Create the base rate for the forwarder agency and all its children recursively
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

      res.status(200).json({
         message: "Base rate and child rates created successfully",
         base_rate: result.baseRate,
         child_rates_count: result.childRates.length,
         child_rates: result.childRates,
      });
   } catch (error) {
      console.error("Error creating base rate and child rates:", error);
      res.status(500).json({
         message: "Error creating rates",
         error: error instanceof Error ? error.message : "Unknown error",
      });
   }
});

shipping_rates_routes.put("/:id", authMiddleware, async (req: any, res: any) => {
   const { id } = req.params;
   const user = req?.user;
   const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN, Roles.AGENCY_SUPERVISOR];
   if (!permited_roles.includes(user.role)) {
      return res.status(403).json({ message: "You are not authorized to update rates" });
   }

   const result = shipping_ratesSchema.safeParse(req.body);
   if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0].message });
   }

   //if

   const { name, description, cost_in_cents, rate_in_cents, rate_type, min_weight, max_weight } = result.data;

   try {
      const rate = await repository.shippingRates.updateRate(parseInt(id), {
         name,
         description,
         cost_in_cents,
         rate_in_cents,
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
shipping_rates_routes.delete("/:id", authMiddleware, async (req: any, res: any) => {
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

export default shipping_rates_routes;
