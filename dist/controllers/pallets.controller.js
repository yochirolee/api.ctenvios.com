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
exports.pallets = void 0;
const pallets_repository_1 = __importDefault(require("../repositories/pallets.repository"));
const app_error_1 = __importDefault(require("../utils/app.error"));
exports.pallets = {
    /**
     * Get all pallets with pagination and filters
     */
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const status = req.query.status;
        const user = req.user;
        // Filter by user's agency
        const agency_id = user.agency_id;
        const result = yield pallets_repository_1.default.getAll(page, limit, agency_id, status);
        res.status(200).json({
            rows: result.pallets,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Get pallet by ID
     */
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const pallet = yield pallets_repository_1.default.getById(id);
        if (!pallet) {
            res.status(404).json({ error: "Pallet not found" });
            return;
        }
        res.status(200).json(pallet);
    }),
    /**
     * Get pallet by pallet number
     */
    getByPalletNumber: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { palletNumber } = req.params;
        const pallet = yield pallets_repository_1.default.getByPalletNumber(palletNumber);
        if (!pallet) {
            res.status(404).json({ error: "Pallet not found" });
            return;
        }
        res.status(200).json(pallet);
    }),
    /**
     * Create a new pallet
     */
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const user = req.user;
        if (!user.agency_id) {
            throw new app_error_1.default("User must belong to an agency", 403);
        }
        const pallet = yield pallets_repository_1.default.create(user.agency_id, user.id, (_a = req.body) === null || _a === void 0 ? void 0 : _a.notes);
        res.status(201).json(pallet);
    }),
    /**
     * Update pallet
     */
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const pallet = yield pallets_repository_1.default.update(id, {
            notes: req.body.notes,
        });
        res.status(200).json(pallet);
    }),
    /**
     * Delete pallet
     */
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const pallet = yield pallets_repository_1.default.delete(id);
        res.status(200).json(pallet);
    }),
    /**
     * Get parcels in pallet
     */
    getParcels: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = yield pallets_repository_1.default.getParcels(id, page, limit);
        res.status(200).json({
            rows: result.parcels,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Add parcel to pallet
     */
    addParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { tracking_number } = req.body;
        const user = req.user;
        const parcel = yield pallets_repository_1.default.addParcel(id, tracking_number, user.id);
        res.status(200).json(parcel);
    }),
    /**
     * Add all parcels from an order to a pallet
     */
    addParcelsByOrderId: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { order_id } = req.body;
        const user = req.user;
        const result = yield pallets_repository_1.default.addParcelsByOrderId(Number(id), Number(order_id), user.id);
        res.status(200).json(result);
    }),
    /**
     * Remove parcel from pallet
     */
    removeParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id, trackingNumber } = req.params;
        const user = req.user;
        const parcel = yield pallets_repository_1.default.removeParcel(Number(id), trackingNumber, user.id);
        res.status(200).json(parcel);
    }),
    /**
     * Seal pallet
     */
    seal: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        const pallet = yield pallets_repository_1.default.seal(id, user.id);
        res.status(200).json(pallet);
    }),
    /**
     * Unseal pallet
     */
    unseal: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        const pallet = yield pallets_repository_1.default.unseal(id, user.id);
        res.status(200).json(pallet);
    }),
    /**
     * Get parcels ready to be added to pallet
     */
    getReadyForPallet: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const user = req.user;
        if (!user.agency_id) {
            throw new app_error_1.default("User must belong to an agency", 403);
        }
        const result = yield pallets_repository_1.default.getReadyParcels(user.agency_id, page, limit);
        res.status(200).json({
            rows: result.parcels,
            total: result.total,
            page,
            limit,
        });
    }),
};
exports.default = exports.pallets;
