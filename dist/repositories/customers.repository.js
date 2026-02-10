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
const customers = {
    get: (agency_id_1, ...args_1) => __awaiter(void 0, [agency_id_1, ...args_1], void 0, function* (agency_id, page = 1, limit = 10) {
        // Build where clause conditionally based on agency_id
        const whereClause = agency_id
            ? {
                agencies: {
                    some: { id: agency_id },
                },
            }
            : {}; // Empty where clause returns all customers
        // Parallelize count and findMany queries for better performance
        const [total, rows] = yield Promise.all([
            prisma_client_1.default.customer.count({
                where: whereClause,
            }),
            prisma_client_1.default.customer.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    first_name: "asc",
                },
                where: whereClause,
            }),
        ]);
        return { rows, total };
    }),
    search: (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, page = 1, limit = 10) {
        const trimmedQuery = query.trim();
        const queryWords = trimmedQuery.split(/\s+/).filter((word) => word.length > 0);
        const baseConditions = [
            { first_name: { contains: trimmedQuery, mode: "insensitive" } },
            { middle_name: { contains: trimmedQuery, mode: "insensitive" } },
            { last_name: { contains: trimmedQuery, mode: "insensitive" } },
            { second_last_name: { contains: trimmedQuery, mode: "insensitive" } },
            { mobile: { contains: trimmedQuery, mode: "insensitive" } },
            { identity_document: { contains: trimmedQuery, mode: "insensitive" } },
            { email: { contains: trimmedQuery, mode: "insensitive" } },
        ];
        // Búsqueda combinada: cada palabra debe aparecer en al menos un campo
        const combinedNameConditions = queryWords.length > 1
            ? [
                {
                    AND: queryWords.map((word) => ({
                        OR: [
                            { first_name: { contains: word, mode: "insensitive" } },
                            { middle_name: { contains: word, mode: "insensitive" } },
                            { last_name: { contains: word, mode: "insensitive" } },
                            { second_last_name: { contains: word, mode: "insensitive" } },
                        ],
                    })),
                },
            ]
            : [];
        const customers = yield prisma_client_1.default.customer.findMany({
            where: {
                OR: [...baseConditions, ...combinedNameConditions],
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                first_name: "asc",
            },
        });
        return customers;
    }),
    getById: (customerId) => __awaiter(void 0, void 0, void 0, function* () {
        const customer = yield prisma_client_1.default.customer.findUnique({
            where: {
                id: customerId,
            },
            include: {
                receivers: true,
            },
        });
        return customer;
    }),
    getReceivers: (customerId_1, ...args_1) => __awaiter(void 0, [customerId_1, ...args_1], void 0, function* (customerId, page = 1, limit = 10) {
        const receivers = yield prisma_client_1.default.receiver.findMany({
            where: {
                customers: {
                    some: {
                        id: customerId,
                    },
                },
            },
            include: {
                province: true,
                city: true,
            },
            skip: (page - 1) * limit,
            take: limit,
        });
        return receivers;
    }),
    getByMobileAndName: (mobile, first_name, last_name) => __awaiter(void 0, void 0, void 0, function* () {
        const customer = yield prisma_client_1.default.customer.findFirst({
            where: {
                mobile,
                first_name,
                last_name,
            },
        });
        return customer;
    }),
    create: (customer) => __awaiter(void 0, void 0, void 0, function* () {
        const newCustomer = yield prisma_client_1.default.customer.create({
            data: customer,
        });
        return newCustomer;
    }),
    edit: (id, customer) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedCustomer = yield prisma_client_1.default.customer.update({
            where: { id: id },
            data: Object.assign({}, customer),
        });
        return updatedCustomer;
    }),
};
exports.default = customers;
