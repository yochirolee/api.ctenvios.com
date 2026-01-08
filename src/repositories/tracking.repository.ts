import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import { ParcelEventType, Status } from "@prisma/client";
import { AppError } from "../common/app-errors";
import { filterPublicEvents, getPublicMessage } from "../utils/parcel-event-visibility";

/**
 * Tracking Repository
 * Following: Repository pattern, TypeScript strict typing
 */

interface PublicTrackingEvent {
   timestamp: Date;
   status: string;
   location?: string;
}

interface PublicTrackingResponse {
   parcel: {
      tracking_number: string;
      description: string;
      weight: number;
      current_status: string;
      current_location: string | null;
   };
   receiver: {
      name: string;
      province: string;
      city: string;
   };
   timeline: PublicTrackingEvent[];
   estimated_delivery?: Date | null;
}

interface InternalTrackingEvent {
   timestamp: Date;
   event_type: ParcelEventType;
   status: Status;
   description: string | null;
   location: string | null;
   actor: { id: string; name: string };
   references: {
      pallet_number?: string;
      dispatch_id?: number;
      container_number?: string;
      flight_awb?: string;
      warehouse_name?: string;
   };
   notes: string | null;
}

interface InternalTrackingResponse {
   parcel: {
      id: number;
      tracking_number: string;
      description: string;
      weight: number;
      current_status: Status;
      current_location: string | null;
      service_type: string | null;
   };
   order: {
      id: number;
      customer: { name: string; phone: string | null };
      receiver: {
         name: string;
         address: string;
         province: string;
         city: string;
         ci: string;
         mobile: string | null;
         phone: string | null;
      };
   } | null;
   timeline: InternalTrackingEvent[];
   transport: {
      type: "CONTAINER" | "FLIGHT" | null;
      reference: string | null;
      status: string | null;
   } | null;
   delivery_info: {
      messenger: { name: string; phone: string | null } | null;
      route_number: string | null;
      status: string | null;
      attempts: number;
      last_attempt: Date | null;
   } | null;
}

