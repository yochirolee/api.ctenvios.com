import { Router } from "express";
import { Roles } from "@prisma/client";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import controllers from "../controllers";

const router = Router();

// Admin-only routes (ROOT and ADMINISTRATOR)
const adminRoles = [Roles.ROOT, Roles.ADMINISTRATOR];

/**
 * GET /api/v1/config/logging
 * Get current logging configuration status
 */
router.get("/logging-status", authMiddleware, requireRoles(adminRoles), controllers.config.getLoggingConfig);

/**
 * PUT /api/v1/config/logging
 * Enable or disable logging
 * Body: { enabled: boolean }
 */
router.put("/logging-status", authMiddleware, requireRoles(adminRoles), controllers.config.updateLoggingConfig);

/**
 * GET /api/v1/config
 * Get all application configurations
 */
router.get("/", authMiddleware, requireRoles(adminRoles), controllers.config.getAllConfig);

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

export default router;
