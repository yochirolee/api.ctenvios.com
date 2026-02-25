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
exports.customsRates = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
exports.customsRates = {
    get: (page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        // Parallelize count and findMany queries for better performance
        const [total, rows] = yield Promise.all([
            prisma_client_1.default.customsRates.count(),
            prisma_client_1.default.customsRates.findMany({
                take: limit,
                skip: (page - 1) * limit,
                orderBy: {
                    id: "asc",
                },
            }),
        ]);
        return { rows, total };
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const rate = yield prisma_client_1.default.customsRates.findUnique({ where: { id } });
        return rate;
    }),
    search: (query, page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        const rows = yield prisma_client_1.default.customsRates.findMany({
            where: { name: { contains: query, mode: "insensitive" } },
            take: limit,
            skip: (page - 1) * limit,
            orderBy: { id: "asc" },
        });
        const total = yield prisma_client_1.default.customsRates.count({ where: { name: { contains: query, mode: "insensitive" } } });
        return { rows, total };
    }),
    create: (rate) => __awaiter(void 0, void 0, void 0, function* () {
        const newRate = yield prisma_client_1.default.customsRates.create({ data: rate });
        return newRate;
    }),
    update: (id, rate) => __awaiter(void 0, void 0, void 0, function* () {
        // Transformar country_id a relación country si está presente
        // Prisma requiere usar la relación incluso en UncheckedUpdateInput
        const updateData = Object.assign({}, rate);
        // Si rate tiene country_id como campo directo, convertirlo a relación
        if ("country_id" in updateData && typeof updateData.country_id === "number") {
            updateData.country = {
                connect: { id: updateData.country_id },
            };
            delete updateData.country_id;
        }
        const updatedRate = yield prisma_client_1.default.customsRates.update({
            where: { id },
            data: updateData,
        });
        return updatedRate;
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const deletedRate = yield prisma_client_1.default.customsRates.delete({ where: { id } });
        return deletedRate;
    }),
};
exports.default = exports.customsRates;