const tracking = {
   /**
    * Get public tracking (for customers - only public events)
    */
   getPublicTracking: async (tracking_number: string): Promise<PublicTrackingResponse> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
         include: {
            current_location: {
               select: { name: true },
            },
            order: {
               select: {
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
            events: {
               orderBy: { created_at: "desc" },
               include: {
                  location: { select: { name: true } },
               },
            },
            container: {
               select: { estimated_arrival: true },
            },
            flight: {
               select: { estimated_arrival: true },
            },
         },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      // Filter only public events
      const publicEvents = filterPublicEvents(parcel.events);

      // Map events to public format with friendly messages
      const timeline: PublicTrackingEvent[] = publicEvents.map((event) => ({
         timestamp: event.created_at,
         status: getPublicMessage(event.event_type),
         location: event.location?.name,
      }));

      // Get current status message
      const currentStatusEvent = publicEvents[0];
      const currentStatusMessage = currentStatusEvent
         ? getPublicMessage(currentStatusEvent.event_type)
         : "En proceso";

      return {
         parcel: {
            tracking_number: parcel.tracking_number,
            description: parcel.description,
            weight: Number(parcel.weight),
            current_status: currentStatusMessage,
            current_location: parcel.current_location?.name || null,
         },
         receiver: {
            name: parcel.order
               ? `${parcel.order.receiver.first_name} ${parcel.order.receiver.last_name}`
               : "N/A",
            province: parcel.order?.receiver.province.name || "N/A",
            city: parcel.order?.receiver.city.name || "N/A",
         },
         timeline,
         estimated_delivery: parcel.container?.estimated_arrival || parcel.flight?.estimated_arrival || null,
      };
   },

   /**
    * Get full internal tracking (for staff - all events)
    */
   getInternalTracking: async (tracking_number: string): Promise<InternalTrackingResponse> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
         include: {
            service: {
               select: { name: true, service_type: true },
            },
            current_location: {
               select: { name: true },
            },
            current_warehouse: {
               select: { id: true, name: true },
            },
            order: {
               select: {
                  id: true,
                  customer: {
                     select: {
                        first_name: true,
                        last_name: true,
                        mobile: true,
                     },
                  },
                  receiver: {
                     select: {
                        first_name: true,
                        last_name: true,
                        address: true,
                        ci: true,
                        mobile: true,
                        phone: true,
                        province: { select: { name: true } },
                        city: { select: { name: true } },
                     },
                  },
               },
            },
            pallet: {
               select: { pallet_number: true },
            },
            container: {
               select: {
                  id: true,
                  container_number: true,
                  status: true,
                  estimated_arrival: true,
               },
            },
            flight: {
               select: {
                  id: true,
                  awb_number: true,
                  status: true,
                  estimated_arrival: true,
               },
            },
            delivery_assignment: {
               include: {
                  messenger: {
                     select: { id: true, name: true, phone: true },
                  },
                  route: {
                     select: { route_number: true, status: true },
                  },
               },
            },
            events: {
               orderBy: { created_at: "desc" },
               include: {
                  user: { select: { id: true, name: true } },
                  location: { select: { name: true } },
                  pallet: { select: { pallet_number: true } },
                  dispatch: { select: { id: true } },
                  container: { select: { container_number: true } },
                  flight: { select: { awb_number: true } },
                  warehouse: { select: { name: true } },
               },
            },
         },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      // Map all events to internal format
      const timeline: InternalTrackingEvent[] = parcel.events.map((event) => ({
         timestamp: event.created_at,
         event_type: event.event_type,
         status: event.status,
         description: event.description,
         location: event.location?.name || null,
         actor: {
            id: event.user.id,
            name: event.user.name,
         },
         references: {
            pallet_number: event.pallet?.pallet_number,
            dispatch_id: event.dispatch?.id,
            container_number: event.container?.container_number,
            flight_awb: event.flight?.awb_number,
            warehouse_name: event.warehouse?.name,
         },
         notes: event.notes,
      }));

      // Determine transport info
      let transport: InternalTrackingResponse["transport"] = null;
      if (parcel.container) {
         transport = {
            type: "CONTAINER",
            reference: parcel.container.container_number,
            status: parcel.container.status,
         };
      } else if (parcel.flight) {
         transport = {
            type: "FLIGHT",
            reference: parcel.flight.awb_number,
            status: parcel.flight.status,
         };
      }

      // Get delivery info
      let delivery_info: InternalTrackingResponse["delivery_info"] = null;
      if (parcel.delivery_assignment) {
         const assignment = parcel.delivery_assignment;
         delivery_info = {
            messenger: assignment.messenger
               ? { name: assignment.messenger.name, phone: assignment.messenger.phone }
               : null,
            route_number: assignment.route?.route_number || null,
            status: assignment.status,
            attempts: assignment.attempts,
            last_attempt: assignment.last_attempt_at,
         };
      }

      return {
         parcel: {
            id: parcel.id,
            tracking_number: parcel.tracking_number,
            description: parcel.description,
            weight: Number(parcel.weight),
            current_status: parcel.status,
            current_location: parcel.current_location?.name || parcel.current_warehouse?.name || null,
            service_type: parcel.service?.service_type || null,
         },
         order: parcel.order
            ? {
                 id: parcel.order.id,
                 customer: {
                    name: `${parcel.order.customer.first_name} ${parcel.order.customer.last_name}`,
                    phone: parcel.order.customer.mobile,
                 },
                 receiver: {
                    name: `${parcel.order.receiver.first_name} ${parcel.order.receiver.last_name}`,
                    address: parcel.order.receiver.address,
                    province: parcel.order.receiver.province.name,
                    city: parcel.order.receiver.city.name,
                    ci: parcel.order.receiver.ci,
                    mobile: parcel.order.receiver.mobile,
                    phone: parcel.order.receiver.phone,
                 },
              }
            : null,
         timeline,
         transport,
         delivery_info,
      };
   },

   /**
    * Search parcels by tracking number (partial match)
    */
   searchByTrackingNumber: async (
      query: string,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: any[]; total: number }> => {
      const where = {
         tracking_number: {
            contains: query,
            mode: "insensitive" as const,
         },
      };

      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { created_at: "desc" },
            select: {
               id: true,
               tracking_number: true,
               description: true,
               weight: true,
               status: true,
               created_at: true,
               order: {
                  select: {
                     id: true,
                     receiver: {
                        select: {
                           first_name: true,
                           last_name: true,
                           province: { select: { name: true } },
                        },
                     },
                  },
               },
               service: {
                  select: { name: true, service_type: true },
               },
            },
         }),
         prisma.parcel.count({ where }),
      ]);

      return { parcels, total };
   },

   /**
    * Get parcel location history (for map visualization)
    */
   getLocationHistory: async (tracking_number: string): Promise<any[]> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      const events = await prisma.parcelEvent.findMany({
         where: { parcel_id: parcel.id },
         orderBy: { created_at: "asc" },
         select: {
            created_at: true,
            event_type: true,
            status: true,
            location: {
               select: { id: true, name: true },
            },
            warehouse: {
               select: {
                  id: true,
                  name: true,
                  province: { select: { name: true } },
               },
            },
            container: {
               select: { origin_port: true, destination_port: true },
            },
            flight: {
               select: { origin_airport: true, destination_airport: true },
            },
         },
      });

      return events;
   },

   /**
    * Get last scan info (who and when)
    */
   getLastScanInfo: async (
      tracking_number: string
   ): Promise<{ timestamp: Date; user: { id: string; name: string }; event_type: ParcelEventType } | null> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      const lastEvent = await prisma.parcelEvent.findFirst({
         where: { parcel_id: parcel.id },
         orderBy: { created_at: "desc" },
         select: {
            created_at: true,
            event_type: true,
            user: {
               select: { id: true, name: true },
            },
         },
      });

      if (!lastEvent) {
         return null;
      }

      return {
         timestamp: lastEvent.created_at,
         user: lastEvent.user,
         event_type: lastEvent.event_type,
      };
   },
};

export default tracking;
