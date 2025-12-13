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
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const order_with_relations_1 = require("../types/order-with-relations");
const orders = {
    getAll: (_a) => __awaiter(void 0, [_a], void 0, function* ({ page, limit }) {
        const orders = yield prisma_client_1.default.order.findMany({
            skip: (page - 1) * limit,
            take: limit,
        });
        const total = yield prisma_client_1.default.order.count();
        return { orders, total };
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.order.findUnique({ where: { id }, include: { order_items: true } });
    }),
    getByIdWithDetails: (id) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("getByIdWithDetails", id);
        return yield prisma_client_1.default.order.findUnique({
            where: { id },
            include: order_with_relations_1.orderWithRelationsInclude,
        });
    }),
    create: (orderData) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.order.create({
            data: orderData,
            include: {
                customer: true,
                receiver: {
                    include: {
                        province: true,
                        city: true,
                    },
                },
                order_items: {
                    select: {
                        hbl: true,
                        description: true,
                        weight: true,
                        rate_id: true,
                        price_in_cents: true,
                        unit: true,
                        insurance_fee_in_cents: true,
                        customs_fee_in_cents: true,
                        charge_fee_in_cents: true,
                        delivery_fee_in_cents: true,
                    },
                },
            },
        });
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.order.delete({ where: { id } });
    }),
};
exports.default = orders;
