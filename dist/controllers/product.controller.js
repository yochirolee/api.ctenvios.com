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
const repositories_1 = __importDefault(require("../repositories"));
const productController = {
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const product = yield repositories_1.default.products.create(req.body);
        res.status(201).json(product);
    }),
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const products = yield repositories_1.default.products.getAll();
        res.status(200).json(products);
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const product = yield repositories_1.default.products.getById(Number(id));
        res.status(200).json(product);
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const product = yield repositories_1.default.products.update(Number(id), req.body);
        res.status(200).json(product);
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const product = yield repositories_1.default.products.delete(Number(id));
        res.status(200).json(product);
    }),
    connectServices: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const service_id = req.body.service_id;
        const product = yield repositories_1.default.products.connectServices(Number(id), Number(service_id));
        res.status(200).json(product);
    }),
    disconnectServices: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const service_id = req.body.service_id;
        const product = yield repositories_1.default.products.disconnectServices(Number(id), Number(service_id));
        res.status(200).json(product);
    }),
};
exports.default = productController;
