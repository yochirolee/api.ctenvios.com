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
exports.warehouses = void 0;
const warehouses_repository_1 = __importDefault(require("../repositories/warehouses.repository"));
const app_error_1 = __importDefault(require("../utils/app.error"));
exports.warehouses = {
    /**
     * Get all warehouses with pagination and filters
     */
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const carrier_id = req.query.carrier_id ? Number(req.query.carrier_id) : undefined;
        const province_id = req.query.province_id ? Number(req.query.province_id) : undefined;
        const is_active = req.query.is_active !== undefined ? req.query.is_active === "true" : undefined;
        const result = yield warehouses_repository_1.default.getAll(page, limit, carrier_id, province_id, is_active);
        res.status(200).json({
            rows: result.warehouses,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Get warehouse by ID
     */
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const warehouse = yield warehouses_repository_1.default.getById(id);
        if (!warehouse) {
            res.status(404).json({ error: "Warehouse not found" });
            return;
        }
        res.status(200).json(warehouse);
    }),
    /**
     * Create a new warehouse
     */
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { name, address, carrier_id, province_id, is_main, manager_id } = req.body;
        const warehouse = yield warehouses_repository_1.default.create({
            name,
            address,
            carrier_id,
            province_id,
            is_main,
            manager_id,
        });
        res.status(201).json(warehouse);
    }),
    /**
     * Update warehouse
     */
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const warehouse = yield warehouses_repository_1.default.update(id, req.body);
        res.status(200).json(warehouse);
    }),
    /**
     * Delete warehouse
     */
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const warehouse = yield warehouses_repository_1.default.delete(id);
        res.status(200).json(warehouse);
    }),
    /**
     * Get parcels in warehouse
     */
    getParcels: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = yield warehouses_repository_1.default.getParcels(id, page, limit);
        res.status(200).json({
            rows: result.parcels,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Receive parcel in warehouse
     */
    receiveParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { tracking_number } = req.body;
        const user = req.user;
        const parcel = yield warehouses_repository_1.default.receiveParcel(id, tracking_number, user.id);
        res.status(200).json(parcel);
    }),
    /**
     * Transfer parcel to another warehouse
     */
    transferParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { to_warehouse_id, tracking_number } = req.body;
        const user = req.user;
        const parcel = yield warehouses_repository_1.default.transferParcel(id, to_warehouse_id, tracking_number, user.id);
        res.status(200).json(parcel);
    }),
    /**
     * Get warehouses by carrier
     */
    getByCarrier: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const carrier_id = Number(req.params.id);
        const warehouses = yield warehouses_repository_1.default.getByCarrier(carrier_id);
        res.status(200).json(warehouses);
    }),
    /**
     * Get my carrier's warehouses (for carrier users)
     */
    getMyWarehouses: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user.carrier_id) {
            throw new app_error_1.default("User must belong to a carrier", 403);
        }
        const warehouses = yield warehouses_repository_1.default.getByCarrier(user.carrier_id);
        res.status(200).json(warehouses);
    }),
};
exports.default = exports.warehouses;
