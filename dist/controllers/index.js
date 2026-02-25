"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const agencies_controller_1 = __importDefault(require("./agencies.controller"));
const providers_controller_1 = __importDefault(require("./providers.controller"));
const forwarders_controller_1 = __importDefault(require("./forwarders.controller"));
const carriers_controller_1 = __importDefault(require("./carriers.controller"));
const services_controller_1 = __importDefault(require("./services.controller"));
const customers_controller_1 = __importDefault(require("./customers.controller"));
const provinces_controller_1 = __importDefault(require("./provinces.controller"));
const receivers_controller_1 = __importDefault(require("./receivers.controller"));
const customs_rates_controller_1 = __importDefault(require("./customs.rates.controller"));
const analytics_controller_1 = __importDefault(require("./analytics.controller"));
const partners_controller_1 = __importDefault(require("./partners.controller"));
const orders_controller_1 = __importDefault(require("./orders.controller"));
const shipping_rates_controller_1 = __importDefault(require("./shipping.rates.controller"));
const config_controller_1 = __importDefault(require("./config.controller"));
const logs_controller_1 = __importDefault(require("./logs.controller"));
const issues_controller_1 = __importDefault(require("./issues.controller"));
const users_controller_1 = __importDefault(require("./users.controller"));
const containers_controller_1 = __importDefault(require("./containers.controller"));
const flights_controller_1 = __importDefault(require("./flights.controller"));
const parcels_controller_1 = __importDefault(require("./parcels.controller"));
const dispatch_controller_1 = __importDefault(require("./dispatch.controller"));
const controllers = {
    agencies: agencies_controller_1.default,
    providers: providers_controller_1.default,
    forwarders: forwarders_controller_1.default,
    carriers: carriers_controller_1.default,
    services: services_controller_1.default,
    customers: customers_controller_1.default,
    provinces: provinces_controller_1.default,
    receivers: receivers_controller_1.default,
    customsRates: customs_rates_controller_1.default,
    analytics: analytics_controller_1.default,
    partners: partners_controller_1.default,
    orders: orders_controller_1.default,
    shippingRates: shipping_rates_controller_1.default,
    config: config_controller_1.default,
    logs: logs_controller_1.default,
    issues: issues_controller_1.default,
    users: users_controller_1.default,
    containers: containers_controller_1.default,
    flights: flights_controller_1.default,
    parcels: parcels_controller_1.default,
    dispatch: dispatch_controller_1.default,
};
exports.default = controllers;
