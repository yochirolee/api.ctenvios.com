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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.services_controller = void 0;
const repositories_1 = __importDefault(require("../repositories"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const serviceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, { message: "Name is required" }),
    description: zod_1.z.string().optional(),
    service_type: zod_1.z.nativeEnum(client_1.ServiceType, { message: "Service type is required" }),
    forwarder_id: zod_1.z.number().min(0, { message: "Forwarder ID is required" }),
    provider_id: zod_1.z.number().min(0, { message: "Provider ID is required" }),
    is_active: zod_1.z.boolean().default(true),
});
exports.services_controller = {
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const service = serviceSchema.safeParse(req.body);
            if (!service.success) {
                const errors = service.error.errors.map((err) => ({
                    field: err.path.length > 0 ? err.path.join(".") : "root",
                    message: err.message,
                }));
                return res.status(400).json({
                    error: "Validation failed",
                    source: "zod",
                    errors,
                });
            }
            const all_agencies = yield repositories_1.default.agencies.getAll();
            // Transform data for Prisma ServiceCreateInput
            const _a = service.data, { forwarder_id, provider_id } = _a, serviceData = __rest(_a, ["forwarder_id", "provider_id"]);
            const prismaServiceData = Object.assign(Object.assign({}, serviceData), { forwarder: {
                    connect: { id: forwarder_id },
                }, provider: {
                    connect: { id: provider_id },
                }, agencies: {
                    connect: all_agencies.map((agency) => ({ id: agency.id })),
                } });
            const newService = yield repositories_1.default.services.create(prismaServiceData);
            res.status(201).json(newService);
        }
        catch (error) {
            console.error("Error creating service:", error);
            res.status(500).json({ error: error.message });
        }
    }),
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const service = yield repositories_1.default.services.getAll();
        res.status(200).json(service);
    }),
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const service = yield repositories_1.default.services.getById(Number(id));
        res.status(200).json(service);
    }),
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const service = yield repositories_1.default.services.update(Number(id), req.body);
        res.status(200).json(service);
    }),
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const service = yield repositories_1.default.services.delete(Number(id));
        res.status(200).json(service);
    }),
};
exports.default = exports.services_controller;
