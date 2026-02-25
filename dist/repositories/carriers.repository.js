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
exports.carriers = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
exports.carriers = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const carriers = yield prisma_client_1.default.carrier.findMany({
            include: {
                forwarder: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                services: {
                    select: {
                        id: true,
                        name: true,
                        is_active: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                        services: true,
                    },
                },
            },
            orderBy: {
                id: "asc",
            },
        });
        return carriers;
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const carrier = yield prisma_client_1.default.carrier.findUnique({
            where: { id },
            include: {
                forwarder: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                services: {
                    select: {
                        id: true,
                        name: true,
                        is_active: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                        services: true,
                    },
                },
            },
        });
        return carrier;
    }),
    getUsers: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const users = yield prisma_client_1.default.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
            },
            where: { carrier_id: id },
            orderBy: {
                name: "asc",
            },
        });
        return users;
    }),
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        const carrier = yield prisma_client_1.default.carrier.create({
            data,
            include: {
                forwarder: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return carrier;
    }),
    update: (id, data) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedCarrier = yield prisma_client_1.default.carrier.update({
            where: { id },
            data,
            include: {
                forwarder: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return updatedCarrier;
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma_client_1.default.carrier.delete({
            where: { id },
        });
    }),
    getByForwarderId: (forwarderId) => __awaiter(void 0, void 0, void 0, function* () {
        const carriers = yield prisma_client_1.default.carrier.findMany({
            where: { forwarder_id: forwarderId },
            include: {
                _count: {
                    select: {
                        users: true,
                        services: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });
        return carriers;
    }),
};
exports.default = exports.carriers;
