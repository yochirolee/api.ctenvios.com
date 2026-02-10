"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = void 0;
const orders_service_1 = require("./orders.service");
const resolvers_service_1 = require("./resolvers.service");
const pricing_service_1 = require("./pricing.service");
const upload_service_1 = __importDefault(require("./upload.service"));
exports.services = {
    orders: orders_service_1.ordersService,
    resolvers: resolvers_service_1.resolvers,
    pricing: pricing_service_1.pricingService,
    upload: upload_service_1.default,
};
exports.default = exports.services;
