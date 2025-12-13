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
exports.resolvers = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const app_errors_1 = require("../common/app-errors");
const repositories_1 = __importDefault(require("../repositories"));
const generate_hbl_1 = require("../utils/generate-hbl");
const pricing_service_1 = require("./pricing.service");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
exports.resolvers = {
    /**
     * Resolves province name to province ID
     * @param provinceName - The name of the province
     * @returns Province ID
     */
    resolveProvinceId: (provinceName) => __awaiter(void 0, void 0, void 0, function* () {
        const province = yield prisma_client_1.default.province.findFirst({
            where: {
                name: {
                    equals: provinceName,
                    mode: "insensitive",
                },
            },
        });
        if (!province) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Province '${provinceName}' not found`);
        }
        return province.id;
    }),
    /**
     * Resolves city name to city ID within a province
     * @param cityName - The name of the city
     * @param provinceId - The province ID to search within
     * @returns City ID
     */
    resolveCityId: (cityName, provinceId) => __awaiter(void 0, void 0, void 0, function* () {
        const city = yield prisma_client_1.default.city.findFirst({
            where: {
                name: {
                    equals: cityName,
                    mode: "insensitive",
                },
                province_id: provinceId,
            },
        });
        if (!city) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `City '${cityName}' not found in the specified province`);
        }
        return city.id;
    }),
    resolveReceiver: (_a) => __awaiter(void 0, [_a], void 0, function* ({ receiver_id, receiver, }) {
        // Scenario 1: Frontend provides receiver_id
        if (receiver_id) {
            const existingReceiver = yield repositories_1.default.receivers.getById(receiver_id);
            if (!existingReceiver) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Receiver with ID ${receiver_id} not found`);
            }
            return existingReceiver;
        }
        // Scenario 2: Partners provide receiver data
        if (receiver === null || receiver === void 0 ? void 0 : receiver.ci) {
            // Check if receiver exists by CI
            const existingReceiver = yield repositories_1.default.receivers.getByCi(receiver.ci);
            if (existingReceiver)
                return existingReceiver;
        }
        if (!receiver) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Receiver data is required");
        }
        // If both province and city are provided as names, resolve them in parallel
        if (receiver.province &&
            typeof receiver.province === "string" &&
            receiver.city &&
            typeof receiver.city === "string") {
            const resolvedProvinceId = yield exports.resolvers.resolveProvinceId(receiver.province);
            receiver.province_id = resolvedProvinceId;
            receiver.city_id = yield exports.resolvers.resolveCityId(receiver.city, resolvedProvinceId);
        }
        // Validate required location fields
        if (!receiver.province_id || !receiver.city_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Province and city are required for creating a new receiver");
        }
        // Create new receiver with resolved IDs
        const receiverData = {
            first_name: receiver.first_name,
            middle_name: receiver.middle_name || null,
            last_name: receiver.last_name,
            second_last_name: receiver.second_last_name || null,
            ci: receiver.ci,
            passport: receiver.passport || null,
            email: receiver.email || null,
            mobile: receiver.mobile || null,
            phone: receiver.phone || null,
            address: receiver.address,
            province_id: receiver.province_id,
            city_id: receiver.city_id,
        };
        const newReceiver = yield repositories_1.default.receivers.create(receiverData);
        return newReceiver;
    }),
    resolveCustomer: (_a) => __awaiter(void 0, [_a], void 0, function* ({ customer_id, customer, }) {
        // Scenario 1: Frontend provides customer_id
        if (customer_id) {
            const existingCustomer = yield repositories_1.default.customers.getById(customer_id);
            if (!existingCustomer) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Customer with ID ${customer_id} not found`);
            }
            return existingCustomer;
        }
        // Scenario 2: Partners provide customer data
        if (!customer) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Customer information is required");
        }
        // Check if customer exists by mobile and name
        if (customer.mobile && customer.first_name && customer.last_name) {
            const existingCustomer = yield repositories_1.default.customers.getByMobileAndName(customer.mobile, customer.first_name, customer.last_name);
            if (existingCustomer) {
                return existingCustomer;
            }
            // Create new customer if not found
            const customerData = {
                first_name: customer.first_name,
                middle_name: customer.middle_name || null,
                last_name: customer.last_name,
                second_last_name: customer.second_last_name || null,
                mobile: customer.mobile,
                email: customer.email || null,
                address: customer.address || null,
                identity_document: customer.identity_document || null,
            };
            const newCustomer = yield repositories_1.default.customers.create(customerData);
            return newCustomer;
        }
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Customer mobile, first_name, and last_name are required");
    }),
    resolveItemsWithHbl: (_a) => __awaiter(void 0, [_a], void 0, function* ({ order_items, service_id, agency_id, }) {
        // 🚀 OPTIMIZATION: Extract unique rate IDs efficiently (single pass, no intermediate arrays)
        // 🚀 OPTIMIZATION: Parallelize HBL generation and rate fetching
        const allHblCodes = yield (0, generate_hbl_1.generateHBLFast)(agency_id, service_id, order_items.length);
        const rates = yield pricing_service_1.pricingService.getRatesByServiceIdAndAgencyId(service_id, agency_id);
        // Pre-allocate and populate items array
        const items_hbl = new Array(order_items.length);
        for (let i = 0; i < order_items.length; i++) {
            const item = order_items[i];
            const rate = rates.find((rate) => rate.id === item.rate_id);
            if (!rate) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Rate with ID ${item.rate_id} not found or not exists for your agency ${agency_id}`);
            }
            items_hbl[i] = {
                hbl: allHblCodes[i],
                description: item.description,
                price_in_cents: item.price_in_cents || (rate === null || rate === void 0 ? void 0 : rate.price_in_cents) || 0,
                charge_fee_in_cents: item.charge_fee_in_cents || 0,
                delivery_fee_in_cents: item.delivery_fee_in_cents || 0,
                rate_id: item.rate_id,
                insurance_fee_in_cents: item.insurance_fee_in_cents || 0,
                customs_fee_in_cents: item.customs_fee_in_cents || 0,
                quantity: 1,
                weight: item.weight,
                service_id,
                agency_id,
                unit: (rate === null || rate === void 0 ? void 0 : rate.unit) || item.unit || client_1.Unit.PER_LB,
            };
        }
        return items_hbl;
    }),
};
