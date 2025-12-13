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
const zod_1 = require("zod");
const repositories_1 = __importDefault(require("../repositories"));
const forwarderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    logo: zod_1.z.string().optional(),
    contact: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(10),
    email: zod_1.z.string().email(),
    address: zod_1.z.string().min(1),
});
const providersIdsSchema = zod_1.z.array(zod_1.z.number()).optional();
exports.forwarders = {
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const forwarders = yield repositories_1.default.forwarders.getAll();
        res.status(200).json(forwarders);
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const forwarder = yield repositories_1.default.forwarders.getById(Number(id));
        res.status(200).json(forwarder);
    }),
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const result = forwarderSchema.safeParse(req.body);
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
        const forwarder = yield repositories_1.default.forwarders.create(result.data);
        res.status(201).json(forwarder);
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { providersIds } = req.body;
        const parsedforwarder = forwarderSchema.safeParse(req.body);
        if (!parsedforwarder.success) {
            const errors = parsedforwarder.error.errors.map((err) => ({
                field: err.path.length > 0 ? err.path.join(".") : "root",
                message: err.message,
            }));
            return res.status(400).json({
                error: "Validation failed",
                source: "zod",
                errors,
            });
        }
        const forwarder = yield repositories_1.default.forwarders.update(Number(id), parsedforwarder.data, providersIds);
        res.status(200).json(forwarder);
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const forwarder = yield repositories_1.default.forwarders.delete(Number(id));
        res.status(200).json(forwarder);
    }),
};
exports.default = exports.forwarders;
