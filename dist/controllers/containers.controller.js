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
exports.containers = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const containers_repository_1 = __importDefault(require("../repositories/containers.repository"));
const app_error_1 = __importDefault(require("../utils/app.error"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const repositories_1 = __importDefault(require("../repositories"));
const generate_container_manifest_excel_1 = require("../utils/excel/generate-container-manifest-excel");
const ALLOWED_CONTAINER_STATUSES = [
    client_1.Status.IN_AGENCY,
    client_1.Status.IN_PALLET,
    client_1.Status.IN_DISPATCH,
    client_1.Status.RECEIVED_IN_DISPATCH,
    client_1.Status.IN_WAREHOUSE,
];
const addParcelParamsSchema = zod_1.z.object({
    id: zod_1.z.coerce.number().int().positive(),
});
const addParcelBodySchema = zod_1.z.object({
    tracking_number: zod_1.z.string().min(1),
});
exports.containers = {
    /**
     * Get all containers with pagination and filters
     */
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const status = req.query.status;
        const user = req.user;
        // Get forwarder_id from user's agency
        let forwarder_id;
        if (user.agency_id) {
            const agency = yield prisma_client_1.default.agency.findUnique({
                where: { id: user.agency_id },
                select: { forwarder_id: true },
            });
            forwarder_id = (_a = agency === null || agency === void 0 ? void 0 : agency.forwarder_id) !== null && _a !== void 0 ? _a : undefined;
        }
        const result = yield containers_repository_1.default.getAll(page, limit, forwarder_id, status);
        res.status(200).json({
            rows: result.containers,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Get container by ID
     */
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const container = yield containers_repository_1.default.getById(Number(id));
        if (!container) {
            res.status(404).json({ error: "Container not found" });
            return;
        }
        res.status(200).json(container);
    }),
    /**
     * Get container by container number
     */
    getByContainerNumber: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { containerNumber } = req.params;
        const container = yield containers_repository_1.default.getByContainerNumber(containerNumber);
        if (!container) {
            res.status(404).json({ error: "Container not found" });
            return;
        }
        res.status(200).json(container);
    }),
    /**
     * Create a new container
     */
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const body = req.body;
        if (!user.agency_id) {
            throw new app_error_1.default("User must belong to an agency", 403);
        }
        const agency = yield repositories_1.default.agencies.getById(user.agency_id);
        if (!agency) {
            throw new app_error_1.default("Agency not found", 404);
        }
        if (agency.agency_type !== client_1.AgencyType.FORWARDER) {
            throw new app_error_1.default("Only reseller agencies can create containers", 403);
        }
        const container = yield containers_repository_1.default.create(Object.assign(Object.assign({}, body), { forwarder_id: agency.forwarder_id, created_by_id: user.id, estimated_departure: body.estimated_departure ? new Date(body.estimated_departure) : undefined, estimated_arrival: body.estimated_arrival ? new Date(body.estimated_arrival) : undefined }));
        res.status(201).json(container);
    }),
    /**
     * Update container
     */
    update: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const user = req.user;
        const body = req.body;
        console.log("updateing container", body);
        const updateData = Object.assign(Object.assign({}, body), { estimated_departure: body.estimated_departure ? new Date(body.estimated_departure) : undefined, estimated_arrival: body.estimated_arrival ? new Date(body.estimated_arrival) : undefined, actual_departure: body.actual_departure ? new Date(body.actual_departure) : undefined, actual_arrival: body.actual_arrival ? new Date(body.actual_arrival) : undefined });
        const container = yield containers_repository_1.default.update(Number(id), updateData, user === null || user === void 0 ? void 0 : user.id);
        res.status(200).json(container);
    }),
    /**
     * Delete container
     */
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const container = yield containers_repository_1.default.delete(Number(id));
        res.status(200).json(container);
    }),
    /**
     * Get parcels in container
     */
    getParcels: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = yield containers_repository_1.default.getParcels(Number(id), page, limit);
        res.status(200).json({
            rows: result.parcels,
            total: result.total,
            page,
            limit,
        });
    }),
    /**
     * Add parcel to container
     */
    addParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const user = req.user;
        const { id } = addParcelParamsSchema.parse(req.params);
        const { tracking_number } = addParcelBodySchema.parse(req.body);
        const parcel = yield containers_repository_1.default.getParcelAttachInfo(tracking_number);
        if (!parcel) {
            throw new app_error_1.default("Parcel not found", 404);
        }
        if (parcel.deleted_at) {
            throw new app_error_1.default(`Cannot add parcel ${tracking_number} - its order has been deleted`, 400);
        }
        if (((_a = parcel.service) === null || _a === void 0 ? void 0 : _a.service_type) !== "MARITIME") {
            throw new app_error_1.default(`Parcel ${tracking_number} uses ${((_b = parcel.service) === null || _b === void 0 ? void 0 : _b.service_name) || "AIR"} service (${(_c = parcel.service) === null || _c === void 0 ? void 0 : _c.service_type}). Only MARITIME parcels can be added to containers. Use flights for AIR parcels.`, 400);
        }
        if (parcel.container_id) {
            throw new app_error_1.default(`Parcel ${tracking_number} is already in container ${parcel.container_id}`, 409);
        }
        if (parcel.flight_id) {
            throw new app_error_1.default(`Parcel ${tracking_number} is already in flight ${parcel.flight_id}`, 409);
        }
        if (!ALLOWED_CONTAINER_STATUSES.includes(parcel.status)) {
            throw new app_error_1.default(`Parcel with status ${parcel.status} cannot be added to container. Allowed statuses: ${ALLOWED_CONTAINER_STATUSES.join(", ")}`, 400);
        }
        const container = yield containers_repository_1.default.getContainerAttachInfo(id);
        if (!container) {
            throw new app_error_1.default(`Container with id ${id} not found`, 404);
        }
        if (container.status !== client_1.ContainerStatus.PENDING && container.status !== client_1.ContainerStatus.LOADING) {
            throw new app_error_1.default(`Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`, 400);
        }
        const updatedParcel = yield containers_repository_1.default.addParcel(id, tracking_number, user.id);
        res.status(200).json({ data: updatedParcel });
    }),
    /**
     * Add all parcels from an order to container
     */
    addParcelsByOrderId: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { order_id } = req.body;
        const user = req.user;
        const result = yield containers_repository_1.default.addParcelsByOrderId(Number(id), order_id, user.id);
        res.status(200).json(result);
    }),
    /**
     * Add all parcels from a dispatch to container
     */
    addParcelsByDispatchId: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { dispatch_id } = req.body;
        const user = req.user;
        const result = yield containers_repository_1.default.addParcelsByDispatchId(Number(id), dispatch_id, user.id);
        res.status(200).json(result);
    }),
    /**
     * Remove parcel from container
     */
    removeParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id, trackingNumber } = req.params;
        const user = req.user;
        const parcel = yield containers_repository_1.default.removeParcel(Number(id), trackingNumber, user.id);
        res.status(200).json(parcel);
    }),
    /**
     * Update container status
     */
    updateStatus: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const { status, seal_number, booking_number, cat_number, location, description } = req.body;
        const user = req.user;
        const container = yield containers_repository_1.default.updateStatus(Number(id), status, user.id, location, description, seal_number, booking_number, cat_number);
        res.status(200).json(container);
    }),
    /**
     * Get container events
     */
    getEvents: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const events = yield containers_repository_1.default.getEvents(Number(id));
        res.status(200).json(events);
    }),
    /**
     * Get parcels ready to be added to container (uses unified parcels listFiltered)
     */
    getReadyForContainer: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const user = req.user;
        if (!user.agency_id) {
            throw new app_error_1.default("User must belong to an agency", 403);
        }
        const agency = yield prisma_client_1.default.agency.findUnique({
            where: { id: user.agency_id },
            select: { forwarder_id: true },
        });
        if (!(agency === null || agency === void 0 ? void 0 : agency.forwarder_id)) {
            throw new app_error_1.default("Agency must be associated with a forwarder", 403);
        }
        const allowedStatuses = [
            client_1.Status.IN_AGENCY,
            client_1.Status.IN_PALLET,
            client_1.Status.IN_DISPATCH,
            client_1.Status.RECEIVED_IN_DISPATCH,
            client_1.Status.IN_WAREHOUSE,
        ];
        const { rows, total } = yield repositories_1.default.parcels.listFiltered({
            forwarder_id: agency.forwarder_id,
            container_id_null: true,
            flight_id_null: true,
            service_type: "MARITIME",
            status_in: allowedStatuses,
        }, page, limit);
        res.status(200).json({
            rows,
            total,
            page,
            limit,
        });
    }),
    /**
     * Export container manifest as Excel file
     */
    exportManifestExcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const { id } = req.params;
        const containerId = Number(id);
        const buffer = yield (0, generate_container_manifest_excel_1.generateContainerManifestExcel)(containerId);
        // Get container info for filename
        const container = yield prisma_client_1.default.container.findUnique({
            where: { id: containerId },
            select: { container_number: true, container_name: true },
        });
        const datePart = new Date().toISOString().split("T")[0];
        const safeContainerName = (_a = container === null || container === void 0 ? void 0 : container.container_name) === null || _a === void 0 ? void 0 : _a.trim().replace(/\s+/g, "_");
        const filename = container
            ? `Manifiesto_${safeContainerName || container.container_number}_${datePart}.xlsx`
            : `Manifiesto_${containerId}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
    }),
    /**
     * Get container manifest data (JSON) for frontend rendering
     */
    getManifestData: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const containerId = Number(id);
        const data = yield (0, generate_container_manifest_excel_1.getContainerManifestData)(containerId);
        res.status(200).json(data);
    }),
};
exports.default = exports.containers;
