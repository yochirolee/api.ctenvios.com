"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const controllers_1 = __importDefault(require("../controllers"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const services_routes = (0, express_1.Router)();
// Admin-only routes
const adminRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
services_routes.post("/", (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.services.create);
services_routes.get("/", (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.services.getAll);
services_routes.get("/:id", (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.services.getById);
services_routes.put("/:id", (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.services.update);
services_routes.delete("/:id", (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.services.delete);
// Public routes (still require authentication via authMiddleware in router.ts)
exports.default = services_routes;
