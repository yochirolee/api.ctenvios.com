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
const app_errors_1 = require("../common/app-errors");
const parcel_event_visibility_1 = require("../utils/parcel-event-visibility");
const tracking = {
    /**
     * Get public tracking (for customers - only public events)
     */
    getPublicTracking: (tracking_number) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
            include: {
                current_location: {
                    select: { name: true },
                },
                order: {
                    select: {
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
                events: {
                    orderBy: { created_at: "desc" },
                    include: {
                        location: { select: { name: true } },
                    },
                },
                container: {
                    select: { estimated_arrival: true },
                },
                flight: {
                    select: { estimated_arrival: true },
                },
            },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        // Filter only public events
        const publicEvents = (0, parcel_event_visibility_1.filterPublicEvents)(parcel.events);
        // Map events to public format with friendly messages
        const timeline = publicEvents.map((event) => {
            var _a;
            return ({
                timestamp: event.created_at,
                status: (0, parcel_event_visibility_1.getPublicMessage)(event.event_type),
                location: (_a = event.location) === null || _a === void 0 ? void 0 : _a.name,
            });
        });
        // Get current status message
        const currentStatusEvent = publicEvents[0];
        const currentStatusMessage = currentStatusEvent
            ? (0, parcel_event_visibility_1.getPublicMessage)(currentStatusEvent.event_type)
            : "En proceso";
        return {
            parcel: {
                tracking_number: parcel.tracking_number,
                description: parcel.description,
                weight: Number(parcel.weight),
                current_status: currentStatusMessage,
                current_location: ((_a = parcel.current_location) === null || _a === void 0 ? void 0 : _a.name) || null,
            },
            receiver: {
                name: parcel.order
                    ? `${parcel.order.receiver.first_name} ${parcel.order.receiver.last_name}`
                    : "N/A",
                province: ((_b = parcel.order) === null || _b === void 0 ? void 0 : _b.receiver.province.name) || "N/A",
                city: ((_c = parcel.order) === null || _c === void 0 ? void 0 : _c.receiver.city.name) || "N/A",
            },
            timeline,
            estimated_delivery: ((_d = parcel.container) === null || _d === void 0 ? void 0 : _d.estimated_arrival) || ((_e = parcel.flight) === null || _e === void 0 ? void 0 : _e.estimated_arrival) || null,
        };
    }),
    /**
     * Get full internal tracking (for staff - all events)
     */
    getInternalTracking: (tracking_number) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
            include: {
                service: {
                    select: { name: true, service_type: true },
                },
                current_location: {
                    select: { name: true },
                },
                current_warehouse: {
                    select: { id: true, name: true },
                },
                order: {
                    select: {
                        id: true,
                        customer: {
                            select: {
                                first_name: true,
                                last_name: true,
                                mobile: true,
                            },
                        },
                        receiver: {
                            select: {
                                first_name: true,
                                last_name: true,
                                address: true,
                                ci: true,
                                mobile: true,
                                phone: true,
                                province: { select: { name: true } },
                                city: { select: { name: true } },
                            },
                        },
                    },
                },
                pallet: {
                    select: { pallet_number: true },
                },
                container: {
                    select: {
                        id: true,
                        container_number: true,
                        status: true,
                        estimated_arrival: true,
                    },
                },
                flight: {
                    select: {
                        id: true,
                        awb_number: true,
                        status: true,
                        estimated_arrival: true,
                    },
                },
                delivery_assignment: {
                    include: {
                        messenger: {
                            select: { id: true, name: true, phone: true },
                        },
                        route: {
                            select: { route_number: true, status: true },
                        },
                    },
                },
                events: {
                    orderBy: { created_at: "desc" },
                    include: {
                        user: { select: { id: true, name: true } },
                        location: { select: { name: true } },
                        pallet: { select: { pallet_number: true } },
                        dispatch: { select: { id: true } },
                        container: { select: { container_number: true } },
                        flight: { select: { awb_number: true } },
                        warehouse: { select: { name: true } },
                    },
                },
            },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        // Map all events to internal format
        const timeline = parcel.events.map((event) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                timestamp: event.created_at,
                event_type: event.event_type,
                status: event.status,
                description: event.description,
                location: ((_a = event.location) === null || _a === void 0 ? void 0 : _a.name) || null,
                actor: {
                    id: event.user.id,
                    name: event.user.name,
                },
                references: {
                    pallet_number: (_b = event.pallet) === null || _b === void 0 ? void 0 : _b.pallet_number,
                    dispatch_id: (_c = event.dispatch) === null || _c === void 0 ? void 0 : _c.id,
                    container_number: (_d = event.container) === null || _d === void 0 ? void 0 : _d.container_number,
                    flight_awb: (_e = event.flight) === null || _e === void 0 ? void 0 : _e.awb_number,
                    warehouse_name: (_f = event.warehouse) === null || _f === void 0 ? void 0 : _f.name,
                },
                notes: event.notes,
            });
        });
        // Determine transport info
        let transport = null;
        if (parcel.container) {
            transport = {
                type: "CONTAINER",
                reference: parcel.container.container_number,
                status: parcel.container.status,
            };
        }
        else if (parcel.flight) {
            transport = {
                type: "FLIGHT",
                reference: parcel.flight.awb_number,
                status: parcel.flight.status,
            };
        }
        // Get delivery info
        let delivery_info = null;
        if (parcel.delivery_assignment) {
            const assignment = parcel.delivery_assignment;
            delivery_info = {
                messenger: assignment.messenger
                    ? { name: assignment.messenger.name, phone: assignment.messenger.phone }
                    : null,
                route_number: ((_a = assignment.route) === null || _a === void 0 ? void 0 : _a.route_number) || null,
                status: assignment.status,
                attempts: assignment.attempts,
                last_attempt: assignment.last_attempt_at,
            };
        }
        return {
            parcel: {
                id: parcel.id,
                tracking_number: parcel.tracking_number,
                description: parcel.description,
                weight: Number(parcel.weight),
                current_status: parcel.status,
                current_location: ((_b = parcel.current_location) === null || _b === void 0 ? void 0 : _b.name) || ((_c = parcel.current_warehouse) === null || _c === void 0 ? void 0 : _c.name) || null,
                service_type: ((_d = parcel.service) === null || _d === void 0 ? void 0 : _d.service_type) || null,
            },
            order: parcel.order
                ? {
                    id: parcel.order.id,
                    customer: {
                        name: `${parcel.order.customer.first_name} ${parcel.order.customer.last_name}`,
                        phone: parcel.order.customer.mobile,
                    },
                    receiver: {
                        name: `${parcel.order.receiver.first_name} ${parcel.order.receiver.last_name}`,
                        address: parcel.order.receiver.address,
                        province: parcel.order.receiver.province.name,
                        city: parcel.order.receiver.city.name,
                        ci: parcel.order.receiver.ci,
                        mobile: parcel.order.receiver.mobile,
                        phone: parcel.order.receiver.phone,
                    },
                }
                : null,
            timeline,
            transport,
            delivery_info,
        };
    }),
    /**
     * Search parcels by tracking number (partial match)
     */
    searchByTrackingNumber: (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, page = 1, limit = 20) {
        const where = {
            tracking_number: {
                contains: query,
                mode: "insensitive",
            },
        };
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { created_at: "desc" },
                select: {
                    id: true,
                    tracking_number: true,
                    description: true,
                    weight: true,
                    status: true,
                    created_at: true,
                    order: {
                        select: {
                            id: true,
                            receiver: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    province: { select: { name: true } },
                                },
                            },
                        },
                    },
                    service: {
                        select: { name: true, service_type: true },
                    },
                },
            }),
            prisma_client_1.default.parcel.count({ where }),
        ]);
        return { parcels, total };
    }),
    /**
     * Get parcel location history (for map visualization)
     */
    getLocationHistory: (tracking_number) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        const events = yield prisma_client_1.default.parcelEvent.findMany({
            where: { parcel_id: parcel.id },
            orderBy: { created_at: "asc" },
            select: {
                created_at: true,
                event_type: true,
                status: true,
                location: {
                    select: { id: true, name: true },
                },
                warehouse: {
                    select: {
                        id: true,
                        name: true,
                        province: { select: { name: true } },
                    },
                },
                container: {
                    select: { origin_port: true, destination_port: true },
                },
                flight: {
                    select: { origin_airport: true, destination_airport: true },
                },
            },
        });
        return events;
    }),
    /**
     * Get last scan info (who and when)
     */
    getLastScanInfo: (tracking_number) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        const lastEvent = yield prisma_client_1.default.parcelEvent.findFirst({
            where: { parcel_id: parcel.id },
            orderBy: { created_at: "desc" },
            select: {
                created_at: true,
                event_type: true,
                user: {
                    select: { id: true, name: true },
                },
            },
        });
        if (!lastEvent) {
            return null;
        }
        return {
            timestamp: lastEvent.created_at,
            user: lastEvent.user,
            event_type: lastEvent.event_type,
        };
    }),
};
exports.default = tracking;
