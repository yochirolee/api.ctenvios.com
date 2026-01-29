import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import { Container, ContainerStatus, Parcel, ParcelEventType, Prisma, Status } from "@prisma/client";
import { AppError } from "../common/app-errors";
import { getEventTypeForContainerStatus } from "../utils/parcel-event-visibility";
import {
   updateMultipleOrdersStatusTx,
   updateOrderStatusFromParcelTx,
   updateOrderStatusFromParcelsTx,
} from "../utils/order-status-calculator";

// Allowed statuses for parcels to be added to container
const ALLOWED_CONTAINER_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.RECEIVED_IN_DISPATCH,
   Status.IN_WAREHOUSE,
];

/**
 * Validates if a parcel status allows it to be added to container
 */
const isValidStatusForContainer = (status: Status): boolean => {
   return ALLOWED_CONTAINER_STATUSES.includes(status);
};

interface ParcelAttachInfo {
   id: number;
   status: Status;
   weight: Prisma.Decimal;
   deleted_at: Date | null;
   container_id: number | null;
   flight_id: number | null;
   service: {
      service_type: string | null;
      service_name: string | null;
   } | null;
}

interface ContainerAttachInfo {
   id: number;
   status: ContainerStatus;
   container_number: string;
}

const containers = {
   /**
    * Get minimal parcel info needed for container attach validation
    */
   getParcelAttachInfo: async (tracking_number: string): Promise<ParcelAttachInfo | null> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
         select: {
            id: true,
            status: true,
            weight: true,
            deleted_at: true,
            container_id: true,
            flight_id: true,
            service: {
               select: {
                  service_type: true,
                  name: true,
               },
            },
         },
      });

      if (!parcel) {
         return null;
      }

      return {
         id: parcel.id,
         status: parcel.status,
         weight: parcel.weight,
         deleted_at: parcel.deleted_at,
         container_id: parcel.container_id,
         flight_id: parcel.flight_id,
         service: parcel.service
            ? { service_type: parcel.service.service_type, service_name: parcel.service.name }
            : null,
      };
   },

   /**
    * Get minimal container info needed for parcel attach validation
    */
   getContainerAttachInfo: async (container_id: number): Promise<ContainerAttachInfo | null> => {
      return prisma.container.findUnique({
         where: { id: container_id },
         select: {
            id: true,
            status: true,
            container_number: true,
         },
      });
   },

   /**
    * Get all containers with pagination
    */
   getAll: async (
      page: number,
      limit: number,
      forwarder_id?: number,
      status?: ContainerStatus,
   ): Promise<{ containers: Container[]; total: number }> => {
      const where: Prisma.ContainerWhereInput = {};

      if (forwarder_id) {
         where.forwarder_id = forwarder_id;
      }

      if (status) {
         where.status = status;
      }

      const [containers, total] = await Promise.all([
         prisma.container.findMany({
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
         prisma.container.count({ where }),
      ]);

      return { containers, total };
   },

   /**
    * Get container by ID with full details
    */
   getById: async (id: number): Promise<Container | null> => {
      const container = await prisma.container.findUnique({
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

      return container;
   },

   /**
    * Get container by container number
    */
   getByContainerNumber: async (container_number: string): Promise<Container | null> => {
      const container = await prisma.container.findUnique({
         where: { container_number },
         include: {
            forwarder: {
               select: { id: true, name: true },
            },
            provider: {
               select: { id: true, name: true },
            },
         },
      });

      return container;
   },

   /**
    * Create a new container
    */
   create: async (data: Prisma.ContainerUncheckedCreateInput): Promise<Container> => {
      const container = await prisma.$transaction(async (tx) => {
         const created = await tx.container.create({
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
         await tx.containerEvent.create({
            data: {
               container_id: created.id,
               status: created.status,
               description: "Container created",
               created_by_id: data.created_by_id,
            },
         });

         return created;
      });

      return container;
   },

   /**
    * Update container
    */
   update: async (id: number, data: Prisma.ContainerUncheckedUpdateInput, user_id?: string): Promise<Container> => {
      const container = await prisma.$transaction(async (tx) => {
         const current = await tx.container.findUnique({ where: { id } });

         if (!current) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${id} not found`);
         }

         const updated = await tx.container.update({
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
            await tx.containerEvent.create({
               data: {
                  container_id: id,
                  status: data.status as ContainerStatus,
                  description: `Status changed from ${current.status} to ${data.status}`,
                  created_by_id: user_id,
               },
            });
         }

         return updated;
      });

      return container;
   },

   /**
    * Delete container (only if empty and PENDING)
    */
   delete: async (id: number): Promise<Container> => {
      const container = await prisma.container.findUnique({
         where: { id },
         include: { _count: { select: { parcels: true } } },
      });

      if (!container) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${id} not found`);
      }

      if (container._count.parcels > 0) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Cannot delete container with parcels. Remove all parcels first.",
         );
      }

      if (container.status !== ContainerStatus.PENDING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot delete container with status ${container.status}. Only PENDING containers can be deleted.`,
         );
      }

      const deleted = await prisma.container.delete({ where: { id } });
      return deleted;
   },

   /**
    * Get parcels in container with pagination
    */
   getParcels: async (
      container_id: number,
      page: number = 1,
      limit: number = 20,
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            include: {
               agency: { select: { id: true, name: true } },
            },
            where: { container_id },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { updated_at: "desc" },
         }),
         prisma.parcel.count({ where: { container_id } }),
      ]);

      return { parcels, total };
   },

   /**
    * Add parcel to container
    */
   addParcel: async (container_id: number, tracking_number: string, user_id: string): Promise<Parcel> => {
      const updatedParcel = await prisma.$transaction(async (tx) => {
         const parcel = await tx.parcel.findUnique({
            where: { tracking_number },
            select: {
               id: true,
               status: true,
               weight: true,
               container_id: true,
               flight_id: true,
            },
         });

         if (!parcel) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
         }

         if (parcel.container_id) {
            throw new AppError(
               HttpStatusCodes.CONFLICT,
               `Parcel ${tracking_number} is already in container ${parcel.container_id}`,
            );
         }

         if (parcel.flight_id) {
            throw new AppError(
               HttpStatusCodes.CONFLICT,
               `Parcel ${tracking_number} is already in flight ${parcel.flight_id}`,
            );
         }

         const container = await tx.container.findUnique({
            where: { id: container_id },
            select: { id: true, status: true, container_number: true },
         });

         if (!container) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${container_id} not found`);
         }

         if (container.status !== ContainerStatus.PENDING && container.status !== ContainerStatus.LOADING) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`,
            );
         }

         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               container_id,
               status: Status.IN_CONTAINER,
            },
         });

         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.LOADED_TO_CONTAINER,
               user_id,
               status: Status.IN_CONTAINER,
               container_id,
               notes: `Added to container ${container.container_number}`,
            },
         });

         await tx.container.update({
            where: { id: container_id },
            data: {
               current_weight_kg: {
                  increment: parcel.weight,
               },
               status: ContainerStatus.LOADING,
            },
         });

         await updateOrderStatusFromParcelTx(tx, parcel.id);

         return updated;
      });

      return updatedParcel;
   },

   /**
    * Add all parcels from an order to container
    */
   addParcelsByOrderId: async (
      container_id: number,
      order_id: number,
      user_id: string,
   ): Promise<{ added: number; skipped: number; parcels: Parcel[] }> => {
      const container = await prisma.container.findUnique({ where: { id: container_id } });

      if (!container) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${container_id} not found`);
      }

      if (container.status !== ContainerStatus.PENDING && container.status !== ContainerStatus.LOADING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`,
         );
      }

      // Find all parcels for this order with service info
      const parcels = await prisma.parcel.findMany({
         where: { order_id },
         include: {
            service: { select: { service_type: true, name: true } },
         },
      });

      if (parcels.length === 0) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `No parcels found for order ${order_id}`);
      }

      let added = 0;
      let skipped = 0;
      let totalWeight = 0;
      const addedParcels: Parcel[] = [];

      await prisma.$transaction(async (tx) => {
         for (const parcel of parcels) {
            // Skip if already in a container or flight
            if (parcel.container_id || parcel.flight_id) {
               skipped++;
               continue;
            }

            // Skip if service type is not MARITIME (only maritime parcels go in containers)
            if (parcel.service?.service_type !== "MARITIME") {
               skipped++;
               continue;
            }

            // Skip if status doesn't allow adding to container
            if (!isValidStatusForContainer(parcel.status)) {
               skipped++;
               continue;
            }

            // Update parcel
            const updated = await tx.parcel.update({
               where: { id: parcel.id },
               data: {
                  container_id,
                  status: Status.IN_CONTAINER,
               },
            });

            // Create parcel event
            await tx.parcelEvent.create({
               data: {
                  parcel_id: parcel.id,
                  event_type: ParcelEventType.LOADED_TO_CONTAINER,
                  user_id,
                  status: Status.IN_CONTAINER,
                  container_id,
                  notes: `Added to container ${container.container_number} (batch from order #${order_id})`,
               },
            });

            totalWeight += Number(parcel.weight);
            addedParcels.push(updated);
            added++;
         }

         // Update container weight and status
         if (added > 0) {
            await tx.container.update({
               where: { id: container_id },
               data: {
                  current_weight_kg: {
                     increment: totalWeight,
                  },
                  status: ContainerStatus.LOADING,
               },
            });

            await updateOrderStatusFromParcelsTx(tx, order_id);
         }
      });

      return { added, skipped, parcels: addedParcels };
   },

   /**
    * Add all parcels from a dispatch to container
    */
   addParcelsByDispatchId: async (
      container_id: number,
      dispatch_id: number,
      user_id: string,
   ): Promise<{ added: number; skipped: number; parcels: Parcel[] }> => {
      const container = await prisma.container.findUnique({ where: { id: container_id } });

      if (!container) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${container_id} not found`);
      }

      if (container.status !== ContainerStatus.PENDING && container.status !== ContainerStatus.LOADING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot add parcels to container with status ${container.status}. Container must be PENDING or LOADING.`,
         );
      }

      // Find the dispatch with its parcels
      const dispatch = await prisma.dispatch.findUnique({
         where: { id: dispatch_id },
         include: {
            parcels: {
               include: {
                  service: { select: { service_type: true, name: true } },
               },
            },
         },
      });

      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatch_id} not found`);
      }

      if (dispatch.parcels.length === 0) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `No parcels found in dispatch ${dispatch_id}`);
      }

      let added = 0;
      let skipped = 0;
      let totalWeight = 0;
      const addedParcels: Parcel[] = [];
      const affectedOrderIds = new Set<number>();

      await prisma.$transaction(async (tx) => {
         for (const parcel of dispatch.parcels) {
            // Skip if already in a container or flight
            if (parcel.container_id || parcel.flight_id) {
               skipped++;
               continue;
            }

            // Skip if service type is not MARITIME (only maritime parcels go in containers)
            if (parcel.service?.service_type !== "MARITIME") {
               skipped++;
               continue;
            }

            // Skip if status doesn't allow adding to container
            if (!isValidStatusForContainer(parcel.status)) {
               skipped++;
               continue;
            }

            // Update parcel
            const updated = await tx.parcel.update({
               where: { id: parcel.id },
               data: {
                  container_id,
                  status: Status.IN_CONTAINER,
               },
            });

            // Create parcel event
            await tx.parcelEvent.create({
               data: {
                  parcel_id: parcel.id,
                  event_type: ParcelEventType.LOADED_TO_CONTAINER,
                  user_id,
                  status: Status.IN_CONTAINER,
                  container_id,
                  notes: `Added to container ${container.container_number} (batch from dispatch #${dispatch_id})`,
               },
            });

            totalWeight += Number(parcel.weight);
            addedParcels.push(updated);
            added++;

            // Track affected orders for status update
            if (parcel.order_id) {
               affectedOrderIds.add(parcel.order_id);
            }
         }

         // Update container weight and status
         if (added > 0) {
            await tx.container.update({
               where: { id: container_id },
               data: {
                  current_weight_kg: {
                     increment: totalWeight,
                  },
                  status: ContainerStatus.LOADING,
               },
            });
         }

         if (affectedOrderIds.size > 0) {
            await updateMultipleOrdersStatusTx(tx, [...affectedOrderIds]);
         }
      });

      return { added, skipped, parcels: addedParcels };
   },

   /**
    * Remove parcel from container
    */
   removeParcel: async (container_id: number, tracking_number: string, user_id: string): Promise<Parcel> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      if (parcel.container_id !== container_id) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel ${tracking_number} is not in container ${container_id}`,
         );
      }

      const container = await prisma.container.findUnique({ where: { id: container_id } });

      if (!container) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${container_id} not found`);
      }

      // Only allow removal if container is PENDING or LOADING
      if (container.status !== ContainerStatus.PENDING && container.status !== ContainerStatus.LOADING) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot remove parcels from container with status ${container.status}. Container must be PENDING or LOADING.`,
         );
      }

      const updatedParcel = await prisma.$transaction(async (tx) => {
         // Update parcel
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               container_id: null,
               status: Status.IN_WAREHOUSE,
            },
         });

         // Create parcel event with container reference
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.REMOVED_FROM_CONTAINER,
               user_id,
               status: Status.IN_WAREHOUSE,
               container_id, // Keep reference to which container it was removed from
               notes: `Removed from container ${container.container_number}`,
            },
         });

         // Update container weight
         await tx.container.update({
            where: { id: container_id },
            data: {
               current_weight_kg: {
                  decrement: parcel.weight,
               },
            },
         });

         await updateOrderStatusFromParcelTx(tx, parcel.id);

         return updated;
      });

      return updatedParcel;
   },

   /**
    * Update container status with event tracking
    */
   updateStatus: async (
      id: number,
      status: ContainerStatus,
      user_id: string,
      location?: string,
      description?: string,
   ): Promise<Container> => {
      const container = await prisma.container.findUnique({ where: { id } });

      if (!container) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Container with id ${id} not found`);
      }

      const updated = await prisma.$transaction(async (tx) => {
         // Update container status
         const updatedContainer = await tx.container.update({
            where: { id },
            data: {
               status,
               ...(status === ContainerStatus.DEPARTED && { actual_departure: new Date() }),
               ...(status === ContainerStatus.AT_PORT && { actual_arrival: new Date() }),
            },
         });

         // Create event
         await tx.containerEvent.create({
            data: {
               container_id: id,
               status,
               location,
               description: description || `Status changed to ${status}`,
               created_by_id: user_id,
            },
         });

         // Update parcels status based on container status
         const parcels = await tx.parcel.findMany({
            where: { container_id: id },
            select: { id: true, order_id: true },
         });

         // Map container status to parcel status
         const containerToParcelStatus: Partial<Record<ContainerStatus, Status>> = {
            [ContainerStatus.DEPARTED]: Status.IN_TRANSIT,
            [ContainerStatus.IN_TRANSIT]: Status.IN_TRANSIT,
            [ContainerStatus.AT_PORT]: Status.AT_PORT_OF_ENTRY,
            [ContainerStatus.CUSTOMS_HOLD]: Status.CUSTOMS_INSPECTION,
            [ContainerStatus.CUSTOMS_CLEARED]: Status.RELEASED_FROM_CUSTOMS,
            [ContainerStatus.UNLOADING]: Status.RELEASED_FROM_CUSTOMS,
         };

         const newParcelStatus = containerToParcelStatus[status];

         if (newParcelStatus && parcels.length > 0) {
            for (const parcel of parcels) {
               await tx.parcel.update({
                  where: { id: parcel.id },
                  data: { status: newParcelStatus },
               });

               await tx.parcelEvent.create({
                  data: {
                     parcel_id: parcel.id,
                     event_type: getEventTypeForContainerStatus(status),
                     user_id,
                     status: newParcelStatus,
                     container_id: id,
                     notes: `Container ${container.container_number} - ${status}${location ? ` at ${location}` : ""}`,
                  },
               });
            }
         }

         // Collect unique order IDs to update
         const orderIds = [...new Set(parcels.map((p) => p.order_id).filter((id): id is number => id !== null))];

         if (orderIds.length > 0) {
            await updateMultipleOrdersStatusTx(tx, orderIds);
         }

         return updatedContainer;
      });

      return updated;
   },

   /**
    * Get container events
    */
   getEvents: async (container_id: number): Promise<any[]> => {
      const events = await prisma.containerEvent.findMany({
         where: { container_id },
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
    * Get parcels ready to be added to container (by forwarder)
    */
   getReadyParcels: async (
      forwarder_id: number,
      page: number = 1,
      limit: number = 20,
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const where: Prisma.ParcelWhereInput = {
         container_id: null,
         flight_id: null,
         deleted_at: null,
         status: {
            in: ALLOWED_CONTAINER_STATUSES,
         },
         agency: {
            forwarder_id,
         },
         // Only maritime service parcels
         service: {
            service_type: "MARITIME",
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

export default containers;
