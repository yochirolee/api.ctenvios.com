import prisma from "../lib/prisma.client";
import { Parcel, Status } from "@prisma/client";

const listSelect = {
   id: true,
   tracking_number: true,
   description: true,
   weight: true,
   status: true,
   created_at: true,
   updated_at: true,
} as const;

const parcels = {
   get: async (page: number, limit: number): Promise<Parcel[]> => {
      return await prisma.parcel.findMany({
         take: limit,
         skip: (page - 1) * limit,
         orderBy: { tracking_number: "asc" },
      });
   },
   getWithEvents: async (page = 1, limit = 10) => {
      return await prisma.parcel.findMany({
         include: { events: true },
         orderBy: { updated_at: "desc" },
         take: limit,
         skip: (page - 1) * limit,
      });
   },

   /** Paginated list with optional status filter (data access only) */
   getAllPaginated: async (
      where: { status?: Status },
      page: number,
      limit: number
   ): Promise<{ rows: Array<Pick<Parcel, "id" | "tracking_number" | "description" | "weight" | "status" | "created_at" | "updated_at">>; total: number }> => {
      const [rows, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { created_at: "desc" },
            select: listSelect,
         }),
         prisma.parcel.count({ where }),
      ]);
      return { rows, total };
   },

   /** Get parcel by HBL with full details for admin (data access only) */
   getByHblWithDetails: async (hbl: string) => {
      return await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         include: {
            agency: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
            order: {
               select: {
                  id: true,
                  receiver: {
                     select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        second_last_name: true,
                        phone: true,
                        address: true,
                     },
                  },
               },
            },
            order_items: true,
            container: { select: { id: true, container_name: true, container_number: true, status: true } },
            flight: { select: { id: true, awb_number: true, flight_number: true, status: true } },
            dispatch: { select: { id: true, status: true } },
         },
      });
   },

   /** Get parcels by order ID with service (data access only) */
   getByOrderId: async (
      orderId: number,
      page = 1,
      limit = 10
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where: { order_id: orderId },
            orderBy: { tracking_number: "asc" },
            take: limit,
            skip: (page - 1) * limit,
            include: {
               service: { select: { id: true, name: true } },
            },
         }),
         prisma.parcel.count({ where: { order_id: orderId } }),
      ]);
      return { parcels, total };
   },

   /** Get parcel events by HBL; returns null if parcel not found (data access only) */
   getEventsByHbl: async (hbl: string) => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         select: { id: true },
      });
      if (!parcel) return null;
      return await prisma.parcelEvent.findMany({
         where: { parcel_id: parcel.id },
         orderBy: { created_at: "desc" },
         include: {
            user: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
            dispatch: { select: { id: true } },
            container: { select: { id: true, container_name: true, container_number: true } },
            flight: { select: { id: true, awb_number: true, flight_number: true } },
         },
      });
   },

   /** Public tracking view by HBL; returns null if not found (data access only) */
   getTrackByHbl: async (hbl: string) => {
      return await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         select: {
            tracking_number: true,
            status: true,
            description: true,
            weight: true,
            created_at: true,
            order: {
               select: {
                  id: true,
                  receiver: {
                     select: {
                        first_name: true,
                        last_name: true,
                        province: { select: { name: true } },
                        city: { select: { name: true } },
                     },
                  },
               },
            },
            container: {
               select: {
                  container_name: true,
                  status: true,
                  estimated_arrival: true,
               },
            },
            flight: {
               select: {
                  flight_number: true,
                  status: true,
                  estimated_arrival: true,
               },
            },
            events: {
               orderBy: { created_at: "desc" },
               select: {
                  status: true,
                  notes: true,
                  created_at: true,
                  location: { select: { name: true } },
               },
            },
         },
      });
   },

   getInAgency: async (
      agency_id: number,
      page = 1,
      limit = 10
   ): Promise<{
      rows: Array<Pick<Parcel, "id" | "external_reference" | "tracking_number" | "description" | "weight" | "agency_id" | "service_id" | "status" | "order_id" | "dispatch_id">>;
      total: number;
   }> => {
      const where = { agency_id, dispatch_id: null };
      const [rows, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            orderBy: { tracking_number: "asc" },
            take: limit,
            skip: (page - 1) * limit,
            select: {
               id: true,
               tracking_number: true,
               external_reference: true,
               description: true,
               weight: true,
               agency_id: true,
               service_id: true,
               status: true,
               order_id: true,
               dispatch_id: true,
            },
         }),
         prisma.parcel.count({ where }),
      ]);
      return { rows, total };
   },

   /** Update parcel status and create STATUS_CORRECTED event in a transaction (data access only). Returns null if parcel not found. */
   updateStatusWithEvent: async (
      hbl: string,
      status: Status,
      notes: string | null,
      user_id: string
   ): Promise<Parcel | null> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number: hbl },
         select: { id: true },
      });
      if (!parcel) return null;

      return await prisma.$transaction(async (tx) => {
         const updated = await tx.parcel.update({
            where: { tracking_number: hbl },
            data: { status },
         });
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: "STATUS_CORRECTED",
               user_id,
               status,
               notes,
            },
         });
         return updated;
      });
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
