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
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
// Import configService - if it fails, we'll handle it in each function
const config_service_1 = require("../services/config.service");
/**
 * Get logging configuration status
 * GET /api/v1/config/logging
 */
const config = {
    getLoggingConfig: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const enabled = yield config_service_1.configService.getBoolean("logging_enabled", true);
        res.status(200).json({
            status: enabled,
            message: enabled ? "Logging is currently enabled" : "Logging is currently disabled",
        });
    }),
    updateLoggingConfig: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const { enabled } = req.body;
        if (typeof enabled !== "boolean") {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "enabled must be a boolean value");
        }
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        yield config_service_1.configService.set("logging_enabled", enabled.toString(), "Controls whether application logs are saved to database", userId);
        res.status(200).json({
            status: enabled,
            message: enabled ? "Logging has been enabled" : "Logging has been disabled",
            updated_by: userId,
            updated_at: new Date().toISOString(),
        });
    }),
    getAllConfig: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const configs = yield config_service_1.configService.getAll();
        res.status(200).json(configs);
    }),
};
exports.default = config;
