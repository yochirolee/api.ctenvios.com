import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import { Pallet, PalletStatus, Parcel, ParcelEventType, Prisma, Status } from "@prisma/client";
import { AppError } from "../common/app-errors";
import { updateOrderStatusFromParcel, updateOrderStatusFromParcels } from "../utils/order-status-calculator";

/**
 * Pallets Repository
 * Following: Repository pattern, TypeScript strict typing
 */

// Allowed statuses for parcels to be added to pallet
const ALLOWED_PALLET_STATUSES: Status[] = [Status.IN_AGENCY];

/**
 * Validates if a parcel status allows it to be added to pallet
 */
const isValidStatusForPallet = (status: Status): boolean => {
   return ALLOWED_PALLET_STATUSES.includes(status);
};

/**
 * Generate a unique pallet number
 */
const generatePalletNumber = async (agency_id: number): Promise<string> => {
   const date = new Date();
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, "0");

   // Count pallets for this agency this month
   const count = await prisma.pallet.count({
      where: {
         agency_id,
         created_at: {
            gte: new Date(year, date.getMonth(), 1),
            lt: new Date(year, date.getMonth() + 1, 1),
         },
      },
   });

   const sequence = String(count + 1).padStart(4, "0");
   return `P-${agency_id}-${year}${month}-${sequence}`;
};

