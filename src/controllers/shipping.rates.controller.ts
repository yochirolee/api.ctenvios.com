import { Request, Response } from "express";
import { Roles, AgencyType } from "@prisma/client";
import { pricingService } from "../services/pricing.service";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import repository from "../repositories";

// Admin roles that can update any pricing
const ADMIN_ROLES: Roles[] = [Roles.ROOT, Roles.ADMINISTRATOR];

interface ShippingRateRequest extends Request {
   user?: {
      id: string;
      role: Roles;
      agency_id: number | null;
   };
}

const shippingRates = {
   create: async (req: ShippingRateRequest, res: Response) => {
      const { product_id, buyer_agency_id, seller_agency_id, service_id, price_in_cents, cost_in_cents, is_active } =
         req.body;
      const user = req.user;

      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      const isAdmin = ADMIN_ROLES.includes(user.role);

      // Permission check for non-admin users
      if (!isAdmin) {
         if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "User must belong to an agency");
         }

         // AGENCY_ADMIN can only create agreements for their CHILDREN (not themselves)
         // Parent agency sets rates for children, not the other way around
         if (user.role === Roles.AGENCY_ADMIN) {
            const childAgencies = await repository.agencies.getAllChildrenRecursively(user.agency_id);

            // Seller MUST be user's agency (they are selling to their children)
            if (seller_agency_id !== user.agency_id) {
               throw new AppError(
                  HttpStatusCodes.FORBIDDEN,
                  "You can only create pricing agreements where your agency is the seller"
               );
            }

            // Buyer MUST be a child agency (NOT same agency - no internal rates by AGENCY_ADMIN)
            if (!childAgencies.includes(buyer_agency_id)) {
               throw new AppError(
                  HttpStatusCodes.FORBIDDEN,
                  "You can only create pricing agreements for your child agencies. To modify your own rates, contact your parent agency or administrator."
               );
            }
         } else {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You don't have permission to create pricing agreements");
         }
      }

      // Validate internal rates: Only FORWARDER agencies can have seller === buyer
      if (seller_agency_id === buyer_agency_id) {
         const agency = await prisma.agency.findUnique({
            where: { id: seller_agency_id },
            select: { agency_type: true, name: true },
         });

         if (!agency) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Agency not found");
         }

         if (agency.agency_type !== AgencyType.FORWARDER) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               "Only forwarder agencies can have internal rates (where seller equals buyer). Regular agencies must have rates set by their parent agency."
            );
         }
      }

      // Create pricing agreement and rate in a transaction (implemented in pricingService)
      const result = await pricingService.createPricingWithRate({
         product_id,
         buyer_agency_id,
         seller_agency_id,
         service_id,
         price_in_cents,
         cost_in_cents,
         is_active,
      });
      res.status(201).json({
         message: "Shipping rate created successfully",
         data: result,
      });
   },
   update: async (req: ShippingRateRequest, res: Response) => {
      const { id } = req.params;
      const { price_in_cents, cost_in_cents } = req.body;
      const user = req.user;

      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      // Execute update in a transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
         // 1. Get the shipping rate with agreement details first for permission check
         const existingRate = await tx.shippingRate.findUnique({
            where: { id: Number(id) },
            include: {
               pricing_agreement: true,
            },
         });

         if (!existingRate) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Shipping rate not found");
         }

         if (!existingRate.pricing_agreement) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, "Agreement not found");
         }

         const agreement = existingRate.pricing_agreement;
         const isAdmin = ADMIN_ROLES.includes(user.role);

         // Determine if user can modify the agreement cost
         let canModifyAgreement = isAdmin;

         // ========== PERMISSION CHECK ==========
         if (!isAdmin) {
            if (!user.agency_id) {
               throw new AppError(HttpStatusCodes.FORBIDDEN, "User must belong to an agency");
            }

            const childAgencies = await repository.agencies.getAllChildrenRecursively(user.agency_id);

            // Check if user can update the shipping rate (sales price)
            // User can update rates for their agency or child agencies
            const canUpdateRate =
               existingRate.agency_id === user.agency_id || childAgencies.includes(existingRate.agency_id);

            if (!canUpdateRate) {
               throw new AppError(
                  HttpStatusCodes.FORBIDDEN,
                  "You can only update shipping rates for your agency or child agencies"
               );
            }

            // AGENCY_ADMIN can modify agreement cost ONLY if they are the SELLER
            // (i.e., they are updating the cost they charge to their children)
            const isSeller = agreement.seller_agency_id === user.agency_id;
            canModifyAgreement = isSeller;

            // If user sends cost_in_cents but can't modify it, we silently ignore it
            // This makes the API more forgiving and frontend simpler
         }

         // 2. Update the shipping rate (sales price)
         const shippingRate = await tx.shippingRate.update({
            where: { id: Number(id) },
            data: {
               price_in_cents,
            },
         });

         // 3. Update the pricing agreement cost ONLY if user has permission
         let pricingAgreement = agreement;
         if (cost_in_cents !== undefined && canModifyAgreement) {
            pricingAgreement = await tx.pricingAgreement.update({
               where: {
                  id: agreement.id,
               },
               data: {
                  price_in_cents: cost_in_cents,
               },
            });
         }

         return {
            shippingRate,
            pricingAgreement,
         };
      });

      res.status(200).json({
         message: "Shipping rate updated successfully",
         data: result,
      });
   },
   getByServiceIdAndAgencyId: async (req: Request, res: Response) => {
      const { service_id, agency_id } = req.params;
      const result = await pricingService.getRatesByServiceIdAndAgencyId(Number(service_id), Number(agency_id));
      res.status(200).json(result);
   },

   /**
    * Toggle the is_active status of a shipping rate
    * - An agency can toggle their OWN rates
    * - An agency can toggle their CHILD's rates (explicit action, no cascade)
    * - Only updates ShippingRate.is_active, NOT PricingAgreement.is_active
    */
   toggleStatus: async (req: ShippingRateRequest, res: Response) => {
      const { id } = req.params;
      const { is_active } = req.body;
      const user = req.user;

      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
      }

      if (typeof is_active !== "boolean") {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "is_active must be a boolean");
      }

      // Get the shipping rate
      const existingRate = await prisma.shippingRate.findUnique({
         where: { id: Number(id) },
         include: {
            agency: { select: { id: true, name: true } },
         },
      });

      if (!existingRate) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Shipping rate not found");
      }

      const isAdmin = ADMIN_ROLES.includes(user.role);

      // ========== PERMISSION CHECK ==========
      if (!isAdmin) {
         if (!user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "User must belong to an agency");
         }

         const childAgencies = await repository.agencies.getAllChildrenRecursively(user.agency_id);

         // User can toggle status for their own agency OR child agencies
         const canToggle =
            existingRate.agency_id === user.agency_id || childAgencies.includes(existingRate.agency_id);

         if (!canToggle) {
            throw new AppError(
               HttpStatusCodes.FORBIDDEN,
               "You can only toggle status for your agency's rates or your child agencies' rates"
            );
         }
      }

      // Update only the ShippingRate is_active (NOT the PricingAgreement)
      const updatedRate = await prisma.shippingRate.update({
         where: { id: Number(id) },
         data: { is_active },
         include: {
            agency: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
         },
      });

      res.status(200).json({
         message: `Shipping rate ${is_active ? "enabled" : "disabled"} successfully`,
         data: updatedRate,
      });
   },
};

export default shippingRates;
