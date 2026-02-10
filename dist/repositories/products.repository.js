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
exports.products = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
exports.products = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.product.findMany({
            include: {
                services: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
    }),
    create: (product) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("create product", product);
        return yield prisma_client_1.default.product.create({ data: product });
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.product.findUnique({ where: { id } });
    }),
    update: (id, product) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.product.update({ where: { id: Number(id) }, data: product });
    }),
    connectServices: (id, serviceId) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.product.update({
            where: { id },
            data: { services: { connect: { id: serviceId } } },
        });
    }),
    disconnectServices: (id, serviceId) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.product.update({
            where: { id },
            data: { services: { disconnect: { id: serviceId } } },
        });
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.product.delete({ where: { id } });
    }),
};
exports.default = exports.products;
