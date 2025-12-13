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
exports.receivers = void 0;
const repositories_1 = __importDefault(require("../repositories"));
const types_1 = require("../types/types");
const capitalize_1 = __importDefault(require("../utils/capitalize"));
exports.receivers = {
    get: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { page, limit } = req.query;
        const { rows, total } = yield repositories_1.default.receivers.get(parseInt(page) || 1, parseInt(limit) || 50);
        const flat_rows = rows.map((row) => {
            var _a, _b;
            return Object.assign(Object.assign({}, row), { province: ((_a = row.province) === null || _a === void 0 ? void 0 : _a.name) || "", city: ((_b = row.city) === null || _b === void 0 ? void 0 : _b.name) || "" });
        });
        res.status(200).json({ rows: flat_rows, total });
    }),
    getByCi: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { ci } = req.params;
        const receiver = yield repositories_1.default.receivers.getByCi(ci);
        if (!receiver) {
            return res.status(404).json({ error: "Receiver not found" });
        }
        res.status(200).json(receiver);
    }),
    search: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { query, page, limit } = req.query;
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }
        const data = yield repositories_1.default.receivers.search(req.query.query, parseInt(page) || 1, parseInt(limit) || 50);
        res.status(200).json({
            rows: data,
            total: data.length,
        });
    }),
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { first_name, last_name, middle_name, second_last_name, mobile, ci, address, email, province_id, city_id } = req.body;
        const new_receiver = {
            ci: (ci === null || ci === void 0 ? void 0 : ci.trim()) || null,
            email: (email === null || email === void 0 ? void 0 : email.trim()) || null,
            first_name: (0, capitalize_1.default)(first_name.trim()),
            last_name: (0, capitalize_1.default)(last_name.trim()),
            middle_name: middle_name ? (0, capitalize_1.default)(middle_name.trim()) : null,
            second_last_name: second_last_name ? (0, capitalize_1.default)(second_last_name.trim()) : null,
            mobile: mobile.replace(/\s+/g, ""),
            address: (address === null || address === void 0 ? void 0 : address.trim()) || null,
            province_id: parseInt(province_id),
            city_id: parseInt(city_id),
        };
        const customer_id = parseInt(req.query.customerId);
        const receiver = yield repositories_1.default.receivers.create(new_receiver);
        if (customer_id && customer_id > 0) {
            yield repositories_1.default.receivers.connect(receiver.id, customer_id);
        }
        res.status(201).json(receiver);
    }),
    edit: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "Receiver ID is required" });
        }
        const result = types_1.createReceiverSchema.safeParse(req.body);
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
        const receiver = yield repositories_1.default.receivers.edit(parseInt(id), req.body);
        res.status(200).json(receiver);
    }),
};
exports.default = exports.receivers;
