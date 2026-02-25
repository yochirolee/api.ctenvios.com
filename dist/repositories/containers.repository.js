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
// Allowed statuses for parcels to be added to container
const ALLOWED_CONTAINER_STATUSES = [
    client_1.Status.IN_AGENCY,
    client_1.Status.IN_PALLET,
    client_1.Status.IN_DISPATCH,
    client_1.Status.RECEIVED_IN_DISPATCH,
    client_1.Status.IN_WAREHOUSE,
];
/**
 * Validates if a parcel status allows it to be added to container
 */
const isValidStatusForContainer = (status) => {
    return ALLOWED_CONTAINER_STATUSES.includes(status);
};
const containers = {
    /**
     * Get minimal parcel info needed for container attach validation
     */
    getParcelAttachInfo: (tracking_number) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
            select: {
                id: true,
                status: true,
                weight: true,
                deleted_at: true,
                container_id: true,
                flight_id: true,
                service: {
                    select: {
                        service_type: true,
                        name: true,
                    },
                },
            },
        });
        if (!parcel) {
            return null;
        }
        return {
            id: parcel.id,
            status: parcel.status,
            weight: parcel.weight,
            deleted_at: parcel.deleted_at,
            container_id: parcel.container_id,
            flight_id: parcel.flight_id,
            service: parcel.service
                ? { service_type: parcel.service.service_type, service_name: parcel.service.name }
                : null,
        };
    }),
    /**
     * Get minimal container info needed for parcel attach validation
     */
    getContainerAttachInfo: (container_id) => __awaiter(void 0, void 0, void 0, function* () {
        return prisma_client_1.default.container.findUnique({
            where: { id: container_id },
            select: {
                id: true,
                status: true,
                container_number: true,
            },
        });
    }),
    /**
     * Get all containers with pagination
     */
    getAll: (page, limit, forwarder_id, status) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {};
        if (forwarder_id) {
            where.forwarder_id = forwarder_id;
        }
        if (status) {
            where.status = status;
        }
        const [containers, total] = yield Promise.all([
            prisma_client_1.default.container.findMany({
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
            prisma_client_1.default.container.count({ where }),
        ]);
        return { containers, total };
    }),
    /**
     * Get container by ID with full details
     */
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.container.findUnique({
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
        return container;
    }),
    /**
     * Get container by container number
     */
    getByContainerNumber: (container_number) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.container.findUnique({
            where: { container_number },
            include: {
                forwarder: {
                    select: { id: true, name: true },
                },
                provider: {
                    select: { id: true, name: true },
                },
            },
        });
        return container;
    }),
    /**
     * Create a new container
     */
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const created = yield tx.container.create({
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
            yield tx.containerEvent.create({
                data: {
                    container_id: created.id,
                    status: created.status,
                    description: "Container created",
                    created_by_id: data.created_by_id,
                },
            });
            return created;
        }));
        return container;
    }),
    /**
     * Update container
     */
    update: (id, data, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const current = yield tx.container.findUnique({ where: { id } });
            if (!current) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${id} not found`);
            }
            const updated = yield tx.container.update({
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
                yield tx.containerEvent.create({
                    data: {
                        container_id: id,
                        status: data.status,
                        description: `Status changed from ${current.status} to ${data.status}`,
                        created_by_id: user_id,
                    },
                });
            }
            return updated;
        }));
        return container;
    }),
    /**
     * Delete container (only if empty and PENDING)
     */
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.container.findUnique({
            where: { id },
            include: { _count: { select: { parcels: true } } },
        });
        if (!container) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${id} not found`);
        }
        if (container._count.parcels > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete container with parcels. Remove all parcels first.");
        }
        if (container.status !== client_1.ContainerStatus.PENDING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete container with status ${container.status}. Only PENDING containers can be deleted.`);
        }
        const deleted = yield prisma_client_1.default.container.delete({ where: { id } });
        return deleted;
    }),
    /**
     * Get parcels in container with pagination
     */
    getParcels: (container_id_1, ...args_1) => __awaiter(void 0, [container_id_1, ...args_1], void 0, function* (container_id, page = 1, limit = 20) {
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                include: {
                    agency: { select: { id: true, name: true } },
                },
                where: { container_id },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { updated_at: "desc" },
            }),
            prisma_client_1.default.parcel.count({ where: { container_id } }),
        ]);
        return { parcels, total };
    }),
    /**
     * Add parcel to container
     */
    addParcel: (container_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const parcel = yield tx.parcel.findUnique({
                where: { tracking_number },
                select: {
                    id: true,
                    status: true,
                    weight: true,
                    container_id: true,
                    flight_id: true,
                },
            });
            if (!parcel) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
            }
            if (parcel.container_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel ${tracking_number} is already in container ${parcel.container_id}`);
            }
            if (parcel.flight_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel ${tracking_number} is already in flight ${parcel.flight_id}`);
            }
            const container = yield tx.container.findUnique({
                where: { id: container_id },
                select: { id: true, status: true, container_number: true, container_name: true },
            });
            const containerName = (_a = container === null || container === void 0 ? void 0 : container.container_name) !== null && _a !== void 0 ? _a : null;
            if (!container) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${container_id} not found`);
            }
            if (container.status !== client_1.ContainerStatus.PENDING && container.status !== client_1.ContainerStatus.LOADING) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`);
            }
            const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({
                status: client_1.Status.IN_CONTAINER,
                container_id,
                container_name: containerName,
            });
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    container_id,
                    status: client_1.Status.IN_CONTAINER,
                    status_details: statusDetails,
                },
            });
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.LOADED_TO_CONTAINER,
                    user_id,
                    status: client_1.Status.IN_CONTAINER,
                    container_id,
                    status_details: statusDetails,
                    notes: `Added to container ${container.container_number}`,
                },
            });
            yield tx.container.update({
                where: { id: container_id },
                data: {
                    current_weight_kg: {
                        increment: parcel.weight,
                    },
                    status: client_1.ContainerStatus.LOADING,
                },
            });
            yield (0, order_status_calculator_1.updateOrderStatusFromParcelTx)(tx, parcel.id);
            return updated;
        }));
        return updatedParcel;
    }),
    /**
     * Add all parcels from an order to container
     */
    addParcelsByOrderId: (container_id, order_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.container.findUnique({ where: { id: container_id } });
        if (!container) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${container_id} not found`);
        }
        if (container.status !== client_1.ContainerStatus.PENDING && container.status !== client_1.ContainerStatus.LOADING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`);
        }
        // Find all parcels for this order with service info
        const parcels = yield prisma_client_1.default.parcel.findMany({
            where: { order_id },
            include: {
                service: { select: { service_type: true, name: true } },
            },
        });
        if (parcels.length === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `No parcels found for order ${order_id}`);
        }
        let added = 0;
        let skipped = 0;
        let totalWeight = 0;
        const addedParcels = [];
        yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            for (const parcel of parcels) {
                // Skip if already in a container or flight
                if (parcel.container_id || parcel.flight_id) {
                    skipped++;
                    continue;
                }
                // Skip if service type is not MARITIME (only maritime parcels go in containers)
                if (((_a = parcel.service) === null || _a === void 0 ? void 0 : _a.service_type) !== "MARITIME") {
                    skipped++;
                    continue;
                }
                // Skip if status doesn't allow adding to container
                if (!isValidStatusForContainer(parcel.status)) {
                    skipped++;
                    continue;
                }
                const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({
                    status: client_1.Status.IN_CONTAINER,
                    container_id,
                    container_name: container.container_name,
                });
                // Update parcel
                const updated = yield tx.parcel.update({
                    where: { id: parcel.id },
                    data: {
                        container_id,
                        status: client_1.Status.IN_CONTAINER,
                        status_details: statusDetails,
                    },
                });
                // Create parcel event
                yield tx.parcelEvent.create({
                    data: {
                        parcel_id: parcel.id,
                        event_type: client_1.ParcelEventType.LOADED_TO_CONTAINER,
                        user_id,
                        status: client_1.Status.IN_CONTAINER,
                        container_id,
                        status_details: statusDetails,
                        notes: `Added to container ${container.container_number} (batch from order #${order_id})`,
                    },
                });
                totalWeight += Number(parcel.weight);
                addedParcels.push(updated);
                added++;
            }
            // Update container weight and status
            if (added > 0) {
                yield tx.container.update({
                    where: { id: container_id },
                    data: {
                        current_weight_kg: {
                            increment: totalWeight,
                        },
                        status: client_1.ContainerStatus.LOADING,
                    },
                });
                yield (0, order_status_calculator_1.updateOrderStatusFromParcelsTx)(tx, order_id);
            }
        }));
        return { added, skipped, parcels: addedParcels };
    }),
    /**
     * Add all parcels from a dispatch to container
     */
    addParcelsByDispatchId: (container_id, dispatch_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.container.findUnique({ where: { id: container_id } });
        if (!container) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${container_id} not found`);
        }
        if (container.status !== client_1.ContainerStatus.PENDING && container.status !== client_1.ContainerStatus.LOADING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`);
        }
        // Find the dispatch with its parcels
        const dispatch = yield prisma_client_1.default.dispatch.findUnique({
            where: { id: dispatch_id },
            include: {
                parcels: {
                    include: {
                        service: { select: { service_type: true, name: true } },
                    },
                },
            },
        });
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Dispatch with id ${dispatch_id} not found`);
        }
        if (dispatch.parcels.length === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `No parcels found in dispatch ${dispatch_id}`);
        }
        let added = 0;
        let skipped = 0;
        let totalWeight = 0;
        const addedParcels = [];
        const affectedOrderIds = new Set();
        yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            for (const parcel of dispatch.parcels) {
                // Skip if already in a container or flight
                if (parcel.container_id || parcel.flight_id) {
                    skipped++;
                    continue;
                }
                // Skip if service type is not MARITIME (only maritime parcels go in containers)
                if (((_a = parcel.service) === null || _a === void 0 ? void 0 : _a.service_type) !== "MARITIME") {
                    skipped++;
                    continue;
                }
                // Skip if status doesn't allow adding to container
                if (!isValidStatusForContainer(parcel.status)) {
                    skipped++;
                    continue;
                }
                const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({
                    status: client_1.Status.IN_CONTAINER,
                    container_id,
                    container_name: container.container_name,
                });
                // Update parcel
                const updated = yield tx.parcel.update({
                    where: { id: parcel.id },
                    data: {
                        container_id,
                        status: client_1.Status.IN_CONTAINER,
                        status_details: statusDetails,
                    },
                });
                // Create parcel event
                yield tx.parcelEvent.create({
                    data: {
                        parcel_id: parcel.id,
                        event_type: client_1.ParcelEventType.LOADED_TO_CONTAINER,
                        user_id,
                        status: client_1.Status.IN_CONTAINER,
                        container_id,
                        status_details: statusDetails,
                        notes: `Added to container ${container.container_number} (batch from dispatch #${dispatch_id})`,
                    },
                });
                totalWeight += Number(parcel.weight);
                addedParcels.push(updated);
                added++;
                // Track affected orders for status update
                if (parcel.order_id) {
                    affectedOrderIds.add(parcel.order_id);
                }
            }
            // Update container weight and status
            if (added > 0) {
                yield tx.container.update({
                    where: { id: container_id },
                    data: {
                        current_weight_kg: {
                            increment: totalWeight,
                        },
                        status: client_1.ContainerStatus.LOADING,
                    },
                });
            }
            if (affectedOrderIds.size > 0) {
                yield (0, order_status_calculator_1.updateMultipleOrdersStatusTx)(tx, [...affectedOrderIds]);
            }
        }));
        return { added, skipped, parcels: addedParcels };
    }),
    /**
     * Remove parcel from container
     */
    removeParcel: (container_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        if (parcel.container_id !== container_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel ${tracking_number} is not in container ${container_id}`);
        }
        const container = yield prisma_client_1.default.container.findUnique({ where: { id: container_id } });
        if (!container) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${container_id} not found`);
        }
        // Only allow removal if container is PENDING or LOADING
        if (container.status !== client_1.ContainerStatus.PENDING && container.status !== client_1.ContainerStatus.LOADING) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot remove parcels from container with status ${container.status}. Container must be PENDING or LOADING.`);
        }
        const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({ status: client_1.Status.IN_WAREHOUSE });
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update parcel
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    container_id: null,
                    status: client_1.Status.IN_WAREHOUSE,
                    status_details: statusDetails,
                },
            });
            // Create parcel event with container reference
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.REMOVED_FROM_CONTAINER,
                    user_id,
                    status: client_1.Status.IN_WAREHOUSE,
                    status_details: statusDetails,
                    container_id, // Keep reference to which container it was removed from
                    notes: `Removed from container ${container.container_number}`,
                },
            });
            // Update container weight
            yield tx.container.update({
                where: { id: container_id },
                data: {
                    current_weight_kg: {
                        decrement: parcel.weight,
                    },
                },
            });
            yield (0, order_status_calculator_1.updateOrderStatusFromParcelTx)(tx, parcel.id);
            return updated;
        }));
        return updatedParcel;
    }),
    /**
     * Update container status with event tracking
     */
    updateStatus: (id, status, user_id, location, description, seal_number, booking_number, cat_number) => __awaiter(void 0, void 0, void 0, function* () {
        const container = yield prisma_client_1.default.container.findUnique({ where: { id } });
        if (!container) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Container with id ${id} not found`);
        }
        const updated = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update container status
            const updatedContainer = yield tx.container.update({
                where: { id },
                data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ status }, (status === client_1.ContainerStatus.DEPARTED && { actual_departure: new Date() })), (status === client_1.ContainerStatus.AT_PORT && { actual_arrival: new Date() })), (seal_number && { seal_number })), (booking_number && { booking_number })), (cat_number && { cat_number })),
            });
            // Create event
            yield tx.containerEvent.create({
                data: {
                    container_id: id,
                    status,
                    location,
                    description: description || `Status changed to ${status}`,
                    created_by_id: user_id,
                },
            });
            // Update parcels status based on container status
            const parcels = yield tx.parcel.findMany({
                where: { container_id: id },
                select: { id: true, order_id: true },
            });
            // Map container status to parcel status
            const containerToParcelStatus = {
                [client_1.ContainerStatus.DEPARTED]: client_1.Status.IN_TRANSIT,
                [client_1.ContainerStatus.IN_TRANSIT]: client_1.Status.IN_TRANSIT,
                [client_1.ContainerStatus.AT_PORT]: client_1.Status.AT_PORT_OF_ENTRY,
                [client_1.ContainerStatus.CUSTOMS_HOLD]: client_1.Status.CUSTOMS_INSPECTION,
                [client_1.ContainerStatus.CUSTOMS_CLEARED]: client_1.Status.RELEASED_FROM_CUSTOMS,
                [client_1.ContainerStatus.UNLOADING]: client_1.Status.RELEASED_FROM_CUSTOMS,
            };
            const newParcelStatus = containerToParcelStatus[status];
            if (newParcelStatus && parcels.length > 0) {
                const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({
                    status: newParcelStatus,
                    container_id: id,
                    container_name: container.container_name,
                });
                for (const parcel of parcels) {
                    yield tx.parcel.update({
                        where: { id: parcel.id },
                        data: { status: newParcelStatus, status_details: statusDetails },
                    });
                    yield tx.parcelEvent.create({
                        data: {
                            parcel_id: parcel.id,
                            event_type: (0, parcel_event_visibility_1.getEventTypeForContainerStatus)(status),
                            user_id,
                            status: newParcelStatus,
                            container_id: id,
                            status_details: statusDetails,
                            notes: `Container ${container.container_number} - ${status}${location ? ` at ${location}` : ""}`,
                        },
                    });
                }
            }
            // Collect unique order IDs to update
            const orderIds = [...new Set(parcels.map((p) => p.order_id).filter((id) => id !== null))];
            if (orderIds.length > 0) {
                yield (0, order_status_calculator_1.updateMultipleOrdersStatusTx)(tx, orderIds);
            }
            return updatedContainer;
        }));
        return updated;
    }),
    /**
     * Get container events
     */
    getEvents: (container_id) => __awaiter(void 0, void 0, void 0, function* () {
        const events = yield prisma_client_1.default.containerEvent.findMany({
            where: { container_id },
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
     * Get parcels ready to be added to container (by forwarder)
     */
    getReadyParcels: (forwarder_id_1, ...args_1) => __awaiter(void 0, [forwarder_id_1, ...args_1], void 0, function* (forwarder_id, page = 1, limit = 20) {
        const where = {
            container_id: null,
            flight_id: null,
            deleted_at: null,
            status: {
                in: ALLOWED_CONTAINER_STATUSES,
            },
            agency: {
                forwarder_id,
            },
            // Only maritime service parcels
            service: {
                service_type: "MARITIME",
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
exports.default = containers;
