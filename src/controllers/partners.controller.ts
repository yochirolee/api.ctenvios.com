import { Response } from "express";
import { z } from "zod";
import { Roles } from "@prisma/client";
import { AppError } from "../common/app-errors";
import repository from "../repositories";
import prisma from "../config/prisma_db";
import { services } from "../services";
import { pricingService } from "../services/pricing.service";
import HttpStatusCodes from "../common/https-status-codes";

const partnerCreateSchema = z.object({
   name: z.string().min(1, "Name is required"),
   email: z.string().email("Valid email is required"),
   contact_name: z.string().min(1, "Contact name is required"),
   phone: z.string().min(10, "Valid phone number is required"),
   agency_id: z.number().int().positive("Valid agency ID is required"),
   rate_limit: z.number().int().positive().optional().default(1000),
   forwarder_id: z.number().int().positive("Valid forwarder ID is required"),
});

const partnerUpdateSchema = z.object({
   name: z.string().min(1).optional(),
   email: z.string().email().optional(),
   contact_name: z.string().min(1).optional(),
   phone: z.string().min(10).optional(),
   rate_limit: z.number().int().positive().optional(),
   forwarder_id: z.number().int().positive().optional(),
   is_active: z.boolean().optional(),
});

const partners = {
   getAll: async (req: any, res: Response): Promise<void> => {
      const user = req.user;

      // Only ROOT, ADMINISTRATOR, and FORWARDER_ADMIN can see all partners
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];

      if (!permittedRoles.includes(user.role)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view partners");
      }

      const allPartners = await repository.partners.getAll();
      res.status(200).json(allPartners);
   },

   getById: async (req: any, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      const partner = await repository.partners.getById(parseInt(id));

      if (!partner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization - only admins or users from the same agency can view
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];
      if (!permittedRoles.includes(user.role) && user.agency_id !== partner.agency_id) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view this partner");
      }

      res.status(200).json(partner);
   },

   create: async (req: any, res: Response): Promise<void> => {
      const user = req.user;

      // Only specific roles can create partners
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR];
      if (!permittedRoles.includes(user.role)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to create partners");
      }

      // Validate request body
      const result = partnerCreateSchema.safeParse(req.body);
      if (!result.success) {
         const fieldErrors = result.error.flatten().fieldErrors;
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid partner data");
      }

      const { name, email, contact_name, phone, agency_id, rate_limit, forwarder_id } = result.data;

      // Verify the agency exists
      const agency = await prisma.agency.findUnique({
         where: { id: agency_id },
         select: { id: true },
      });

      if (!agency) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Agency not found");
      }

      /*  if (!agency.is_active) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot create partner for inactive agency");
      } */

      // Check if user is authorized to create partner for this agency
      if (
         !permittedRoles.slice(0, 3).includes(user.role) && // Not ROOT, ADMIN, or FORWARDER_ADMIN
         user.agency_id !== agency_id
      ) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You can only create partners for your own agency");
      }

      // Create the partner
      const partner = await repository.partners.create({
         name,
         email,
         contact_name,
         phone,
         rate_limit,
         agency: { connect: { id: agency_id } },
         forwarder: { connect: { id: forwarder_id } },
      });

      res.status(201).json({
         message: "Partner created successfully",
         partner,
      });
   },

   update: async (req: any, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      // Validate request body
      const result = partnerUpdateSchema.safeParse(req.body);
      if (!result.success) {
         const fieldErrors = result.error.flatten().fieldErrors;
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid partner data");
      }

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];
      if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to update this partner");
      }

      const updatedPartner = await repository.partners.update(parseInt(id), result.data);

      res.status(200).json({
         message: "Partner updated successfully",
         partner: updatedPartner,
      });
   },

   delete: async (req: any, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Only ROOT, ADMINISTRATOR, and FORWARDER_ADMIN can delete partners
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];
      if (!permittedRoles.includes(user.role)) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to delete partners");
      }

      await repository.partners.delete(parseInt(id));

      res.status(200).json({
         message: "Partner deleted successfully",
      });
   },

   createApiKey: async (req: any, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      console.log(id, "id");
      console.log(user, "user");

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      // Validate optional body parameters
      const { name, environment = "live", expires_in_days } = req.body;

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR];
      if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to create API keys for this partner");
      }

      // Calculate expiration date if provided
      let expiresAt: Date | undefined;
      if (expires_in_days && expires_in_days > 0) {
         expiresAt = new Date();
         expiresAt.setDate(expiresAt.getDate() + expires_in_days);
      }

      const apiKey = await repository.partners.createApiKey(parseInt(id), {
         name,
         environment,
         expiresAt,
      });

      res.status(201).json({
         message: "API key created successfully. Save this key securely - it will not be shown again.",
         api_key: {
            id: apiKey.id,
            key: apiKey.displayKey, // This is the only time the full key is shown!
            prefix: apiKey.prefix,
         },
         warning: "⚠️ Store this API key securely. You will not be able to see it again.",
      });
   },

   getApiKeys: async (req: any, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];
      if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view API keys for this partner");
      }

      const apiKeys = await repository.partners.getApiKeys(parseInt(id));

      res.status(200).json({
         api_keys: apiKeys,
         note: "API key values are hashed and cannot be retrieved. Only metadata is shown.",
      });
   },

   revokeApiKey: async (req: any, res: Response): Promise<void> => {
      const { id, keyId } = req.params;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      if (!keyId) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid API key ID is required");
      }

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR];
      if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to revoke API keys for this partner");
      }

      await repository.partners.revokeApiKey(keyId);

      res.status(200).json({
         message: "API key revoked successfully",
      });
   },

   deleteApiKey: async (req: any, res: Response): Promise<void> => {
      const { id, keyId } = req.params;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      if (!keyId) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid API key ID is required");
      }

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization - Only ROOT can permanently delete
      if (user.role !== Roles.ROOT) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "Only ROOT users can permanently delete API keys. Use revoke instead.");
      }

      await repository.partners.deleteApiKey(keyId);

      res.status(200).json({
         message: "API key permanently deleted",
      });
   },

   getLogs: async (req: any, res: Response): Promise<void> => {
      const { id } = req.params;
      const { limit, offset } = req.query;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];
      if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view logs for this partner");
      }

      const logs = await repository.partners.getLogs(
         parseInt(id),
         limit ? parseInt(limit as string) : 100,
         offset ? parseInt(offset as string) : 0
      );

      res.status(200).json(logs);
   },

   getStats: async (req: any, res: Response): Promise<void> => {
      const { id } = req.params;
      const user = req.user;

      if (!id || isNaN(parseInt(id))) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid partner ID is required");
      }

      // Check if partner exists
      const existingPartner = await repository.partners.getById(parseInt(id));
      if (!existingPartner) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Partner not found");
      }

      // Check authorization
      const permittedRoles = [Roles.ROOT, Roles.ADMINISTRATOR, Roles.FORWARDER_ADMIN];
      if (!permittedRoles.includes(user.role) && user.agency_id !== existingPartner.agency_id) {
         throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view stats for this partner");
      }

      const stats = await repository.partners.getStats(parseInt(id));

      res.status(200).json(stats);
   },
   //Order creation for partners
   createOrder: async (req: any, res: Response): Promise<void> => {
      const {
         partner_order_id,
         customer_id,
         receiver_id,
         customer,
         receiver,
         service_id,
         items,
         total_delivery_fee_in_cents,
         requires_home_delivery,
      } = req.body;
      const user = req.user;
      // Get agency user (needed for order creation)
      const agencyUser = await prisma.user.findFirst({
         where: { agency_id: req.partner.agency_id },
         select: { id: true },
      });

      if (!agencyUser) {
         throw new AppError(HttpStatusCodes.INTERNAL_SERVER_ERROR, "No user found for partner's agency");
      }
      const orderResult = await services.orders.create({
         partner_order_id,
         customer_id,
         receiver_id,
         customer,
         receiver,
         service_id,
         items,
         user_id: agencyUser.id,
         agency_id: req.partner.agency_id,
         total_delivery_fee_in_cents,
         requires_home_delivery,
      });

      res.status(200).json({
         message: "Order created successfully",
         data: orderResult,
      });
   },
   getRates: async (req: any, res: Response): Promise<void> => {
      if (!req.partner) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Partner authentication required");
      }

      const agency_id = req.partner.agency_id;

      // Parse service_id from query params (optional filter)
      const service_id = req.query.service_id ? parseInt(req.query.service_id as string) : undefined;

      // Validate service_id if provided
      if (service_id !== undefined && (isNaN(service_id) || service_id <= 0)) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid service_id parameter");
      }

      // Get rates with optional service filter
      const rates = await pricingService.getRatesByServiceIdAndAgencyId(service_id ?? 0, agency_id ?? 0);

      res.status(200).json({
         status: "success",
         count: rates.length,
         filters: {
            agency_id,
            service_id: service_id || "all",
         },
         data: rates,
      });
   },
};

export default partners;
