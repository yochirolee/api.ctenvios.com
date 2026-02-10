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
const provinces = {
    get: () => __awaiter(void 0, void 0, void 0, function* () {
        // Ensure valid numeric values
        const provinces = yield prisma_client_1.default.province.findMany({
            include: {
                cities: true,
            },
            orderBy: {
                id: "asc",
            },
        });
        return provinces;
    }),
    getCityById: (city_id) => __awaiter(void 0, void 0, void 0, function* () {
        const city = yield prisma_client_1.default.city.findUnique({
            where: { id: city_id },
            include: {
                province: true,
            },
        });
        return city;
    }),
    getCityByName: (city_name, province_id) => __awaiter(void 0, void 0, void 0, function* () {
        const city = yield prisma_client_1.default.city.findFirst({
            where: Object.assign({ name: {
                    equals: city_name,
                    mode: "insensitive",
                } }, (province_id && { province_id })),
            include: {
                province: true,
            },
        });
        return city;
    }),
};
exports.default = provinces;
