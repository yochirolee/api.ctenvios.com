"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConfig = exports.getConfig = exports.getAllConfig = exports.updateLoggingConfig = exports.getLoggingConfig = void 0;
const config_service_1 = require("../services/config.service");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
/**
 * Get logging configuration status
 * GET /api/v1/config/logging
 */
const getLoggingConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const enabled = yield config_service_1.configService.getBoolean("logging_enabled", true);
    res.status(200).json({
        logging_enabled: enabled,
        message: enabled ? "Logging is currently enabled" : "Logging is currently disabled",
    });
});
exports.getLoggingConfig = getLoggingConfig;
/**
 * Update logging configuration
 * PUT /api/v1/config/logging
 * Body: { enabled: boolean }
 */
const updateLoggingConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "enabled must be a boolean value");
    }
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const userEmail = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
    yield config_service_1.configService.set("logging_enabled", enabled.toString(), "Controls whether application logs are saved to database", userId || undefined);
    res.status(200).json({
        logging_enabled: enabled,
        message: enabled ? "Logging has been enabled" : "Logging has been disabled",
        updated_by: userEmail,
        updated_at: new Date().toISOString(),
    });
});
exports.updateLoggingConfig = updateLoggingConfig;
/**
 * Get all application configurations
 * GET /api/v1/config
 */
const getAllConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const configs = yield config_service_1.configService.getAll();
    res.status(200).json(configs);
});
exports.getAllConfig = getAllConfig;
/**
 * Get specific configuration by key
 * GET /api/v1/config/:key
 */
const getConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { key } = req.params;
    const value = yield config_service_1.configService.get(key);
    if (value === null) {
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Configuration key '${key}' not found`);
    }
    res.status(200).json({
        key,
        value,
    });
});
exports.getConfig = getConfig;
/**
 * Update or create configuration
 * PUT /api/v1/config/:key
 * Body: { value: string, description?: string }
 */
const updateConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { key } = req.params;
    const { value, description } = req.body;
    if (!value) {
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "value is required");
    }
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    yield config_service_1.configService.set(key, value, description, userId || undefined);
    res.status(200).json({
        key,
        value,
        description,
        updated_by: (_b = req.user) === null || _b === void 0 ? void 0 : _b.email,
        updated_at: new Date().toISOString(),
    });
});
exports.updateConfig = updateConfig;
exports.default = {
    getLoggingConfig: exports.getLoggingConfig,
    updateLoggingConfig: exports.updateLoggingConfig,
    getAllConfig: exports.getAllConfig,
    getConfig: exports.getConfig,
    updateConfig: exports.updateConfig,
};
