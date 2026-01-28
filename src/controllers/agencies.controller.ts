import { Request, Response } from "express";
import { z } from "zod";
import { AgencyType, Prisma, Roles } from "@prisma/client";
import { AppError } from "../common/app-errors";
import { agencySchema } from "../types/types";
import repository from "../repositories";
import prisma from "../lib/prisma.client";
import { auth } from "../lib/auth";
import HttpStatusCodes from "../common/https-status-codes";

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
      website: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.string().url().optional()),
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
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      const user_agency = await repository.agencies.getById(user.agency_id);
      if (!user_agency) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Agency not found");
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
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }

      const agency = await repository.agencies.getById(agencyId);
      if (!agency) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Agency not found");
      }

      res.status(200).json(agency);
   },

   getUsers: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }

      const users = await repository.agencies.getUsers(agencyId);
      res.status(200).json(users);
   },
   create: async (req: Request, res: Response): Promise<void> => {
      const { user: current_user } = req as AuthenticatedRequest;

      // Authorization check
      if (!(AGENCY_CREATION_ROLES as readonly Roles[]).includes(current_user.role)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to create agencies");
      }

      if (!current_user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      // Validate parent agency
      const parent_agency = await prisma.agency.findUnique({
         where: { id: current_user.agency_id },
      });

      if (!parent_agency) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Parent agency not found");
      }

      const canCreateChild =
         parent_agency.agency_type === AgencyType.FORWARDER || parent_agency.agency_type === AgencyType.RESELLER;

      if (!canCreateChild) {
         throw new AppError(
            HttpStatusCodes.FORBIDDEN,
            "Only FORWARDER and RESELLER agencies can create child agencies",
         );
      }
      // Validate request body
      const result = create_agency_schema.safeParse(req.body);
      if (!result.success) {
         const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid agency data: ${errors}`);
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
         throw new AppError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "Failed to register agency admin user");
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
      /*  const rateCreationPromises = parent_services.flatMap((service) =>
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
      ); */

      // const rates_created = await Promise.all(rateCreationPromises);

      res.status(201).json({
         agency: created_agency,
         // rates_created_count: rates_created.length,
         message: "Agency and pricing agreements created successfully",
      });
   },

   update: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }

      const result = agencyUpdateSchema.safeParse(req.body) as z.SafeParseReturnType<
         typeof agencyUpdateSchema,
         Prisma.AgencyUpdateInput
      >;

      if (!result.success) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency data");
      }

      const agency = await repository.agencies.update(agencyId, result.data);
      res.status(200).json({ agency });
   },

   remove: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }

      const agency = await repository.agencies.delete(agencyId);
      res.status(200).json({ agency });
   },

   getChildren: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }

      const children = await repository.agencies.getChildren(agencyId);
      res.status(200).json(children);
   },

   getParent: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }

      const parent = await repository.agencies.getParent(agencyId);
      res.status(200).json(parent);
   },
   getServicesWithRates: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }
      const services_with_rates = await repository.services.getServicesWithRates(agencyId);
      if (!services_with_rates) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "No services found");
      }

      const formatted_services_with_rates = services_with_rates.map((service) => {
         return {
            ...service,
            shipping_rates:
               service.shipping_rates.map((rate) => {
                  return {
                     id: rate.id,
                     name: rate.product.name,
                     description: rate.product.description,
                     unit: rate.product.unit,
                     price_in_cents: rate.price_in_cents,
                     cost_in_cents: rate.pricing_agreement.price_in_cents,
                     is_active: rate.is_active,
                     seller_agency_id: rate.pricing_agreement.seller_agency_id,
                     buyer_agency_id: rate.pricing_agreement.buyer_agency_id,
                  };
               }) || [],
         };
      });
      res.status(200).json(formatted_services_with_rates);
   },
   getActiveServicesWithRates: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const agencyId = Number(id);

      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }
      const services_with_rates = await repository.services.getActiveServicesWithRates(agencyId);
      if (!services_with_rates) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "No services found");
      }
      const formatted_services_with_rates = services_with_rates.map((service) => {
         return {
            ...service,
            shipping_rates:
               service.shipping_rates.map((rate) => {
                  return {
                     id: rate.id,
                     name: rate.product.name,
                     description: rate.product.description,
                     unit: rate.product.unit,
                     price_in_cents: rate.price_in_cents,
                     cost_in_cents: rate.pricing_agreement.price_in_cents,
                     is_active: rate.is_active,
                  };
               }) || [],
         };
      });
      res.status(200).json(formatted_services_with_rates);
   },
   getParcelsInAgency: async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { page, limit } = req.query;
      const agencyId = Number(id);
      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;
      if (isNaN(agencyId) || agencyId <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency ID");
      }
      const { parcels: parcels_data, total } = await repository.parcels.getInAgency(agencyId, pageNumber, limitNumber);
      res.status(200).json({ rows: parcels_data, total: total });
   },
};

export default agencies;
