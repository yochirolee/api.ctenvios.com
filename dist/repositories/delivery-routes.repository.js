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
const order_status_calculator_1 = require("../utils/order-status-calculator");
/**
 * Delivery Routes Repository
 * Following: Repository pattern, TypeScript strict typing
 */
/**
 * Generate a unique route number
 */
const generateRouteNumber = (carrier_id) => __awaiter(void 0, void 0, void 0, function* () {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    // Count routes for this carrier today
    const startOfDay = new Date(year, date.getMonth(), date.getDate());
    const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);
    const count = yield prisma_client_1.default.deliveryRoute.count({
        where: {
            carrier_id,
            created_at: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });
    const sequence = String(count + 1).padStart(3, "0");
    return `RT-${carrier_id}-${year}${month}${day}-${sequence}`;
});
const deliveryRoutes = {
    /**
     * Get all routes with pagination
     */
    getAll: (page, limit, carrier_id, warehouse_id, messenger_id, status, scheduled_date) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {};
        if (carrier_id) {
            where.carrier_id = carrier_id;
        }
        if (warehouse_id) {
            where.warehouse_id = warehouse_id;
        }
        if (messenger_id) {
            where.messenger_id = messenger_id;
        }
        if (status) {
            where.status = status;
        }
        if (scheduled_date) {
            const startOfDay = new Date(scheduled_date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(scheduled_date);
            endOfDay.setHours(23, 59, 59, 999);
            where.scheduled_date = {
                gte: startOfDay,
                lte: endOfDay,
            };
        }
        const [routes, total] = yield Promise.all([
            prisma_client_1.default.deliveryRoute.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    carrier: {
                        select: { id: true, name: true },
                    },
                    warehouse: {
                        select: { id: true, name: true },
                    },
                    messenger: {
                        select: { id: true, name: true, phone: true },
                    },
                    province: {
                        select: { id: true, name: true },
                    },
                    created_by: {
                        select: { id: true, name: true },
                    },
                    _count: {
                        select: { assignments: true },
                    },
                },
                orderBy: [{ scheduled_date: "desc" }, { created_at: "desc" }],
            }),
            prisma_client_1.default.deliveryRoute.count({ where }),
        ]);
        return { routes, total };
    }),
    /**
     * Get route by ID with full details
     */
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const route = yield prisma_client_1.default.deliveryRoute.findUnique({
            where: { id },
            include: {
                carrier: {
                    select: { id: true, name: true },
                },
                warehouse: {
                    select: { id: true, name: true },
                },
                messenger: {
                    select: { id: true, name: true, phone: true },
                },
                province: {
                    select: { id: true, name: true },
                },
                created_by: {
                    select: { id: true, name: true },
                },
                assignments: {
                    include: {
                        parcel: {
                            include: {
                                order: {
                                    select: {
                                        id: true,
                                        receiver: {
                                            select: {
                                                first_name: true,
                                                last_name: true,
                                                address: true,
                                                mobile: true,
                                                city: { select: { name: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { created_at: "asc" },
                },
            },
        });
        return route;
    }),
    /**
     * Create a new route
     */
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        const route_number = yield generateRouteNumber(data.carrier_id);
        const route = yield prisma_client_1.default.deliveryRoute.create({
            data: {
                route_number,
                carrier_id: data.carrier_id,
                warehouse_id: data.warehouse_id,
                messenger_id: data.messenger_id,
                province_id: data.province_id,
                scheduled_date: data.scheduled_date,
                notes: data.notes,
                created_by_id: data.created_by_id,
            },
            include: {
                carrier: {
                    select: { id: true, name: true },
                },
                warehouse: {
                    select: { id: true, name: true },
                },
                messenger: {
                    select: { id: true, name: true, phone: true },
                },
                province: {
                    select: { id: true, name: true },
                },
            },
        });
        return route;
    }),
    /**
     * Update route
     */
    update: (id, data) => __awaiter(void 0, void 0, void 0, function* () {
        const route = yield prisma_client_1.default.deliveryRoute.findUnique({ where: { id } });
        if (!route) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Route with id ${id} not found`);
        }
        if (route.status !== client_1.RouteStatus.PLANNING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot update route with status ${route.status}. Route must be PLANNING.`);
        }
        const updated = yield prisma_client_1.default.deliveryRoute.update({
            where: { id },
            data,
            include: {
                carrier: {
                    select: { id: true, name: true },
                },
                warehouse: {
                    select: { id: true, name: true },
                },
                messenger: {
                    select: { id: true, name: true, phone: true },
                },
                province: {
                    select: { id: true, name: true },
                },
            },
        });
        return updated;
    }),
    /**
     * Delete route (only if PLANNING and empty)
     */
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const route = yield prisma_client_1.default.deliveryRoute.findUnique({
            where: { id },
            include: { _count: { select: { assignments: true } } },
        });
        if (!route) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Route with id ${id} not found`);
        }
        if (route._count.assignments > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete route with assignments. Remove all assignments first.");
        }
        if (route.status !== client_1.RouteStatus.PLANNING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete route with status ${route.status}. Only PLANNING routes can be deleted.`);
        }
        const deleted = yield prisma_client_1.default.deliveryRoute.delete({ where: { id } });
        return deleted;
    }),
    /**
     * Add parcel to route
     */
    addParcelToRoute: (route_id, parcel_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const route = yield prisma_client_1.default.deliveryRoute.findUnique({ where: { id: route_id } });
        if (!route) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Route with id ${route_id} not found`);
        }
        if (route.status !== client_1.RouteStatus.PLANNING && route.status !== client_1.RouteStatus.READY) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcels to route with status ${route.status}. Route must be PLANNING or READY.`);
        }
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { id: parcel_id },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with id ${parcel_id} not found`);
        }
        // Check if parcel is already assigned
        const existingAssignment = yield prisma_client_1.default.deliveryAssignment.findUnique({
            where: { parcel_id },
        });
        if (existingAssignment) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel is already assigned to a delivery`);
        }
        // Parcel should be released from customs or in warehouse
        const allowedStatuses = [client_1.Status.RELEASED_FROM_CUSTOMS, client_1.Status.IN_WAREHOUSE];
        if (!allowedStatuses.includes(parcel.status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel with status ${parcel.status} cannot be assigned for delivery. Must be RELEASED_FROM_CUSTOMS or IN_WAREHOUSE.`);
        }
        const assignment = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const created = yield tx.deliveryAssignment.create({
                data: {
                    parcel_id,
                    route_id,
                },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id,
                    event_type: client_1.ParcelEventType.ASSIGNED_TO_ROUTE,
                    user_id,
                    status: parcel.status,
                    notes: `Assigned to route ${route.route_number}`,
                },
            });
            return created;
        }));
        return assignment;
    }),
    /**
     * Remove parcel from route
     */
    removeParcelFromRoute: (route_id, parcel_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const route = yield prisma_client_1.default.deliveryRoute.findUnique({ where: { id: route_id } });
        if (!route) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Route with id ${route_id} not found`);
        }
        if (route.status !== client_1.RouteStatus.PLANNING && route.status !== client_1.RouteStatus.READY) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot remove parcels from route with status ${route.status}. Route must be PLANNING or READY.`);
        }
        const assignment = yield prisma_client_1.default.deliveryAssignment.findFirst({
            where: { parcel_id, route_id },
        });
        if (!assignment) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel is not in this route`);
        }
        yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.deliveryAssignment.delete({
                where: { id: assignment.id },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id,
                    event_type: client_1.ParcelEventType.NOTE_ADDED,
                    user_id,
                    status: client_1.Status.IN_WAREHOUSE,
                    notes: `Removed from route ${route.route_number}`,
                },
            });
        }));
    }),
    /**
     * Assign parcel directly to messenger (without route)
     */
    assignToMessenger: (parcel_id, messenger_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { id: parcel_id },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with id ${parcel_id} not found`);
        }
        // Check if parcel is already assigned
        const existingAssignment = yield prisma_client_1.default.deliveryAssignment.findUnique({
            where: { parcel_id },
        });
        if (existingAssignment) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel is already assigned to a delivery`);
        }
        // Parcel should be released from customs or in warehouse
        const allowedStatuses = [client_1.Status.RELEASED_FROM_CUSTOMS, client_1.Status.IN_WAREHOUSE];
        if (!allowedStatuses.includes(parcel.status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel with status ${parcel.status} cannot be assigned for delivery.`);
        }
        const messenger = yield prisma_client_1.default.user.findUnique({
            where: { id: messenger_id },
            select: { id: true, name: true },
        });
        if (!messenger) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Messenger with id ${messenger_id} not found`);
        }
        const assignment = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const created = yield tx.deliveryAssignment.create({
                data: {
                    parcel_id,
                    messenger_id,
                },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id,
                    event_type: client_1.ParcelEventType.ASSIGNED_TO_MESSENGER,
                    user_id,
                    status: parcel.status,
                    notes: `Assigned to messenger ${messenger.name}`,
                },
            });
            return created;
        }));
        return assignment;
    }),
    /**
     * Start route (mark as in progress)
     */
    startRoute: (id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const route = yield prisma_client_1.default.deliveryRoute.findUnique({
            where: { id },
            include: { _count: { select: { assignments: true } } },
        });
        if (!route) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Route with id ${id} not found`);
        }
        if (route.status !== client_1.RouteStatus.READY) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot start route with status ${route.status}. Route must be READY.`);
        }
        if (route._count.assignments === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot start route with no assignments");
        }
        const updated = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield tx.deliveryRoute.update({
                where: { id },
                data: {
                    status: client_1.RouteStatus.IN_PROGRESS,
                    started_at: new Date(),
                },
            });
            // Update all assignments to OUT_FOR_DELIVERY
            const assignments = yield tx.deliveryAssignment.findMany({
                where: { route_id: id },
                include: { parcel: { select: { order_id: true } } },
            });
            for (const assignment of assignments) {
                yield tx.deliveryAssignment.update({
                    where: { id: assignment.id },
                    data: { status: client_1.DeliveryStatus.OUT_FOR_DELIVERY },
                });
                yield tx.parcel.update({
                    where: { id: assignment.parcel_id },
                    data: { status: client_1.Status.OUT_FOR_DELIVERY },
                });
                yield tx.parcelEvent.create({
                    data: {
                        parcel_id: assignment.parcel_id,
                        event_type: client_1.ParcelEventType.OUT_FOR_DELIVERY,
                        user_id,
                        status: client_1.Status.OUT_FOR_DELIVERY,
                        notes: `Route ${route.route_number} started`,
                    },
                });
            }
            // Collect unique order IDs
            const orderIds = [...new Set(assignments
                    .map((a) => a.parcel.order_id)
                    .filter((id) => id !== null))];
            return { result, orderIds };
        }));
        // Update order statuses
        if (updated.orderIds.length > 0) {
            yield (0, order_status_calculator_1.updateMultipleOrdersStatus)(updated.orderIds);
        }
        return updated.result;
    }),
    /**
     * Mark route as ready
     */
    markAsReady: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const route = yield prisma_client_1.default.deliveryRoute.findUnique({
            where: { id },
            include: { _count: { select: { assignments: true } } },
        });
        if (!route) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Route with id ${id} not found`);
        }
        if (route.status !== client_1.RouteStatus.PLANNING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot mark route as ready with status ${route.status}. Route must be PLANNING.`);
        }
        if (route._count.assignments === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot mark route as ready with no assignments");
        }
        const updated = yield prisma_client_1.default.deliveryRoute.update({
            where: { id },
            data: { status: client_1.RouteStatus.READY },
        });
        return updated;
    }),
    /**
     * Record delivery attempt
     */
    recordDeliveryAttempt: (assignment_id, user_id, success, data) => __awaiter(void 0, void 0, void 0, function* () {
        const assignment = yield prisma_client_1.default.deliveryAssignment.findUnique({
            where: { id: assignment_id },
            include: { route: true, parcel: { select: { order_id: true } } },
        });
        if (!assignment) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Assignment with id ${assignment_id} not found`);
        }
        if (assignment.status === client_1.DeliveryStatus.DELIVERED) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Parcel is already delivered");
        }
        const orderId = assignment.parcel.order_id;
        const updated = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const newStatus = success ? client_1.DeliveryStatus.DELIVERED : client_1.DeliveryStatus.FAILED;
            const parcelStatus = success ? client_1.Status.DELIVERED : client_1.Status.FAILED_DELIVERY;
            const result = yield tx.deliveryAssignment.update({
                where: { id: assignment_id },
                data: {
                    status: newStatus,
                    attempts: { increment: 1 },
                    last_attempt_at: new Date(),
                    delivered_at: success ? new Date() : undefined,
                    recipient_name: data.recipient_name,
                    recipient_ci: data.recipient_ci,
                    signature: data.signature,
                    photo_proof: data.photo_proof,
                    notes: data.notes,
                },
            });
            yield tx.parcel.update({
                where: { id: assignment.parcel_id },
                data: { status: parcelStatus },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: assignment.parcel_id,
                    event_type: success ? client_1.ParcelEventType.DELIVERED : client_1.ParcelEventType.DELIVERY_FAILED,
                    user_id,
                    status: parcelStatus,
                    notes: data.notes || (success ? "Delivered successfully" : "Delivery failed"),
                },
            });
            // Check if all assignments in route are completed
            if (assignment.route_id) {
                const pendingCount = yield tx.deliveryAssignment.count({
                    where: {
                        route_id: assignment.route_id,
                        status: { in: [client_1.DeliveryStatus.PENDING, client_1.DeliveryStatus.OUT_FOR_DELIVERY] },
                    },
                });
                if (pendingCount === 0) {
                    yield tx.deliveryRoute.update({
                        where: { id: assignment.route_id },
                        data: {
                            status: client_1.RouteStatus.COMPLETED,
                            completed_at: new Date(),
                        },
                    });
                }
            }
            return result;
        }));
        // Update order status based on parcel changes
        if (orderId) {
            yield (0, order_status_calculator_1.updateOrderStatusFromParcels)(orderId);
        }
        return updated;
    }),
    /**
     * Reschedule failed delivery
     */
    rescheduleDelivery: (assignment_id, user_id, notes) => __awaiter(void 0, void 0, void 0, function* () {
        const assignment = yield prisma_client_1.default.deliveryAssignment.findUnique({
            where: { id: assignment_id },
        });
        if (!assignment) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Assignment with id ${assignment_id} not found`);
        }
        if (assignment.status !== client_1.DeliveryStatus.FAILED) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot reschedule assignment with status ${assignment.status}. Must be FAILED.`);
        }
        const updated = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield tx.deliveryAssignment.update({
                where: { id: assignment_id },
                data: {
                    status: client_1.DeliveryStatus.RESCHEDULED,
                    notes: notes || assignment.notes,
                },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: assignment.parcel_id,
                    event_type: client_1.ParcelEventType.DELIVERY_RESCHEDULED,
                    user_id,
                    status: client_1.Status.OUT_FOR_DELIVERY,
                    notes: notes || "Delivery rescheduled",
                },
            });
            return result;
        }));
        return updated;
    }),
    /**
     * Get assignments for a messenger
     */
    getMessengerAssignments: (messenger_id, status) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {
            OR: [{ messenger_id }, { route: { messenger_id } }],
        };
        if (status) {
            where.status = status;
        }
        const assignments = yield prisma_client_1.default.deliveryAssignment.findMany({
            where,
            include: {
                parcel: {
                    include: {
                        order: {
                            select: {
                                id: true,
                                receiver: {
                                    select: {
                                        first_name: true,
                                        last_name: true,
                                        address: true,
                                        mobile: true,
                                        phone: true,
                                        city: { select: { name: true } },
                                        province: { select: { name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
                route: {
                    select: { id: true, route_number: true, status: true },
                },
            },
            orderBy: { created_at: "desc" },
        });
        return assignments;
    }),
    /**
     * Get parcels ready for delivery (by warehouse)
     */
    getParcelsReadyForDelivery: (warehouse_id_1, ...args_1) => __awaiter(void 0, [warehouse_id_1, ...args_1], void 0, function* (warehouse_id, page = 1, limit = 20) {
        const where = {
            current_warehouse_id: warehouse_id,
            status: { in: [client_1.Status.RELEASED_FROM_CUSTOMS, client_1.Status.IN_WAREHOUSE] },
            delivery_assignment: null, // Not yet assigned
        };
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { created_at: "asc" },
                include: {
                    order: {
                        select: {
                            id: true,
                            receiver: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    address: true,
                                    mobile: true,
                                    city: { select: { name: true } },
                                    province: { select: { name: true } },
                                },
                            },
                        },
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
exports.default = deliveryRoutes;
