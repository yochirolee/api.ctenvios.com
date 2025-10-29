import { Router, Response } from "express";
import prisma from "../config/prisma_db";
import { services } from "../services";
import StatusCodes from "../common/https-status-codes";

const products_routes = Router();

products_routes.get("/", async (req: any, res: Response) => {
   const products = await prisma.product.findMany({
      select: {
         id: true,
         name: true,
         description: true,
         unit: true,
         length: true,
         width: true,
         height: true,
      },
   });
   res.status(200).json(products);
});

products_routes.post("/", async (req: any, res: any) => {
   try {
      const { name, description, service_id, unit, length, width, height } = req.body;

      const providerAgencyId = req.user.agency_id; // Obtenido del token de autenticación

      // --- VALIDACIÓN ---
      if (!name || !service_id || !unit) {
         return res.status(400).json({ error: "Nombre, servicio y unidad son obligatorios." });
      }

      // Opcional: Verificar si ya existe un producto con el mismo nombre para ese servicio
      const existingProduct = await prisma.product.findUnique({
         where: {
            provider_id_service_id_name: {
               name: name,
               service_id: service_id,
               provider_id: providerAgencyId,
            },
         },
      });

      if (existingProduct) {
         return res.status(409).json({ error: "Ya existe un producto con este nombre para el servicio seleccionado." });
      }

      // --- CREACIÓN ---
      const newProduct = await prisma.product.create({
         data: {
            name,
            description,
            unit,
            length,
            width,
            height,
            service: { connect: { id: service_id } },
            provider: { connect: { id: providerAgencyId } },
         },
      });

      return res.status(201).json(newProduct);
   } catch (error) {
      console.error("Error al crear el producto:", error);
      return res.status(500).json({ error: "Error interno del servidor." });
   }
});

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
