import { Request, Response } from "express";
import { z } from "zod";
import { AgencyType, Prisma, Roles } from "@prisma/client";
import AppError from "../utils/app.error";

import { agencySchema } from "../types/types";
import repository from "../repositories";
import prisma from "../config/prisma_db";
import { auth } from "../lib/auth";
import { pricingService } from "../services/pricing.service";

// Create update schema by making all fields optional
const agencyUpdateSchema = agencySchema.partial();

const create_agency_schema = z.object({
   agency: z.object({
      name: z.string().min(1),
      address: z.string().min(1),
      contact: z.string().min(1),
      phone: z.string().min(10),
      email: z.string().email(),
      website: z.string().url().optional(),
      agency_type: z.enum(["AGENCY", "RESELLER", "FORWARDER"]),
      parent_agency_id: z.number().int().positive().optional(),
   }),
   user: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(10),
      password: z.string().min(8),
      role: z.literal("AGENCY_ADMIN"),
   }),
});

const agencies = {
   getAll: async (req: any, res: Response) => {
      const user = req.user;

      if (!user.agency_id) {
         throw new AppError("Agency ID is required", 400, [], "zod");
      }
      const user_agency = await repository.agencies.getById(user.agency_id);

      let agencies = [];
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];
      if (user_agency?.agency_type === AgencyType.FORWARDER && permited_roles.includes(user?.role)) {
         agencies = await repository.agencies.getAll();
      } else {
         agencies.push(user_agency);
         agencies.push(...(await repository.agencies.getChildren(Number(user_agency?.id))));
      }

      res.status(200).json(agencies);
   },
   getById: async (req: Request, res: Response) => {
      const { id } = req.params;
      const agency = await repository.agencies.getById(Number(id));
      res.status(200).json(agency);
   },

   getUsers: async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!id) {
         throw new AppError("Agency ID is required", 400, [], "zod");
      }
      const users = await repository.agencies.getUsers(Number(id));
      res.status(200).json(users);
   },
   //if agency is FORWARDER create agency with parent_agency_id as null with services but no shipping_rates
   //create agency with services and shipping_rates from parent_agency
   create: async (req: any, res: Response) => {
      const current_user = req.user;
      const permited_roles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN];
      if (!permited_roles.includes(current_user.role)) {
         return res.status(403).json({ error: "You are not authorized to create agencies" });
      }
      const parent_agency = await prisma.agency.findUnique({
         where: { id: current_user.agency_id },
      });
      if (
         !parent_agency ||
         (parent_agency.agency_type !== AgencyType.FORWARDER && parent_agency.agency_type !== AgencyType.RESELLER)
      ) {
         return res.status(404).json({ error: "Agency not found or can not create a child agency" });
      }
      const result = create_agency_schema.safeParse(req.body);
      if (!result.success) {
         const fieldErrors = result.error.flatten().fieldErrors;
         const errorSummary = Object.entries(fieldErrors).map(([field, messages]) => ({
            field,
            messages,
            firstError: messages[0],
         }));

         return res.status(400).json({
            message: "Invalid agency data",
            errors: fieldErrors,
            errorSummary,
            fieldsWithErrors: Object.keys(fieldErrors),
            detailedErrors: result.error.issues.map((issue) => ({
               path: issue.path.join("."),
               message: issue.message,
               code: issue.code,
               ...(issue.code === "invalid_type"
                  ? {
                       expected: issue.expected,
                       received: issue.received,
                    }
                  : {}),
            })),
         });
      }

      const { agency: child_agency, user } = result.data;

      if (child_agency.agency_type === AgencyType.FORWARDER) {
         child_agency.parent_agency_id = undefined;
      }

      // Find all services from parent agency with shipping_rates and pricing_agreements
      const parent_services = await repository.services.getByAgencyId(parent_agency.id, false);

      const uniqueParentsServicesId = parent_services
         .map((service) => service.id)
         .filter((id): id is number => id !== null);

      // Step 1: Create agency and connect services in transaction
      let created_agency;
      try {
         created_agency = await prisma.agency.create({
            data: {
               ...child_agency,
               parent_agency_id: parent_agency.id,
               forwarder_id: parent_agency.forwarder_id,
               services: {
                  connect: uniqueParentsServicesId.map((service_id: number) => ({ id: service_id })),
               },
            },
         });
      } catch (error) {
         console.error("Error creating agency:", error);
         return res.status(500).json({
            message: "Error creating agency",
            error: error instanceof Error ? error.message : "Unknown error",
         });
      }
      //create agency admin
      const user_response = await auth.api.signUpEmail({
         body: {
            email: user.email,
            password: user.password,
            name: user.name,
         },
      });
      if (!user_response.token) {
         return res.status(400).json({ message: "User registration failed." });
      }

      // Update internal Prisma user record
      await prisma.user.update({
         where: { email: user.email },
         data: {
            agency_id: created_agency.id,
            role: user.role,
         },
      });

      // Step 2: Create pricing agreements and rates (outside main transaction to avoid nested transaction conflicts)
      const rateCreationPromises = parent_services.flatMap((service) =>
         service.shipping_rates.map((shipping_rate) =>
            pricingService.createPricingWithRate({
               product_id: shipping_rate.pricing_agreement.product.id,
               service_id: service.id,
               seller_agency_id: parent_agency.id,
               buyer_agency_id: created_agency.id,
               cost_in_cents: shipping_rate.pricing_agreement.price_in_cents,
               price_in_cents: shipping_rate.price_in_cents,
               name: shipping_rate.pricing_agreement.product.name,
               is_active: shipping_rate.is_active,
            })
         )
      );

      try {
         const rates_created = await Promise.all(rateCreationPromises);

         res.status(201).json({
            agency: created_agency,
            rates_created_count: rates_created.length,
            message: "Agency and pricing agreements created successfully",
         });
      } catch (error) {
         console.error("Error creating pricing agreements:", error);
         return res.status(500).json({
            message:
               "Agency created but some pricing agreements failed. Please review and create missing rates manually.",
            error: error instanceof Error ? error.message : "Unknown error",
            agency_id: created_agency.id,
         });
      }
   },

   update: async (req: Request, res: Response) => {
      const { id } = req.params;
      const result = agencyUpdateSchema.safeParse(req.body) as z.SafeParseReturnType<
         typeof agencyUpdateSchema,
         Prisma.AgencyUpdateInput
      >;
      if (!result.success) {
         throw new AppError("Invalid agency data", 400, result.error.flatten().fieldErrors, "zod");
      }
      const agency = await repository.agencies.update(Number(id), result.data);
      res.status(200).json({
         agency,
      });
   },
   remove: async (req: Request, res: Response) => {
      const { id } = req.params;
      const agency = await repository.agencies.delete(Number(id));
      res.status(200).json({
         agency,
      });
   },
   getChildren: async (req: Request, res: Response) => {
      const { id } = req.params;
      const children = await repository.agencies.getChildren(Number(id));
      res.status(200).json(children);
   },
   getParent: async (req: Request, res: Response) => {
      const { id } = req.params;
      const parent = await repository.agencies.getParent(Number(id));
      res.status(200).json(parent);
   },
   getActivesServicesRates: async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!id) {
         throw new AppError("Agency ID is required", 400, [], "zod");
      }
      const agency = await repository.agencies.getById(Number(id));
      if (!agency) {
         throw new AppError("Agency not found", 404, [], "zod");
      }
      const getActives =
         agency.agency_type === AgencyType.FORWARDER || agency.agency_type === AgencyType.RESELLER ? true : false;

      const services = await repository.services.getByAgencyId(Number(id), getActives);

      const services_with_rates = services.map((service) => {
         return {
            ...service,
            shipping_rates: service.shipping_rates.map((rate) => {
               return {
                  id: rate.id,
                  name: rate.pricing_agreement.product.name,
                  description: rate.pricing_agreement.product.description,
                  unit: rate.pricing_agreement.product.unit,
                  price_in_cents: rate.price_in_cents,
                  cost_in_cents: rate.pricing_agreement.price_in_cents,
                  is_active: rate.is_active,
               };
            }),
         };
      });

      res.status(200).json(services_with_rates);
   },
};

export default agencies;
