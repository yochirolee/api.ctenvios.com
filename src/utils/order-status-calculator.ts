import { Prisma, Status } from "@prisma/client";
import prisma from "../lib/prisma.client";

/**
 * Order Status Calculator
 * Calculates order status based on the status of all its parcels
 * Following: TypeScript strict typing, Utility function pattern
 */

// Estados base de parcels (no parciales) en orden de prioridad
const BASE_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.RECEIVED_IN_DISPATCH,
   Status.IN_WAREHOUSE,
   Status.IN_CONTAINER,
   Status.IN_TRANSIT,
   Status.AT_PORT_OF_ENTRY,
   Status.CUSTOMS_INSPECTION,
   Status.RELEASED_FROM_CUSTOMS,
   Status.OUT_FOR_DELIVERY,
   Status.FAILED_DELIVERY,
   Status.DELIVERED,
   Status.RETURNED_TO_SENDER,
];

// Mapeo de estado base a su versión parcial
const PARTIAL_STATUS_MAP: Partial<Record<Status, Status>> = {
   [Status.IN_PALLET]: Status.PARTIALLY_IN_PALLET,
   [Status.IN_DISPATCH]: Status.PARTIALLY_IN_DISPATCH,
   [Status.RECEIVED_IN_DISPATCH]: Status.PARTIALLY_IN_DISPATCH,
   [Status.IN_CONTAINER]: Status.PARTIALLY_IN_CONTAINER,
   [Status.IN_TRANSIT]: Status.PARTIALLY_IN_TRANSIT,
   [Status.AT_PORT_OF_ENTRY]: Status.PARTIALLY_AT_PORT,
   [Status.CUSTOMS_INSPECTION]: Status.PARTIALLY_IN_CUSTOMS,
   [Status.RELEASED_FROM_CUSTOMS]: Status.PARTIALLY_RELEASED,
   [Status.OUT_FOR_DELIVERY]: Status.PARTIALLY_OUT_FOR_DELIVERY,
   [Status.DELIVERED]: Status.PARTIALLY_DELIVERED,
};

/**
 * Get the priority index for a status (higher = more advanced)
 */
const getStatusPriority = (status: Status): number => {
   const index = BASE_STATUSES.indexOf(status);
   return index === -1 ? 0 : index;
};

/**
 * Check if a status is a base parcel status (not a partial order status)
 */
