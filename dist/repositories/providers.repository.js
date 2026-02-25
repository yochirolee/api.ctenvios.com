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
exports.providers = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
exports.providers = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const providers = yield prisma_client_1.default.provider.findMany({
            include: {
                forwarders: true,
                services: {
                    include: {
                        agencies: true,
                    },
                },
            },
        });
        return providers;
    }),
    create: (provider) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.provider.create({
            data: provider,
        });
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const provider = yield prisma_client_1.default.provider.findUnique({
            where: { id },
            include: {
                services: {
                    orderBy: {
                        name: "asc",
                    },
                },
            },
        });
        return provider;
    }),
    update: (id, provider) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            return yield prisma_client_1.default.provider.update({
                where: { id },
                data: provider,
            });
        }
        catch (error) {
            console.error("Error updating provider:", error);
            throw error;
        }
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const deletedProvider = yield prisma_client_1.default.provider.delete({
                where: { id },
            });
            return deletedProvider;
        }
        catch (error) {
            console.error("Error deleting provider:", error);
            throw error;
        }
    }),
};
exports.default = exports.providers;
