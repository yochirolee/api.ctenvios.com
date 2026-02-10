"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const controllers_1 = __importDefault(require("../controllers"));
const carriersRoutes = (0, express_1.Router)();
// Schema de validación para crear carrier
const createCarrierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required").max(255),
    forwarder_id: zod_1.z.number().int().positive("Forwarder ID must be a positive integer"),
});
// Schema de validación para actualizar carrier
const updateCarrierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    forwarder_id: zod_1.z.number().int().positive().optional(),
});
// Nota: Los schemas de validación para crear usuarios ahora están en users.routes.ts
/**
 * GET /api/v1/carriers
 * Get all carriers (with permissions check)
 */
carriersRoutes.get("/", controllers_1.default.carriers.getAll);
/**
 * GET /api/v1/carriers/:id
 * Get carrier by ID
 */
carriersRoutes.get("/:id", controllers_1.default.carriers.getById);
/**
 * GET /api/v1/carriers/:id/users
 * Get all users of a carrier
 */
carriersRoutes.get("/:id/users", controllers_1.default.carriers.getUsers);
/**
 * POST /api/v1/carriers
 * Create a new carrier
 */
carriersRoutes.post("/", (0, validate_middleware_1.validate)({ body: createCarrierSchema }), controllers_1.default.carriers.create);
// Nota: La creación de usuarios de carrier ahora se hace a través de POST /api/v1/users con carrier_id
/**
 * PUT /api/v1/carriers/:id
 * Update a carrier
 */
carriersRoutes.put("/:id", (0, validate_middleware_1.validate)({ body: updateCarrierSchema }), controllers_1.default.carriers.update);
/**
 * DELETE /api/v1/carriers/:id
 * Delete a carrier
 */
carriersRoutes.delete("/:id", controllers_1.default.carriers.remove);
exports.default = carriersRoutes;
