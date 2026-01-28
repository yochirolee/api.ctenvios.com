import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import { Flight, FlightStatus, Parcel, ParcelEventType, Prisma, Status } from "@prisma/client";
import { AppError } from "../common/app-errors";
import { getEventTypeForFlightStatus } from "../utils/parcel-event-visibility";
import { updateOrderStatusFromParcel, updateMultipleOrdersStatus } from "../utils/order-status-calculator";

// Allowed statuses for parcels to be added to flight
const ALLOWED_FLIGHT_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.RECEIVED_IN_DISPATCH,
   Status.IN_WAREHOUSE,
];

/**
 * Validates if a parcel status allows it to be added to flight
 */
const isValidStatusForFlight = (status: Status): boolean => {
   return ALLOWED_FLIGHT_STATUSES.includes(status);
};

const flights = {
   /**
    * Get all flights with pagination
    */
   getAll: async (
      page: number,
      limit: number,
      forwarder_id?: number,
      status?: FlightStatus
   ): Promise<{ flights: Flight[]; total: number }> => {
      const where: Prisma.FlightWhereInput = {};

      if (forwarder_id) {
         where.forwarder_id = forwarder_id;
      }

      if (status) {
         where.status = status;
      }

      const [flights, total] = await Promise.all([
         prisma.flight.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            include: {
               forwarder: {
                  select: { id: true, name: true },
               },
               provider: {
                  select: { id: true, name: true },
               },
               created_by: {
                  select: { id: true, name: true },
               },
               _count: {
                  select: { parcels: true },
               },
            },
            orderBy: { created_at: "desc" },
         }),
         prisma.flight.count({ where }),
      ]);

      return { flights, total };
   },

   /**
    * Get flight by ID with full details
    */
   getById: async (id: number): Promise<Flight | null> => {
      const flight = await prisma.flight.findUnique({
         where: { id },
         include: {
            forwarder: {
               select: { id: true, name: true },
            },
            provider: {
               select: { id: true, name: true },
            },
            created_by: {
               select: { id: true, name: true },
            },
            events: {
               orderBy: { created_at: "desc" },
               include: {
                  created_by: {
                     select: { id: true, name: true },
                  },
               },
            },
            _count: {
               select: { parcels: true },
            },
         },
      });

      return flight;
   },

   /**
    * Get flight by AWB number
    */
   getByAwbNumber: async (awb_number: string): Promise<Flight | null> => {
      const flight = await prisma.flight.findUnique({
         where: { awb_number },
         include: {
            forwarder: {
               select: { id: true, name: true },
            },
            provider: {
               select: { id: true, name: true },
            },
         },
      });

      return flight;
   },

   /**
    * Create a new flight
    */
   create: async (data: Prisma.FlightUncheckedCreateInput): Promise<Flight> => {
      const flight = await prisma.$transaction(async (tx) => {
         const created = await tx.flight.create({
            data,
            include: {
               forwarder: {
                  select: { id: true, name: true },
               },
               provider: {
                  select: { id: true, name: true },
               },
            },
         });

         // Create initial event
         await tx.flightEvent.create({
            data: {
               flight_id: created.id,
               status: created.status,
               description: "Flight created",
               created_by_id: data.created_by_id,
            },
         });

         return created;
      });

      return flight;
   },

   /**
    * Update flight
    */
   update: async (id: number, data: Prisma.FlightUncheckedUpdateInput, user_id?: string): Promise<Flight> => {
      const flight = await prisma.$transaction(async (tx) => {
         const current = await tx.flight.findUnique({ where: { id } });

         if (!current) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Flight with id ${id} not found`);
         }

         const updated = await tx.flight.update({
            where: { id },
            data,
            include: {
               forwarder: {
                  select: { id: true, name: true },
               },
               provider: {
                  select: { id: true, name: true },
               },
            },
         });

         // Create event if status changed
         if (data.status && data.status !== current.status && user_id) {
            await tx.flightEvent.create({
               data: {
                  flight_id: id,
                  status: data.status as FlightStatus,
                  description: `Status changed from ${current.status} to ${data.status}`,
                  created_by_id: user_id,
               },
            });
         }

         return updated;
      });

      return flight;
   },

   /**
    * Delete flight (only if empty and PENDING)
    */
   delete: async (id: number): Promise<Flight> => {
      const flight = await prisma.flight.findUnique({
         where: { id },
         include: { _count: { select: { parcels: true } } },
      });

      if (!flight) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Flight with id ${id} not found`);
      }

      if (flight._count.parcels > 0) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Cannot delete flight with parcels. Remove all parcels first."
         );
      }

      if (flight.status !== FlightStatus.PENDING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot delete flight with status ${flight.status}. Only PENDING flights can be deleted.`
         );
      }

      const deleted = await prisma.flight.delete({ where: { id } });
      return deleted;
   },

   /**
    * Get parcels in flight with pagination
    */
   getParcels: async (
      flight_id: number,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where: { flight_id },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { updated_at: "desc" },
         }),
         prisma.parcel.count({ where: { flight_id } }),
      ]);

      return { parcels, total };
   },

   /**
    * Add parcel to flight
    */
   addParcel: async (flight_id: number, tracking_number: string, user_id: string): Promise<Parcel> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
         include: {
            service: { select: { service_type: true, name: true } },
         },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      // Check if parcel's order has been deleted
      if (parcel.deleted_at) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot add parcel ${tracking_number} - its order has been deleted`
         );
      }

      // Validate service type - only AIR parcels can be added to flights
      if (parcel.service?.service_type !== "AIR") {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel ${tracking_number} uses ${parcel.service?.name || "MARITIME"} service (${parcel.service?.service_type}). ` +
               `Only AIR parcels can be added to flights. Use containers for MARITIME parcels.`
         );
      }

      if (!isValidStatusForFlight(parcel.status)) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel with status ${
               parcel.status
            } cannot be added to flight. Allowed statuses: ${ALLOWED_FLIGHT_STATUSES.join(", ")}`
         );
      }

      if (parcel.flight_id) {
         throw new AppError(
            HttpStatusCodes.CONFLICT,
            `Parcel ${tracking_number} is already in flight ${parcel.flight_id}`
         );
      }

      if (parcel.container_id) {
         throw new AppError(
            HttpStatusCodes.CONFLICT,
            `Parcel ${tracking_number} is already in container ${parcel.container_id}`
         );
      }

      const flight = await prisma.flight.findUnique({ where: { id: flight_id } });

      if (!flight) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Flight with id ${flight_id} not found`);
      }

      if (flight.status !== FlightStatus.PENDING && flight.status !== FlightStatus.LOADING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot add parcels to flight with status ${flight.status}. Flight must be PENDING or LOADING.`
         );
      }

      const updatedParcel = await prisma.$transaction(async (tx) => {
         // Update parcel
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               flight_id,
               status: Status.IN_TRANSIT, // Air cargo goes directly to IN_TRANSIT
            },
         });

         // Create parcel event with flight reference
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.LOADED_TO_FLIGHT,
               user_id,
               status: Status.IN_TRANSIT,
               flight_id,
               notes: `Added to flight ${flight.awb_number}`,
            },
         });

         // Update flight totals and status
         await tx.flight.update({
            where: { id: flight_id },
            data: {
               total_weight_kg: {
                  increment: parcel.weight,
               },
               total_pieces: {
                  increment: 1,
               },
               status: FlightStatus.LOADING,
            },
         });

         return updated;
      });

      // Update order status based on parcel changes
      await updateOrderStatusFromParcel(parcel.id);

      return updatedParcel;
   },

   /**
    * Remove parcel from flight
    */
   removeParcel: async (flight_id: number, tracking_number: string, user_id: string): Promise<Parcel> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      if (parcel.flight_id !== flight_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Parcel ${tracking_number} is not in flight ${flight_id}`);
      }

      const flight = await prisma.flight.findUnique({ where: { id: flight_id } });

      if (!flight) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Flight with id ${flight_id} not found`);
      }

      // Only allow removal if flight is PENDING or LOADING
      if (flight.status !== FlightStatus.PENDING && flight.status !== FlightStatus.LOADING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot remove parcels from flight with status ${flight.status}. Flight must be PENDING or LOADING.`
         );
      }

      const updatedParcel = await prisma.$transaction(async (tx) => {
         // Update parcel
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               flight_id: null,
               status: Status.IN_WAREHOUSE,
            },
         });

         // Create parcel event with flight reference
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.REMOVED_FROM_FLIGHT,
               user_id,
               status: Status.IN_WAREHOUSE,
               flight_id, // Keep reference to which flight it was removed from
               notes: `Removed from flight ${flight.awb_number}`,
            },
         });

         // Update flight totals
         await tx.flight.update({
            where: { id: flight_id },
            data: {
               total_weight_kg: {
                  decrement: parcel.weight,
               },
               total_pieces: {
                  decrement: 1,
               },
            },
         });

         return updated;
      });

      // Update order status based on parcel changes
      await updateOrderStatusFromParcel(parcel.id);

      return updatedParcel;
   },

   /**
    * Update flight status with event tracking
    */
   updateStatus: async (
      id: number,
      status: FlightStatus,
      user_id: string,
      location?: string,
      description?: string
   ): Promise<Flight> => {
      const flight = await prisma.flight.findUnique({ where: { id } });

      if (!flight) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Flight with id ${id} not found`);
      }

      const updated = await prisma.$transaction(async (tx) => {
         // Update flight status
         const updatedFlight = await tx.flight.update({
            where: { id },
            data: {
               status,
               ...(status === FlightStatus.DEPARTED && { actual_departure: new Date() }),
               ...(status === FlightStatus.LANDED && { actual_arrival: new Date() }),
            },
         });

         // Create event
         await tx.flightEvent.create({
            data: {
               flight_id: id,
               status,
               location,
               description: description || `Status changed to ${status}`,
               created_by_id: user_id,
            },
         });

         // Update parcels status based on flight status
         const parcels = await tx.parcel.findMany({
            where: { flight_id: id },
            select: { id: true, order_id: true },
         });

         // Map flight status to parcel status
         const flightToParcelStatus: Partial<Record<FlightStatus, Status>> = {
            [FlightStatus.DEPARTED]: Status.IN_TRANSIT,
            [FlightStatus.IN_TRANSIT]: Status.IN_TRANSIT,
            [FlightStatus.LANDED]: Status.AT_PORT_OF_ENTRY,
            [FlightStatus.CUSTOMS_HOLD]: Status.CUSTOMS_INSPECTION,
            [FlightStatus.CUSTOMS_CLEARED]: Status.RELEASED_FROM_CUSTOMS,
         };

         const newParcelStatus = flightToParcelStatus[status];

         if (newParcelStatus && parcels.length > 0) {
            for (const parcel of parcels) {
               await tx.parcel.update({
                  where: { id: parcel.id },
                  data: { status: newParcelStatus },
               });

               await tx.parcelEvent.create({
                  data: {
                     parcel_id: parcel.id,
                     event_type: getEventTypeForFlightStatus(status),
                     user_id,
                     status: newParcelStatus,
                     flight_id: id,
                     notes: `Flight ${flight.awb_number} - ${status}${location ? ` at ${location}` : ""}`,
                  },
               });
            }
         }

         // Collect unique order IDs to update
         const orderIds = [...new Set(parcels.map((p) => p.order_id).filter((id): id is number => id !== null))];

         return { updatedFlight, orderIds };
      });

      // Update order statuses based on parcel changes
      if (updated.orderIds.length > 0) {
         await updateMultipleOrdersStatus(updated.orderIds);
      }

      return updated.updatedFlight;
   },

   /**
    * Get flight events
    */
   getEvents: async (flight_id: number): Promise<any[]> => {
      const events = await prisma.flightEvent.findMany({
         where: { flight_id },
         orderBy: { created_at: "desc" },
         include: {
            created_by: {
               select: { id: true, name: true },
            },
         },
      });

      return events;
   },

   /**
    * Get parcels ready to be added to flight (by forwarder)
    */
   getReadyParcels: async (
      forwarder_id: number,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const where: Prisma.ParcelWhereInput = {
         container_id: null,
         flight_id: null,
         status: {
            in: ALLOWED_FLIGHT_STATUSES,
         },
         agency: {
            forwarder_id,
         },
         // Only air service parcels
         service: {
            service_type: "AIR",
         },
      };

      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { updated_at: "desc" },
            include: {
               agency: {
                  select: { id: true, name: true },
               },
               service: {
                  select: { id: true, name: true },
               },
            },
         }),
         prisma.parcel.count({ where }),
      ]);

      return { parcels, total };
   },
};

export default flights;
