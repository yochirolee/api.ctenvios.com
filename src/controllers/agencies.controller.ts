import { Request, Response } from "express";
import { z } from "zod";
import { AgencyType, Prisma, Roles } from "@prisma/client";
import AppError from "../utils/app.error";

import { agencySchema } from "../types/types";
import repository from "../repositories";
import prisma from "../config/prisma_db";
import { auth } from "../lib/auth";
import { pricingService } from "../services/pricing.service";

// Extend Express Request type for authenticated requests
interface AuthenticatedRequest extends Request {
   user: {
      id: number;
      email: string;
      role: Roles;
      agency_id: number | null;
   };
}

// Create update schema by making all fields optional
const agencyUpdateSchema = agencySchema.partial();

// Roles allowed to create agencies
const AGENCY_CREATION_ROLES = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.AGENCY_ADMIN] as const;

// Roles allowed to view all agencies
const AGENCY_VIEW_ALL_ROLES = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN] as const;

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
   getAll: async (req: Request, res: Response): Promise<void> => {
      const { user } = req as AuthenticatedRequest;

      if (!user.agency_id) {
         throw new AppError("User must be associated with an agency", 400, [], "auth");
      }

      const user_agency = await repository.agencies.getById(user.agency_id);
      if (!user_agency) {
         throw new AppError("Agency not found", 404, [], "not_found");
      }

      const canViewAll =
         user_agency.agency_type === AgencyType.FORWARDER &&
         (AGENCY_VIEW_ALL_ROLES as readonly Roles[]).includes(user.role);

      const agencies = canViewAll
         ? await repository.agencies.getAll()
         : [user_agency, ...(await repository.agencies.getChildren(user_agency.id))];

      res.status(200).json(agencies);
   },
   getById: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError("Invalid agency ID", 400, [], "validation");
      }

      const agency = await repository.agencies.getById(agencyId);
      if (!agency) {
         throw new AppError("Agency not found", 404, [], "not_found");
      }

      res.status(200).json(agency);
   },

   getUsers: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError("Invalid agency ID", 400, [], "validation");
      }

      const users = await repository.agencies.getUsers(agencyId);
      res.status(200).json(users);
   },
   create: async (req: Request, res: Response): Promise<void> => {
      const { user: current_user } = req as AuthenticatedRequest;

      // Authorization check
      if (!(AGENCY_CREATION_ROLES as readonly Roles[]).includes(current_user.role)) {
         throw new AppError("You are not authorized to create agencies", 403, [], "auth");
      }

      if (!current_user.agency_id) {
         throw new AppError("User must be associated with an agency", 400, [], "auth");
      }

      // Validate parent agency
      const parent_agency = await prisma.agency.findUnique({
         where: { id: current_user.agency_id },
      });

      if (!parent_agency) {
         throw new AppError("Parent agency not found", 404, [], "not_found");
      }

      const canCreateChild =
         parent_agency.agency_type === AgencyType.FORWARDER || parent_agency.agency_type === AgencyType.RESELLER;

      if (!canCreateChild) {
         throw new AppError("Only FORWARDER and RESELLER agencies can create child agencies", 403, [], "business_rule");
      }
      // Validate request body
      const result = create_agency_schema.safeParse(req.body);
      if (!result.success) {
         throw new AppError("Invalid agency data", 400, result.error.flatten().fieldErrors, "zod");
      }

      const { agency: child_agency, user } = result.data;

      if (child_agency.agency_type === AgencyType.FORWARDER) {
         child_agency.parent_agency_id = undefined;
      }

      // Find all services from parent agency with shipping_rates and pricing_agreements
      const parent_services = await repository.services.getByAgencyId(parent_agency.id);

      const uniqueParentsServicesId = parent_services
         .map((service) => service.id)
         .filter((id): id is number => id !== null);

      // Create agency and connect services
      const created_agency = await prisma.agency.create({
         data: {
            ...child_agency,
            parent_agency_id: parent_agency.id,
            forwarder_id: parent_agency.forwarder_id,
            services: {
               connect: uniqueParentsServicesId.map((service_id: number) => ({ id: service_id })),
            },
         },
      });

      // Create agency admin user
      const user_response = await auth.api.signUpEmail({
         body: {
            email: user.email,
            password: user.password,
            name: user.name,
         },
      });

      if (!user_response.token) {
         throw new AppError("Failed to register agency admin user", 500, [], "external_service");
      }

      // Associate user with agency
      await prisma.user.update({
         where: { email: user.email },
         data: {
            agency_id: created_agency.id,
            role: user.role,
         },
      });

      // Create pricing agreements and rates for child agency
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

      const rates_created = await Promise.all(rateCreationPromises);

      res.status(201).json({
         agency: created_agency,
         rates_created_count: rates_created.length,
         message: "Agency and pricing agreements created successfully",
      });
   },

   update: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError("Invalid agency ID", 400, [], "validation");
      }

      const result = agencyUpdateSchema.safeParse(req.body) as z.SafeParseReturnType<
         typeof agencyUpdateSchema,
         Prisma.AgencyUpdateInput
      >;

      if (!result.success) {
         throw new AppError("Invalid agency data", 400, result.error.flatten().fieldErrors, "zod");
      }

      const agency = await repository.agencies.update(agencyId, result.data);
      res.status(200).json({ agency });
   },

   remove: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError("Invalid agency ID", 400, [], "validation");
      }

      const agency = await repository.agencies.delete(agencyId);
      res.status(200).json({ agency });
   },

   getChildren: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError("Invalid agency ID", 400, [], "validation");
      }

      const children = await repository.agencies.getChildren(agencyId);
      res.status(200).json(children);
   },

   getParent: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError("Invalid agency ID", 400, [], "validation");
      }

      const parent = await repository.agencies.getParent(agencyId);
      res.status(200).json(parent);
   },
   getServices: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError("Invalid agency ID", 400, [], "validation");
      }

      const services = await repository.services.getByAgencyId(agencyId);
      res.status(200).json(services);
   },
   getShippingRates: async (req: Request, res: Response): Promise<void> => {
      const { service_id, agency_id } = req.params;
      const rates = await pricingService.getRatesByServiceIdAndAgencyId(Number(service_id), Number(agency_id));
      res.status(200).json(rates);
   },
};

export default agencies;
