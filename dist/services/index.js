"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = void 0;
const orders_service_1 = require("./orders.service");
const resolvers_service_1 = require("./resolvers.service");
const pricing_service_1 = require("./pricing.service");
exports.services = {
    orders: orders_service_1.ordersService,
    resolvers: resolvers_service_1.resolvers,
    pricing: pricing_service_1.pricingService,
};
exports.default = exports.services;
