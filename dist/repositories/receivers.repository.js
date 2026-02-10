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
const receivers = {
    get: (agency_id_1, ...args_1) => __awaiter(void 0, [agency_id_1, ...args_1], void 0, function* (agency_id, page = 1, limit = 10) {
        // Build where clause conditionally based on agency_id
        const whereClause = agency_id
            ? {
                agencies: {
                    some: { id: agency_id },
                },
            }
            : {}; // Empty where clause returns all receivers
        // Parallelize count and findMany queries for better performance
        const [total, rows] = yield Promise.all([
            prisma_client_1.default.receiver.count({
                where: whereClause,
            }),
            prisma_client_1.default.receiver.findMany({
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    first_name: "asc",
                },
                where: whereClause,
                include: {
                    province: true,
                    city: true,
                },
            }),
        ]);
        return { rows, total };
    }),
    search: (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, page = 1, limit = 10) {
        const terms = query.trim().split(/\s+/).filter(Boolean);
        const receivers = yield prisma_client_1.default.receiver.findMany({
            where: {
                OR: [
                    // Búsqueda por campos individuales
                    { first_name: { contains: query, mode: "insensitive" } },
                    { middle_name: { contains: query, mode: "insensitive" } },
                    { last_name: { contains: query, mode: "insensitive" } },
                    { second_last_name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                    { mobile: { contains: query, mode: "insensitive" } },
                    // Búsqueda combinada por nombre completo (en cualquier orden)
                    {
                        AND: terms.map((term) => ({
                            OR: [
                                { first_name: { contains: term, mode: "insensitive" } },
                                { middle_name: { contains: term, mode: "insensitive" } },
                                { last_name: { contains: term, mode: "insensitive" } },
                                { second_last_name: { contains: term, mode: "insensitive" } },
                            ],
                        })),
                    },
                ],
            },
            include: {
                province: true,
                city: true,
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: {
                first_name: "asc",
            },
        });
        return receivers.map((receiver) => (Object.assign(Object.assign({}, receiver), { province: receiver.province.name, city: receiver.city.name })));
    }),
    create: (receiver) => __awaiter(void 0, void 0, void 0, function* () {
        const newReceiver = yield prisma_client_1.default.receiver.create({
            data: receiver,
            include: {
                province: true,
                city: true,
            },
        });
        return newReceiver;
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const receiver = yield prisma_client_1.default.receiver.findUnique({
            where: { id: id },
            include: {
                province: true,
                city: true,
            },
        });
        return receiver;
    }),
    getByCi: (ci) => __awaiter(void 0, void 0, void 0, function* () {
        const receiver = yield prisma_client_1.default.receiver.findUnique({
            where: { ci: ci },
            include: {
                province: true,
                city: true,
            },
        });
        return receiver;
    }),
    connect: (receiverId, customerId) => __awaiter(void 0, void 0, void 0, function* () {
        // Ensure both IDs are valid
        if (!receiverId || !customerId) {
            throw new Error("Both receiverId and customerId are required");
        }
        const updatedReceiver = yield prisma_client_1.default.receiver.update({
            where: {
                id: receiverId,
            },
            data: {
                customers: {
                    connect: {
                        id: customerId,
                    },
                },
            },
            include: {
                province: true,
                city: true,
                customers: true, // Include customer data in response
            },
        });
        const flat_receiver = Object.assign(Object.assign({}, updatedReceiver), { province: updatedReceiver.province.name, city: updatedReceiver.city.name });
        return flat_receiver;
    }),
    disconnect: (receiverId, customerId) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedReceiver = yield prisma_client_1.default.receiver.update({
            where: { id: receiverId },
            data: {
                customers: {
                    disconnect: { id: customerId },
                },
            },
        });
        return updatedReceiver;
    }),
    edit: (id, receiver) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedReceiver = yield prisma_client_1.default.receiver.update({
            where: { id },
            data: receiver,
            include: {
                province: true,
                city: true,
            },
        });
        const flat_receiver = Object.assign(Object.assign({}, updatedReceiver), { province: updatedReceiver.province.name, city: updatedReceiver.city.name });
        return flat_receiver;
    }),
};
exports.default = receivers;
