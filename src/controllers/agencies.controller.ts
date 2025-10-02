import { Request, Response } from "express";
import { z } from "zod";
import { AgencyType, Prisma, Roles, ShippingRate } from "@prisma/client";
import AppError from "../utils/app.error";

import { agencySchema } from "../types/types";
import repository from "../repository";
import prisma from "../config/prisma_db";
import { auth } from "../lib/auth";

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
         return res.status(403).json({ message: "You are not authorized to create agencies" });
      }
      const current_agency = await prisma.agency.findUnique({
         where: { id: current_user.agency_id },
      });
      if (!current_agency || current_agency?.agency_type !== AgencyType.FORWARDER) {
         return res.status(404).json({ message: "This can not create an agency" });
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

      const parent_agency = await prisma.agency.findUnique({
         where: {
            id: agency.parent_agency_id || current_user.agency_id,
         },
         include: {
            shipping_rates: true,
         },
      });

      if (!parent_agency?.shipping_rates) {
         throw new AppError("Parent agency has no rates", 400, [], "zod");
      }

      const services_ids = parent_agency?.shipping_rates
         .filter(
            (shipping_rate, index, self) => index === self.findIndex((t) => t.service_id === shipping_rate.service_id)
         )
         .map((shipping_rate) => shipping_rate.service_id)
         .filter((id): id is number => id !== null);

      try {
         const agency_created = await prisma.$transaction(async (tx) => {
            const created_agency = await tx.agency.create({
               data: {
                  ...agency,
                  parent_agency_id: parent_agency?.id,
                  forwarder_id: parent_agency?.forwarder_id || 1,
                  services: {
                     connect: services_ids.map((service_id) => ({
                        id: service_id,
                     })),
                  },
               },
            });
            await tx.shippingRate.createMany({
               data: parent_agency?.shipping_rates.map((shipping_rate: ShippingRate) => ({
                  cost_in_cents: shipping_rate.cost_in_cents,
                  rate_in_cents: shipping_rate.rate_in_cents,
                  service_id: shipping_rate.service_id,
                  name: shipping_rate.name,
                  description: shipping_rate.description,
                  rate_type: shipping_rate.rate_type,
                  min_weight: shipping_rate.min_weight,
                  max_weight: shipping_rate.max_weight,
                  is_base_rate: false,
                  length: shipping_rate.length,
                  width: shipping_rate.width,
                  height: shipping_rate.height,
                  forwarder_id: shipping_rate.forwarder_id,
                  agency_id: created_agency.id,
                  parent_rate_id: shipping_rate.parent_rate_id,
               })),
            });

            // Create user using signup API instead of admin API
            await auth.api.signUpEmail({
               body: {
                  email: user.email,
                  password: user.password,
                  name: user.name,
               },
            });

            // Update the created user with additional fields
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

            return created_agency;
         });

         res.status(201).json(agency_created);
      } catch (error) {
         console.error("Error creating agency:", error);
         res.status(500).json({
            message: "Error creating agency",
            error: error,
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
   getServicesWithRates: async (req: Request, res: Response) => {
      const { id } = req.params;
      const { is_active } = req.query;
      const isActiveBoolean =
         is_active === undefined ? undefined : is_active === "true" ? true : is_active === "false" ? false : undefined;
      const servicesAndRates = await repository.agencies.getServicesWithRates(
         Number(id),
         isActiveBoolean as boolean | null
      );

      res.status(200).json(servicesAndRates);
   },
};

export default agencies;
