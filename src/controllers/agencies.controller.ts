import { Request, Response } from "express";
import { z } from "zod";
import { AgencyType, Prisma, Roles } from "@prisma/client";
import AppError from "../utils/app.error";

import { agencySchema } from "../types/types";
import repository from "../repositories";
import prisma from "../config/prisma_db";
import { auth } from "../lib/auth.lib";

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
      const current_agency = await prisma.agency.findUnique({
         where: { id: current_user.agency_id },
      });
      if (
         !current_agency ||
         (current_agency.agency_type !== AgencyType.FORWARDER && current_agency.agency_type !== AgencyType.RESELLER)
      ) {
         return res.status(404).json({ error: "This can not create an agency" });
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

      const { agency, user } = result.data;

      if (agency.agency_type === AgencyType.FORWARDER) {
         agency.parent_agency_id = undefined;
      }

      // Determine parent agency (from input or current user's agency)
      const parent_agency_id = agency.parent_agency_id || current_user.agency_id;

      // Validate parent agency exists and get its basic info
      const parent_agency = await prisma.agency.findUnique({
         where: { id: parent_agency_id },
         select: {
            id: true,
            forwarder_id: true,
            agency_type: true,
         },
      });

      if (!parent_agency) {
         return res.status(404).json({ error: "Parent agency not found" });
      }

      // Get services from parent agency's rates to connect to new agency
      const parent_rates = await prisma.shippingRate.findMany({
         where: { agency_id: parent_agency.id },
         select: { service_id: true },
         distinct: ["service_id"],
      });

      // ✅ Validate parent has rates before creating child agency
      if (parent_rates.length === 0) {
         return res.status(400).json({
            error: "Parent agency has no rates configured. Cannot create child agency.",
            parent_agency_id: parent_agency.id,
         });
      }

      const services_ids = parent_rates.map((rate) => rate.service_id).filter((id): id is number => id !== null);

      // Step 1: Create user in auth system (outside transaction - cannot rollback HTTP calls)
      try {
         await auth.api.signUpEmail({
            body: {
               email: user.email,
               password: user.password,
               name: user.name,
            },
         });
      } catch (error) {
         console.error("Error creating user in auth system:", error);
         return res.status(500).json({
            message: "Error creating user in authentication system",
            error: error instanceof Error ? error.message : "Unknown error",
         });
      }

      // Step 2: Create agency, rates, and link user in ONE atomic transaction
      try {
         const result = await prisma.$transaction(
            async (tx) => {
               // 1. Create the agency
               const created_agency = await tx.agency.create({
                  data: {
                     ...agency,
                     parent_agency_id: parent_agency.id,
                     forwarder_id: parent_agency.forwarder_id,
                     services: {
                        connect: services_ids.map((service_id) => ({ id: service_id })),
                     },
                  },
               });

               // 2. Create rates for the new agency (within same transaction)
               const ratesResult = await repository.shippingRates.createRatesForNewAgency(
                  created_agency.id,
                  created_agency.parent_agency_id,
                  created_agency.forwarder_id,
                  created_agency.commission_rate || 0,
                  tx // ✅ Pass transaction context
               );

               // 3. Link user in our database with agency relationship
               await tx.user.update({
                  where: { email: user.email },
                  data: {
                     agency_id: created_agency.id,
                     role: user.role,
                     phone: user.phone,
                     emailVerified: true,
                     created_by: current_user.email,
                  },
               });

               return {
                  agency: created_agency,
                  rates_created: ratesResult.createdRates.length,
               };
            },
            {
               maxWait: 10000, // 10 seconds max wait to start transaction
               timeout: 30000, // 30 seconds max transaction time
            }
         );

         console.log(`✅ Agency created with ${result.rates_created} inherited rates (inactive)`);

         res.status(201).json({
            ...result,
            message: "Agency created successfully with inherited rates (inactive by default)",
         });
      } catch (error) {
         console.error("Error in agency creation transaction:", error);
         return res.status(500).json({
            message:
               "Error creating agency. User was created in auth system but agency/rates creation failed. Please contact support.",
            error: error instanceof Error ? error.message : "Unknown error",
            user_email: user.email,
            note: "You may need to manually clean up the auth user or retry agency creation.",
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
      const services = await repository.agencies.getActivesServicesRates(Number(id));

      res.status(200).json(services);
   },
   //por ahora no se usa pero se deja para futuras implementaciones
   getActivesShippingRates: async (req: Request, res: Response) => {
      const { id, service_id } = req.params;

      const shipping_rates = await repository.agencies.getActivesShippingRates(Number(id), Number(service_id));
      res.status(200).json(shipping_rates);
   },
};

export default agencies;
