import { Status } from "@prisma/client";

/**
 * Parcel status_details: human-readable context (location) for a parcel's status.
 * Used when updating parcel status so UI can show e.g. "In Dispatch #5", "In Container #22".
 */

export interface ParcelStatusDetailsParams {
   status: Status;
   dispatch_id?: number | null;
   container_id?: number | null;
   container_name?: string | null;
   pallet_id?: number | null;
   flight_id?: number | null;
   current_warehouse_id?: number | null;
}

/**
 * Build a short human-readable status_details string for a parcel.
 * Prefers location context (dispatch, container, etc.) when available.
 */
export const buildParcelStatusDetails = (params: ParcelStatusDetailsParams): string => {
   const {
      status,
      dispatch_id,
      container_id,
      container_name,
      pallet_id,
      flight_id,
      current_warehouse_id,
   } = params;

   if (container_id != null) {
      return container_name ? `In Container ${container_name}` : `In Container #${container_id}`;
   }
   if (flight_id != null) {
      return `In Flight #${flight_id}`;
   }
   if (dispatch_id != null) {
      if (status === Status.RECEIVED_IN_DISPATCH) {
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
      case Status.IN_AGENCY:
         return "In agency";
      case Status.IN_WAREHOUSE:
         return "In warehouse";
      case Status.IN_TRANSIT:
         return "In transit";
      case Status.AT_PORT_OF_ENTRY:
         return "At port of entry";
      case Status.CUSTOMS_INSPECTION:
         return "Customs inspection";
      case Status.RELEASED_FROM_CUSTOMS:
         return "Released from customs";
      case Status.OUT_FOR_DELIVERY:
         return "Out for delivery";
      case Status.FAILED_DELIVERY:
         return "Delivery failed";
      case Status.DELIVERED:
         return "Delivered";
      case Status.RETURNED_TO_SENDER:
         return "Returned to sender";
      case Status.CANCELLED:
         return "Cancelled";
      default:
         return "In agency";
   }
};
