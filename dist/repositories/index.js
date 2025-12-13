"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repository = void 0;
const agencies_repository_1 = __importDefault(require("./agencies.repository"));
const providers_repository_1 = __importDefault(require("./providers.repository"));
const forwarders_repository_1 = __importDefault(require("./forwarders.repository"));
const services_repository_1 = __importDefault(require("./services.repository"));
const customers_repository_1 = __importDefault(require("./customers.repository"));
const provinces_repository_1 = __importDefault(require("./provinces.repository"));
const receivers_repository_1 = __importDefault(require("./receivers.repository"));
const customs_rates_repository_1 = __importDefault(require("./customs.rates.repository"));
const analytics_repository_1 = __importDefault(require("./analytics.repository"));
const partners_repository_1 = __importDefault(require("./partners.repository"));
const orders_repository_1 = __importDefault(require("./orders.repository"));
const payments_repository_1 = __importDefault(require("./payments.repository"));
const products_repository_1 = __importDefault(require("./products.repository"));
const shipping_rates_repository_1 = __importDefault(require("./shipping.rates.repository"));
const dispatch_repository_1 = __importDefault(require("./dispatch.repository"));
const parcels_repository_1 = __importDefault(require("./parcels.repository"));
const error_logs_repository_1 = __importDefault(require("./error-logs.repository"));
const app_logs_repository_1 = __importDefault(require("./app-logs.repository"));
exports.repository = {
    agencies: agencies_repository_1.default,
    providers: providers_repository_1.default,
    forwarders: forwarders_repository_1.default,
    services: services_repository_1.default,
    customers: customers_repository_1.default,
    provinces: provinces_repository_1.default,
    receivers: receivers_repository_1.default,
    customsRates: customs_rates_repository_1.default,
    analytics: analytics_repository_1.default,
    partners: partners_repository_1.default,
    orders: orders_repository_1.default,
    payments: payments_repository_1.default,
    products: products_repository_1.default,
    shippingRates: shipping_rates_repository_1.default,
    dispatch: dispatch_repository_1.default,
    parcels: parcels_repository_1.default,
    errorLogs: error_logs_repository_1.default,
    appLogs: app_logs_repository_1.default,
};
exports.default = exports.repository;
