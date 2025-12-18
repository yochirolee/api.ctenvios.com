import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate.middleware";
import controllers from "../controllers";

const carriersRoutes = Router();

// Schema de validación para crear carrier
const createCarrierSchema = z.object({
   name: z.string().min(1, "Name is required").max(255),
   forwarder_id: z.number().int().positive("Forwarder ID must be a positive integer"),
});

// Schema de validación para actualizar carrier
const updateCarrierSchema = z.object({
   name: z.string().min(1).max(255).optional(),
   forwarder_id: z.number().int().positive().optional(),
});

// Nota: Los schemas de validación para crear usuarios ahora están en users.routes.ts

/**
 * GET /api/v1/carriers
 * Get all carriers (with permissions check)
 */
carriersRoutes.get("/", controllers.carriers.getAll);

/**
 * GET /api/v1/carriers/:id
 * Get carrier by ID
 */
carriersRoutes.get("/:id", controllers.carriers.getById);

/**
 * GET /api/v1/carriers/:id/users
 * Get all users of a carrier
 */
carriersRoutes.get("/:id/users", controllers.carriers.getUsers);

/**
 * POST /api/v1/carriers
 * Create a new carrier
 */
carriersRoutes.post("/", validate({ body: createCarrierSchema }), controllers.carriers.create);

// Nota: La creación de usuarios de carrier ahora se hace a través de POST /api/v1/users con carrier_id

/**
 * PUT /api/v1/carriers/:id
 * Update a carrier
 */
carriersRoutes.put("/:id", validate({ body: updateCarrierSchema }), controllers.carriers.update);

/**
 * DELETE /api/v1/carriers/:id
 * Delete a carrier
 */
carriersRoutes.delete("/:id", controllers.carriers.remove);

export default carriersRoutes;

