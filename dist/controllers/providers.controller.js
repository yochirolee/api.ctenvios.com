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
const zod_1 = require("zod");
const repositories_1 = __importDefault(require("../repositories"));
const providerSchema = zod_1.z.object({
    name: zod_1.z.string(),
    address: zod_1.z.string(),
    contact: zod_1.z.string(),
    phone: zod_1.z.string(),
    email: zod_1.z.string(),
});
exports.providers = {
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const result = providerSchema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map((err) => ({
                field: err.path.length > 0 ? err.path.join(".") : "root",
                message: err.message,
            }));
            return res.status(400).json({
                error: "Validation failed",
                source: "zod",
                errors,
            });
        }
        const provider = yield repositories_1.default.providers.create(result.data);
        res.status(201).json(provider);
    }),
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const providers = yield repositories_1.default.providers.getAll();
        res.status(200).json(providers);
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                error: "Invalid provider id",
            });
        }
        const provider = yield repositories_1.default.providers.getById(id);
        res.status(200).json(provider);
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                error: "Invalid provider id",
            });
        }
        const provider = yield repositories_1.default.providers.update(id, req.body);
        res.status(200).json(provider);
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                error: "Invalid provider id",
            });
        }
        const provider = yield repositories_1.default.providers.delete(id);
        res.status(200).json(provider);
    }),
};
exports.default = exports.providers;
