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
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
const types_1 = require("../types/types");
const listSelect = {
    id: true,
    tracking_number: true,
    description: true,
    weight: true,
    status: true,
    created_at: true,
    updated_at: true,
};
const parcels = {
    get: (page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.parcel.findMany({
            take: limit,
            skip: (page - 1) * limit,
            orderBy: { tracking_number: "asc" },
        });
    }),
    getWithEvents: (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (page = 1, limit = 10) {
        return yield prisma_client_1.default.parcel.findMany({
            include: { events: true },
            orderBy: { updated_at: "desc" },
            take: limit,
            skip: (page - 1) * limit,
        });
    }),
    /** Paginated list with optional status filter (data access only) */
    getAllPaginated: (where, page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        const [rows, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { created_at: "desc" },
                select: listSelect,
            }),
            prisma_client_1.default.parcel.count({ where }),
        ]);
        return { rows, total };
    }),
    /** Get parcel by HBL with full details for admin (data access only) */
    getByHblWithDetails: (hbl) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number: hbl },
            include: {
                agency: { select: { id: true, name: true } },
                service: { select: { id: true, name: true } },
                order: {
                    select: {
                        id: true,
                        receiver: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                                second_last_name: true,
                                phone: true,
                                address: true,
                            },
                        },
                    },
                },
                order_items: true,
                container: { select: { id: true, container_name: true, container_number: true, status: true } },
                flight: { select: { id: true, awb_number: true, flight_number: true, status: true } },
                dispatch: { select: { id: true, status: true } },
            },
        });
    }),
    /** Get parcels by order ID with service (data access only) */
    getByOrderId: (orderId_1, ...args_1) => __awaiter(void 0, [orderId_1, ...args_1], void 0, function* (orderId, page = 1, limit = 10) {
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where: { order_id: orderId },
                orderBy: { tracking_number: "asc" },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    service: { select: { id: true, name: true } },
                },
            }),
            prisma_client_1.default.parcel.count({ where: { order_id: orderId } }),
        ]);
        return { parcels, total };
    }),
    /** Get parcel events by HBL; returns null if parcel not found (data access only) */
    getEventsByHbl: (hbl) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number: hbl },
            select: { id: true },
        });
        if (!parcel)
            return null;
        return yield prisma_client_1.default.parcelEvent.findMany({
            where: { parcel_id: parcel.id },
            orderBy: { created_at: "desc" },
            include: {
                user: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } },
                dispatch: { select: { id: true } },
                container: { select: { id: true, container_name: true, container_number: true } },
                flight: { select: { id: true, awb_number: true, flight_number: true } },
            },
        });
    }),
    /** Public tracking view by HBL; returns null if not found (data access only) */
    getTrackByHbl: (hbl) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number: hbl },
            select: {
                tracking_number: true,
                status: true,
                description: true,
                weight: true,
                created_at: true,
                order: {
                    select: {
                        id: true,
                        receiver: {
                            select: {
                                first_name: true,
                                last_name: true,
                                province: { select: { name: true } },
                                city: { select: { name: true } },
                            },
                        },
                    },
                },
                container: {
                    select: {
                        container_name: true,
                        status: true,
                        estimated_arrival: true,
                    },
                },
                flight: {
                    select: {
                        flight_number: true,
                        status: true,
                        estimated_arrival: true,
                    },
                },
                events: {
                    orderBy: { created_at: "desc" },
                    select: {
                        status: true,
                        notes: true,
                        created_at: true,
                        location: { select: { name: true } },
                    },
                },
            },
        });
    }),
    getInAgency: (agency_id_1, ...args_1) => __awaiter(void 0, [agency_id_1, ...args_1], void 0, function* (agency_id, page = 1, limit = 10) {
        const where = { agency_id, dispatch_id: null };
        const [rows, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where,
                orderBy: { tracking_number: "asc" },
                take: limit,
                skip: (page - 1) * limit,
                select: {
                    id: true,
                    tracking_number: true,
                    external_reference: true,
                    description: true,
                    weight: true,
                    agency_id: true,
                    service_id: true,
                    status: true,
                    order_id: true,
                    dispatch_id: true,
                },
            }),
            prisma_client_1.default.parcel.count({ where }),
        ]);
        return { rows, total };
    }),
    /**
     * Paginated list with optional filters: status, hbl (search), order_id, agency_id,
     * description, customer (name), receiver (name), dispatch_id_null, etc.
     * Used by GET /parcels and by ready-for-dispatch / ready-for-container.
     */
    listFiltered: (filters, page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const where = {
            deleted_at: null,
        };
        if (filters.status != null)
            where.status = filters.status;
        if (filters.status_in != null && filters.status_in.length > 0)
            where.status = { in: filters.status_in };
        if (filters.hbl != null && filters.hbl.trim() !== "") {
            where.tracking_number = { contains: filters.hbl.trim(), mode: "insensitive" };
        }
        if (filters.order_id != null)
            where.order_id = filters.order_id;
        if (filters.agency_id_in != null && filters.agency_id_in.length > 0) {
            where.agency_id = { in: filters.agency_id_in };
        }
        else if (filters.agency_id != null) {
            where.agency_id = filters.agency_id;
        }
        const descTrim = (_a = filters.description) === null || _a === void 0 ? void 0 : _a.trim();
        if (descTrim && descTrim !== "") {
            where.description = { contains: descTrim, mode: "insensitive" };
        }
        const customerTrim = (_b = filters.customer) === null || _b === void 0 ? void 0 : _b.trim();
        const receiverTrim = (_c = filters.receiver) === null || _c === void 0 ? void 0 : _c.trim();
        if (customerTrim !== "" || receiverTrim !== "") {
            const orderConditions = [];
            if (customerTrim) {
                const customerWords = customerTrim.split(/\s+/).filter(Boolean);
                orderConditions.push({
                    customer: (0, types_1.buildNameSearchFilter)(customerWords),
                });
            }
            if (receiverTrim) {
                const receiverWords = receiverTrim.split(/\s+/).filter(Boolean);
                orderConditions.push({
                    receiver: (0, types_1.buildNameSearchFilter)(receiverWords),
                });
            }
            where.order = orderConditions.length === 1 ? orderConditions[0] : { AND: orderConditions };
        }
        if (filters.dispatch_id_null === true)
            where.dispatch_id = null;
        if (filters.container_id_null === true)
            where.container_id = null;
        if (filters.flight_id_null === true)
            where.flight_id = null;
        if (filters.forwarder_id != null) {
            where.agency = { forwarder_id: filters.forwarder_id };
        }
        if (filters.service_type != null) {
            where.service = { service_type: filters.service_type };
        }
        const select = {
            id: true,
            tracking_number: true,
            description: true,
            weight: true,
            status: true,
            order_id: true,
            order: {
                select: {
                    id: true,
                    customer: { select: { id: true, first_name: true, last_name: true, middle_name: true, second_last_name: true, mobile: true, address: true } },
                    receiver: { select: { id: true, first_name: true, last_name: true, middle_name: true, second_last_name: true, mobile: true, phone: true, address: true, province: { select: { id: true, name: true } }, city: { select: { id: true, name: true } } } },
                },
            },
            external_reference: true,
            agency_id: true,
            agency: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
            updated_at: true,
        };
        const [rows, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where,
                orderBy: { updated_at: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                select,
            }),
            prisma_client_1.default.parcel.count({ where }),
        ]);
        return { rows, total };
    }),
    /** Update parcel status and create STATUS_CORRECTED event in a transaction (data access only). Returns null if parcel not found. */
    updateStatusWithEvent: (hbl, status, notes, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number: hbl },
            select: { id: true },
        });
        if (!parcel)
            return null;
        return yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const updated = yield tx.parcel.update({
                where: { tracking_number: hbl },
                data: { status },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: "STATUS_CORRECTED",
                    user_id,
                    status,
                    notes,
                },
            });
            return updated;
        }));
    }),
    findParcelByHbl: (hbl) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number: hbl },
            select: {
                id: true,
                tracking_number: true,
                description: true,
                weight: true,
                agency_id: true,
                service_id: true,
                dispatch_id: true,
                current_location_id: true,
                status: true,
            },
        });
    }),
    /**
     * Gets the previous status of a parcel before it was added to dispatch
     * by querying ParcelEvent history in reverse chronological order
     * Skips both IN_DISPATCH and RECEIVED_IN_DISPATCH statuses
     */
    getPreviousStatus: (parcelId) => __awaiter(void 0, void 0, void 0, function* () {
        // Statuses to skip when looking for previous status (dispatch-related statuses)
        const DISPATCH_STATUSES = [client_1.Status.IN_DISPATCH, client_1.Status.RECEIVED_IN_DISPATCH];
        // Get all events for this parcel, ordered by created_at descending
        const events = yield prisma_client_1.default.parcelEvent.findMany({
            where: { parcel_id: parcelId },
            orderBy: { created_at: "desc" },
            select: {
                status: true,
                created_at: true,
            },
        });
        if (events.length === 0) {
            return null;
        }
        // Find the first status that is NOT a dispatch-related status
        for (const event of events) {
            if (!DISPATCH_STATUSES.includes(event.status)) {
                return event.status;
            }
        }
        // If all events are dispatch-related, return IN_AGENCY as default
        return client_1.Status.IN_AGENCY;
    }),
};
exports.default = parcels;
