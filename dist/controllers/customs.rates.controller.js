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
const types_1 = require("../types/types");
const customsRates = {
    get: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { page, limit } = req.query;
        const { rows, total } = yield repositories_1.default.customsRates.get(parseInt(page) || 1, parseInt(limit) || 25);
        res.status(200).json({ rows, total });
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const rate = yield repositories_1.default.customsRates.getById(Number(id));
        res.status(200).json(rate);
    }),
    search: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { query, page, limit } = req.query;
        const { rows, total } = yield repositories_1.default.customsRates.search(query, parseInt(page) || 1, parseInt(limit) || 25);
        res.status(200).json({ rows, total });
    }),
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const schema = types_1.customsRatesSchema.safeParse(req.body);
        if (!schema.success) {
            const errors = schema.error.errors.map((err) => ({
                field: err.path.length > 0 ? err.path.join(".") : "root",
                message: err.message,
            }));
            return res.status(400).json({
                error: "Validation failed",
                source: "zod",
                errors,
            });
        }
        const customsRate = schema.data;
        const rate = yield repositories_1.default.customsRates.create(customsRate);
        res.status(201).json(rate);
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const schema = types_1.customsRatesSchema.safeParse(req.body);
        if (!schema.success) {
            const errors = schema.error.errors.map((err) => ({
                field: err.path.length > 0 ? err.path.join(".") : "root",
                message: err.message,
            }));
            return res.status(400).json({
                error: "Validation failed",
                source: "zod",
                errors,
            });
        }
        const customsRate = schema.data;
        const rate = yield repositories_1.default.customsRates.update(Number(id), customsRate);
        res.status(200).json(rate);
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const rate = yield repositories_1.default.customsRates.delete(Number(id));
        res.status(200).json(rate);
    }),
};
exports.default = customsRates;
