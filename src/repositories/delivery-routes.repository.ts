import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import {
   DeliveryAssignment,
   DeliveryRoute,
   DeliveryStatus,
   ParcelEventType,
   Prisma,
   RouteStatus,
   Status,
} from "@prisma/client";
import { AppError } from "../common/app-errors";
import { updateOrderStatusFromParcel, updateOrderStatusFromParcels, updateMultipleOrdersStatus } from "../utils/order-status-calculator";
import { buildParcelStatusDetails } from "../utils/parcel-status-details";

/**
 * Delivery Routes Repository
 * Following: Repository pattern, TypeScript strict typing
 */

/**
 * Generate a unique route number
 */
const generateRouteNumber = async (carrier_id: number): Promise<string> => {
   const date = new Date();
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, "0");
   const day = String(date.getDate()).padStart(2, "0");

   // Count routes for this carrier today
   const startOfDay = new Date(year, date.getMonth(), date.getDate());
   const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);

   const count = await prisma.deliveryRoute.count({
      where: {
         carrier_id,
         created_at: {
            gte: startOfDay,
            lt: endOfDay,
         },
      },
   });

   const sequence = String(count + 1).padStart(3, "0");
   return `RT-${carrier_id}-${year}${month}${day}-${sequence}`;
};

const deliveryRoutes = {
   /**
    * Get all routes with pagination
    */
   getAll: async (
      page: number,
      limit: number,
      carrier_id?: number,
      warehouse_id?: number,
      messenger_id?: string,
      status?: RouteStatus,
      scheduled_date?: Date
   ): Promise<{ routes: DeliveryRoute[]; total: number }> => {
      const where: Prisma.DeliveryRouteWhereInput = {};

      if (carrier_id) {
         where.carrier_id = carrier_id;
      }

      if (warehouse_id) {
         where.warehouse_id = warehouse_id;
      }

      if (messenger_id) {
         where.messenger_id = messenger_id;
      }

      if (status) {
         where.status = status;
      }

      if (scheduled_date) {
         const startOfDay = new Date(scheduled_date);
         startOfDay.setHours(0, 0, 0, 0);
         const endOfDay = new Date(scheduled_date);
         endOfDay.setHours(23, 59, 59, 999);

         where.scheduled_date = {
            gte: startOfDay,
            lte: endOfDay,
         };
      }

      const [routes, total] = await Promise.all([
         prisma.deliveryRoute.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            include: {
               carrier: {
                  select: { id: true, name: true },
               },
               warehouse: {
                  select: { id: true, name: true },
               },
               messenger: {
                  select: { id: true, name: true, phone: true },
               },
               province: {
                  select: { id: true, name: true },
               },
               created_by: {
                  select: { id: true, name: true },
               },
               _count: {
                  select: { assignments: true },
               },
            },
            orderBy: [{ scheduled_date: "desc" }, { created_at: "desc" }],
         }),
         prisma.deliveryRoute.count({ where }),
      ]);

      return { routes, total };
   },

   /**
    * Get route by ID with full details
    */
   getById: async (id: number): Promise<DeliveryRoute | null> => {
      const route = await prisma.deliveryRoute.findUnique({
         where: { id },
         include: {
            carrier: {
               select: { id: true, name: true },
            },
            warehouse: {
               select: { id: true, name: true },
            },
            messenger: {
               select: { id: true, name: true, phone: true },
            },
            province: {
               select: { id: true, name: true },
            },
            created_by: {
               select: { id: true, name: true },
            },
            assignments: {
               include: {
                  parcel: {
                     include: {
                        order: {
                           select: {
                              id: true,
                              receiver: {
                                 select: {
                                    first_name: true,
                                    last_name: true,
                                    address: true,
                                    mobile: true,
                                    city: { select: { name: true } },
                                 },
                              },
                           },
                        },
                     },
                  },
               },
               orderBy: { created_at: "asc" },
            },
         },
      });

      return route;
   },

   /**
    * Create a new route
    */
   create: async (data: {
      carrier_id: number;
      warehouse_id: number;
      messenger_id: string;
      province_id: number;
      scheduled_date: Date;
      notes?: string;
      created_by_id: string;
   }): Promise<DeliveryRoute> => {
      const route_number = await generateRouteNumber(data.carrier_id);

      const route = await prisma.deliveryRoute.create({
         data: {
            route_number,
            carrier_id: data.carrier_id,
            warehouse_id: data.warehouse_id,
            messenger_id: data.messenger_id,
            province_id: data.province_id,
            scheduled_date: data.scheduled_date,
            notes: data.notes,
            created_by_id: data.created_by_id,
         },
         include: {
            carrier: {
               select: { id: true, name: true },
            },
            warehouse: {
               select: { id: true, name: true },
            },
            messenger: {
               select: { id: true, name: true, phone: true },
            },
            province: {
               select: { id: true, name: true },
            },
         },
      });

      return route;
   },

   /**
    * Update route
    */
   update: async (id: number, data: Prisma.DeliveryRouteUncheckedUpdateInput): Promise<DeliveryRoute> => {
      const route = await prisma.deliveryRoute.findUnique({ where: { id } });

      if (!route) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Route with id ${id} not found`);
      }

      if (route.status !== RouteStatus.PLANNING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot update route with status ${route.status}. Route must be PLANNING.`
         );
      }

      const updated = await prisma.deliveryRoute.update({
         where: { id },
         data,
         include: {
            carrier: {
               select: { id: true, name: true },
            },
            warehouse: {
               select: { id: true, name: true },
            },
            messenger: {
               select: { id: true, name: true, phone: true },
            },
            province: {
               select: { id: true, name: true },
            },
         },
      });

      return updated;
   },

   /**
    * Delete route (only if PLANNING and empty)
    */
   delete: async (id: number): Promise<DeliveryRoute> => {
      const route = await prisma.deliveryRoute.findUnique({
         where: { id },
         include: { _count: { select: { assignments: true } } },
      });

      if (!route) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Route with id ${id} not found`);
      }

      if (route._count.assignments > 0) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Cannot delete route with assignments. Remove all assignments first."
         );
      }

      if (route.status !== RouteStatus.PLANNING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot delete route with status ${route.status}. Only PLANNING routes can be deleted.`
         );
      }

      const deleted = await prisma.deliveryRoute.delete({ where: { id } });
      return deleted;
   },

   /**
    * Add parcel to route
    */
   addParcelToRoute: async (route_id: number, parcel_id: number, user_id: string): Promise<DeliveryAssignment> => {
      const route = await prisma.deliveryRoute.findUnique({ where: { id: route_id } });

      if (!route) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Route with id ${route_id} not found`);
      }

      if (route.status !== RouteStatus.PLANNING && route.status !== RouteStatus.READY) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot add parcels to route with status ${route.status}. Route must be PLANNING or READY.`
         );
      }

      const parcel = await prisma.parcel.findUnique({
         where: { id: parcel_id },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with id ${parcel_id} not found`);
      }

      // Check if parcel is already assigned
      const existingAssignment = await prisma.deliveryAssignment.findUnique({
         where: { parcel_id },
      });

      if (existingAssignment) {
         throw new AppError(HttpStatusCodes.CONFLICT, `Parcel is already assigned to a delivery`);
      }

      // Parcel should be released from customs or in warehouse
      const allowedStatuses: Status[] = [Status.RELEASED_FROM_CUSTOMS, Status.IN_WAREHOUSE];
      if (!allowedStatuses.includes(parcel.status)) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel with status ${parcel.status} cannot be assigned for delivery. Must be RELEASED_FROM_CUSTOMS or IN_WAREHOUSE.`
         );
      }

      const statusDetails = buildParcelStatusDetails({
         status: parcel.status,
         dispatch_id: parcel.dispatch_id,
         container_id: parcel.container_id,
         pallet_id: parcel.pallet_id,
         flight_id: parcel.flight_id,
         current_warehouse_id: parcel.current_warehouse_id,
      });
      const assignment = await prisma.$transaction(async (tx) => {
         const created = await tx.deliveryAssignment.create({
            data: {
               parcel_id,
               route_id,
            },
         });

         await tx.parcelEvent.create({
            data: {
               parcel_id,
               event_type: ParcelEventType.ASSIGNED_TO_ROUTE,
               user_id,
               status: parcel.status,
               status_details: statusDetails,
               notes: `Assigned to route ${route.route_number}`,
            },
         });

         return created;
      });

      return assignment;
   },

   /**
    * Remove parcel from route
    */
   removeParcelFromRoute: async (route_id: number, parcel_id: number, user_id: string): Promise<void> => {
      const route = await prisma.deliveryRoute.findUnique({ where: { id: route_id } });

      if (!route) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Route with id ${route_id} not found`);
      }

      if (route.status !== RouteStatus.PLANNING && route.status !== RouteStatus.READY) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot remove parcels from route with status ${route.status}. Route must be PLANNING or READY.`
         );
      }

      const assignment = await prisma.deliveryAssignment.findFirst({
         where: { parcel_id, route_id },
      });

      if (!assignment) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel is not in this route`);
      }

      const statusDetails = buildParcelStatusDetails({ status: Status.IN_WAREHOUSE });
      await prisma.$transaction(async (tx) => {
         await tx.deliveryAssignment.delete({
            where: { id: assignment.id },
         });

         await tx.parcelEvent.create({
            data: {
               parcel_id,
               event_type: ParcelEventType.NOTE_ADDED,
               user_id,
               status: Status.IN_WAREHOUSE,
               status_details: statusDetails,
               notes: `Removed from route ${route.route_number}`,
            },
         });
      });
   },

   /**
    * Assign parcel directly to messenger (without route)
    */
   assignToMessenger: async (
      parcel_id: number,
      messenger_id: string,
      user_id: string
   ): Promise<DeliveryAssignment> => {
      const parcel = await prisma.parcel.findUnique({
         where: { id: parcel_id },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with id ${parcel_id} not found`);
      }

      // Check if parcel is already assigned
      const existingAssignment = await prisma.deliveryAssignment.findUnique({
         where: { parcel_id },
      });

      if (existingAssignment) {
         throw new AppError(HttpStatusCodes.CONFLICT, `Parcel is already assigned to a delivery`);
      }

      // Parcel should be released from customs or in warehouse
      const allowedStatuses: Status[] = [Status.RELEASED_FROM_CUSTOMS, Status.IN_WAREHOUSE];
      if (!allowedStatuses.includes(parcel.status)) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel with status ${parcel.status} cannot be assigned for delivery.`
         );
      }

      const messenger = await prisma.user.findUnique({
         where: { id: messenger_id },
         select: { id: true, name: true },
      });

      if (!messenger) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Messenger with id ${messenger_id} not found`);
      }

      const assignment = await prisma.$transaction(async (tx) => {
         const created = await tx.deliveryAssignment.create({
            data: {
               parcel_id,
               messenger_id,
            },
         });

         await tx.parcelEvent.create({
            data: {
               parcel_id,
               event_type: ParcelEventType.ASSIGNED_TO_MESSENGER,
               user_id,
               status: parcel.status,
               notes: `Assigned to messenger ${messenger.name}`,
            },
         });

         return created;
      });

      return assignment;
   },

   /**
    * Start route (mark as in progress)
    */
   startRoute: async (id: number, user_id: string): Promise<DeliveryRoute> => {
      const route = await prisma.deliveryRoute.findUnique({
         where: { id },
         include: { _count: { select: { assignments: true } } },
      });

      if (!route) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Route with id ${id} not found`);
      }

      if (route.status !== RouteStatus.READY) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot start route with status ${route.status}. Route must be READY.`
         );
      }

      if (route._count.assignments === 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot start route with no assignments");
      }

      const updated = await prisma.$transaction(async (tx) => {
         const result = await tx.deliveryRoute.update({
            where: { id },
            data: {
               status: RouteStatus.IN_PROGRESS,
               started_at: new Date(),
            },
         });

         // Update all assignments to OUT_FOR_DELIVERY
         const assignments = await tx.deliveryAssignment.findMany({
            where: { route_id: id },
            include: { parcel: { select: { order_id: true } } },
         });

         for (const assignment of assignments) {
            await tx.deliveryAssignment.update({
               where: { id: assignment.id },
               data: { status: DeliveryStatus.OUT_FOR_DELIVERY },
            });

            const statusDetails = buildParcelStatusDetails({ status: Status.OUT_FOR_DELIVERY });
            await tx.parcel.update({
               where: { id: assignment.parcel_id },
               data: {
                  status: Status.OUT_FOR_DELIVERY,
                  status_details: statusDetails,
               },
            });

            await tx.parcelEvent.create({
               data: {
                  parcel_id: assignment.parcel_id,
                  event_type: ParcelEventType.OUT_FOR_DELIVERY,
                  user_id,
                  status: Status.OUT_FOR_DELIVERY,
                  status_details: statusDetails,
                  notes: `Route ${route.route_number} started`,
               },
            });
         }

         // Collect unique order IDs
         const orderIds = [...new Set(
            assignments
               .map((a) => a.parcel.order_id)
               .filter((id): id is number => id !== null)
         )];

         return { result, orderIds };
      });

      // Update order statuses
      if (updated.orderIds.length > 0) {
         await updateMultipleOrdersStatus(updated.orderIds);
      }

      return updated.result;
   },

   /**
    * Mark route as ready
    */
   markAsReady: async (id: number): Promise<DeliveryRoute> => {
      const route = await prisma.deliveryRoute.findUnique({
         where: { id },
         include: { _count: { select: { assignments: true } } },
      });

      if (!route) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Route with id ${id} not found`);
      }

      if (route.status !== RouteStatus.PLANNING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot mark route as ready with status ${route.status}. Route must be PLANNING.`
         );
      }

      if (route._count.assignments === 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot mark route as ready with no assignments");
      }

      const updated = await prisma.deliveryRoute.update({
         where: { id },
         data: { status: RouteStatus.READY },
      });

      return updated;
   },

   /**
    * Record delivery attempt
    */
   recordDeliveryAttempt: async (
      assignment_id: number,
      user_id: string,
      success: boolean,
      data: {
         recipient_name?: string;
         recipient_ci?: string;
         signature?: string;
         photo_proof?: string;
         notes?: string;
      }
   ): Promise<DeliveryAssignment> => {
      const assignment = await prisma.deliveryAssignment.findUnique({
         where: { id: assignment_id },
         include: { route: true, parcel: { select: { order_id: true } } },
      });

      if (!assignment) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Assignment with id ${assignment_id} not found`);
      }

      if (assignment.status === DeliveryStatus.DELIVERED) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Parcel is already delivered");
      }

      const orderId = assignment.parcel.order_id;

      const updated = await prisma.$transaction(async (tx) => {
         const newStatus = success ? DeliveryStatus.DELIVERED : DeliveryStatus.FAILED;
         const parcelStatus = success ? Status.DELIVERED : Status.FAILED_DELIVERY;

         const result = await tx.deliveryAssignment.update({
            where: { id: assignment_id },
            data: {
               status: newStatus,
               attempts: { increment: 1 },
               last_attempt_at: new Date(),
               delivered_at: success ? new Date() : undefined,
               recipient_name: data.recipient_name,
               recipient_ci: data.recipient_ci,
               signature: data.signature,
               photo_proof: data.photo_proof,
               notes: data.notes,
            },
         });

         const statusDetails = buildParcelStatusDetails({ status: parcelStatus });
         await tx.parcel.update({
            where: { id: assignment.parcel_id },
            data: {
               status: parcelStatus,
               status_details: statusDetails,
            },
         });

         await tx.parcelEvent.create({
            data: {
               parcel_id: assignment.parcel_id,
               event_type: success ? ParcelEventType.DELIVERED : ParcelEventType.DELIVERY_FAILED,
               user_id,
               status: parcelStatus,
               status_details: statusDetails,
               notes: data.notes || (success ? "Delivered successfully" : "Delivery failed"),
            },
         });

         // Check if all assignments in route are completed
         if (assignment.route_id) {
            const pendingCount = await tx.deliveryAssignment.count({
               where: {
                  route_id: assignment.route_id,
                  status: { in: [DeliveryStatus.PENDING, DeliveryStatus.OUT_FOR_DELIVERY] },
               },
            });

            if (pendingCount === 0) {
               await tx.deliveryRoute.update({
                  where: { id: assignment.route_id },
                  data: {
                     status: RouteStatus.COMPLETED,
                     completed_at: new Date(),
                  },
               });
            }
         }

         return result;
      });

      // Update order status based on parcel changes
      if (orderId) {
         await updateOrderStatusFromParcels(orderId);
      }

      return updated;
   },

   /**
    * Reschedule failed delivery
    */
   rescheduleDelivery: async (
      assignment_id: number,
      user_id: string,
      notes?: string
   ): Promise<DeliveryAssignment> => {
      const assignment = await prisma.deliveryAssignment.findUnique({
         where: { id: assignment_id },
      });

      if (!assignment) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Assignment with id ${assignment_id} not found`);
      }

      if (assignment.status !== DeliveryStatus.FAILED) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot reschedule assignment with status ${assignment.status}. Must be FAILED.`
         );
      }

      const statusDetails = buildParcelStatusDetails({ status: Status.OUT_FOR_DELIVERY });
      const updated = await prisma.$transaction(async (tx) => {
         const result = await tx.deliveryAssignment.update({
            where: { id: assignment_id },
            data: {
               status: DeliveryStatus.RESCHEDULED,
               notes: notes || assignment.notes,
            },
         });

         await tx.parcelEvent.create({
            data: {
               parcel_id: assignment.parcel_id,
               event_type: ParcelEventType.DELIVERY_RESCHEDULED,
               user_id,
               status: Status.OUT_FOR_DELIVERY,
               status_details: statusDetails,
               notes: notes || "Delivery rescheduled",
            },
         });

         return result;
      });

      return updated;
   },

   /**
    * Get assignments for a messenger
    */
   getMessengerAssignments: async (
      messenger_id: string,
      status?: DeliveryStatus
   ): Promise<DeliveryAssignment[]> => {
      const where: Prisma.DeliveryAssignmentWhereInput = {
         OR: [{ messenger_id }, { route: { messenger_id } }],
      };

      if (status) {
         where.status = status;
      }

      const assignments = await prisma.deliveryAssignment.findMany({
         where,
         include: {
            parcel: {
               include: {
                  order: {
                     select: {
                        id: true,
                        receiver: {
                           select: {
                              first_name: true,
                              last_name: true,
                              address: true,
                              mobile: true,
                              phone: true,
                              city: { select: { name: true } },
                              province: { select: { name: true } },
                           },
                        },
                     },
                  },
               },
            },
            route: {
               select: { id: true, route_number: true, status: true },
            },
         },
         orderBy: { created_at: "desc" },
      });

      return assignments;
   },

   /**
    * Get parcels ready for delivery (by warehouse)
    */
   getParcelsReadyForDelivery: async (
      warehouse_id: number,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: any[]; total: number }> => {
      const where: Prisma.ParcelWhereInput = {
         current_warehouse_id: warehouse_id,
         status: { in: [Status.RELEASED_FROM_CUSTOMS, Status.IN_WAREHOUSE] },
         delivery_assignment: null, // Not yet assigned
      };

      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { created_at: "asc" },
            include: {
               order: {
                  select: {
                     id: true,
                     receiver: {
                        select: {
                           first_name: true,
                           last_name: true,
                           address: true,
                           mobile: true,
                           city: { select: { name: true } },
                           province: { select: { name: true } },
                        },
                     },
                  },
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

export default deliveryRoutes;
