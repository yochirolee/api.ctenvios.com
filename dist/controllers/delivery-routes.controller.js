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
exports.deliveryRoutes = void 0;
const delivery_routes_repository_1 = __importDefault(require("../repositories/delivery-routes.repository"));
const app_error_1 = __importDefault(require("../utils/app.error"));
exports.deliveryRoutes = {
    /**
     * Get all routes with pagination and filters
     */
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const carrier_id = req.query.carrier_id ? Number(req.query.carrier_id) : undefined;
        const warehouse_id = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
        const messenger_id = req.query.messenger_id;
        const status = req.query.status;
        const scheduled_date = req.query.scheduled_date ? new Date(req.query.scheduled_date) : undefined;
        const result = yield delivery_routes_repository_1.default.getAll(page, limit, carrier_id, warehouse_id, messenger_id, status, scheduled_date);
        res.status(200).json({
            rows: result.routes,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Get route by ID
     */
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const route = yield delivery_routes_repository_1.default.getById(id);
        if (!route) {
            res.status(404).json({ error: "Route not found" });
            return;
        }
        res.status(200).json(route);
    }),
    /**
     * Create a new route
     */
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const { carrier_id, warehouse_id, messenger_id, province_id, scheduled_date, notes } = req.body;
        const route = yield delivery_routes_repository_1.default.create({
            carrier_id,
            warehouse_id,
            messenger_id,
            province_id,
            scheduled_date: new Date(scheduled_date),
            notes,
            created_by_id: user.id,
        });
        res.status(201).json(route);
    }),
    /**
     * Update route
     */
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const updateData = Object.assign(Object.assign({}, req.body), { scheduled_date: req.body.scheduled_date ? new Date(req.body.scheduled_date) : undefined });
        const route = yield delivery_routes_repository_1.default.update(id, updateData);
        res.status(200).json(route);
    }),
    /**
     * Delete route
     */
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const route = yield delivery_routes_repository_1.default.delete(id);
        res.status(200).json(route);
    }),
    /**
     * Add parcel to route
     */
    addParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { parcel_id } = req.body;
        const user = req.user;
        const assignment = yield delivery_routes_repository_1.default.addParcelToRoute(id, parcel_id, user.id);
        res.status(201).json(assignment);
    }),
    /**
     * Remove parcel from route
     */
    removeParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id, parcelId } = req.params;
        const user = req.user;
        yield delivery_routes_repository_1.default.removeParcelFromRoute(id, parcelId, user.id);
        res.status(200).json({ message: "Parcel removed from route" });
    }),
    /**
     * Assign parcel directly to messenger
     */
    assignToMessenger: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { parcel_id, messenger_id } = req.body;
        const user = req.user;
        const assignment = yield delivery_routes_repository_1.default.assignToMessenger(parcel_id, messenger_id, user.id);
        res.status(201).json(assignment);
    }),
    /**
     * Mark route as ready
     */
    markAsReady: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const route = yield delivery_routes_repository_1.default.markAsReady(id);
        res.status(200).json(route);
    }),
    /**
     * Start route
     */
    startRoute: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        const route = yield delivery_routes_repository_1.default.startRoute(id, user.id);
        res.status(200).json(route);
    }),
    /**
     * Record delivery attempt
     */
    recordDeliveryAttempt: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { assignmentId } = req.params;
        const user = req.user;
        const { success, recipient_name, recipient_ci, signature, photo_proof, notes } = req.body;
        const assignment = yield delivery_routes_repository_1.default.recordDeliveryAttempt(assignmentId, user.id, success, {
            recipient_name,
            recipient_ci,
            signature,
            photo_proof,
            notes,
        });
        res.status(200).json(assignment);
    }),
    /**
     * Reschedule failed delivery
     */
    rescheduleDelivery: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { assignmentId } = req.params;
        const { notes } = req.body;
        const user = req.user;
        const assignment = yield delivery_routes_repository_1.default.rescheduleDelivery(assignmentId, user.id, notes);
        res.status(200).json(assignment);
    }),
    /**
     * Get my assignments (for messenger)
     */
    getMyAssignments: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const status = req.query.status;
        const assignments = yield delivery_routes_repository_1.default.getMessengerAssignments(user.id, status);
        res.status(200).json(assignments);
    }),
    /**
     * Get parcels ready for delivery
     */
    getParcelsReadyForDelivery: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { warehouse_id } = req.query;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        if (!warehouse_id) {
            throw new app_error_1.default("Warehouse ID is required", 400);
        }
        const result = yield delivery_routes_repository_1.default.getParcelsReadyForDelivery(Number(warehouse_id), page, limit);
        res.status(200).json({
            rows: result.parcels,
            total: result.total,
            page,
            limit,
        });
    }),
};
exports.default = exports.deliveryRoutes;
