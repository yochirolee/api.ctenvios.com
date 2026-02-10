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
 * Pallets Repository
 * Following: Repository pattern, TypeScript strict typing
 */
// Allowed statuses for parcels to be added to pallet
const ALLOWED_PALLET_STATUSES = [client_1.Status.IN_AGENCY];
/**
 * Validates if a parcel status allows it to be added to pallet
 */
const isValidStatusForPallet = (status) => {
    return ALLOWED_PALLET_STATUSES.includes(status);
};
/**
 * Generate a unique pallet number
 */
const generatePalletNumber = (agency_id) => __awaiter(void 0, void 0, void 0, function* () {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    // Count pallets for this agency this month
    const count = yield prisma_client_1.default.pallet.count({
        where: {
            agency_id,
            created_at: {
                gte: new Date(year, date.getMonth(), 1),
                lt: new Date(year, date.getMonth() + 1, 1),
            },
        },
    });
    const sequence = String(count + 1).padStart(4, "0");
    return `P-${agency_id}-${year}${month}-${sequence}`;
});
const pallets = {
    /**
     * Get all pallets with pagination
     */
    getAll: (page, limit, agency_id, status) => __awaiter(void 0, void 0, void 0, function* () {
        const where = {};
        if (agency_id) {
            where.agency_id = agency_id;
        }
        if (status) {
            where.status = status;
        }
        const [pallets, total] = yield Promise.all([
            prisma_client_1.default.pallet.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    agency: {
                        select: { id: true, name: true },
                    },
                    created_by: {
                        select: { id: true, name: true },
                    },
                    dispatch: {
                        select: { id: true, status: true },
                    },
                    _count: {
                        select: { parcels: true },
                    },
                },
                orderBy: { created_at: "desc" },
            }),
            prisma_client_1.default.pallet.count({ where }),
        ]);
        return { pallets, total };
    }),
    /**
     * Get pallet by ID with full details
     */
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet = yield prisma_client_1.default.pallet.findUnique({
            where: { id },
            include: {
                agency: {
                    select: { id: true, name: true },
                },
                created_by: {
                    select: { id: true, name: true },
                },
                dispatch: {
                    select: { id: true, status: true, receiver_agency: { select: { id: true, name: true } } },
                },
                _count: {
                    select: { parcels: true },
                },
            },
        });
        return pallet;
    }),
    /**
     * Get pallet by pallet number
     */
    getByPalletNumber: (pallet_number) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet = yield prisma_client_1.default.pallet.findUnique({
            where: { pallet_number },
            include: {
                agency: {
                    select: { id: true, name: true },
                },
                created_by: {
                    select: { id: true, name: true },
                },
            },
        });
        return pallet;
    }),
    /**
     * Create a new pallet
     */
    create: (agency_id, user_id, notes) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet_number = yield generatePalletNumber(agency_id);
        const pallet = yield prisma_client_1.default.pallet.create({
            data: {
                pallet_number,
                agency_id,
                created_by_id: user_id,
                notes,
            },
            include: {
                agency: {
                    select: { id: true, name: true },
                },
                created_by: {
                    select: { id: true, name: true },
                },
            },
        });
        return pallet;
    }),
    /**
     * Update pallet
     */
    update: (id, data) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet = yield prisma_client_1.default.pallet.findUnique({ where: { id } });
        if (!pallet) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Pallet with id ${id} not found`);
        }
        const updated = yield prisma_client_1.default.pallet.update({
            where: { id },
            data,
            include: {
                agency: {
                    select: { id: true, name: true },
                },
                created_by: {
                    select: { id: true, name: true },
                },
            },
        });
        return updated;
    }),
    /**
     * Delete pallet (only if empty and OPEN)
     */
    delete: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet = yield prisma_client_1.default.pallet.findUnique({
            where: { id },
            include: { _count: { select: { parcels: true } } },
        });
        if (!pallet) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Pallet with id ${id} not found`);
        }
        if (pallet._count.parcels > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete pallet with parcels. Remove all parcels first.");
        }
        if (pallet.status !== client_1.PalletStatus.OPEN) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete pallet with status ${pallet.status}. Only OPEN pallets can be deleted.`);
        }
        const deleted = yield prisma_client_1.default.pallet.delete({ where: { id } });
        return deleted;
    }),
    /**
     * Get parcels in pallet with pagination
     */
    getParcels: (pallet_id_1, ...args_1) => __awaiter(void 0, [pallet_id_1, ...args_1], void 0, function* (pallet_id, page = 1, limit = 20) {
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where: { pallet_id },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { updated_at: "desc" },
                include: {
                    agency: { select: { id: true, name: true } },
                },
            }),
            prisma_client_1.default.parcel.count({ where: { pallet_id } }),
        ]);
        return { parcels, total };
    }),
    /**
     * Add parcel to pallet
     */
    addParcel: (pallet_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        // Check if parcel's order has been deleted
        if (parcel.deleted_at) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcel ${tracking_number} - its order has been deleted`);
        }
        if (parcel.pallet_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel ${tracking_number} is already in pallet ${parcel.pallet_id}`);
        }
        if (!isValidStatusForPallet(parcel.status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel with status ${parcel.status} cannot be added to pallet. Parcel must be IN_AGENCY.`);
        }
        const pallet = yield prisma_client_1.default.pallet.findUnique({ where: { id: pallet_id } });
        if (!pallet) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Pallet with id ${pallet_id} not found`);
        }
        if (pallet.status !== client_1.PalletStatus.OPEN) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcels to pallet with status ${pallet.status}. Pallet must be OPEN.`);
        }
        // Verify parcel belongs to same agency as pallet
        if (parcel.agency_id !== pallet.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel belongs to a different agency. Cannot add to this pallet.`);
        }
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update parcel
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    pallet_id,
                    status: client_1.Status.IN_PALLET,
                },
            });
            // Create parcel event
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.ADDED_TO_PALLET,
                    user_id,
                    status: client_1.Status.IN_PALLET,
                    pallet_id,
                    notes: `Added to pallet ${pallet.pallet_number}`,
                },
            });
            // Update pallet weight and count
            yield tx.pallet.update({
                where: { id: pallet_id },
                data: {
                    total_weight_kg: {
                        increment: parcel.weight,
                    },
                    parcels_count: {
                        increment: 1,
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
     * Add all parcels from an order to a pallet
     */
    addParcelsByOrderId: (pallet_id, order_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet = yield prisma_client_1.default.pallet.findUnique({ where: { id: pallet_id } });
        if (!pallet) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Pallet with id ${pallet_id} not found`);
        }
        if (pallet.status !== client_1.PalletStatus.OPEN) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot add parcels to pallet with status ${pallet.status}. Pallet must be OPEN.`);
        }
        // Find all parcels for this order
        const parcels = yield prisma_client_1.default.parcel.findMany({
            where: { order_id },
        });
        if (parcels.length === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `No parcels found for order ${order_id}`);
        }
        let added = 0;
        let skipped = 0;
        let totalWeight = 0;
        const addedParcels = [];
        yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            for (const parcel of parcels) {
                // Skip if already assigned elsewhere (safety net)
                if (parcel.pallet_id || parcel.dispatch_id || parcel.container_id || parcel.flight_id) {
                    skipped++;
                    continue;
                }
                // Skip if status doesn't allow adding to pallet
                if (!isValidStatusForPallet(parcel.status)) {
                    skipped++;
                    continue;
                }
                // Skip if parcel belongs to a different agency than the pallet
                if (parcel.agency_id !== pallet.agency_id) {
                    skipped++;
                    continue;
                }
                const updated = yield tx.parcel.update({
                    where: { id: parcel.id },
                    data: {
                        pallet_id,
                        status: client_1.Status.IN_PALLET,
                    },
                });
                yield tx.parcelEvent.create({
                    data: {
                        parcel_id: parcel.id,
                        event_type: client_1.ParcelEventType.ADDED_TO_PALLET,
                        user_id,
                        status: client_1.Status.IN_PALLET,
                        pallet_id,
                        notes: `Added to pallet ${pallet.pallet_number} (batch from order #${order_id})`,
                    },
                });
                totalWeight += Number(parcel.weight);
                addedParcels.push(updated);
                added++;
            }
            if (added > 0) {
                yield tx.pallet.update({
                    where: { id: pallet_id },
                    data: {
                        total_weight_kg: {
                            increment: totalWeight,
                        },
                        parcels_count: {
                            increment: added,
                        },
                    },
                });
            }
        }));
        if (added > 0) {
            yield (0, order_status_calculator_1.updateOrderStatusFromParcels)(order_id);
        }
        return { added, skipped, parcels: addedParcels };
    }),
    /**
     * Remove parcel from pallet
     */
    removeParcel: (pallet_id, tracking_number, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const parcel = yield prisma_client_1.default.parcel.findUnique({
            where: { tracking_number },
        });
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        if (parcel.pallet_id !== pallet_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel ${tracking_number} is not in pallet ${pallet_id}`);
        }
        const pallet = yield prisma_client_1.default.pallet.findUnique({ where: { id: pallet_id } });
        if (!pallet) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Pallet with id ${pallet_id} not found`);
        }
        // Only allow removal if pallet is OPEN
        if (pallet.status !== client_1.PalletStatus.OPEN) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot remove parcels from pallet with status ${pallet.status}. Pallet must be OPEN.`);
        }
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update parcel
            const updated = yield tx.parcel.update({
                where: { tracking_number },
                data: {
                    pallet_id: null,
                    status: client_1.Status.IN_AGENCY,
                },
            });
            // Create parcel event
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    event_type: client_1.ParcelEventType.REMOVED_FROM_PALLET,
                    user_id,
                    status: client_1.Status.IN_AGENCY,
                    pallet_id, // Keep reference to which pallet it was removed from
                    notes: `Removed from pallet ${pallet.pallet_number}`,
                },
            });
            // Update pallet weight and count
            yield tx.pallet.update({
                where: { id: pallet_id },
                data: {
                    total_weight_kg: {
                        decrement: parcel.weight,
                    },
                    parcels_count: {
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
     * Seal pallet (close it for dispatch)
     */
    seal: (id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet = yield prisma_client_1.default.pallet.findUnique({
            where: { id },
            include: { _count: { select: { parcels: true } } },
        });
        if (!pallet) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Pallet with id ${id} not found`);
        }
        if (pallet.status !== client_1.PalletStatus.OPEN) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Pallet is already ${pallet.status}`);
        }
        if (pallet._count.parcels === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot seal an empty pallet");
        }
        const updated = yield prisma_client_1.default.pallet.update({
            where: { id },
            data: { status: client_1.PalletStatus.SEALED },
            include: {
                agency: { select: { id: true, name: true } },
                created_by: { select: { id: true, name: true } },
            },
        });
        return updated;
    }),
    /**
     * Unseal pallet (reopen it)
     */
    unseal: (id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        const pallet = yield prisma_client_1.default.pallet.findUnique({ where: { id } });
        if (!pallet) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Pallet with id ${id} not found`);
        }
        if (pallet.status !== client_1.PalletStatus.SEALED) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot unseal pallet with status ${pallet.status}. Pallet must be SEALED.`);
        }
        if (pallet.dispatch_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot unseal pallet that is already in a dispatch");
        }
        const updated = yield prisma_client_1.default.pallet.update({
            where: { id },
            data: { status: client_1.PalletStatus.OPEN },
            include: {
                agency: { select: { id: true, name: true } },
                created_by: { select: { id: true, name: true } },
            },
        });
        return updated;
    }),
    /**
     * Get parcels ready to be added to pallet (by agency)
     */
    getReadyParcels: (agency_id_1, ...args_1) => __awaiter(void 0, [agency_id_1, ...args_1], void 0, function* (agency_id, page = 1, limit = 20) {
        const where = {
            pallet_id: null,
            dispatch_id: null,
            container_id: null,
            flight_id: null,
            agency_id,
            status: client_1.Status.IN_AGENCY,
        };
        const [parcels, total] = yield Promise.all([
            prisma_client_1.default.parcel.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { created_at: "desc" },
                include: {
                    order: {
                        select: {
                            id: true,
                            agency: { select: { id: true, name: true } },
                        },
                    },
                    service: {
                        select: { id: true, name: true, service_type: true },
                    },
                },
            }),
            prisma_client_1.default.parcel.count({ where }),
        ]);
        return { parcels, total };
    }),
};
exports.default = pallets;
