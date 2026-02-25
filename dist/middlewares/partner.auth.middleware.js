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
exports.partnerLogMiddleware = exports.partnerAuthMiddleware = void 0;
const repositories_1 = __importDefault(require("../repositories"));
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
/**
 * Middleware to authenticate partners using API Key
 * Validates API key from Authorization header (Bearer token)
 * Checks if partner is active and within rate limits
 */
const partnerAuthMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Extract API key from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "API key is required. Please provide an API key in the Authorization header.");
        }
        // Support both "Bearer TOKEN" and direct token formats
        const apiKey = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
        if (!apiKey || apiKey.trim() === "") {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "Invalid API key format");
        }
        // Validate API key and get partner
        const partner = yield repositories_1.default.partners.getByApiKey(apiKey.trim());
        if (!partner) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "Invalid API key or partner not found");
        }
        if (!partner.is_active) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "Partner account is inactive. Please contact support.");
        }
        // Check rate limiting (requests per hour)
        if (partner.rate_limit && partner.rate_limit > 0) {
            const stats = yield repositories_1.default.partners.getStats(partner.id);
            if (stats.requests_last_hour >= partner.rate_limit) {
                throw new app_errors_1.AppError(https_status_codes_1.default.TOO_MANY_REQUESTS, `Rate limit exceeded. You are limited to ${partner.rate_limit} requests per hour.`);
            }
        }
        // Attach partner to request object
        req.partner = partner;
        next();
    }
    catch (error) {
        console.error("Partner authentication error:", error);
        if (error instanceof app_errors_1.AppError) {
            res.status(error.status).json({
                status: "error",
                message: error.message,
            });
        }
        else {
            res.status(401).json({
                status: "error",
                message: "Authentication failed",
            });
        }
    }
});
exports.partnerAuthMiddleware = partnerAuthMiddleware;
/**
 * Middleware to log partner API requests
 * Should be used after partnerAuthMiddleware
 */
const partnerLogMiddleware = (req, res, next) => {
    if (!req.partner) {
        return next();
    }
    // Store original end function
    const originalEnd = res.end;
    const originalJson = res.json;
    let responseBody = null;
    // Override json method to capture response
    res.json = function (body) {
        responseBody = body;
        return originalJson.call(this, body);
    };
    // Override end to log after response is sent
    res.end = function (chunk, encoding, callback) {
        // Restore original function
        res.end = originalEnd;
        // Log the request asynchronously (don't block response)
        setImmediate(() => {
            const partner = req.partner;
            if (partner && partner.api_key_id) {
                repositories_1.default.partners
                    .logRequest({
                    partner_id: partner.id,
                    api_key_id: partner.api_key_id,
                    endpoint: req.originalUrl,
                    method: req.method,
                    status_code: res.statusCode,
                    request_body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
                    response_body: responseBody,
                    ip_address: req.headers["x-forwarded-for"] || req.socket.remoteAddress || undefined,
                    user_agent: req.headers["user-agent"],
                })
                    .catch((err) => console.error("Failed to log partner request:", err));
            }
        });
        // Call original end
        return originalEnd.call(this, chunk, encoding, callback);
    };
    next();
};
exports.partnerLogMiddleware = partnerLogMiddleware;
exports.default = exports.partnerAuthMiddleware;
