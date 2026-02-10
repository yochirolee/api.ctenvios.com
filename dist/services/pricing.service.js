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
exports.pricingService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
exports.pricingService = {
    getRatesByServiceIdAndAgencyId: (service_id, agency_id) => __awaiter(void 0, void 0, void 0, function* () {
        const rates = yield prisma_client_1.default.shippingRate.findMany({
            where: { service_id, agency_id },
            select: {
                id: true,
                price_in_cents: true,
                is_active: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        unit: true,
                    },
                },
                pricing_agreement: {
                    select: {
                        id: true,
                        price_in_cents: true,
                    },
                },
            },
            orderBy: {
                id: "desc",
            },
        });
        if (rates.length === 0) {
            return [];
        }
        return rates.map((rate) => {
            return {
                id: rate.id,
                name: rate.product.name,
                description: rate.product.description,
                unit: rate.product.unit,
                price_in_cents: rate.price_in_cents,
                cost_in_cents: rate.pricing_agreement.price_in_cents,
                is_active: rate.is_active,
            };
        });
    }),
    createPricingWithRate: (input) => __awaiter(void 0, void 0, void 0, function* () {
        const { product_id, service_id, seller_agency_id, buyer_agency_id, cost_in_cents, price_in_cents, is_active = true, } = input;
        // Validate required fields
        if (!product_id || !service_id || !seller_agency_id || !buyer_agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Missing required fields");
        }
        if (cost_in_cents === undefined || cost_in_cents < 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "cost_in_cents must be a non-negative number");
        }
        if (price_in_cents === undefined || price_in_cents < 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "price_in_cents must be a non-negative number");
        }
        // Determine if this is an internal agreement
        const is_internal = seller_agency_id === buyer_agency_id;
        // Execute within transaction for atomicity
        const result = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Validate product exists and is active
            const product = yield tx.product.findUnique({
                where: { id: product_id },
            });
            if (!product) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Product with id ${product_id} not found`);
            }
            if (!product.is_active) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Product with id ${product_id} is not active`);
            }
            // 2. Validate service exists
            const service = yield tx.service.findUnique({
                where: { id: service_id },
            });
            if (!service) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Service with id ${service_id} not found`);
            }
            if (!service.is_active) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Service with id ${service_id} is not active`);
            }
            // 3. Validate seller agency exists
            const sellerAgency = yield tx.agency.findUnique({
                where: { id: seller_agency_id },
            });
            if (!sellerAgency) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Seller agency with id ${seller_agency_id} not found`);
            }
            // 4. Validate buyer agency exists
            const buyerAgency = yield tx.agency.findUnique({
                where: { id: buyer_agency_id },
            });
            if (!buyerAgency) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Buyer agency with id ${buyer_agency_id} not found`);
            }
            // 5. Check for existing PricingAgreement (handle unique constraint)
            const existingAgreement = yield tx.pricingAgreement.findUnique({
                where: {
                    seller_agency_id_buyer_agency_id_product_id_service_id: {
                        seller_agency_id,
                        buyer_agency_id,
                        product_id,
                        service_id,
                    },
                },
            });
            if (existingAgreement) {
                throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Pricing agreement already exists for seller ${seller_agency_id}, buyer ${buyer_agency_id}, and product ${product_id}`);
            }
            // 6. Create PricingAgreement
            const agreement = yield tx.pricingAgreement.create({
                data: {
                    seller_agency_id,
                    buyer_agency_id,
                    product_id,
                    service_id,
                    price_in_cents: cost_in_cents, // cost_in_cents becomes the agreement price
                    is_active,
                    effective_from: new Date(),
                },
            });
            // 7. Create ShippingRate linked to the agreement
            const rate = yield tx.shippingRate.create({
                data: {
                    product_id,
                    service_id,
                    agency_id: buyer_agency_id, // Buyer agency uses this rate
                    pricing_agreement_id: agreement.id,
                    scope: client_1.RateScope.PUBLIC,
                    price_in_cents, // Selling price for the buyer agency
                    effective_from: new Date(),
                    is_active,
                },
            });
            return { agreement, rate, is_internal };
        }));
        return result;
    }),
    /**
     * Gets all pricing agreements for a specific product
     */
    getProductPricing: (product_id) => __awaiter(void 0, void 0, void 0, function* () {
        const agreements = yield prisma_client_1.default.pricingAgreement.findMany({
            where: { product_id },
            include: {
                product: true,
                service: true,
                shipping_rates: {
                    include: {
                        agency: true,
                        tiers: true,
                    },
                },
            },
            orderBy: { created_at: "desc" },
        });
        return agreements;
    }),
    /**
     * Gets pricing agreements for a specific agency (as buyer or seller)
     */
    getAgencyPricing: (agency_id_1, ...args_1) => __awaiter(void 0, [agency_id_1, ...args_1], void 0, function* (agency_id, role = "buyer") {
        const where_clause = role === "buyer" ? { buyer_agency_id: agency_id } : { seller_agency_id: agency_id };
        const agreements = yield prisma_client_1.default.pricingAgreement.findMany({
            where: where_clause,
            include: {
                product: true,
                service: true,
                shipping_rates: {
                    include: {
                        agency: true,
                        tiers: true,
                    },
                },
            },
            orderBy: { created_at: "desc" },
        });
        return agreements;
    }),
    getPriceAgreementsBetweenAgencies: (seller_agency_id, buyer_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
        const agreements = yield prisma_client_1.default.pricingAgreement.findMany({
            where: {
                seller_agency_id: seller_agency_id,
                buyer_agency_id: buyer_agency_id,
                is_active: true,
            },
            select: {
                id: true,
                price_in_cents: true,
                service_id: true,
            },
        });
        return agreements.map((agreement) => {
            return {
                id: agreement.id,
                seller_agency_id: seller_agency_id,
                buyer_agency_id: buyer_agency_id,
                service_id: agreement.service_id,
                price_in_cents: agreement.price_in_cents,
            };
        });
    }),
};
