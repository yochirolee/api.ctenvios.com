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
exports.getOrderStatusSummary = exports.updateOrderStatusFromParcelTx = exports.updateOrderStatusFromParcel = exports.updateMultipleOrdersStatusTx = exports.updateMultipleOrdersStatus = exports.updateOrderStatusFromParcelsTx = exports.updateOrderStatusFromParcels = exports.calculateOrderStatus = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
/**
 * Order Status Calculator
 * Calculates order status based on the status of all its parcels
 * Following: TypeScript strict typing, Utility function pattern
 */
// Estados base de parcels (no parciales) en orden de prioridad
const BASE_STATUSES = [
    client_1.Status.IN_AGENCY,
    client_1.Status.IN_PALLET,
    client_1.Status.IN_DISPATCH,
    client_1.Status.RECEIVED_IN_DISPATCH,
    client_1.Status.IN_WAREHOUSE,
    client_1.Status.IN_CONTAINER,
    client_1.Status.IN_TRANSIT,
    client_1.Status.AT_PORT_OF_ENTRY,
    client_1.Status.CUSTOMS_INSPECTION,
    client_1.Status.RELEASED_FROM_CUSTOMS,
    client_1.Status.OUT_FOR_DELIVERY,
    client_1.Status.FAILED_DELIVERY,
    client_1.Status.DELIVERED,
    client_1.Status.RETURNED_TO_SENDER,
];
// Mapeo de estado base a su versión parcial
const PARTIAL_STATUS_MAP = {
    [client_1.Status.IN_PALLET]: client_1.Status.PARTIALLY_IN_PALLET,
    [client_1.Status.IN_DISPATCH]: client_1.Status.PARTIALLY_IN_DISPATCH,
    [client_1.Status.RECEIVED_IN_DISPATCH]: client_1.Status.PARTIALLY_IN_DISPATCH,
    [client_1.Status.IN_CONTAINER]: client_1.Status.PARTIALLY_IN_CONTAINER,
    [client_1.Status.IN_TRANSIT]: client_1.Status.PARTIALLY_IN_TRANSIT,
    [client_1.Status.AT_PORT_OF_ENTRY]: client_1.Status.PARTIALLY_AT_PORT,
    [client_1.Status.CUSTOMS_INSPECTION]: client_1.Status.PARTIALLY_IN_CUSTOMS,
    [client_1.Status.RELEASED_FROM_CUSTOMS]: client_1.Status.PARTIALLY_RELEASED,
    [client_1.Status.OUT_FOR_DELIVERY]: client_1.Status.PARTIALLY_OUT_FOR_DELIVERY,
    [client_1.Status.DELIVERED]: client_1.Status.PARTIALLY_DELIVERED,
};
/**
 * Get the priority index for a status (higher = more advanced)
 */
const getStatusPriority = (status) => {
    const index = BASE_STATUSES.indexOf(status);
    return index === -1 ? 0 : index;
};
/**
 * Check if a status is a base parcel status (not a partial order status)
 */
const isBaseStatus = (status) => {
    return BASE_STATUSES.includes(status);
};
/**
 * Calculate the order status based on parcel statuses
 *
 * Logic:
 * - If all parcels have the same status → Order has that status
 * - If parcels are in different stages → Use PARTIALLY_* for the most advanced stage
 *
 * Example:
 * - 3 parcels IN_DISPATCH, 1 IN_AGENCY → PARTIALLY_IN_DISPATCH
 * - 2 parcels IN_CONTAINER, 2 IN_DISPATCH → PARTIALLY_IN_CONTAINER
 * - 2 parcels DELIVERED, 2 IN_TRANSIT → PARTIALLY_DELIVERED
 */
const calculateOrderStatus = (parcelStatuses) => {
    if (parcelStatuses.length === 0) {
        return client_1.Status.IN_AGENCY;
    }
    // Filter only base statuses (parcels shouldn't have partial statuses)
    const baseStatuses = parcelStatuses.filter(isBaseStatus);
    if (baseStatuses.length === 0) {
        return client_1.Status.IN_AGENCY;
    }
    // If all parcels have the same status → Order has that status
    const uniqueStatuses = [...new Set(baseStatuses)];
    if (uniqueStatuses.length === 1) {
        return uniqueStatuses[0];
    }
    // Find the maximum (most advanced) status among all parcels
    let maxStatus = baseStatuses[0];
    let maxPriority = getStatusPriority(maxStatus);
    for (const status of baseStatuses) {
        const priority = getStatusPriority(status);
        if (priority > maxPriority) {
            maxPriority = priority;
            maxStatus = status;
        }
    }
    // Count how many parcels are at the max status
    const atMaxCount = baseStatuses.filter((s) => s === maxStatus).length;
    const totalParcels = baseStatuses.length;
    // If all parcels are at max status, return that status
    if (atMaxCount === totalParcels) {
        return maxStatus;
    }
    // Some parcels are at a more advanced stage than others → use partial status
    const partialStatus = PARTIAL_STATUS_MAP[maxStatus];
    // If no partial status exists for this max status, return the max status
    // (e.g., IN_AGENCY, IN_WAREHOUSE don't have partial versions)
    if (!partialStatus) {
        return maxStatus;
    }
    return partialStatus;
};
exports.calculateOrderStatus = calculateOrderStatus;
/**
 * Update order status based on its parcels' current statuses
 * Call this function whenever a parcel status changes
 */
