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
exports.tracking = void 0;
const tracking_repository_1 = __importDefault(require("../repositories/tracking.repository"));
exports.tracking = {
    /**
     * Get public tracking (no auth required)
     */
    getPublicTracking: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { trackingNumber } = req.params;
        const tracking = yield tracking_repository_1.default.getPublicTracking(trackingNumber);
        res.status(200).json(tracking);
    }),
    /**
     * Get full internal tracking (staff only)
     */
    getInternalTracking: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { trackingNumber } = req.params;
        const tracking = yield tracking_repository_1.default.getInternalTracking(trackingNumber);
        res.status(200).json(tracking);
    }),
    /**
     * Search parcels by tracking number
     */
    search: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const query = req.query.q || "";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = yield tracking_repository_1.default.searchByTrackingNumber(query, page, limit);
        res.status(200).json({
            rows: result.parcels,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Get location history for a parcel
     */
    getLocationHistory: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { trackingNumber } = req.params;
        const history = yield tracking_repository_1.default.getLocationHistory(trackingNumber);
        res.status(200).json(history);
    }),
    /**
     * Get last scan info for a parcel
     */
    getLastScan: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { trackingNumber } = req.params;
        const lastScan = yield tracking_repository_1.default.getLastScanInfo(trackingNumber);
        res.status(200).json(lastScan);
    }),
};
exports.default = exports.tracking;
