import { Router, Response } from "express";
import prisma from "../lib/prisma.client";
import { services } from "../services";
import StatusCodes from "../common/https-status-codes";
import z from "zod";
import { Unit } from "@prisma/client";
import productController from "../controllers/product.controller";
import { validate } from "../middlewares/validate.middleware";

const products_routes = Router();

const createProductSchema = z.object({
   id: z.number().optional(),
   provider_id: z.number(),
   name: z.string(),
   description: z.string(),
   unit: z.nativeEnum(Unit),
   length: z.number().optional(),
   width: z.number().optional(),
   height: z.number().optional(),
   is_active: z.boolean(),
});

const updateProductSchema = z.object({
   name: z.string().optional(),
   description: z.string().optional(),
   unit: z.nativeEnum(Unit).optional(),
   length: z.number().optional(),
   width: z.number().optional(),
   height: z.number().optional(),
   is_active: z.boolean().optional(),
   serviceIds: z.array(z.number().positive()).min(1).optional(),
});

products_routes.get("/", productController.getAll);

products_routes.post("/", validate({ body: createProductSchema }), productController.create);

products_routes.get("/", productController.getAll);

products_routes.get("/:id", productController.getById);

products_routes.put("/:id", validate({ body: updateProductSchema }), productController.update);

products_routes.delete("/:id", productController.delete);

products_routes.post("/:id/connect-service", productController.connectServices);
products_routes.delete("/:id/disconnect-service", productController.disconnectServices);

// Create pricing agreement and shipping rate for a product
//this has to be moved to shipping rates routes and controller
products_routes.post("/:productId/pricing", async (req: any, res: Response) => {
   try {
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
         return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid product ID" });
      }

      const { service_id, seller_agency_id, buyer_agency_id, cost_in_cents, price_in_cents, name, is_active } =
         req.body;

      // Validate required fields
      if (
         !service_id ||
         seller_agency_id === undefined ||
         buyer_agency_id === undefined ||
         cost_in_cents === undefined ||
         price_in_cents === undefined
      ) {
         return res.status(StatusCodes.BAD_REQUEST).json({
            error: "Missing required fields: service_id, seller_agency_id, buyer_agency_id, cost_in_cents, price_in_cents",
         });
      }

      // Create pricing agreement and shipping rate
      const result = await services.pricing.createPricingWithRate({
         product_id: productId,
         service_id,
         seller_agency_id,
         buyer_agency_id,
         cost_in_cents,
         price_in_cents,
         name,
         is_active,
      });

      return res.status(StatusCodes.CREATED).json({
         message: "Pricing created successfully",
         data: result,
      });
   } catch (error: any) {
      console.error("Error creating pricing:", error);

      // Handle AppError instances with proper status codes
      if (error.statusCode) {
         return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
         error: "Error creating pricing",
         details: error.message,
      });
   }
});

// Get all pricing for a specific product
products_routes.get("/:productId/pricing", async (req: any, res: Response) => {
   try {
      const productId = parseInt(req.params.productId);

      if (isNaN(productId)) {
         return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid product ID" });
      }

      const pricing = await services.pricing.getProductPricing(productId);

      return res.status(StatusCodes.OK).json(pricing);
   } catch (error: any) {
      console.error("Error fetching product pricing:", error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
         error: "Error fetching product pricing",
         details: error.message,
      });
   }
});

export default products_routes;
