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
const services = {
    create: (service) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.service.create({ data: service });
    }),
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const services = yield prisma_client_1.default.service.findMany({
            include: {
                provider: true,
                forwarder: true,
                products: true,
            },
            where: {
                is_active: true,
            },
        });
        return services.map((service) => {
            return {
                id: service.id,
                name: service.name,
                provider: service.provider.name,
                service_type: service.service_type,
                is_active: service.is_active,
            };
        });
    }),
    getByAgencyId: (agency_id) => __awaiter(void 0, void 0, void 0, function* () {
        const services = yield prisma_client_1.default.service.findMany({
            where: { agencies: { some: { id: agency_id } } },
        });
        return services;
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            return yield prisma_client_1.default.service.findUnique({ where: { id } });
        }
        catch (error) {
            console.error("Error getting service by id:", error);
            throw error;
        }
    }),
    getServicesWithRates: (agency_id) => __awaiter(void 0, void 0, void 0, function* () {
        const services = yield prisma_client_1.default.service.findMany({
            where: { agencies: { some: { id: agency_id } } },
            select: {
                id: true,
                name: true,
                service_type: true,
                is_active: true,
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                shipping_rates: {
                    where: { agency_id: agency_id },
                    orderBy: { id: "desc" },
                    select: {
                        id: true,
                        price_in_cents: true,
                        is_active: true,
                        pricing_agreement: {
                            select: {
                                id: true,
                                price_in_cents: true,
                                seller_agency_id: true,
                                buyer_agency_id: true,
                            },
                        },
                        product: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                unit: true,
                            },
                        },
                    },
                },
            },
        });
        return services;
    }),
    getActiveServicesWithRates: (agency_id) => __awaiter(void 0, void 0, void 0, function* () {
        const services = yield prisma_client_1.default.service.findMany({
            where: { agencies: { some: { id: agency_id } }, is_active: true },
            select: {
                id: true,
                name: true,
                service_type: true,
                is_active: true,
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                shipping_rates: {
                    where: { agency_id: agency_id, is_active: true },
                    select: {
                        id: true,
                        price_in_cents: true,
                        is_active: true,
                        pricing_agreement: {
                            select: {
                                id: true,
                                price_in_cents: true,
                            },
                        },
                        product: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                unit: true,
                            },
                        },
                    },
                },
            },
        });
        return services;
    }),
    getByProviderId: (provider_id) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const services = yield prisma_client_1.default.service.findMany({
                where: { provider_id },
                include: {
                    provider: true,
                    forwarder: true,
                },
                orderBy: {
                    name: "asc",
                },
            });
            return services;
        }
        catch (error) {
            console.error("Error getting services by provider ID:", error);
            throw error;
        }
    }),
    update: (id, service) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            return yield prisma_client_1.default.service.update({ where: { id }, data: service });
        }
        catch (error) {
            console.error("Error updating service:", error);
            throw error;
        }
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            return yield prisma_client_1.default.service.delete({ where: { id } });
        }
        catch (error) {
            console.error("Error deleting service:", error);
            throw error;
        }
    }),
};
exports.default = services;
