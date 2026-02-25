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
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
const app_errors_1 = require("../common/app-errors");
const parcel_event_visibility_1 = require("../utils/parcel-event-visibility");
const order_status_calculator_1 = require("../utils/order-status-calculator");
const parcel_status_details_1 = require("../utils/parcel-status-details");
// Allowed statuses for parcels to be added to flight
const ALLOWED_FLIGHT_STATUSES = [
    client_1.Status.IN_AGENCY,
    client_1.Status.IN_PALLET,
    client_1.Status.IN_DISPATCH,
    client_1.Status.RECEIVED_IN_DISPATCH,
    client_1.Status.IN_WAREHOUSE,
];
/**
 * Validates if a parcel status allows it to be added to flight
 */
const isValidStatusForFlight = (status) => {
    return ALLOWED_FLIGHT_STATUSES.includes(status);
};
const flights = {
    /**
     * Get all flights with pagination
     */
    getAll: (page, limit, forwarder_id, status) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {};
        if (forwarder_id) {
            where.forwarder_id = forwarder_id;
        }
        if (status) {
            where.status = status;
        }
        const [flights, total] = yield Promise.all([
            prisma_client_1.default.flight.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    forwarder: {
                        select: { id: true, name: true },
                    },
                    provider: {
                        select: { id: true, name: true },
                    },
                    created_by: {
                        select: { id: true, name: true },
                    },
                    _count: {
                        select: { parcels: true },
                    },
                },
                orderBy: { created_at: "desc" },
            }),
            prisma_client_1.default.flight.count({ where }),
        ]);
        return { flights, total };
    }),
    /**
     * Get flight by ID with full details
     */
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const flight = yield prisma_client_1.default.flight.findUnique({
            where: { id },
            include: {
                forwarder: {
                    select: { id: true, name: true },
                },
                provider: {
                    select: { id: true, name: true },
                },
                created_by: {
                    select: { id: true, name: true },
                },
                events: {
                    orderBy: { created_at: "desc" },
                    include: {
                        created_by: {
                            select: { id: true, name: true },
                        },
                    },
                },
                _count: {
                    select: { parcels: true },
                },
            },
        });
        return flight;
    }),
    /**
     * Get flight by AWB number
     */
    getByAwbNumber: (awb_number) => __awaiter(void 0, void 0, void 0, function* () {
        const flight = yield prisma_client_1.default.flight.findUnique({
            where: { awb_number },
            include: {
                forwarder: {
                    select: { id: true, name: true },
                },
                provider: {
                    select: { id: true, name: true },
                },
            },
        });
        return flight;
    }),
    /**
     * Create a new flight
     */
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        const flight = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const created = yield tx.flight.create({
                data,
                include: {
                    forwarder: {
                        select: { id: true, name: true },
                    },
                    provider: {
                        select: { id: true, name: true },
                    },
                },
            });
            // Create initial event
            yield tx.flightEvent.create({
                data: {
                    flight_id: created.id,
                    status: created.status,
                    description: "Flight created",
                    created_by_id: data.created_by_id,
                },
            });
            return created;
        }));
        return flight;
    }),
    /**
     * Update flight
     */
    update: (id, data, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const flight = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const current = yield tx.flight.findUnique({ where: { id } });
            if (!current) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Flight with id ${id} not found`);
            }
            const updated = yield tx.flight.update({
                where: { id },
                data,
                include: {
                    forwarder: {
                        select: { id: true, name: true },
                    },
                    provider: {
                        select: { id: true, name: true },
                    },
                },
            });
            // Create event if status changed
            if (data.status && data.status !== current.status && user_id) {
                yield tx.flightEvent.create({
                    data: {
                        flight_id: id,
                        status: data.status,
                        description: `Status changed from ${current.status} to ${data.status}`,
                        created_by_id: user_id,
                    },
                });
            }
            return updated;
        }));
        return flight;
    }),
    /**
     * Delete flight (only if empty and PENDING)
     */
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const flight = yield prisma_client_1.default.flight.findUnique({
            where: { id },
            include: { _count: { select: { parcels: true } } },
        });
        if (!flight) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Flight with id ${id} not found`);
        }
        if (flight._count.parcels > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete flight with parcels. Remove all parcels first.");
        }
        if (flight.status !== client_1.FlightStatus.PENDING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete flight with status ${flight.status}. Only PENDING flights can be deleted.`);
        }
        const deleted = yield prisma_client_1.default.flight.delete({ where: { id } });
        return deleted;
    }),
    /**
     * Get parcels in flight with pagination
     */
    getParcels: (flight_id_1, ...args_1) => __awaiter(void 0, [flight_id_1, ...args_1], void 0, function* (flight_id, page = 1, limit = 20) {
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where: { flight_id },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { updated_at: "desc" },
            }),
            prisma_client_1.default.parcel.count({ where: { flight_id } }),
        ]);
        return { parcels, total };
    }),
    /**
     * Add parcel to flight
     */
    addParcel: (flight_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
            include: {
                service: { select: { service_type: true, name: true } },
            },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        // Check if parcel's order has been deleted
        if (parcel.deleted_at) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcel ${tracking_number} - its order has been deleted`);
        }
        // Validate service type - only AIR parcels can be added to flights
        if (((_a = parcel.service) === null || _a === void 0 ? void 0 : _a.service_type) !== "AIR") {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel ${tracking_number} uses ${((_b = parcel.service) === null || _b === void 0 ? void 0 : _b.name) || "MARITIME"} service (${(_c = parcel.service) === null || _c === void 0 ? void 0 : _c.service_type}). ` +
                `Only AIR parcels can be added to flights. Use containers for MARITIME parcels.`);
        }
        if (!isValidStatusForFlight(parcel.status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel with status ${parcel.status} cannot be added to flight. Allowed statuses: ${ALLOWED_FLIGHT_STATUSES.join(", ")}`);
        }
        if (parcel.flight_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel ${tracking_number} is already in flight ${parcel.flight_id}`);
        }
        if (parcel.container_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel ${tracking_number} is already in container ${parcel.container_id}`);
        }
        const flight = yield prisma_client_1.default.flight.findUnique({ where: { id: flight_id } });
        if (!flight) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Flight with id ${flight_id} not found`);
        }
        if (flight.status !== client_1.FlightStatus.PENDING && flight.status !== client_1.FlightStatus.LOADING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcels to flight with status ${flight.status}. Flight must be PENDING or LOADING.`);
        }
        const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({
            status: client_1.Status.IN_TRANSIT,
            flight_id,
        });
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update parcel
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    flight_id,
                    status: client_1.Status.IN_TRANSIT, // Air cargo goes directly to IN_TRANSIT
                    status_details: statusDetails,
                },
            });
            // Create parcel event with flight reference
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.LOADED_TO_FLIGHT,
                    user_id,
                    status: client_1.Status.IN_TRANSIT,
                    flight_id,
                    status_details: statusDetails,
                    notes: `Added to flight ${flight.awb_number}`,
                },
            });
            // Update flight totals and status
            yield tx.flight.update({
                where: { id: flight_id },
                data: {
                    total_weight_kg: {
                        increment: parcel.weight,
                    },
                    total_pieces: {
                        increment: 1,
                    },
                    status: client_1.FlightStatus.LOADING,
                },
            });
            return updated;
        }));
        // Update order status based on parcel changes
        yield (0, order_status_calculator_1.updateOrderStatusFromParcel)(parcel.id);
        return updatedParcel;
    }),
    /**
     * Remove parcel from flight
     */
    removeParcel: (flight_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        if (parcel.flight_id !== flight_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel ${tracking_number} is not in flight ${flight_id}`);
        }
        const flight = yield prisma_client_1.default.flight.findUnique({ where: { id: flight_id } });
        if (!flight) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Flight with id ${flight_id} not found`);
        }
        // Only allow removal if flight is PENDING or LOADING
        if (flight.status !== client_1.FlightStatus.PENDING && flight.status !== client_1.FlightStatus.LOADING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot remove parcels from flight with status ${flight.status}. Flight must be PENDING or LOADING.`);
        }
        const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({ status: client_1.Status.IN_WAREHOUSE });
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update parcel
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    flight_id: null,
                    status: client_1.Status.IN_WAREHOUSE,
                    status_details: statusDetails,
                },
            });
            // Create parcel event with flight reference
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.REMOVED_FROM_FLIGHT,
                    user_id,
                    status: client_1.Status.IN_WAREHOUSE,
                    flight_id, // Keep reference to which flight it was removed from
                    status_details: statusDetails,
                    notes: `Removed from flight ${flight.awb_number}`,
                },
            });
            // Update flight totals
            yield tx.flight.update({
                where: { id: flight_id },
                data: {
                    total_weight_kg: {
                        decrement: parcel.weight,
                    },
                    total_pieces: {
                        decrement: 1,
                    },
                },
            });
            return updated;
        }));
        // Update order status based on parcel changes
        yield (0, order_status_calculator_1.updateOrderStatusFromParcel)(parcel.id);
        return updatedParcel;
    }),
    /**
     * Update flight status with event tracking
     */
    updateStatus: (id, status, user_id, location, description) => __awaiter(void 0, void 0, void 0, function* () {
        const flight = yield prisma_client_1.default.flight.findUnique({ where: { id } });
        if (!flight) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Flight with id ${id} not found`);
        }
        const updated = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update flight status
            const updatedFlight = yield tx.flight.update({
                where: { id },
                data: Object.assign(Object.assign({ status }, (status === client_1.FlightStatus.DEPARTED && { actual_departure: new Date() })), (status === client_1.FlightStatus.LANDED && { actual_arrival: new Date() })),
            });
            // Create event
            yield tx.flightEvent.create({
                data: {
                    flight_id: id,
                    status,
                    location,
                    description: description || `Status changed to ${status}`,
                    created_by_id: user_id,
                },
            });
            // Update parcels status based on flight status
            const parcels = yield tx.parcel.findMany({
                where: { flight_id: id },
                select: { id: true, order_id: true },
            });
            // Map flight status to parcel status
            const flightToParcelStatus = {
                [client_1.FlightStatus.DEPARTED]: client_1.Status.IN_TRANSIT,
                [client_1.FlightStatus.IN_TRANSIT]: client_1.Status.IN_TRANSIT,
                [client_1.FlightStatus.LANDED]: client_1.Status.AT_PORT_OF_ENTRY,
                [client_1.FlightStatus.CUSTOMS_HOLD]: client_1.Status.CUSTOMS_INSPECTION,
                [client_1.FlightStatus.CUSTOMS_CLEARED]: client_1.Status.RELEASED_FROM_CUSTOMS,
            };
            const newParcelStatus = flightToParcelStatus[status];
            if (newParcelStatus && parcels.length > 0) {
                const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({
                    status: newParcelStatus,
                    flight_id: id,
                });
                for (const parcel of parcels) {
                    yield tx.parcel.update({
                        where: { id: parcel.id },
                        data: { status: newParcelStatus, status_details: statusDetails },
                    });
                    yield tx.parcelEvent.create({
                        data: {
                            parcel_id: parcel.id,
                            event_type: (0, parcel_event_visibility_1.getEventTypeForFlightStatus)(status),
                            user_id,
                            status: newParcelStatus,
                            flight_id: id,
                            status_details: statusDetails,
                            notes: `Flight ${flight.awb_number} - ${status}${location ? ` at ${location}` : ""}`,
                        },
                    });
                }
            }
            // Collect unique order IDs to update
            const orderIds = [...new Set(parcels.map((p) => p.order_id).filter((id) => id !== null))];
            return { updatedFlight, orderIds };
        }));
        // Update order statuses based on parcel changes
        if (updated.orderIds.length > 0) {
            yield (0, order_status_calculator_1.updateMultipleOrdersStatus)(updated.orderIds);
        }
        return updated.updatedFlight;
    }),
    /**
     * Get flight events
     */
    getEvents: (flight_id) => __awaiter(void 0, void 0, void 0, function* () {
        const events = yield prisma_client_1.default.flightEvent.findMany({
            where: { flight_id },
            orderBy: { created_at: "desc" },
            include: {
                created_by: {
                    select: { id: true, name: true },
                },
            },
        });
        return events;
    }),
    /**
     * Get parcels ready to be added to flight (by forwarder)
     */
    getReadyParcels: (forwarder_id_1, ...args_1) => __awaiter(void 0, [forwarder_id_1, ...args_1], void 0, function* (forwarder_id, page = 1, limit = 20) {
        const where = {
            container_id: null,
            flight_id: null,
            status: {
                in: ALLOWED_FLIGHT_STATUSES,
            },
            agency: {
                forwarder_id,
            },
            // Only air service parcels
            service: {
                service_type: "AIR",
            },
        };
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { updated_at: "desc" },
                include: {
                    agency: {
                        select: { id: true, name: true },
                    },
                    service: {
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma_client_1.default.parcel.count({ where }),
        ]);
        return { parcels, total };
    }),
};
exports.default = flights;
