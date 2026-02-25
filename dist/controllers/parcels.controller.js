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
exports.parcels = void 0;
const client_1 = require("@prisma/client");
const repositories_1 = __importDefault(require("../repositories"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
/**
 * Parcels controller – HTTP + thin logic only.
 * GET /parcels is the unified list: filter by status, search by hbl, filter by order_id, and optional scope (ready_for=dispatch|container).
 */
const ALLOWED_DISPATCH_STATUSES = [
    client_1.Status.IN_AGENCY,
    client_1.Status.IN_PALLET,
    client_1.Status.IN_DISPATCH,
    client_1.Status.IN_WAREHOUSE,
];
const ALLOWED_CONTAINER_STATUSES = [
    client_1.Status.IN_AGENCY,
    client_1.Status.IN_PALLET,
    client_1.Status.IN_DISPATCH,
    client_1.Status.RECEIVED_IN_DISPATCH,
    client_1.Status.IN_WAREHOUSE,
];
const parsePage = (q, fallback) => {
    const n = Number(q);
    return Number.isFinite(n) && n >= 1 ? n : fallback;
};
const parseLimit = (q, fallback) => {
    const n = Number(q);
    return Number.isFinite(n) && n >= 1 ? n : fallback;
};
const parseBool = (s) => s === "true" || s === "1";
exports.parcels = {
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const page = parsePage(req.query.page, 1);
        const limit = parseLimit(req.query.limit, 25);
        const q = req.query;
        const filters = {};
        if (q.ready_for === "dispatch") {
            if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== client_1.Roles.ROOT && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.agency_id) == null) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
            }
            filters.dispatch_id_null = true;
            filters.status_in = ALLOWED_DISPATCH_STATUSES;
        }
        else if (q.ready_for === "container") {
            if (((_c = req.user) === null || _c === void 0 ? void 0 : _c.agency_id) == null) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
            }
            const agency = yield prisma_client_1.default.agency.findUnique({
                where: { id: req.user.agency_id },
                select: { forwarder_id: true },
            });
            if ((agency === null || agency === void 0 ? void 0 : agency.forwarder_id) == null) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Agency must be associated with a forwarder");
            }
            filters.forwarder_id = agency.forwarder_id;
            filters.container_id_null = true;
            filters.flight_id_null = true;
            filters.service_type = "MARITIME";
            filters.status_in = ALLOWED_CONTAINER_STATUSES;
        }
        else {
            if (q.status)
                filters.status = q.status;
            const hbl = ((_e = (_d = q.hbl) !== null && _d !== void 0 ? _d : q.q) !== null && _e !== void 0 ? _e : "").trim();
            if (hbl)
                filters.hbl = hbl;
            const orderId = q.order_id != null ? Number(q.order_id) : undefined;
            if (orderId != null && Number.isFinite(orderId))
                filters.order_id = orderId;
            if ((_f = q.description) === null || _f === void 0 ? void 0 : _f.trim())
                filters.description = q.description.trim();
            if ((_g = q.customer) === null || _g === void 0 ? void 0 : _g.trim())
                filters.customer = q.customer.trim();
            if ((_h = q.receiver) === null || _h === void 0 ? void 0 : _h.trim())
                filters.receiver = q.receiver.trim();
            if (q.scope === "agency" && ((_j = req.user) === null || _j === void 0 ? void 0 : _j.agency_id) != null)
                filters.agency_id = req.user.agency_id;
            if (q.agency_id != null) {
                const n = Number(q.agency_id);
                if (Number.isFinite(n))
                    filters.agency_id = n;
            }
            if (parseBool(q.dispatch_id_null))
                filters.dispatch_id_null = true;
            if (parseBool(q.container_id_null))
                filters.container_id_null = true;
            if (parseBool(q.flight_id_null))
                filters.flight_id_null = true;
            if (q.forwarder_id != null) {
                const n = Number(q.forwarder_id);
                if (Number.isFinite(n))
                    filters.forwarder_id = n;
            }
        }
        // RBAC: ROOT sees all parcels; non-ROOT see only their agency + child agencies
        if (((_k = req.user) === null || _k === void 0 ? void 0 : _k.role) !== client_1.Roles.ROOT && ((_l = req.user) === null || _l === void 0 ? void 0 : _l.agency_id) != null) {
            const childAgencies = yield repositories_1.default.agencies.getAllChildrenRecursively(req.user.agency_id);
            filters.agency_id_in = [req.user.agency_id, ...childAgencies];
        }
        const result = yield repositories_1.default.parcels.listFiltered(filters, page, limit);
        res.status(200).json({ rows: result.rows, total: result.total, page, limit });
    }),
    getByHbl: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { hbl } = req.params;
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "HBL (tracking number) is required");
        }
        const parcel = yield repositories_1.default.parcels.getByHblWithDetails(hbl);
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Parcel not found");
        }
        res.status(200).json(parcel);
    }),
    getByOrderId: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const orderId = Number(req.params.orderId);
        if (!Number.isFinite(orderId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Valid order ID is required");
        }
        const { parcels } = yield repositories_1.default.parcels.getByOrderId(orderId, 1, 1000);
        res.status(200).json({ rows: parcels });
    }),
    getEvents: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { hbl } = req.params;
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "HBL (tracking number) is required");
        }
        const events = yield repositories_1.default.parcels.getEventsByHbl(hbl);
        if (events === null) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Parcel not found");
        }
        res.status(200).json(events);
    }),
    getInAgency: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const page = parsePage(req.query.page, 1);
        const limit = parseLimit(req.query.limit, 25);
        const agencyId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.agency_id;
        if (agencyId == null) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "User must belong to an agency");
        }
        const result = yield repositories_1.default.parcels.getInAgency(agencyId, page, limit);
        res.status(200).json(Object.assign(Object.assign({}, result), { page, limit }));
    }),
    updateStatus: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { hbl } = req.params;
        console.log(req.body, hbl, "req.body");
        const { status, notes } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "HBL (tracking number) is required");
        }
        if (!userId) {
            throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "Authentication required");
        }
        if (!status) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "status is required");
        }
        const updated = yield repositories_1.default.parcels.updateStatusWithEvent(hbl, status, notes !== null && notes !== void 0 ? notes : null, userId);
        if (!updated) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Parcel not found");
        }
        res.status(200).json(updated);
    }),
    track: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { hbl } = req.params;
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "HBL (tracking number) is required");
        }
        let parcel = null;
        if (hbl.startsWith("CTE") || hbl.startsWith("cte")) {
            parcel = yield repositories_1.default.parcels.getTrackByHbl(hbl);
        }
        else {
            parcel = yield repositories_1.default.parcels.getTrackByExternalReference(hbl);
        }
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Parcel not found");
        }
        res.status(200).json(parcel);
    }),
};
exports.default = exports.parcels;