const isBaseStatus = (status: Status): boolean => {
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
export const calculateOrderStatus = (parcelStatuses: Status[]): Status => {
   if (parcelStatuses.length === 0) {
      return Status.IN_AGENCY;
   }

   // Filter only base statuses (parcels shouldn't have partial statuses)
   const baseStatuses = parcelStatuses.filter(isBaseStatus);
   if (baseStatuses.length === 0) {
      return Status.IN_AGENCY;
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

/** Parcel row shape used for order status and status_details */
interface ParcelStatusRow {
   status: Status;
   dispatch_id: number | null;
   container_id: number | null;
   container?: { container_name: string } | null;
}

/**
 * Build a human-readable order status_details string from parcels
 * e.g. "2 in Dispatch #5, 1 in Container 22", "All in Agency"
 */
export const buildOrderStatusDetails = (parcels: ParcelStatusRow[]): string => {
   if (parcels.length === 0) {
      return "";
   }

   type GroupInfo = number | { n: number; container_name?: string };
   const groups: Map<string, GroupInfo> = new Map();
   for (const p of parcels) {
      const key =
         p.container_id != null
            ? `container:${p.container_id}`
            : p.dispatch_id != null
              ? `dispatch:${p.dispatch_id}`
              : "agency";
      if (key.startsWith("container:")) {
         const existing = groups.get(key);
         const prevN = typeof existing === "object" ? existing.n : 0;
         const container_name = p.container?.container_name ?? (typeof existing === "object" ? existing.container_name : undefined);
         groups.set(key, { n: prevN + 1, container_name });
      } else {
         const prev = groups.get(key);
         const prevN = typeof prev === "object" ? prev.n : (prev ?? 0);
         groups.set(key, prevN + 1);
      }
   }

   const total = parcels.length;
   const parts: string[] = [];
   if (groups.has("agency")) {
      const val = groups.get("agency")!;
      const n = typeof val === "object" ? val.n : val;
      parts.push(total === 1 && n === 1 ? "In agency" : `${n} in agency`);
   }
   for (const [key, val] of groups) {
      const n = typeof val === "object" ? val.n : val;
      if (key.startsWith("dispatch:")) {
         const id = key.replace("dispatch:", "");
         parts.push(total === 1 && n === 1 ? `In Dispatch #${id}` : `${n} in Dispatch #${id}`);
      } else if (key.startsWith("container:")) {
         const id = key.replace("container:", "");
         const containerName = typeof val === "object" ? val.container_name : undefined;
         const label = containerName ? `Container ${containerName}` : `Container #${id}`;
         parts.push(total === 1 && n === 1 ? `In ${label}` : `${n} in ${label}`);
      }
   }

   if (parts.length === 0) {
      return "";
   }
   if (parts.length === 1 && total > 1) {
      const one = parts[0];
      return one.replace(/^\d+ in /i, "All in ");
   }
   return parts.join(", ");
};

/**
 * Update order status based on its parcels' current statuses
 * Call this function whenever a parcel status changes
 */
export const updateOrderStatusFromParcels = async (order_id: number): Promise<Status> => {
   const parcels = await prisma.parcel.findMany({
      where: { order_id },
      select: {
         status: true,
         dispatch_id: true,
         container_id: true,
         container: { select: { container_name: true } },
      },
   });

   const parcelStatuses = parcels.map((p) => p.status);
   const newOrderStatus = calculateOrderStatus(parcelStatuses);
   const statusDetails = buildOrderStatusDetails(parcels);

   await prisma.order.update({
      where: { id: order_id },
      data: { status: newOrderStatus, status_details: statusDetails || null },
   });

   return newOrderStatus;
};

/**
 * Update order status based on its parcels' current statuses (transaction-aware)
 */
export const updateOrderStatusFromParcelsTx = async (
   tx: Prisma.TransactionClient,
   order_id: number
): Promise<Status> => {
   const parcels = await tx.parcel.findMany({
      where: { order_id },
      select: {
         status: true,
         dispatch_id: true,
         container_id: true,
         container: { select: { container_name: true } },
      },
   });

   const parcelStatuses = parcels.map((p) => p.status);
   const newOrderStatus = calculateOrderStatus(parcelStatuses);
   const statusDetails = buildOrderStatusDetails(parcels);

   await tx.order.update({
      where: { id: order_id },
      data: { status: newOrderStatus, status_details: statusDetails || null },
   });

   return newOrderStatus;
};

/**
 * Bulk update: Update order status for multiple orders
 * Useful when updating container/flight status affects many orders
 */
export const updateMultipleOrdersStatus = async (order_ids: number[]): Promise<void> => {
   // Use Promise.all for parallel execution
   await Promise.all(order_ids.map((id) => updateOrderStatusFromParcels(id)));
};

/**
 * Bulk update: Update order status for multiple orders (transaction-aware)
 */
export const updateMultipleOrdersStatusTx = async (
   tx: Prisma.TransactionClient,
   order_ids: number[]
): Promise<void> => {
   await Promise.all(order_ids.map((id) => updateOrderStatusFromParcelsTx(tx, id)));
};

/**
 * Update order status from a parcel ID
 * Convenience function when you have the parcel but not the order
 */
export const updateOrderStatusFromParcel = async (parcel_id: number): Promise<Status | null> => {
   const parcel = await prisma.parcel.findUnique({
      where: { id: parcel_id },
      select: { order_id: true },
   });

   if (!parcel?.order_id) {
      return null;
   }

   return updateOrderStatusFromParcels(parcel.order_id);
};

/**
 * Update order status from a parcel ID (transaction-aware)
 */
export const updateOrderStatusFromParcelTx = async (
   tx: Prisma.TransactionClient,
   parcel_id: number
): Promise<Status | null> => {
   const parcel = await tx.parcel.findUnique({
      where: { id: parcel_id },
      select: { order_id: true },
   });

   if (!parcel?.order_id) {
      return null;
   }

   return updateOrderStatusFromParcelsTx(tx, parcel.order_id);
};

/**
 * Get a human-readable status summary for an order
 */
export const getOrderStatusSummary = async (
   order_id: number
): Promise<{
   order_status: Status;
   parcels_count: number;
   status_breakdown: Record<string, number>;
}> => {
   const parcels = await prisma.parcel.findMany({
      where: { order_id },
      select: { status: true },
   });

   const statusBreakdown: Record<string, number> = {};
   for (const parcel of parcels) {
      statusBreakdown[parcel.status] = (statusBreakdown[parcel.status] || 0) + 1;
   }

   const parcelStatuses = parcels.map((p) => p.status);
   const orderStatus = calculateOrderStatus(parcelStatuses);

   return {
      order_status: orderStatus,
      parcels_count: parcels.length,
      status_breakdown: statusBreakdown,
   };
};
