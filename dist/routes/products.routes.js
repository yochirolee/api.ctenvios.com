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
const express_1 = require("express");
const services_1 = require("../services");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const zod_1 = __importDefault(require("zod"));
const client_1 = require("@prisma/client");
const product_controller_1 = __importDefault(require("../controllers/product.controller"));
const validate_middleware_1 = require("../middlewares/validate.middleware");
const products_routes = (0, express_1.Router)();
const createProductSchema = zod_1.default.object({
    id: zod_1.default.number().optional(),
    provider_id: zod_1.default.number(),
    name: zod_1.default.string(),
    description: zod_1.default.string(),
    unit: zod_1.default.nativeEnum(client_1.Unit),
    length: zod_1.default.number().optional(),
    width: zod_1.default.number().optional(),
    height: zod_1.default.number().optional(),
    is_active: zod_1.default.boolean(),
});
const updateProductSchema = zod_1.default.object({
    name: zod_1.default.string().optional(),
    description: zod_1.default.string().optional(),
    unit: zod_1.default.nativeEnum(client_1.Unit).optional(),
    length: zod_1.default.number().optional(),
    width: zod_1.default.number().optional(),
    height: zod_1.default.number().optional(),
    is_active: zod_1.default.boolean().optional(),
    serviceIds: zod_1.default.array(zod_1.default.number().positive()).min(1).optional(),
});
products_routes.get("/", product_controller_1.default.getAll);
products_routes.post("/", (0, validate_middleware_1.validate)({ body: createProductSchema }), product_controller_1.default.create);
products_routes.get("/", product_controller_1.default.getAll);
products_routes.get("/:id", product_controller_1.default.getById);
products_routes.put("/:id", (0, validate_middleware_1.validate)({ body: updateProductSchema }), product_controller_1.default.update);
products_routes.delete("/:id", product_controller_1.default.delete);
products_routes.post("/:id/connect-service", product_controller_1.default.connectServices);
products_routes.delete("/:id/disconnect-service", product_controller_1.default.disconnectServices);
// Create pricing agreement and shipping rate for a product
//this has to be moved to shipping rates routes and controller
products_routes.post("/:productId/pricing", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId)) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({ error: "Invalid product ID" });
        }
        const { service_id, seller_agency_id, buyer_agency_id, cost_in_cents, price_in_cents, name, is_active } = req.body;
        // Validate required fields
        if (!service_id ||
            seller_agency_id === undefined ||
            buyer_agency_id === undefined ||
            cost_in_cents === undefined ||
            price_in_cents === undefined) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({
                error: "Missing required fields: service_id, seller_agency_id, buyer_agency_id, cost_in_cents, price_in_cents",
            });
        }
        // Create pricing agreement and shipping rate
        const result = yield services_1.services.pricing.createPricingWithRate({
            product_id: productId,
            service_id,
            seller_agency_id,
            buyer_agency_id,
            cost_in_cents,
            price_in_cents,
            name,
            is_active,
        });
        return res.status(https_status_codes_1.default.CREATED).json({
            message: "Pricing created successfully",
            data: result,
        });
    }
    catch (error) {
        console.error("Error creating pricing:", error);
        // Handle AppError instances with proper status codes
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({
            error: "Error creating pricing",
            details: error.message,
        });
    }
}));
// Get all pricing for a specific product
products_routes.get("/:productId/pricing", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId)) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({ error: "Invalid product ID" });
        }
        const pricing = yield services_1.services.pricing.getProductPricing(productId);
        return res.status(https_status_codes_1.default.OK).json(pricing);
    }
    catch (error) {
        console.error("Error fetching product pricing:", error);
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({
            error: "Error fetching product pricing",
            details: error.message,
        });
    }
}));
exports.default = products_routes;
