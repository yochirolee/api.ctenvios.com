import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import { Parcel, ParcelEventType, Prisma, Status, Warehouse } from "@prisma/client";
import { AppError } from "../common/app-errors";
import { updateOrderStatusFromParcel } from "../utils/order-status-calculator";
import { buildParcelStatusDetails } from "../utils/parcel-status-details";

/**
 * Warehouses Repository
 * Following: Repository pattern, TypeScript strict typing
 */

const warehouses = {
   /**
    * Get all warehouses with pagination
    */
   getAll: async (
      page: number,
      limit: number,
      carrier_id?: number,
      province_id?: number,
      is_active?: boolean
   ): Promise<{ warehouses: Warehouse[]; total: number }> => {
      const where: Prisma.WarehouseWhereInput = {};

      if (carrier_id) {
         where.carrier_id = carrier_id;
      }

      if (province_id) {
         where.province_id = province_id;
      }

      if (is_active !== undefined) {
         where.is_active = is_active;
      }

      const [warehouses, total] = await Promise.all([
         prisma.warehouse.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            include: {
               carrier: {
                  select: { id: true, name: true },
               },
               province: {
                  select: { id: true, name: true },
               },
               manager: {
                  select: { id: true, name: true },
               },
               _count: {
                  select: { parcels: true },
               },
            },
            orderBy: [{ is_main: "desc" }, { created_at: "desc" }],
         }),
         prisma.warehouse.count({ where }),
      ]);

      return { warehouses, total };
   },

   /**
    * Get warehouse by ID with full details
    */
   getById: async (id: number): Promise<Warehouse | null> => {
      const warehouse = await prisma.warehouse.findUnique({
         where: { id },
         include: {
            carrier: {
               select: { id: true, name: true },
            },
            province: {
               select: { id: true, name: true },
            },
            manager: {
               select: { id: true, name: true, phone: true },
            },
            _count: {
               select: { parcels: true },
            },
         },
      });

      return warehouse;
   },

   /**
    * Create a new warehouse
    */
   create: async (data: {
      name: string;
      address: string;
      carrier_id: number;
      province_id: number;
      is_main?: boolean;
      manager_id?: string;
   }): Promise<Warehouse> => {
      // If setting as main, ensure no other main warehouse exists for this carrier in this province
      if (data.is_main) {
         const existingMain = await prisma.warehouse.findFirst({
            where: {
               carrier_id: data.carrier_id,
               province_id: data.province_id,
               is_main: true,
            },
         });

         if (existingMain) {
            throw new AppError(
               HttpStatusCodes.CONFLICT,
               `Carrier already has a main warehouse in this province (ID: ${existingMain.id})`
            );
         }
      }

      const warehouse = await prisma.warehouse.create({
         data: {
            name: data.name,
            address: data.address,
            carrier_id: data.carrier_id,
            province_id: data.province_id,
            is_main: data.is_main ?? false,
            manager_id: data.manager_id,
         },
         include: {
            carrier: {
               select: { id: true, name: true },
            },
            province: {
               select: { id: true, name: true },
            },
            manager: {
               select: { id: true, name: true },
            },
         },
      });

      return warehouse;
   },

   /**
    * Update warehouse
    */
   update: async (id: number, data: Prisma.WarehouseUncheckedUpdateInput): Promise<Warehouse> => {
      const warehouse = await prisma.warehouse.findUnique({ where: { id } });

      if (!warehouse) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Warehouse with id ${id} not found`);
      }

      // If setting as main, ensure no other main warehouse exists
      if (data.is_main === true && !warehouse.is_main) {
         const existingMain = await prisma.warehouse.findFirst({
            where: {
               carrier_id: warehouse.carrier_id,
               province_id: warehouse.province_id,
               is_main: true,
               id: { not: id },
            },
         });

         if (existingMain) {
            throw new AppError(
               HttpStatusCodes.CONFLICT,
               `Carrier already has a main warehouse in this province (ID: ${existingMain.id})`
            );
         }
      }

      const updated = await prisma.warehouse.update({
         where: { id },
         data,
         include: {
            carrier: {
               select: { id: true, name: true },
            },
            province: {
               select: { id: true, name: true },
            },
            manager: {
               select: { id: true, name: true },
            },
         },
      });

      return updated;
   },

   /**
    * Delete warehouse (only if empty)
    */
   delete: async (id: number): Promise<Warehouse> => {
      const warehouse = await prisma.warehouse.findUnique({
         where: { id },
         include: { _count: { select: { parcels: true } } },
      });

      if (!warehouse) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Warehouse with id ${id} not found`);
      }

      if (warehouse._count.parcels > 0) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Cannot delete warehouse with parcels. Transfer all parcels first."
         );
      }

      const deleted = await prisma.warehouse.delete({ where: { id } });
      return deleted;
   },

   /**
    * Get parcels in warehouse with pagination
    */
   getParcels: async (
      warehouse_id: number,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where: { current_warehouse_id: warehouse_id },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { updated_at: "desc" },
            include: {
               order: {
                  select: {
                     id: true,
                     receiver: {
                        select: {
                           first_name: true,
                           last_name: true,
                           address: true,
                           city: { select: { name: true } },
                        },
                     },
                  },
               },
               service: {
                  select: { id: true, name: true },
               },
            },
         }),
         prisma.parcel.count({ where: { current_warehouse_id: warehouse_id } }),
      ]);

      return { parcels, total };
   },

   /**
    * Receive parcel in warehouse
    */
   receiveParcel: async (warehouse_id: number, tracking_number: string, user_id: string): Promise<Parcel> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouse_id } });

      if (!warehouse) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Warehouse with id ${warehouse_id} not found`);
      }

      if (!warehouse.is_active) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot receive parcels in inactive warehouse");
      }

      // Parcel should be released from customs or in another warehouse
      const allowedStatuses: Status[] = [Status.RELEASED_FROM_CUSTOMS, Status.IN_WAREHOUSE];
      if (!allowedStatuses.includes(parcel.status) && !parcel.current_warehouse_id) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel with status ${parcel.status} cannot be received in warehouse. Must be RELEASED_FROM_CUSTOMS or transferring from another warehouse.`
         );
      }

      const previousWarehouseId = parcel.current_warehouse_id;

      const statusDetails = buildParcelStatusDetails({
         status: Status.IN_WAREHOUSE,
         current_warehouse_id: warehouse_id,
      });
      const updatedParcel = await prisma.$transaction(async (tx) => {
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               current_warehouse_id: warehouse_id,
               status: Status.IN_WAREHOUSE,
               status_details: statusDetails,
            },
         });

         // Create parcel event
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: previousWarehouseId
                  ? ParcelEventType.WAREHOUSE_TRANSFERRED
                  : ParcelEventType.WAREHOUSE_RECEIVED,
               user_id,
               status: Status.IN_WAREHOUSE,
               warehouse_id,
               status_details: statusDetails,
               notes: previousWarehouseId
                  ? `Transferred from warehouse ${previousWarehouseId} to ${warehouse.name}`
                  : `Received at ${warehouse.name}`,
            },
         });

         return updated;
      });

      // Update order status based on parcel changes
      await updateOrderStatusFromParcel(parcel.id);

      return updatedParcel;
   },

   /**
    * Transfer parcel to another warehouse
    */
   transferParcel: async (
      from_warehouse_id: number,
      to_warehouse_id: number,
      tracking_number: string,
      user_id: string
   ): Promise<Parcel> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      if (parcel.current_warehouse_id !== from_warehouse_id) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel ${tracking_number} is not in warehouse ${from_warehouse_id}`
         );
      }

      const fromWarehouse = await prisma.warehouse.findUnique({ where: { id: from_warehouse_id } });
      const toWarehouse = await prisma.warehouse.findUnique({ where: { id: to_warehouse_id } });

      if (!fromWarehouse) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Source warehouse with id ${from_warehouse_id} not found`);
      }

      if (!toWarehouse) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Destination warehouse with id ${to_warehouse_id} not found`);
      }

      if (!toWarehouse.is_active) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot transfer to inactive warehouse");
      }

      const statusDetails = buildParcelStatusDetails({
         status: Status.IN_WAREHOUSE,
         current_warehouse_id: to_warehouse_id,
      });
      const updatedParcel = await prisma.$transaction(async (tx) => {
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               current_warehouse_id: to_warehouse_id,
               status_details: statusDetails,
            },
         });

         // Create parcel event
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.WAREHOUSE_TRANSFERRED,
               user_id,
               status: Status.IN_WAREHOUSE,
               warehouse_id: to_warehouse_id,
               status_details: statusDetails,
               notes: `Transferred from ${fromWarehouse.name} to ${toWarehouse.name}`,
            },
         });

         return updated;
      });

      // Update order status based on parcel changes
      await updateOrderStatusFromParcel(parcel.id);

      return updatedParcel;
   },

   /**
    * Get main warehouse for carrier in a province
    */
   getMainForCarrierAndProvince: async (carrier_id: number, province_id: number): Promise<Warehouse | null> => {
      const warehouse = await prisma.warehouse.findFirst({
         where: {
            carrier_id,
            province_id,
            is_main: true,
            is_active: true,
         },
         include: {
            carrier: {
               select: { id: true, name: true },
            },
            province: {
               select: { id: true, name: true },
            },
         },
      });

      return warehouse;
   },

   /**
    * Get warehouses by carrier
    */
   getByCarrier: async (carrier_id: number): Promise<Warehouse[]> => {
      const warehouses = await prisma.warehouse.findMany({
         where: { carrier_id, is_active: true },
         include: {
            province: {
               select: { id: true, name: true },
            },
            manager: {
               select: { id: true, name: true },
            },
            _count: {
               select: { parcels: true },
            },
         },
         orderBy: [{ is_main: "desc" }, { province: { name: "asc" } }],
      });

      return warehouses;
   },
};

export default warehouses;
