"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderWithRelationsInclude = void 0;
const client_1 = require("@prisma/client");
exports.orderWithRelationsInclude = client_1.Prisma.validator()({
    customer: true,
    receiver: {
        include: {
            province: true,
            city: true,
        },
    },
    agency: true,
    service: {
        include: {
            provider: true,
            forwarder: true,
        },
    },
    order_items: {
        orderBy: { hbl: "asc" },
        include: {
            rate: { include: { product: { select: { name: true, unit: true } } } },
        },
    },
    payments: true,
    discounts: true,
    user: true,
});
