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
 * Warehouses Repository
 * Following: Repository pattern, TypeScript strict typing
 */
const warehouses = {
    /**
     * Get all warehouses with pagination
     */
    getAll: (page, limit, carrier_id, province_id, is_active) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {};
        if (carrier_id) {
            where.carrier_id = carrier_id;
        }
        if (province_id) {
            where.province_id = province_id;
        }
        if (is_active !== undefined) {
            where.is_active = is_active;
        }
        const [warehouses, total] = yield Promise.all([
            prisma_client_1.default.warehouse.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    carrier: {
                        select: { id: true, name: true },
                    },
                    province: {
                        select: { id: true, name: true },
                    },
                    manager: {
                        select: { id: true, name: true },
                    },
                    _count: {
                        select: { parcels: true },
                    },
                },
                orderBy: [{ is_main: "desc" }, { created_at: "desc" }],
            }),
            prisma_client_1.default.warehouse.count({ where }),
        ]);
        return { warehouses, total };
    }),
    /**
     * Get warehouse by ID with full details
     */
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const warehouse = yield prisma_client_1.default.warehouse.findUnique({
            where: { id },
            include: {
                carrier: {
                    select: { id: true, name: true },
                },
                province: {
                    select: { id: true, name: true },
                },
                manager: {
                    select: { id: true, name: true, phone: true },
                },
                _count: {
                    select: { parcels: true },
                },
            },
        });
        return warehouse;
    }),
    /**
     * Create a new warehouse
     */
    create: (data) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // If setting as main, ensure no other main warehouse exists for this carrier in this province
        if (data.is_main) {
            const existingMain = yield prisma_client_1.default.warehouse.findFirst({
                where: {
                    carrier_id: data.carrier_id,
                    province_id: data.province_id,
                    is_main: true,
                },
            });
            if (existingMain) {
                throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Carrier already has a main warehouse in this province (ID: ${existingMain.id})`);
            }
        }
        const warehouse = yield prisma_client_1.default.warehouse.create({
            data: {
                name: data.name,
                address: data.address,
                carrier_id: data.carrier_id,
                province_id: data.province_id,
                is_main: (_a = data.is_main) !== null && _a !== void 0 ? _a : false,
                manager_id: data.manager_id,
            },
            include: {
                carrier: {
                    select: { id: true, name: true },
                },
                province: {
                    select: { id: true, name: true },
                },
                manager: {
                    select: { id: true, name: true },
                },
            },
        });
        return warehouse;
    }),
    /**
     * Update warehouse
     */
    update: (id, data) => __awaiter(void 0, void 0, void 0, function* () {
        const warehouse = yield prisma_client_1.default.warehouse.findUnique({ where: { id } });
        if (!warehouse) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Warehouse with id ${id} not found`);
        }
        // If setting as main, ensure no other main warehouse exists
        if (data.is_main === true && !warehouse.is_main) {
            const existingMain = yield prisma_client_1.default.warehouse.findFirst({
                where: {
                    carrier_id: warehouse.carrier_id,
                    province_id: warehouse.province_id,
                    is_main: true,
                    id: { not: id },
                },
            });
            if (existingMain) {
                throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Carrier already has a main warehouse in this province (ID: ${existingMain.id})`);
            }
        }
        const updated = yield prisma_client_1.default.warehouse.update({
            where: { id },
            data,
            include: {
                carrier: {
                    select: { id: true, name: true },
                },
                province: {
                    select: { id: true, name: true },
                },
                manager: {
                    select: { id: true, name: true },
                },
            },
        });
        return updated;
    }),
    /**
     * Delete warehouse (only if empty)
     */
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const warehouse = yield prisma_client_1.default.warehouse.findUnique({
            where: { id },
            include: { _count: { select: { parcels: true } } },
        });
        if (!warehouse) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Warehouse with id ${id} not found`);
        }
        if (warehouse._count.parcels > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete warehouse with parcels. Transfer all parcels first.");
        }
        const deleted = yield prisma_client_1.default.warehouse.delete({ where: { id } });
        return deleted;
    }),
    /**
     * Get parcels in warehouse with pagination
     */
    getParcels: (warehouse_id_1, ...args_1) => __awaiter(void 0, [warehouse_id_1, ...args_1], void 0, function* (warehouse_id, page = 1, limit = 20) {
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where: { current_warehouse_id: warehouse_id },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { updated_at: "desc" },
                include: {
                    order: {
                        select: {
                            id: true,
                            receiver: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    address: true,
                                    city: { select: { name: true } },
                                },
                            },
                        },
                    },
                    service: {
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma_client_1.default.parcel.count({ where: { current_warehouse_id: warehouse_id } }),
        ]);
        return { parcels, total };
    }),
    /**
     * Receive parcel in warehouse
     */
    receiveParcel: (warehouse_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        const warehouse = yield prisma_client_1.default.warehouse.findUnique({ where: { id: warehouse_id } });
        if (!warehouse) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Warehouse with id ${warehouse_id} not found`);
        }
        if (!warehouse.is_active) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot receive parcels in inactive warehouse");
        }
        // Parcel should be released from customs or in another warehouse
        const allowedStatuses = [client_1.Status.RELEASED_FROM_CUSTOMS, client_1.Status.IN_WAREHOUSE];
        if (!allowedStatuses.includes(parcel.status) && !parcel.current_warehouse_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel with status ${parcel.status} cannot be received in warehouse. Must be RELEASED_FROM_CUSTOMS or transferring from another warehouse.`);
        }
        const previousWarehouseId = parcel.current_warehouse_id;
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    current_warehouse_id: warehouse_id,
                    status: client_1.Status.IN_WAREHOUSE,
                },
            });
            // Create parcel event
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: previousWarehouseId
                        ? client_1.ParcelEventType.WAREHOUSE_TRANSFERRED
                        : client_1.ParcelEventType.WAREHOUSE_RECEIVED,
                    user_id,
                    status: client_1.Status.IN_WAREHOUSE,
                    warehouse_id,
                    notes: previousWarehouseId
                        ? `Transferred from warehouse ${previousWarehouseId} to ${warehouse.name}`
                        : `Received at ${warehouse.name}`,
                },
            });
            return updated;
        }));
        // Update order status based on parcel changes
        yield (0, order_status_calculator_1.updateOrderStatusFromParcel)(parcel.id);
        return updatedParcel;
    }),
    /**
     * Transfer parcel to another warehouse
     */
    transferParcel: (from_warehouse_id, to_warehouse_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        if (parcel.current_warehouse_id !== from_warehouse_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel ${tracking_number} is not in warehouse ${from_warehouse_id}`);
        }
        const fromWarehouse = yield prisma_client_1.default.warehouse.findUnique({ where: { id: from_warehouse_id } });
        const toWarehouse = yield prisma_client_1.default.warehouse.findUnique({ where: { id: to_warehouse_id } });
        if (!fromWarehouse) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Source warehouse with id ${from_warehouse_id} not found`);
        }
        if (!toWarehouse) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Destination warehouse with id ${to_warehouse_id} not found`);
        }
        if (!toWarehouse.is_active) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot transfer to inactive warehouse");
        }
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    current_warehouse_id: to_warehouse_id,
                },
            });
            // Create parcel event
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.WAREHOUSE_TRANSFERRED,
                    user_id,
                    status: client_1.Status.IN_WAREHOUSE,
                    warehouse_id: to_warehouse_id,
                    notes: `Transferred from ${fromWarehouse.name} to ${toWarehouse.name}`,
                },
            });
            return updated;
        }));
        // Update order status based on parcel changes
        yield (0, order_status_calculator_1.updateOrderStatusFromParcel)(parcel.id);
        return updatedParcel;
    }),
    /**
     * Get main warehouse for carrier in a province
     */
    getMainForCarrierAndProvince: (carrier_id, province_id) => __awaiter(void 0, void 0, void 0, function* () {
        const warehouse = yield prisma_client_1.default.warehouse.findFirst({
            where: {
                carrier_id,
                province_id,
                is_main: true,
                is_active: true,
            },
            include: {
                carrier: {
                    select: { id: true, name: true },
                },
                province: {
                    select: { id: true, name: true },
                },
            },
        });
        return warehouse;
    }),
    /**
     * Get warehouses by carrier
     */
    getByCarrier: (carrier_id) => __awaiter(void 0, void 0, void 0, function* () {
        const warehouses = yield prisma_client_1.default.warehouse.findMany({
            where: { carrier_id, is_active: true },
            include: {
                province: {
                    select: { id: true, name: true },
                },
                manager: {
                    select: { id: true, name: true },
                },
                _count: {
                    select: { parcels: true },
                },
            },
            orderBy: [{ is_main: "desc" }, { province: { name: "asc" } }],
        });
        return warehouses;
    }),
};
exports.default = warehouses;