const updateOrderStatusFromParcels = (order_id) => __awaiter(void 0, void 0, void 0, function* () {
    // Get all parcel statuses for this order
    const parcels = yield prisma_client_1.default.parcel.findMany({
        where: { order_id },
        select: { status: true },
    });
    const parcelStatuses = parcels.map((p) => p.status);
    const newOrderStatus = (0, exports.calculateOrderStatus)(parcelStatuses);
    // Update the order status
    yield prisma_client_1.default.order.update({
        where: { id: order_id },
        data: { status: newOrderStatus },
    });
    return newOrderStatus;
});
exports.updateOrderStatusFromParcels = updateOrderStatusFromParcels;
/**
 * Update order status based on its parcels' current statuses (transaction-aware)
 */
const updateOrderStatusFromParcelsTx = (tx, order_id) => __awaiter(void 0, void 0, void 0, function* () {
    const parcels = yield tx.parcel.findMany({
        where: { order_id },
        select: { status: true },
    });
    const parcelStatuses = parcels.map((p) => p.status);
    const newOrderStatus = (0, exports.calculateOrderStatus)(parcelStatuses);
    yield tx.order.update({
        where: { id: order_id },
        data: { status: newOrderStatus },
    });
    return newOrderStatus;
});
exports.updateOrderStatusFromParcelsTx = updateOrderStatusFromParcelsTx;
/**
 * Bulk update: Update order status for multiple orders
 * Useful when updating container/flight status affects many orders
 */
const updateMultipleOrdersStatus = (order_ids) => __awaiter(void 0, void 0, void 0, function* () {
    // Use Promise.all for parallel execution
    yield Promise.all(order_ids.map((id) => (0, exports.updateOrderStatusFromParcels)(id)));
});
exports.updateMultipleOrdersStatus = updateMultipleOrdersStatus;
/**
 * Bulk update: Update order status for multiple orders (transaction-aware)
 */
const updateMultipleOrdersStatusTx = (tx, order_ids) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all(order_ids.map((id) => (0, exports.updateOrderStatusFromParcelsTx)(tx, id)));
});
exports.updateMultipleOrdersStatusTx = updateMultipleOrdersStatusTx;
/**
 * Update order status from a parcel ID
 * Convenience function when you have the parcel but not the order
 */
const updateOrderStatusFromParcel = (parcel_id) => __awaiter(void 0, void 0, void 0, function* () {
    const parcel = yield prisma_client_1.default.parcel.findUnique({
        where: { id: parcel_id },
        select: { order_id: true },
    });
    if (!(parcel === null || parcel === void 0 ? void 0 : parcel.order_id)) {
        return null;
    }
    return (0, exports.updateOrderStatusFromParcels)(parcel.order_id);
});
exports.updateOrderStatusFromParcel = updateOrderStatusFromParcel;
/**
 * Update order status from a parcel ID (transaction-aware)
 */
const updateOrderStatusFromParcelTx = (tx, parcel_id) => __awaiter(void 0, void 0, void 0, function* () {
    const parcel = yield tx.parcel.findUnique({
        where: { id: parcel_id },
        select: { order_id: true },
    });
    if (!(parcel === null || parcel === void 0 ? void 0 : parcel.order_id)) {
        return null;
    }
    return (0, exports.updateOrderStatusFromParcelsTx)(tx, parcel.order_id);
});
exports.updateOrderStatusFromParcelTx = updateOrderStatusFromParcelTx;
/**
 * Get a human-readable status summary for an order
 */
const getOrderStatusSummary = (order_id) => __awaiter(void 0, void 0, void 0, function* () {
    const parcels = yield prisma_client_1.default.parcel.findMany({
        where: { order_id },
        select: { status: true },
    });
    const statusBreakdown = {};
    for (const parcel of parcels) {
        statusBreakdown[parcel.status] = (statusBreakdown[parcel.status] || 0) + 1;
    }
    const parcelStatuses = parcels.map((p) => p.status);
    const orderStatus = (0, exports.calculateOrderStatus)(parcelStatuses);
    return {
        order_status: orderStatus,
        parcels_count: parcels.length,
        status_breakdown: statusBreakdown,
    };
});
exports.getOrderStatusSummary = getOrderStatusSummary;
