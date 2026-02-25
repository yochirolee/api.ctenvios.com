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
exports.flights = void 0;
const flights_repository_1 = __importDefault(require("../repositories/flights.repository"));
exports.flights = {
    /**
     * Get all flights with pagination and filters
     */
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const status = req.query.status;
        const user = req.user;
        const forwarder_id = user === null || user === void 0 ? void 0 : user.forwarder_id;
        const result = yield flights_repository_1.default.getAll(page, limit, forwarder_id, status);
        res.status(200).json({
            data: result.flights,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    }),
    /**
     * Get flight by ID
     */
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const flight = yield flights_repository_1.default.getById(id);
        if (!flight) {
            res.status(404).json({ error: "Flight not found" });
            return;
        }
        res.status(200).json(flight);
    }),
    /**
     * Get flight by AWB number
     */
    getByAwbNumber: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { awbNumber } = req.params;
        const flight = yield flights_repository_1.default.getByAwbNumber(awbNumber);
        if (!flight) {
            res.status(404).json({ error: "Flight not found" });
            return;
        }
        res.status(200).json(flight);
    }),
    /**
     * Create a new flight
     */
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!(user === null || user === void 0 ? void 0 : user.forwarder_id)) {
            res.status(403).json({ error: "Only forwarder users can create flights" });
            return;
        }
        const flight = yield flights_repository_1.default.create(Object.assign(Object.assign({}, req.body), { forwarder_id: user.forwarder_id, created_by_id: user.id, estimated_departure: req.body.estimated_departure ? new Date(req.body.estimated_departure) : undefined, estimated_arrival: req.body.estimated_arrival ? new Date(req.body.estimated_arrival) : undefined }));
        res.status(201).json(flight);
    }),
    /**
     * Update flight
     */
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        const updateData = Object.assign(Object.assign({}, req.body), { estimated_departure: req.body.estimated_departure ? new Date(req.body.estimated_departure) : undefined, estimated_arrival: req.body.estimated_arrival ? new Date(req.body.estimated_arrival) : undefined, actual_departure: req.body.actual_departure ? new Date(req.body.actual_departure) : undefined, actual_arrival: req.body.actual_arrival ? new Date(req.body.actual_arrival) : undefined });
        const flight = yield flights_repository_1.default.update(id, updateData, user === null || user === void 0 ? void 0 : user.id);
        res.status(200).json(flight);
    }),
    /**
     * Delete flight
     */
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const flight = yield flights_repository_1.default.delete(id);
        res.status(200).json(flight);
    }),
    /**
     * Get parcels in flight
     */
    getParcels: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = yield flights_repository_1.default.getParcels(id, page, limit);
        res.status(200).json({
            data: result.parcels,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    }),
    /**
     * Add parcel to flight
     */
    addParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { tracking_number } = req.body;
        const user = req.user;
        const parcel = yield flights_repository_1.default.addParcel(id, tracking_number, user.id);
        res.status(200).json(parcel);
    }),
    /**
     * Remove parcel from flight
     */
    removeParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id, trackingNumber } = req.params;
        const user = req.user;
        const parcel = yield flights_repository_1.default.removeParcel(Number(id), trackingNumber, user.id);
        res.status(200).json(parcel);
    }),
    /**
     * Update flight status
     */
    updateStatus: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { status, location, description } = req.body;
        const user = req.user;
        const flight = yield flights_repository_1.default.updateStatus(id, status, user.id, location, description);
        res.status(200).json(flight);
    }),
    /**
     * Get flight events
     */
    getEvents: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const events = yield flights_repository_1.default.getEvents(id);
        res.status(200).json(events);
    }),
    /**
     * Get parcels ready to be added to flight
     */
    getReadyParcels: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const user = req.user;
        if (!(user === null || user === void 0 ? void 0 : user.forwarder_id)) {
            res.status(403).json({ error: "Only forwarder users can access this resource" });
            return;
        }
        const result = yield flights_repository_1.default.getReadyParcels(user.forwarder_id, page, limit);
        res.status(200).json({
            data: result.parcels,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    }),
};
exports.default = exports.flights;
