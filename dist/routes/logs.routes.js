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
 * GET /api/v1/logs
 * Get all logs (paginated) with optional filters
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 100, max: 1000)
 *   - level (optional): ERROR | WARN | INFO | HTTP | DEBUG
 *   - source (optional): e.g., "http", "prisma", "application", "partner"
 *   - status_code (optional): HTTP status code (100-599)
 *   - user_id (optional): Filter by user ID
 *   - path (optional): Partial match on request path
 *   - method (optional): GET | POST | PUT | PATCH | DELETE | OPTIONS | HEAD
 *   - startDate (optional): ISO 8601 date string
 *   - endDate (optional): ISO 8601 date string
 *
 * Examples:
 *   GET /api/v1/logs?level=ERROR&source=prisma
 *   GET /api/v1/logs?status_code=500&method=POST
 *   GET /api/v1/logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
 *   GET /api/v1/logs?path=/api/orders&level=ERROR
 */
router.get("/", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.getLogs);
router.get("/:id", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.getLogById);
/**
 * GET /api/v1/logs/stats
 * Get logs statistics
 */
router.get("/stats", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.getLogsStats);
/**
 * GET /api/v1/logs/by-level
 * Get logs by level (paginated)
 * Query params: level (required), page (default: 1), limit (default: 100, max: 1000)
 */
router.get("/by-level", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.getLogsByLevel);
/**
 * GET /api/v1/logs/by-source
 * Get logs by source (paginated)
 * Query params: source (required), page (default: 1), limit (default: 100, max: 1000)
 */
router.get("/by-source", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.getLogsBySource);
/**
 * DELETE /api/v1/logs
 * Delete all logs
 */
router.delete("/", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.deleteAll);
/**
 * DELETE /api/v1/logs/by-date-range
 * Delete logs within a date range
 * Body: { startDate: string (ISO 8601), endDate: string (ISO 8601) }
 */
router.delete("/by-date-range", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.deleteByDateRange);
/**
 * DELETE /api/v1/logs/by-level
 * Delete logs by level (ERROR, WARN, INFO, HTTP, DEBUG)
 * Body: { level: LogLevel }
 */
router.delete("/by-level", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.deleteByLevel);
/**
 * DELETE /api/v1/logs/by-source
 * Delete logs by source (e.g., "http", "prisma", "application")
 * Body: { source: string }
 */
router.delete("/by-source", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.deleteBySource);
/**
 * DELETE /api/v1/logs/older-than
 * Delete logs older than specified days
 * Body: { olderThanDays: number }
 */
router.delete("/older-than", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.deleteOlderThan);
/**
 * DELETE /api/v1/logs/:id
 * Delete a specific log by ID
 */
router.delete("/:id", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRoles)(adminRoles), controllers_1.default.logs.deleteById);
exports.default = router;
