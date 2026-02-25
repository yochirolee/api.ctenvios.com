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
exports.forwarders = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const _1 = require(".");
exports.forwarders = {
    getAll: () => __awaiter(void 0, void 0, void 0, function* () {
        const forwarders = yield prisma_client_1.default.forwarder.findMany();
        return forwarders;
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const forwarder = yield prisma_client_1.default.forwarder.findUnique({
            where: { id },
            include: {
                services: true,
                agencies: true,
                users: true,
                providers: true,
            },
        });
        return forwarder;
    }),
    create: (forwarder) => __awaiter(void 0, void 0, void 0, function* () {
        const newForwarder = yield prisma_client_1.default.forwarder.create({
            data: forwarder,
        });
        return newForwarder;
    }),
    update: (id, forwarder, providersIds) => __awaiter(void 0, void 0, void 0, function* () {
        if (providersIds) {
            const providers = yield _1.repository.providers.getAll();
            //disconnect all providers
            yield prisma_client_1.default.forwarder.update({
                where: { id },
                data: {
                    providers: { disconnect: providers.map((provider) => ({ id: provider.id })) },
                },
            });
            yield prisma_client_1.default.forwarder.update({
                where: { id },
                data: {
                    providers: { connect: providersIds.map((id) => ({ id: id })) },
                },
            });
        }
        const updatedForwarder = yield prisma_client_1.default.forwarder.update({
            where: { id },
            data: forwarder,
        });
        return updatedForwarder;
    }),
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const deletedForwarder = yield prisma_client_1.default.forwarder.delete({
            where: { id },
        });
        return deletedForwarder;
    }),
};
exports.default = exports.forwarders;
