import prisma from "../lib/prisma.client";
import { Parcel, Status } from "@prisma/client";

const parcels = {
   get: async (page: number, limit: number): Promise<Parcel[]> => {
      return await prisma.parcel.findMany({
         take: limit,
         skip: (page - 1) * limit,
         orderBy: {
            tracking_number: "asc",
         },
      });
   },
   getWithEvents: async (page = 1, limit = 10) => {
      return await prisma.parcel.findMany({
         include: {
            events: true,
         },
         orderBy: {
            updated_at: "desc",
         },
         take: limit,
         skip: (page - 1) * limit,
      });
   },
   getInAgency: async (agency_id: number, page = 1, limit = 10) => {
      const parcels = await prisma.parcel.findMany({
         where: { agency_id, dispatch_id: null },
         orderBy: {
            tracking_number: "asc",
         },
         take: limit,
         skip: (page - 1) * limit,
         select: {
            id: true,
            tracking_number: true,
            description: true,
            weight: true,
            agency_id: true,
            service_id: true,
            status: true,
            order_id: true,
            dispatch_id: true,
         },
      });
      const total = await prisma.parcel.count({
         where: { agency_id, dispatch_id: null },
      });
      return { parcels, total };
   },
   findParcelByHbl: async (hbl: string) => {
      return await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         select: {
            id: true,
            tracking_number: true,
            description: true,
            weight: true,
            agency_id: true,
            service_id: true,
            dispatch_id: true,
            current_location_id: true,
            status: true,
         },
      });
   },
   getByOrderId: async (orderId: number, page = 1, limit = 10): Promise<{ parcels: Parcel[]; total: number }> => {
      const parcels = await prisma.parcel.findMany({
      where: { order_id: orderId },
      orderBy: { tracking_number: "asc" },
      take: limit,
      skip: (page - 1) * limit,
      });
   const total = await prisma.parcel.count({ where: { order_id: orderId } });
   return { parcels, total };
   },

   /**
    * Gets the previous status of a parcel before it was added to dispatch
    * by querying ParcelEvent history in reverse chronological order
    * Skips both IN_DISPATCH and RECEIVED_IN_DISPATCH statuses
    */
   getPreviousStatus: async (parcelId: number): Promise<Status | null> => {
      // Statuses to skip when looking for previous status (dispatch-related statuses)
      const DISPATCH_STATUSES: Status[] = [Status.IN_DISPATCH, Status.RECEIVED_IN_DISPATCH];

      // Get all events for this parcel, ordered by created_at descending
      const events = await prisma.parcelEvent.findMany({
         where: { parcel_id: parcelId },
         orderBy: { created_at: "desc" },
         select: {
            status: true,
            created_at: true,
         },
      });

      if (events.length === 0) {
         return null;
      }

      // Find the first status that is NOT a dispatch-related status
      for (const event of events) {
         if (!DISPATCH_STATUSES.includes(event.status)) {
            return event.status;
         }
      }

      // If all events are dispatch-related, return IN_AGENCY as default
      return Status.IN_AGENCY;
   },
};

export default parcels;
