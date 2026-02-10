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
exports.customers = void 0;
const repositories_1 = __importDefault(require("../repositories"));
const app_errors_1 = require("../common/app-errors");
const client_1 = require("@prisma/client");
const capitalize_1 = __importDefault(require("../utils/capitalize"));
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
exports.customers = {
    get: ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const { page, limit } = req.query;
        // ROOT and ADMINISTRATOR can see all customers
        const allowedRoles = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
        const agency_id = allowedRoles.includes(user.role) ? null : user.agency_id;
        const { rows, total } = yield repositories_1.default.customers.get(agency_id, parseInt(page) || 1, parseInt(limit) || 50);
        res.status(200).json({ rows, total });
    })),
    search: ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if (!req.query.query) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Query is required");
        }
        const { page, limit } = req.query;
        console.log("page", page);
        const data = yield repositories_1.default.customers.search(req.query.query, parseInt(page) || 1, parseInt(limit) || 25);
        res.status(200).json({
            rows: data,
            total: data.length,
        });
    })),
    create: ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { mobile, first_name, last_name, middle_name, second_last_name, address, identity_document, email } = req.body;
        if (!first_name || !last_name || !mobile) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "first_name, last_name, and mobile are required");
        }
        const normalizedMobile = mobile.replace(/\s+/g, "");
        const normalizedFirstName = (0, capitalize_1.default)(first_name.trim());
        const normalizedLastName = (0, capitalize_1.default)(last_name.trim());
        // Check if customer already exists
        const existingCustomer = yield repositories_1.default.customers.getByMobileAndName(normalizedMobile, normalizedFirstName, normalizedLastName);
        if (existingCustomer) {
            // Return existing customer
            return res.status(200).json(existingCustomer);
        }
        const new_customer = {
            identity_document: (identity_document === null || identity_document === void 0 ? void 0 : identity_document.trim()) || null,
            email: (email === null || email === void 0 ? void 0 : email.trim()) || null,
            first_name: normalizedFirstName,
            last_name: normalizedLastName,
            middle_name: middle_name ? (0, capitalize_1.default)(middle_name.trim()) : null,
            second_last_name: second_last_name ? (0, capitalize_1.default)(second_last_name.trim()) : null,
            mobile: normalizedMobile,
            address: (address === null || address === void 0 ? void 0 : address.trim()) || null,
        };
        const customer = yield repositories_1.default.customers.create(new_customer);
        res.status(201).json(customer);
    })),
    getById: ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const id = req.params.id;
        if (!id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Customer ID is required");
        }
        const customer = yield repositories_1.default.customers.getById(parseInt(id));
        res.status(200).json(customer);
    })),
    getReceivers: ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const id = req.params.id;
        const { page, limit } = req.query;
        if (!id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Customer ID is required");
        }
        const receivers = yield repositories_1.default.customers.getReceivers(parseInt(id), parseInt(page) || 1, parseInt(limit) || 25);
        const flat_receivers = receivers.map((receiver) => {
            var _a, _b;
            return Object.assign(Object.assign({}, receiver), { province: ((_a = receiver.province) === null || _a === void 0 ? void 0 : _a.name) || "", city: ((_b = receiver.city) === null || _b === void 0 ? void 0 : _b.name) || "" });
        });
        res.status(200).json({ rows: flat_receivers, total: flat_receivers.length });
    })),
    edit: ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const id = req.params.id;
        if (!id || isNaN(parseInt(id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Customer ID is required");
        }
        const customer = yield repositories_1.default.customers.edit(parseInt(id), req.body);
        res.status(200).json(customer);
    })),
};
exports.default = exports.customers;
