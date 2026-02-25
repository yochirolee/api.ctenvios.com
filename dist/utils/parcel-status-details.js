"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildParcelStatusDetails = void 0;
const client_1 = require("@prisma/client");
/**
 * Build a short human-readable status_details string for a parcel.
 * Prefers location context (dispatch, container, etc.) when available.
 */
const buildParcelStatusDetails = (params) => {
    const { status, dispatch_id, container_id, container_name, pallet_id, flight_id, current_warehouse_id, } = params;
    if (container_id != null) {
        return container_name ? `In Container ${container_name}` : `In Container #${container_id}`;
    }
    if (flight_id != null) {
        return `In Flight #${flight_id}`;
    }
    if (dispatch_id != null) {
        if (status === client_1.Status.RECEIVED_IN_DISPATCH) {
            return `Received in Dispatch #${dispatch_id}`;
        }
        return `In Dispatch #${dispatch_id}`;
    }
    if (pallet_id != null) {
        return `In Pallet #${pallet_id}`;
    }
    if (current_warehouse_id != null) {
        return `In Warehouse #${current_warehouse_id}`;
    }
    switch (status) {
        case client_1.Status.IN_AGENCY:
            return "In agency";
        case client_1.Status.IN_WAREHOUSE:
            return "In warehouse";
        case client_1.Status.IN_TRANSIT:
            return "In transit";
        case client_1.Status.AT_PORT_OF_ENTRY:
            return "At port of entry";
        case client_1.Status.CUSTOMS_INSPECTION:
            return "Customs inspection";
        case client_1.Status.RELEASED_FROM_CUSTOMS:
            return "Released from customs";
        case client_1.Status.OUT_FOR_DELIVERY:
            return "Out for delivery";
        case client_1.Status.FAILED_DELIVERY:
            return "Delivery failed";
        case client_1.Status.DELIVERED:
            return "Delivered";
        case client_1.Status.RETURNED_TO_SENDER:
            return "Returned to sender";
        case client_1.Status.CANCELLED:
            return "Cancelled";
        default:
            return "In agency";
    }
};
exports.buildParcelStatusDetails = buildParcelStatusDetails;
