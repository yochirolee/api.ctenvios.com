import { Router } from "express";
import { Roles } from "@prisma/client";
import controllers from "../controllers";
import { requireRoles } from "../middlewares/auth.middleware";

const services_routes = Router();

// Admin-only routes
const adminRoles = [Roles.ROOT, Roles.ADMINISTRATOR];

services_routes.post("/", requireRoles(adminRoles), controllers.services.create);
services_routes.get("/", requireRoles(adminRoles), controllers.services.getAll);
services_routes.get("/:id", requireRoles(adminRoles), controllers.services.getById);
services_routes.put("/:id", requireRoles(adminRoles), controllers.services.update);
services_routes.delete("/:id", requireRoles(adminRoles), controllers.services.delete);
// Public routes (still require authentication via authMiddleware in router.ts)

export default services_routes;