const pallets = {
   /**
    * Get all pallets with pagination
    */
   getAll: async (
      page: number,
      limit: number,
      agency_id?: number,
      status?: PalletStatus
   ): Promise<{ pallets: Pallet[]; total: number }> => {
      const where: Prisma.PalletWhereInput = {};

      if (agency_id) {
         where.agency_id = agency_id;
      }

      if (status) {
         where.status = status;
      }

      const [pallets, total] = await Promise.all([
         prisma.pallet.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            include: {
               agency: {
                  select: { id: true, name: true },
               },
               created_by: {
                  select: { id: true, name: true },
               },
               dispatch: {
                  select: { id: true, status: true },
               },
               _count: {
                  select: { parcels: true },
               },
            },
            orderBy: { created_at: "desc" },
         }),
         prisma.pallet.count({ where }),
      ]);

      return { pallets, total };
   },

   /**
    * Get pallet by ID with full details
    */
   getById: async (id: number): Promise<Pallet | null> => {
      const pallet = await prisma.pallet.findUnique({
         where: { id },
         include: {
            agency: {
               select: { id: true, name: true },
            },
            created_by: {
               select: { id: true, name: true },
            },
            dispatch: {
               select: { id: true, status: true, receiver_agency: { select: { id: true, name: true } } },
            },
            _count: {
               select: { parcels: true },
            },
         },
      });

      return pallet;
   },

   /**
    * Get pallet by pallet number
    */
   getByPalletNumber: async (pallet_number: string): Promise<Pallet | null> => {
      const pallet = await prisma.pallet.findUnique({
         where: { pallet_number },
         include: {
            agency: {
               select: { id: true, name: true },
            },
            created_by: {
               select: { id: true, name: true },
            },
         },
      });

      return pallet;
   },

   /**
    * Create a new pallet
    */
   create: async (agency_id: number, user_id: string, notes?: string): Promise<Pallet> => {
      const pallet_number = await generatePalletNumber(agency_id);

      const pallet = await prisma.pallet.create({
         data: {
            pallet_number,
            agency_id,
            created_by_id: user_id,
            notes,
         },
         include: {
            agency: {
               select: { id: true, name: true },
            },
            created_by: {
               select: { id: true, name: true },
            },
         },
      });

      return pallet;
   },

   /**
    * Update pallet
    */
   update: async (id: number, data: Prisma.PalletUncheckedUpdateInput): Promise<Pallet> => {
      const pallet = await prisma.pallet.findUnique({ where: { id } });

      if (!pallet) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Pallet with id ${id} not found`);
      }

      const updated = await prisma.pallet.update({
         where: { id },
         data,
         include: {
            agency: {
               select: { id: true, name: true },
            },
            created_by: {
               select: { id: true, name: true },
            },
         },
      });

      return updated;
   },

   /**
    * Delete pallet (only if empty and OPEN)
    */
   delete: async (id: number): Promise<Pallet> => {
      const pallet = await prisma.pallet.findUnique({
         where: { id },
         include: { _count: { select: { parcels: true } } },
      });

      if (!pallet) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Pallet with id ${id} not found`);
      }

      if (pallet._count.parcels > 0) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "Cannot delete pallet with parcels. Remove all parcels first."
         );
      }

      if (pallet.status !== PalletStatus.OPEN) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot delete pallet with status ${pallet.status}. Only OPEN pallets can be deleted.`
         );
      }

      const deleted = await prisma.pallet.delete({ where: { id } });
      return deleted;
   },

   /**
    * Get parcels in pallet with pagination
    */
   getParcels: async (
      pallet_id: number,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where: { pallet_id },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { updated_at: "desc" },
            include: {
               agency: { select: { id: true, name: true } },
            },
         }),
         prisma.parcel.count({ where: { pallet_id } }),
      ]);

      return { parcels, total };
   },

   /**
    * Add parcel to pallet
    */
   addParcel: async (pallet_id: number, tracking_number: string, user_id: string): Promise<Parcel> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      if (parcel.pallet_id) {
         throw new AppError(
            HttpStatusCodes.CONFLICT,
            `Parcel ${tracking_number} is already in pallet ${parcel.pallet_id}`
         );
      }

      if (!isValidStatusForPallet(parcel.status)) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel with status ${parcel.status} cannot be added to pallet. Parcel must be IN_AGENCY.`
         );
      }

      const pallet = await prisma.pallet.findUnique({ where: { id: pallet_id } });

      if (!pallet) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Pallet with id ${pallet_id} not found`);
      }

      if (pallet.status !== PalletStatus.OPEN) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot add parcels to pallet with status ${pallet.status}. Pallet must be OPEN.`
         );
      }

      // Verify parcel belongs to same agency as pallet
      if (parcel.agency_id !== pallet.agency_id) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Parcel belongs to a different agency. Cannot add to this pallet.`
         );
      }

      const updatedParcel = await prisma.$transaction(async (tx) => {
         // Update parcel
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               pallet_id,
               status: Status.IN_PALLET,
            },
         });

         // Create parcel event
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.ADDED_TO_PALLET,
               user_id,
               status: Status.IN_PALLET,
               pallet_id,
               notes: `Added to pallet ${pallet.pallet_number}`,
            },
         });

         // Update pallet weight and count
         await tx.pallet.update({
            where: { id: pallet_id },
            data: {
               total_weight_kg: {
                  increment: parcel.weight,
               },
               parcels_count: {
                  increment: 1,
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
    * Add all parcels from an order to a pallet
    */
   addParcelsByOrderId: async (
      pallet_id: number,
      order_id: number,
      user_id: string
   ): Promise<{ added: number; skipped: number; parcels: Parcel[] }> => {
      const pallet = await prisma.pallet.findUnique({ where: { id: pallet_id } });

      if (!pallet) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Pallet with id ${pallet_id} not found`);
      }

      if (pallet.status !== PalletStatus.OPEN) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot add parcels to pallet with status ${pallet.status}. Pallet must be OPEN.`
         );
      }

      // Find all parcels for this order
      const parcels = await prisma.parcel.findMany({
         where: { order_id },
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
            // Skip if already assigned elsewhere (safety net)
            if (parcel.pallet_id || parcel.dispatch_id || parcel.container_id || parcel.flight_id) {
               skipped++;
               continue;
            }

            // Skip if status doesn't allow adding to pallet
            if (!isValidStatusForPallet(parcel.status)) {
               skipped++;
               continue;
            }

            // Skip if parcel belongs to a different agency than the pallet
            if (parcel.agency_id !== pallet.agency_id) {
               skipped++;
               continue;
            }

            const updated = await tx.parcel.update({
               where: { id: parcel.id },
               data: {
                  pallet_id,
                  status: Status.IN_PALLET,
               },
            });

            await tx.parcelEvent.create({
               data: {
                  parcel_id: parcel.id,
                  event_type: ParcelEventType.ADDED_TO_PALLET,
                  user_id,
                  status: Status.IN_PALLET,
                  pallet_id,
                  notes: `Added to pallet ${pallet.pallet_number} (batch from order #${order_id})`,
               },
            });

            totalWeight += Number(parcel.weight);
            addedParcels.push(updated);
            added++;
         }

         if (added > 0) {
            await tx.pallet.update({
               where: { id: pallet_id },
               data: {
                  total_weight_kg: {
                     increment: totalWeight,
                  },
                  parcels_count: {
                     increment: added,
                  },
               },
            });
         }
      });

      if (added > 0) {
         await updateOrderStatusFromParcels(order_id);
      }

      return { added, skipped, parcels: addedParcels };
   },

   /**
    * Remove parcel from pallet
    */
   removeParcel: async (pallet_id: number, tracking_number: string, user_id: string): Promise<Parcel> => {
      const parcel = await prisma.parcel.findUnique({
         where: { tracking_number },
      });

      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
      }

      if (parcel.pallet_id !== pallet_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Parcel ${tracking_number} is not in pallet ${pallet_id}`);
      }

      const pallet = await prisma.pallet.findUnique({ where: { id: pallet_id } });

      if (!pallet) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Pallet with id ${pallet_id} not found`);
      }

      // Only allow removal if pallet is OPEN
      if (pallet.status !== PalletStatus.OPEN) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot remove parcels from pallet with status ${pallet.status}. Pallet must be OPEN.`
         );
      }

      const updatedParcel = await prisma.$transaction(async (tx) => {
         // Update parcel
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               pallet_id: null,
               status: Status.IN_AGENCY,
            },
         });

         // Create parcel event
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: ParcelEventType.REMOVED_FROM_PALLET,
               user_id,
               status: Status.IN_AGENCY,
               pallet_id, // Keep reference to which pallet it was removed from
               notes: `Removed from pallet ${pallet.pallet_number}`,
            },
         });

         // Update pallet weight and count
         await tx.pallet.update({
            where: { id: pallet_id },
            data: {
               total_weight_kg: {
                  decrement: parcel.weight,
               },
               parcels_count: {
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
    * Seal pallet (close it for dispatch)
    */
   seal: async (id: number, user_id: string): Promise<Pallet> => {
      const pallet = await prisma.pallet.findUnique({
         where: { id },
         include: { _count: { select: { parcels: true } } },
      });

      if (!pallet) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Pallet with id ${id} not found`);
      }

      if (pallet.status !== PalletStatus.OPEN) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Pallet is already ${pallet.status}`);
      }

      if (pallet._count.parcels === 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot seal an empty pallet");
      }

      const updated = await prisma.pallet.update({
         where: { id },
         data: { status: PalletStatus.SEALED },
         include: {
            agency: { select: { id: true, name: true } },
            created_by: { select: { id: true, name: true } },
         },
      });

      return updated;
   },

   /**
    * Unseal pallet (reopen it)
    */
   unseal: async (id: number, user_id: string): Promise<Pallet> => {
      const pallet = await prisma.pallet.findUnique({ where: { id } });

      if (!pallet) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Pallet with id ${id} not found`);
      }

      if (pallet.status !== PalletStatus.SEALED) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Cannot unseal pallet with status ${pallet.status}. Pallet must be SEALED.`
         );
      }

      if (pallet.dispatch_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Cannot unseal pallet that is already in a dispatch");
      }

      const updated = await prisma.pallet.update({
         where: { id },
         data: { status: PalletStatus.OPEN },
         include: {
            agency: { select: { id: true, name: true } },
            created_by: { select: { id: true, name: true } },
         },
      });

      return updated;
   },

   /**
    * Get parcels ready to be added to pallet (by agency)
    */
   getReadyParcels: async (
      agency_id: number,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const where: Prisma.ParcelWhereInput = {
         pallet_id: null,
         dispatch_id: null,
         container_id: null,
         flight_id: null,
         agency_id,
         status: Status.IN_AGENCY,
      };

      const [parcels, total] = await Promise.all([
         prisma.parcel.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { created_at: "desc" },
            include: {
               order: {
                  select: {
                     id: true,
                     agency: { select: { id: true, name: true } },
                  },
               },
               service: {
                  select: { id: true, name: true, service_type: true },
               },
            },
         }),
         prisma.parcel.count({ where }),
      ]);

      return { parcels, total };
   },
};

export default pallets;
