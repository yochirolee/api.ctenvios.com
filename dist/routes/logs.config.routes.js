"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const controllers_1 = __importDefault(require("../controllers"));
const router = (0, express_1.Router)();
// Admin-only routes (ROOT and ADMINISTRATOR)
const adminRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
/**
 * GET /api/v1/config/logging
 * Get current logging configuration status
 */
router.get("/logging-status", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.config.getLoggingConfig);
/**
 * PUT /api/v1/config/logging
 * Enable or disable logging
 * Body: { enabled: boolean }
 */
router.put("/logging-status", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.config.updateLoggingConfig);
/**
 * GET /api/v1/config
 * Get all application configurations
 */
router.get("/", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.config.getAllConfig);
/**
 * GET /api/v1/config/:key
 * Get specific configuration by key
 */
//router.get("/:key", authMiddleware, requireRoles(adminRoles), controllers.config.getConfig);
/**
 * PUT /api/v1/config/:key
 * Update or create configuration
 * Body: { value: string, description?: string }
 */
//router.put("/:key", authMiddleware, requireRoles(adminRoles), controllers.config.updateConfig);
exports.default = router;
