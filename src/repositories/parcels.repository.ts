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

   /**
    * Gets the previous status of a parcel before it was set to IN_DISPATCH
    * by querying ParcelEvent history in reverse chronological order
    */
   getPreviousStatus: async (parcelId: number): Promise<Status | null> => {
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

      // Find the status before the first IN_DISPATCH event
      // Skip the most recent event if it's IN_DISPATCH
      let startIndex = 0;
      if (events.length > 0 && events[0].status === Status.IN_DISPATCH) {
         startIndex = 1;
      }

      // Return the first non-IN_DISPATCH status we find
      for (let i = startIndex; i < events.length; i++) {
         if (events[i].status !== Status.IN_DISPATCH) {
            return events[i].status;
         }
      }

      // If all events are IN_DISPATCH or no previous status found, return IN_AGENCY as default
      return Status.IN_AGENCY;
   },
};

export default parcels;
