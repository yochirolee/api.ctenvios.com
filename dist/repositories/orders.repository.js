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
const client_1 = require("@prisma/client");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const order_with_relations_1 = require("../types/order-with-relations");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const index_1 = __importDefault(require("./index"));
// Orders can only be deleted (soft) when in these statuses
const DELETABLE_STATUSES = [client_1.Status.IN_AGENCY];
// Roles that can delete any order
const ADMIN_ROLES = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR];
const orders = {
    getAll: (_a) => __awaiter(void 0, [_a], void 0, function* ({ page, limit }) {
        const orders = yield prisma_client_1.default.order.findMany({
            where: { deleted_at: null }, // Exclude soft-deleted orders
            skip: (page - 1) * limit,
            take: limit,
        });
        const total = yield prisma_client_1.default.order.count({ where: { deleted_at: null } });
        return { orders, total };
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.order.findUnique({
            where: { id, deleted_at: null },
            include: { order_items: true },
        });
    }),
    getParcelsByOrderId: (orderId) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.order.findUnique({
            where: { id: orderId, deleted_at: null },
            include: {
                agency: true,
                customer: true,
                receiver: {
                    include: {
                        province: true,
                        city: true,
                    },
                },
                service: true,
                parcels: true,
                payments: true,
                discounts: true,
                issues: true,
                user: true,
            },
        });
    }),
    getByIdWithDetails: (id) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.order.findUnique({
            where: { id },
            include: order_with_relations_1.orderWithRelationsInclude,
        });
    }),
    create: (orderData) => __awaiter(void 0, void 0, void 0, function* () {
        return yield prisma_client_1.default.order.create({
            data: orderData,
            include: {
                customer: true,
                receiver: {
                    include: {
                        province: true,
                        city: true,
                    },
                },
                order_items: {
                    select: {
                        hbl: true,
                        description: true,
                        weight: true,
                        rate_id: true,
                        price_in_cents: true,
                        unit: true,
                        insurance_fee_in_cents: true,
                        customs_fee_in_cents: true,
                        charge_fee_in_cents: true,
                        delivery_fee_in_cents: true,
                        parcel: {
                            select: { tracking_number: true, external_reference: true },
                        },
                    },
                },
            },
        });
    }),
    /**
     * Soft delete an order
     * Permission rules:
     * - ROOT/ADMINISTRATOR: Can delete any order
     * - AGENCY_ADMIN: Can delete orders from their agency or child agencies
     * - Other users: Can only delete orders they created
     *
     * Business rules:
     * - Only orders in DELETABLE_STATUSES can be deleted
     * - Orders with payments cannot be deleted (must void payments first)
     */
    softDelete: (id, user, reason) => __awaiter(void 0, void 0, void 0, function* () {
        const order = yield prisma_client_1.default.order.findUnique({
            where: { id, deleted_at: null },
            include: {
                payments: true,
                parcels: {
                    select: {
                        id: true,
                        tracking_number: true,
                        status: true,
                        container_id: true,
                        flight_id: true,
                        dispatch_id: true,
                    },
                },
            },
        });
        if (!order) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
        }
        // ========== PERMISSION CHECK ==========
        const isAdmin = ADMIN_ROLES.includes(user.userRole);
        const isAgencyAdmin = user.userRole === client_1.Roles.AGENCY_ADMIN;
        const isOrderCreator = order.user_id === user.userId;
        if (!isAdmin) {
            if (isAgencyAdmin && user.userAgencyId) {
                // AGENCY_ADMIN can delete orders from their agency or child agencies
                const childAgencies = yield index_1.default.agencies.getAllChildrenRecursively(user.userAgencyId);
                const allowedAgencies = [user.userAgencyId, ...childAgencies];
                if (!allowedAgencies.includes(order.agency_id)) {
                    throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You can only delete orders from your agency or child agencies");
                }
            }
            else if (!isOrderCreator) {
                // Regular users can only delete their own orders
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You can only delete orders you created");
            }
        }
        // ========== BUSINESS RULES ==========
        // Validate status
        if (!DELETABLE_STATUSES.includes(order.status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete order in status "${order.status}". Only orders in ${DELETABLE_STATUSES.join(", ")} can be deleted.`);
        }
        // Check for payments
        if (order.payments.length > 0 && order.paid_in_cents > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot delete order with payments. Void or refund payments first.");
        }
        // Check if any parcel is in a container
        const parcelsInContainer = order.parcels.filter((p) => p.container_id !== null);
        if (parcelsInContainer.length > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete order: ${parcelsInContainer.length} parcel(s) are loaded in a container. Remove them first.`);
        }
        // Check if any parcel is in a flight
        const parcelsInFlight = order.parcels.filter((p) => p.flight_id !== null);
        if (parcelsInFlight.length > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete order: ${parcelsInFlight.length} parcel(s) are loaded in a flight. Remove them first.`);
        }
        // Check if any parcel is in a dispatch
        const parcelsInDispatch = order.parcels.filter((p) => p.dispatch_id !== null);
        if (parcelsInDispatch.length > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete order: ${parcelsInDispatch.length} parcel(s) are in a dispatch. Remove them first.`);
        }
        // Check if any parcel has advanced status (beyond IN_AGENCY)
        const advancedParcels = order.parcels.filter((p) => !DELETABLE_STATUSES.includes(p.status));
        if (advancedParcels.length > 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Cannot delete order: ${advancedParcels.length} parcel(s) have status "${advancedParcels[0].status}". Only parcels in ${DELETABLE_STATUSES.join(", ")} can be deleted.`);
        }
        // Store original status before cancellation for potential restore
        const originalStatus = order.status;
        const deletedAt = new Date();
        // Perform soft delete in a transaction - delete order, parcels, and order items
        const deletedOrder = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Soft delete all parcels belonging to this order
            yield tx.parcel.updateMany({
                where: { order_id: id },
                data: { deleted_at: deletedAt },
            });
            // 2. Soft delete all order items belonging to this order
            yield tx.orderItem.updateMany({
                where: { order_id: id },
                data: { deleted_at: deletedAt },
            });
            // 3. Soft delete the order
            const updatedOrder = yield tx.order.update({
                where: { id },
                data: {
                    status: client_1.Status.CANCELLED,
                    deleted_at: deletedAt,
                    deleted_by_id: user.userId,
                    deletion_reason: reason || `Deleted by user. Original status: ${originalStatus}`,
                },
            });
            return updatedOrder;
        }));
        return { success: true, order: deletedOrder };
    }),
    /**
     * Restore a soft-deleted order
     * Restores to IN_AGENCY status (since only IN_AGENCY orders can be deleted)
     * Also restores all parcels that were deleted with the order
     */
    restore: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const order = yield prisma_client_1.default.order.findUnique({
            where: { id },
        });
        if (!order) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
        }
        if (!order.deleted_at) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Order is not deleted");
        }
        // Restore in a transaction - restore order, parcels, and order items
        return yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Restore all parcels belonging to this order
            yield tx.parcel.updateMany({
                where: { order_id: id, deleted_at: { not: null } },
                data: { deleted_at: null },
            });
            // 2. Restore all order items belonging to this order
            yield tx.orderItem.updateMany({
                where: { order_id: id, deleted_at: { not: null } },
                data: { deleted_at: null },
            });
            // 3. Restore the order
            const restoredOrder = yield tx.order.update({
                where: { id },
                data: {
                    status: client_1.Status.IN_AGENCY, // Restore to original deletable status
                    deleted_at: null,
                    deleted_by_id: null,
                    deletion_reason: null,
                },
            });
            return restoredOrder;
        }));
    }),
    /**
     * Get deleted orders (for admin review)
     */
    getDeleted: (_a) => __awaiter(void 0, [_a], void 0, function* ({ page, limit, agency_id }) {
        const where = Object.assign({ deleted_at: { not: null } }, (agency_id && { agency_id }));
        const orders = yield prisma_client_1.default.order.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            include: {
                customer: { select: { first_name: true, last_name: true } },
                deleted_by: { select: { id: true, name: true } },
            },
            orderBy: { deleted_at: "desc" },
        });
        const total = yield prisma_client_1.default.order.count({ where });
        return { orders, total };
    }),
};
exports.default = orders;
