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
const pricing_service_1 = require("./pricing.service");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const types_1 = require("../types/types");
const normalizeSpanishText = (value) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
exports.resolvers = {
    /**
     * Resolves province name to province ID
     * @param provinceName - The name of the province
     * @returns Province ID
     */
    resolveProvinceId: (provinceName) => __awaiter(void 0, void 0, void 0, function* () {
        const provinceNameTrimmed = provinceName.trim();
        const province = yield prisma_client_1.default.province.findFirst({
            where: {
                name: {
                    equals: provinceNameTrimmed,
                    mode: "insensitive",
                },
            },
        });
        if (province)
            return province.id;
        const normalizedProvinceName = normalizeSpanishText(provinceNameTrimmed);
        const provinces = yield prisma_client_1.default.province.findMany({
            select: { id: true, name: true },
        });
        const normalizedMatch = provinces.find((item) => normalizeSpanishText(item.name) === normalizedProvinceName);
        if (normalizedMatch)
            return normalizedMatch.id;
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Province '${provinceNameTrimmed}' not found`);
    }),
    /**
     * Resolves city name to city ID within a province
     * @param cityName - The name of the city
     * @param provinceId - The province ID to search within
     * @returns City ID
     */
    resolveCityId: (cityName, provinceId) => __awaiter(void 0, void 0, void 0, function* () {
        const cityNameTrimmed = cityName.trim();
        const city = yield prisma_client_1.default.city.findFirst({
            where: {
                name: {
                    equals: cityNameTrimmed,
                    mode: "insensitive",
                },
                province_id: provinceId,
            },
        });
        if (city)
            return city.id;
        const normalizedCityName = normalizeSpanishText(cityNameTrimmed);
        const cities = yield prisma_client_1.default.city.findMany({
            where: { province_id: provinceId },
            select: { id: true, name: true },
        });
        const normalizedMatch = cities.find((item) => normalizeSpanishText(item.name) === normalizedCityName);
        if (normalizedMatch)
            return normalizedMatch.id;
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `City '${cityNameTrimmed}' not found in the specified province`);
    }),
    resolveReceiver: (_a) => __awaiter(void 0, [_a], void 0, function* ({ receiver_id, receiver, }) {
        var _b, _c, _d, _e, _f, _g;
        // Scenario 1: Frontend provides receiver_id
        if (receiver_id) {
            const existingReceiver = yield repositories_1.default.receivers.getById(receiver_id);
            if (existingReceiver)
                return existingReceiver;
        }
        // Scenario 2: Partners provide receiver data
        if (receiver === null || receiver === void 0 ? void 0 : receiver.ci) {
            // Check if receiver exists by CI
            const existingReceiver = yield repositories_1.default.receivers.getByCi(receiver.ci);
            if (existingReceiver)
                return existingReceiver;
        }
        // If both province and city are provided as names, resolve them in parallel
        if ((receiver === null || receiver === void 0 ? void 0 : receiver.province) &&
            typeof (receiver === null || receiver === void 0 ? void 0 : receiver.province) === "string" &&
            (receiver === null || receiver === void 0 ? void 0 : receiver.city) &&
            typeof (receiver === null || receiver === void 0 ? void 0 : receiver.city) === "string") {
            const resolvedProvinceId = yield exports.resolvers.resolveProvinceId(receiver === null || receiver === void 0 ? void 0 : receiver.province);
            receiver.province_id = resolvedProvinceId;
            receiver.city_id = yield exports.resolvers.resolveCityId(receiver === null || receiver === void 0 ? void 0 : receiver.city, resolvedProvinceId);
        }
        // Validate required location fields
        if (!(receiver === null || receiver === void 0 ? void 0 : receiver.province_id) || !(receiver === null || receiver === void 0 ? void 0 : receiver.city_id)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Province and city are required for creating a new receiver");
        }
        const parseResult = types_1.createReceiverSchema.safeParse({
            first_name: receiver.first_name,
            last_name: receiver.last_name,
            ci: receiver.ci,
            address: receiver.address,
            province_id: receiver.province_id,
            city_id: receiver.city_id,
            middle_name: (_b = receiver.middle_name) !== null && _b !== void 0 ? _b : null,
            second_last_name: (_c = receiver.second_last_name) !== null && _c !== void 0 ? _c : null,
            passport: (_d = receiver.passport) !== null && _d !== void 0 ? _d : null,
            email: (_e = receiver.email) !== null && _e !== void 0 ? _e : null,
            mobile: (_f = receiver.mobile) !== null && _f !== void 0 ? _f : null,
            phone: (_g = receiver.phone) !== null && _g !== void 0 ? _g : null,
        });
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, JSON.stringify({ message: "Validation failed", errors }));
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
    /*  resolveItemsWithHbl: async ({
        order_items,
        service_id,
        agency_id,
     }: {
        order_items: any[];
        service_id: number;
        agency_id: number;
     }): Promise<any[]> => {
        // 🚀 OPTIMIZATION: Extract unique rate IDs efficiently (single pass, no intermediate arrays)
        const forwarder = await prisma.forwarder.findUnique({
           where: {
              id: agency_id,
           },
        });
        if (!forwarder?.code) {
           throw new AppError(HttpStatusCodes.NOT_FOUND, "Forwarder code not found");
        }
        // 🚀 OPTIMIZATION: Parallelize HBL generation and rate fetching
        const allHblCodes = await buildHBL(forwarder?.code || "", todayYYDDD("America/New_York"), 1, order_items.length);
  
        const rates = await pricingService.getRatesByServiceIdAndAgencyId(service_id, agency_id);
  
        // Pre-allocate and populate items array
        const items_hbl: any[] = new Array(order_items.length);
        for (let i = 0; i < order_items.length; i++) {
           const item = order_items[i];
           const rate = rates.find((rate) => rate.id === item.rate_id);
           if (!rate) {
              throw new AppError(
                 HttpStatusCodes.NOT_FOUND,
                 `Rate with ID ${item.rate_id} not found or not exists for your agency ${agency_id}`
              );
           }
           items_hbl[i] = {
              hbl: allHblCodes[i],
              external_reference: item.external_reference || null,
              description: item.description,
              price_in_cents: item.price_in_cents || rate?.price_in_cents || 0,
              charge_fee_in_cents: item.charge_fee_in_cents || 0,
              delivery_fee_in_cents: item.delivery_fee_in_cents || 0,
              rate_id: item.rate_id,
              insurance_fee_in_cents: item.insurance_fee_in_cents || 0,
              customs_fee_in_cents: item.customs_fee_in_cents || 0,
              customs_rates_id: item.customs_rates_id || null,
              quantity: 1,
              weight: item.weight,
              service_id,
              agency_id,
              unit: rate?.unit || item.unit || Unit.PER_LB,
           };
        }
        return items_hbl;
     }, */
    resolveItems: (_a) => __awaiter(void 0, [_a], void 0, function* ({ order_items, service_id, agency_id, }) {
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        // ⚡ Obtener rates UNA vez
        const rates = yield pricing_service_1.pricingService.getRatesByServiceIdAndAgencyId(service_id, agency_id);
        // ⚡ Indexar rates por id (evita rates.find O(n²))
        const rateById = new Map();
        for (const r of rates)
            rateById.set(r.id, r);
        const items = new Array(order_items.length);
        for (let i = 0; i < order_items.length; i++) {
            const item = order_items[i];
            const rate = rateById.get(item.rate_id);
            if (!rate) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Rate with ID ${item.rate_id} not found or not exists for your agency ${agency_id}`);
            }
            items[i] = {
                external_reference: item.external_reference || null,
                description: item.description,
                price_in_cents: (_c = (_b = item.price_in_cents) !== null && _b !== void 0 ? _b : rate.price_in_cents) !== null && _c !== void 0 ? _c : 0,
                charge_fee_in_cents: (_d = item.charge_fee_in_cents) !== null && _d !== void 0 ? _d : 0,
                delivery_fee_in_cents: (_e = item.delivery_fee_in_cents) !== null && _e !== void 0 ? _e : 0,
                rate_id: item.rate_id,
                insurance_fee_in_cents: (_f = item.insurance_fee_in_cents) !== null && _f !== void 0 ? _f : 0,
                customs_fee_in_cents: (_g = item.customs_fee_in_cents) !== null && _g !== void 0 ? _g : 0,
                customs_rates_id: (_h = item.customs_rates_id) !== null && _h !== void 0 ? _h : null,
                quantity: (_j = item.quantity) !== null && _j !== void 0 ? _j : 1,
                weight: item.weight,
                service_id,
                agency_id,
                unit: (_l = (_k = rate.unit) !== null && _k !== void 0 ? _k : item.unit) !== null && _l !== void 0 ? _l : client_1.Unit.PER_LB,
            };
        }
        return items;
    }),
};
