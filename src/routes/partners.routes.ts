import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { partnerAuthMiddleware, partnerLogMiddleware } from "../middlewares/partner.auth.middleware";
import controllers from "../controllers";
import prisma from "../lib/prisma.client";
import { z } from "zod";
import { AppError } from "../common/app-errors";
import { Unit } from "@prisma/client";
import { validate } from "../middlewares/validate.middleware";
import { createCustomerSchema, createReceiverSchema } from "../types/types";
import HttpStatusCodes from "../common/https-status-codes";

const router = Router();

// ============================================
// ADMIN ROUTES - Partner Management
// ============================================

/**
 * GET /partners
 * Get all partners (admin only)
 */

/**Find partner by agency id */
router.get("/admin/agency/:agencyId", authMiddleware, async (req, res) => {
   const { agencyId } = req.params;
   const partners = await prisma.partner.findMany({
      where: {
         agency_id: parseInt(agencyId),
      },
   });
   res.status(200).json(partners);
});

router.get("/admin", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.getAll(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * GET /partners/:id
 * Get partner by ID (admin or partner's agency)
 */
router.get("/admin/:id", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.getById(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * POST /partners
 * Create a new partner (admin or agency admin)
 */
router.post("/admin", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.create(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * PUT /partners/:id
 * Update partner (admin or partner's agency)
 */
router.put("/admin/:id", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.update(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * DELETE /partners/:id
 * Delete partner (admin only)
 */
router.delete("/admin/:id", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.delete(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * POST /partners/:id/api-keys
 * Create a new API key for a partner
 * Body: { name?: string, environment?: "live" | "test", expires_in_days?: number }
 */
router.post("/admin/:id/api-keys", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.createApiKey(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * GET /partners/:id/api-keys
 * Get all API keys for a partner (metadata only, not actual keys)
 */
router.get("/admin/:id/api-keys", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.getApiKeys(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * POST /partners/:id/api-keys/:keyId/revoke
 * Revoke (soft delete) an API key
 */
router.post("/admin/:id/api-keys/:keyId/revoke", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.revokeApiKey(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * DELETE /partners/:id/api-keys/:keyId
 * Permanently delete an API key (ROOT only)
 */
router.delete("/admin/:id/api-keys/:keyId", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.deleteApiKey(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * GET /partners/:id/logs
 * Get partner request logs
 */
router.get("/admin/:id/logs", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.getLogs(req, res);
   } catch (error) {
      next(error);
   }
});

/**
 * GET /partners/:id/stats
 * Get partner statistics
 */
router.get("/admin/:id/stats", authMiddleware, async (req, res, next) => {
   try {
      await controllers.partners.getStats(req, res);
   } catch (error) {
      next(error);
   }
});

// ============================================
// PARTNER API ROUTES - External Integration
// ============================================

const partnerOrderItemSchema = z.object({
   description: z.string().min(1),
   rate_id: z.number().positive(),
   weight: z.number().positive(),
   price_in_cents: z.number().optional(),
   unit: z.nativeEnum(Unit).optional().default(Unit.PER_LB),
   insurance_fee_in_cents: z.number().optional(),
   charge_fee_in_cents: z.number().optional(),
});

const partnerOrderSchema = z.object({
   partner_order_id: z.string().optional(),
   partner_id: z.number().optional(),
   customer_id: z.number().optional(),
   customer: createCustomerSchema.optional(),
   receiver_id: z.number().optional(),
   receiver: createReceiverSchema.optional(),
   service_id: z.number().positive(),
   order_items: z.array(partnerOrderItemSchema).min(1).optional(),
   total_delivery_fee_in_cents: z.number().int().min(0).optional().default(0),
   requires_home_delivery: z.boolean().optional().default(true),
});

/**
 * POST /partners/api/orders
 * Create order via Partner API
 * Requires API key authentication
 */
/**
 * POST /partners/api/orders
 * Create order via Partner API
 * Requires API key authentication
 */
router.post(
   "/orders",
   partnerAuthMiddleware,
   partnerLogMiddleware,
   validate({ body: partnerOrderSchema }),
   controllers.partners.createOrder
);

/**
 * GET /partners/api/rates
 * Get rates via Partner API
 * Requires API key authentication
 */
router.get("/services", partnerAuthMiddleware, partnerLogMiddleware, controllers.partners.getServices);

/**
 * GET /partners/api/orders/:id
 * Get order details via Partner API
 * Requires API key authentication
 */
router.get("/orders/:id", partnerAuthMiddleware, partnerLogMiddleware, async (req: any, res) => {
   try {
      const partner = req.partner;
      const { id } = req.params;

      if (!partner) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Partner authentication required");
      }

      if (!id || isNaN(parseInt(id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Valid order ID is required");
      }

      // Get order and verify it belongs to partner
      const order = await prisma.order.findFirst({
         where: {
            id: parseInt(id),
            agency_id: partner.agency_id,
         },
         include: {
            customer: {
               select: {
                  first_name: true,
                  last_name: true,
                  mobile: true,
                  email: true,
               },
            },
            receiver: {
               select: {
                  first_name: true,
                  last_name: true,
                  mobile: true,
                  address: true,
                  province: { select: { name: true } },
                  city: { select: { name: true } },
               },
            },
            service: {
               select: {
                  name: true,
                  service_type: true,
               },
            },
            order_items: {
               select: {
                  hbl: true,
                  description: true,
                  weight: true,
                  price_in_cents: true,
                  charge_fee_in_cents: true,
                  delivery_fee_in_cents: true,
                  insurance_fee_in_cents: true,
                  customs_fee_in_cents: true,
                  unit: true,
               },
               orderBy: { hbl: "asc" },
            },
         },
      });

      if (!order) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Order not found");
      }

      res.status(200).json({
         status: "success",
         data: order,
      });
   } catch (error: any) {
      console.error("Partner API get order error:", error);

      if (error instanceof AppError) {
         return res.status(error.status).json({
            status: "error",
            message: error.message,
         });
      }

      res.status(500).json({
         status: "error",
         message: "Error retrieving order",
         error: error.message || error,
      });
   }
});

/**
 * GET /partners/api/tracking/:hbl
 * Track package by HBL via Partner API
 * Requires API key authentication
 */
router.get("/tracking/:hbl", partnerAuthMiddleware, partnerLogMiddleware, async (req: any, res) => {
   try {
      const partner = req.partner;
      const { hbl } = req.params;

      if (!partner) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "Partner authentication required");
      }

      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "HBL tracking number is required");
      }

      // Get item with invoice info
      const item = await prisma.orderItem.findFirst({
         where: {
            hbl: hbl,
            agency_id: partner.agency_id,
         },
         select: {
            hbl: true,
            description: true,
            weight: true,
            status: true,
            created_at: true,
            updated_at: true,
            order: {
               select: {
                  id: true,
                  status: true,
                  payment_status: true,
                  created_at: true,
                  receiver: {
                     select: {
                        first_name: true,
                        last_name: true,
                        city: { select: { name: true } },
                        province: { select: { name: true } },
                     },
                  },
               },
            },
         },
      });

      if (!item) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Tracking number not found");
      }

      res.status(200).json({
         status: "success",
         data: item,
      });
   } catch (error: any) {
      console.error("Partner API tracking error:", error);

      if (error instanceof AppError) {
         return res.status(error.status).json({
            status: "error",
            message: error.message,
         });
      }

      res.status(500).json({
         status: "error",
         message: "Error tracking package",
         error: error.message || error,
      });
   }
});

export default router;
