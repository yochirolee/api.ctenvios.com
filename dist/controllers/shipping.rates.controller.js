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
const pricing_service_1 = require("../services/pricing.service");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const shippingRates = {
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { product_id, buyer_agency_id, seller_agency_id, service_id, price_in_cents, cost_in_cents, is_active } = req.body;
        // Create pricing agreement and rate in a transaction (implemented in pricingService)
        const result = yield pricing_service_1.pricingService.createPricingWithRate({
            product_id,
            buyer_agency_id,
            seller_agency_id,
            service_id,
            price_in_cents,
            cost_in_cents,
            is_active,
        });
        res.status(201).json({
            message: "Shipping rate created successfully",
            data: result,
        });
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { price_in_cents, cost_in_cents, is_active } = req.body;
        // Execute update in a transaction to ensure atomicity
        const result = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Update the shipping rate
            const shippingRate = yield tx.shippingRate.update({
                where: { id: Number(id) },
                data: {
                    price_in_cents,
                    is_active,
                },
            });
            // 2. Find and validate the pricing agreement
            const agreement = yield tx.pricingAgreement.findUnique({
                where: {
                    id: shippingRate.pricing_agreement_id,
                },
            });
            if (!agreement) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Agreement not found");
            }
            // 3. Update the pricing agreement cost
            const pricingAgreement = yield tx.pricingAgreement.update({
                where: {
                    id: agreement.id,
                },
                data: {
                    price_in_cents: cost_in_cents,
                    is_active,
                },
            });
            return {
                shippingRate,
                pricingAgreement,
            };
        }));
        res.status(200).json({
            message: "Shipping rate updated successfully",
            data: result,
        });
    }),
    getByServiceIdAndAgencyId: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { service_id, agency_id } = req.params;
        const result = yield pricing_service_1.pricingService.getRatesByServiceIdAndAgencyId(Number(service_id), Number(agency_id));
        res.status(200).json(result);
    }),
    //create a rate for the current agency and is child of the parent agency
};
exports.default = shippingRates;
