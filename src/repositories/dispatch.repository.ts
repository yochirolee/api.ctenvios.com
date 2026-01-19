import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import { Dispatch, DispatchStatus, Parcel, PaymentStatus, Prisma, Status, DebtStatus } from "@prisma/client";
import { AppError } from "../common/app-errors";
import parcelsRepository from "./parcels.repository";
import { calculateDispatchCost } from "../utils/dispatch-utils";
import interAgencyDebtsRepository from "./inter-agency-debts.repository";
import { determineHierarchyDebts } from "../utils/agency-hierarchy";
import { updateOrderStatusFromParcel } from "../utils/order-status-calculator";

// Allowed statuses for parcels to be added to dispatch
const ALLOWED_DISPATCH_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.IN_WAREHOUSE,
];

/**
 * Validates if a parcel status allows it to be added to dispatch
 */
const isValidStatusForDispatch = (status: Status): boolean => {
   return ALLOWED_DISPATCH_STATUSES.includes(status);
};

/**
 * Calculates the appropriate dispatch status based on parcel count and states
 * Status workflow:
 * - DRAFT: no parcels in dispatch
 * - LOADING: parcels added but not yet dispatched
 * - DISPATCHED: dispatch sent/in transit (set manually via completeDispatch)
 * - RECEIVING: at least one parcel received at destination
 * - RECEIVED: all parcels received
 * - DISCREPANCY: reception discrepancy detected
 */
const calculateDispatchStatus = async (
   prismaClient: { parcel: { findMany: typeof prisma.parcel.findMany; count: typeof prisma.parcel.count } },
   dispatchId: number,
   currentStatus: DispatchStatus
): Promise<DispatchStatus> => {
   // Count total parcels in dispatch
   const totalParcels = await prismaClient.parcel.count({
      where: { dispatch_id: dispatchId },
   });

   // If no parcels, status is DRAFT
   if (totalParcels === 0) {
      return DispatchStatus.DRAFT;
   }

   // If dispatch is still being loaded (not yet dispatched), status is LOADING
   if (currentStatus === DispatchStatus.DRAFT || currentStatus === DispatchStatus.LOADING) {
      return DispatchStatus.LOADING;
   }

   // If dispatch has been dispatched, check reception status
   if (currentStatus === DispatchStatus.DISPATCHED || currentStatus === DispatchStatus.RECEIVING) {
      // Count received parcels
      const receivedParcels = await prismaClient.parcel.count({
         where: {
            dispatch_id: dispatchId,
            status: Status.RECEIVED_IN_DISPATCH,
         },
      });

      if (receivedParcels === 0) {
         return DispatchStatus.DISPATCHED;
      }

      if (receivedParcels === totalParcels) {
         return DispatchStatus.RECEIVED;
      }

      // Some parcels received but not all
      return DispatchStatus.RECEIVING;
   }

   // Keep current status for RECEIVED, DISCREPANCY, CANCELLED
   return currentStatus;
};

/**
 * Recursively checks if receiver_agency_id is a descendant (child, grandchild, etc.) of sender_agency_id
 * Also allows receiver to be the same as sender (agency can receive from itself)
 */
/* const isDescendantAgency = async (receiver_agency_id: number, sender_agency_id: number): Promise<boolean> => {
   // Allow agency to receive from itself
   if (receiver_agency_id === sender_agency_id) {
      return true;
   }

   // Get all descendants of sender agency recursively
   const getAllDescendants = async (parentId: number): Promise<number[]> => {
      const directChildren = await prisma.agency.findMany({
         where: { parent_agency_id: parentId },
         select: { id: true },
      });

      const childIds = directChildren.map((child) => child.id);
      const allDescendantIds = [...childIds];

      // Recursively get descendants of children
      for (const childId of childIds) {
         const descendants = await getAllDescendants(childId);
         allDescendantIds.push(...descendants);
      }

      return allDescendantIds;
   };

   const descendants = await getAllDescendants(sender_agency_id);
   return descendants.includes(receiver_agency_id);
};  */

/**
 * Recalculates dispatch weight from all parcels
 * This avoids precision errors from increment/decrement operations
 * Used only for tracking operations (addItem, removeItem)
 * Can work with Prisma transaction client or regular client
 */
const recalculateDispatchWeight = async (
   prismaClient: {
      parcel: {
         findMany: typeof prisma.parcel.findMany;
      };
   },
   dispatchId: number
): Promise<number> => {
   // Get all parcels in dispatch
   const parcels = await prismaClient.parcel.findMany({
      where: { dispatch_id: dispatchId },
      select: {
         weight: true,
      },
   });

   // Calculate total weight
   let totalWeight = 0;
   for (const parcel of parcels) {
      totalWeight += Number(parcel.weight);
   }

   // Round to 2 decimal places to avoid floating point precision errors
   const roundedWeight = Math.round(totalWeight * 100) / 100;

   return Math.max(0, roundedWeight); // Ensure weight is never negative
};

/**
 * Recalculates dispatch totals (weight and cost_in_cents) from all remaining parcels
 * This is used only for financial operations (completeDispatch)
 * Can work with Prisma transaction client or regular client
 */
/* const recalculateDispatchTotals = async (
   prismaClient: {
      parcel: {
         findMany: typeof prisma.parcel.findMany;
      };
   },
   dispatchId: number,
   sender_agency_id: number,
   receiver_agency_id: number | null
): Promise<{ weight: number; cost_in_cents: number }> => {
   // Get all parcels in dispatch with all relations needed for pricing
   const parcels = await prismaClient.parcel.findMany({
      where: { dispatch_id: dispatchId },
      include: {
         order_items: {
            include: {
               rate: {
                  include: {
                     product: true,
                     pricing_agreement: true,
                  },
               },
            },
         },
      },
   });

   // Calculate total weight
   let totalWeight = 0;
   for (const parcel of parcels) {
      totalWeight += Number(parcel.weight);
   }
   const roundedWeight = Math.round(totalWeight * 100) / 100;

   // Calculate total price if receiver is set
   let totalPrice = 0;
   if (receiver_agency_id) {
      for (const parcel of parcels) {
         try {
            const price = await dispatchPricingService.calculateParcelPrice({
               parcel,
               sender_agency_id,
               receiver_agency_id,
            });
            totalPrice += price;
         } catch (error) {
            console.warn(`Failed to calculate price for parcel ${parcel.tracking_number}:`, error);
            // Continue with other parcels even if one fails
         }
      }
   }

   return {
      weight: Math.max(0, roundedWeight), // Ensure weight is never negative
      cost_in_cents: totalPrice,
   };
}; */

const dispatch = {
   get: async (
      page: number,
      limit: number,
      agency_id?: number,
      status?: DispatchStatus,
      payment_status?: PaymentStatus,
      dispatch_id?: number
   ) => {
      // Build where clause with optional filters
      const where: Prisma.DispatchWhereInput = {
         // If dispatch_id is provided, filter by specific dispatch
         ...(dispatch_id && { id: dispatch_id }),
         // If agency_id is provided, filter by sender or receiver agency
         ...(agency_id && {
            OR: [{ sender_agency_id: agency_id }, { receiver_agency_id: agency_id }],
         }),
         // If status is provided, filter by dispatch status
         ...(status && { status }),
         // If payment_status is provided, filter by payment status
         ...(payment_status && { payment_status }),
      };
      const dispatches = await prisma.dispatch.findMany({
         where,
         skip: (page - 1) * limit,
         take: limit,
         select: {
            id: true,
            status: true,
            payment_status: true,
            payment_date: true,
            payment_method: true,
            payment_reference: true,
            created_at: true,
            updated_at: true,
            cost_in_cents: true,
            declared_cost_in_cents: true,
            weight: true,
            declared_weight: true,
            declared_parcels_count: true,
            received_parcels_count: true,
            sender_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            receiver_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            created_by: {
               select: {
                  id: true,
                  name: true,
               },
            },
            received_by: {
               select: {
                  id: true,
                  name: true,
               },
            },
            _count: {
               select: {
                  parcels: true,
               },
            },
         },
         orderBy: {
            created_at: "desc",
         },
      });
      const total = await prisma.dispatch.count({ where });
      return { dispatches, total };
   },
   getById: async (id: number): Promise<Dispatch | null> => {
      const dispatch = await prisma.dispatch.findUnique({
         where: { id: id },
      });
      return dispatch;
   },

   /**
    * Get dispatch by ID with all details needed for PDF generation
    * Includes rate product and service info for dynamic pricing lookup
    */
   getByIdWithDetails: async (id: number) => {
      const dispatch = await prisma.dispatch.findUnique({
         where: { id },
         include: {
            sender_agency: true,
            receiver_agency: true,
            created_by: true,
            received_by: true,
            parcels: {
               include: {
                  order_items: {
                     include: {
                        service: true,
                        rate: {
                           include: {
                              product: true,
                              service: true, // Include service from rate for PricingAgreement lookup
                              pricing_agreement: true,
                           },
                        },
                     },
                  },
                  order: {
                     include: {
                        receiver: {
                           include: {
                              city: true,
                              province: true,
                           },
                        },
                     },
                  },
               },
               orderBy: { tracking_number: "asc" },
            },
            inter_agency_debts: {
               where: { status: DebtStatus.PENDING },
               include: {
                  debtor_agency: true,
                  creditor_agency: true,
               },
            },
         },
      });
      return dispatch;
   },
   getParcelsInDispatch: async (
      id: number,
      status: Status | undefined,
      page: number = 1,
      limit: number = 20
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      // Validate and ensure limit is always applied
      const parcels = await prisma.parcel.findMany({
         where: { dispatch_id: id },
         orderBy: { updated_at: "desc" },
         take: limit,
         skip: (page - 1) * limit,
      });

      const total = await prisma.parcel.count({
         where: { dispatch_id: id },
      });
      return { parcels: parcels, total: total };
   },
   create: async (dispatch: Prisma.DispatchUncheckedCreateInput): Promise<Dispatch> => {
      const newDispatch = await prisma.$transaction(async (tx) => {
         // Ensure status is DRAFT if not provided
         const dispatchData = {
            ...dispatch,
            status: dispatch.status || DispatchStatus.DRAFT,
         };

         const created = await tx.dispatch.create({
            data: dispatchData,
         });
         return created;
      });
      return newDispatch;
   },
   getItemByParcelId: async (parcelId: number): Promise<Parcel | null> => {
      const item = await prisma.parcel.findFirst({
         where: { id: parcelId },
      });
      return item;
   },
   update: async (id: number, dispatch: Prisma.DispatchUncheckedUpdateInput): Promise<Dispatch> => {
      const updatedDispatch = await prisma.dispatch.update({
         where: { id: id },
         data: dispatch,
      });
      return updatedDispatch;
   },
   delete: async (id: number, user_agency_id: number | null, user_id: string): Promise<Dispatch> => {
      // Get dispatch with all parcels
      const dispatch = await prisma.dispatch.findUnique({
         where: { id },
         include: {
            parcels: true,
         },
      });

      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${id} not found`);
      }

      // Validate that user's agency is the sender agency (skip check if user_agency_id is null, meaning ROOT user)
      if (user_agency_id !== null && dispatch.sender_agency_id !== user_agency_id) {
         throw new AppError(
            HttpStatusCodes.FORBIDDEN,
            `Only the sender agency can delete this dispatch. Your agency: ${user_agency_id}, Sender agency: ${dispatch.sender_agency_id}`
         );
      }

      // Check if dispatch can be deleted (only DRAFT or CANCELLED can be deleted)
      const deletableStatuses: DispatchStatus[] = [DispatchStatus.DRAFT, DispatchStatus.CANCELLED];
      if (!deletableStatuses.includes(dispatch.status)) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Dispatch with status ${dispatch.status} cannot be deleted. Only dispatches with status DRAFT or CANCELLED can be deleted.`
         );
      }

      // Use transaction to ensure all updates succeed
      const deletedDispatch = await prisma.$transaction(async (tx) => {
         // Si el despacho está DISPATCHED, cancelar todas las deudas relacionadas
         if (dispatch.status === DispatchStatus.DISPATCHED) {
            await interAgencyDebtsRepository.cancelByDispatch(id);
         }

         // Restore all parcels from dispatch
         for (const parcel of dispatch.parcels) {
            // Get previous status from ParcelEvent history
            const previousStatus = await parcelsRepository.getPreviousStatus(parcel.id);
            const statusToRestore = previousStatus || Status.IN_AGENCY;

            // Update parcel: remove from dispatch and restore previous status
            await tx.parcel.update({
               where: { id: parcel.id },
               data: {
                  dispatch_id: null,
                  status: statusToRestore,
                  events: {
                     create: {
                        event_type: "REMOVED_FROM_PALLET",
                        user_id: user_id,
                        status: statusToRestore,
                     },
                  },
               },
            });
         }

         // Delete the dispatch
         const deleted = await tx.dispatch.delete({
            where: { id },
         });

         return deleted;
      });

      return deletedDispatch;
   },
   /**
    * Add parcel to dispatch - Tracking only (no financial logic)
    * Handles: parcel status update, tracking events, dispatch weight, dispatch status
    * Financial logic (pricing) is handled only in completeDispatch
    *
    * NOTE: All validations happen INSIDE the transaction to prevent race conditions
    */
   addParcelToDispatch: async (tracking_number: string, dispatchId: number, user_id: string): Promise<Dispatch> => {
      // All logic inside transaction to prevent race conditions
      const { updatedDispatch, parcelId } = await prisma.$transaction(async (tx) => {
         // 1. Fetch parcel with fresh data inside transaction
         const parcel = await tx.parcel.findUnique({
            where: { tracking_number },
         });

         if (!parcel) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
         }

         // 2. Validate parcel status (with fresh data)
         if (!isValidStatusForDispatch(parcel.status)) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Parcel with status ${
                  parcel.status
               } cannot be added to dispatch. Allowed statuses: ${ALLOWED_DISPATCH_STATUSES.join(", ")}`
            );
         }

         // 3. Check if parcel is already in a dispatch (with fresh data - prevents race condition)
         if (parcel.dispatch_id) {
            throw new AppError(
               HttpStatusCodes.CONFLICT,
               `Parcel ${parcel.tracking_number} is already in dispatch ${parcel.dispatch_id}`
            );
         }

         // 4. Fetch dispatch with fresh data
         const currentDispatch = await tx.dispatch.findUnique({
            where: { id: dispatchId },
            select: { status: true },
         });

         if (!currentDispatch) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
         }

         // 5. Update parcel status and connect to dispatch
         await tx.parcel.update({
            where: { id: parcel.id },
            data: {
               dispatch_id: dispatchId,
               status: Status.IN_DISPATCH,
            },
         });

         // 6. Create event to register the parcel being added to dispatch
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: "ADDED_TO_DISPATCH",
               user_id: user_id,
               location_id: parcel.current_location_id || null,
               status: Status.IN_DISPATCH,
               dispatch_id: dispatchId,
            },
         });

         // 7. Calculate new dispatch status (DRAFT -> LOADING when parcels added)
         const newStatus =
            currentDispatch.status === DispatchStatus.DRAFT ? DispatchStatus.LOADING : currentDispatch.status;

         // 8. Update dispatch with weight, count, and status
         const updatedDispatch = await tx.dispatch.update({
            where: { id: dispatchId },
            data: {
               declared_weight: { increment: parcel.weight },
               declared_parcels_count: { increment: 1 },
               status: newStatus,
            },
         });

         return { updatedDispatch, parcelId: parcel.id };
      });

      // Update order status based on parcel changes (outside transaction for performance)
      await updateOrderStatusFromParcel(parcelId);

      return updatedDispatch;
   },
   /**
    * Remove parcel from dispatch - Tracking only (no financial logic)
    * Handles: parcel status restoration, tracking events, dispatch weight, dispatch status
    * Financial logic (pricing) is handled only in completeDispatch
    *
    * NOTE: All validations happen INSIDE the transaction to prevent race conditions
    */
   removeParcelFromDispatch: async (hbl: string, user_id: string): Promise<Parcel> => {
      // All logic inside transaction to prevent race conditions
      const { updatedParcel, parcelId } = await prisma.$transaction(async (tx) => {
         // 1. Fetch parcel with dispatch info inside transaction (fresh data)
         const parcel = await tx.parcel.findUnique({
            where: { tracking_number: hbl },
            include: {
               dispatch: {
                  select: {
                     id: true,
                     status: true,
                  },
               },
            },
         });

         if (!parcel) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${hbl} not found`);
         }

         if (!parcel.dispatch_id || !parcel.dispatch) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, `Parcel ${hbl} is not in any dispatch`);
         }

         const dispatchId = parcel.dispatch_id;
         const currentDispatchStatus = parcel.dispatch.status;

         // 2. Get previous status from ParcelEvent history (inside transaction)
         const events = await tx.parcelEvent.findMany({
            where: { parcel_id: parcel.id },
            orderBy: { created_at: "desc" },
            select: { status: true },
         });

         const DISPATCH_STATUSES: Status[] = [Status.IN_DISPATCH, Status.RECEIVED_IN_DISPATCH];
         let statusToRestore: Status = Status.IN_AGENCY;
         for (const event of events) {
            if (!DISPATCH_STATUSES.includes(event.status)) {
               statusToRestore = event.status;
               break;
            }
         }

         // 3. Update parcel: remove from dispatch and restore previous status
         const updated = await tx.parcel.update({
            where: { tracking_number: hbl },
            data: {
               dispatch_id: null,
               status: statusToRestore,
               events: {
                  create: {
                     event_type: "REMOVED_FROM_DISPATCH",
                     user_id: user_id,
                     status: statusToRestore,
                     notes: `Removed from dispatch ${dispatchId}, restored to ${statusToRestore}`,
                  },
               },
            },
         });

         // 4. Count remaining parcels after removal
         const remainingParcelsCount = await tx.parcel.count({
            where: { dispatch_id: dispatchId },
         });

         // 5. Determine new dispatch status based on remaining parcels
         let newDispatchStatus: DispatchStatus;
         if (remainingParcelsCount === 0) {
            newDispatchStatus = DispatchStatus.DRAFT;
         } else if (
            currentDispatchStatus === DispatchStatus.DRAFT ||
            currentDispatchStatus === DispatchStatus.LOADING
         ) {
            newDispatchStatus = DispatchStatus.LOADING;
         } else {
            // For DISPATCHED, RECEIVING, etc - recalculate based on parcel states
            newDispatchStatus = await calculateDispatchStatus(tx, dispatchId, currentDispatchStatus);
         }

         // 6. Update dispatch with recalculated weight and status
         await tx.dispatch.update({
            where: { id: dispatchId },
            data: {
               declared_weight: { decrement: parcel.weight },
               declared_parcels_count: { decrement: 1 },
               status: newDispatchStatus,
            },
         });

         return { updatedParcel: updated, parcelId: parcel.id };
      });

      // Update order status based on parcel changes (outside transaction for performance)
      await updateOrderStatusFromParcel(parcelId);

      return updatedParcel;
   },
   readyForDispatch: async (
      agency_id: number,
      page: number,
      limit: number
   ): Promise<{ parcels: Parcel[]; total: number }> => {
      const parcels: Parcel[] = await prisma.parcel.findMany({
         where: {
            agency_id,
            dispatch_id: null,
            status: {
               in: ALLOWED_DISPATCH_STATUSES,
            },
         },
         orderBy: {
            updated_at: "desc",
         },
         skip: (page - 1) * limit,
         take: limit,
      });
      const total = await prisma.parcel.count({
         where: {
            agency_id,
            dispatch_id: null,
            status: {
               in: ALLOWED_DISPATCH_STATUSES,
            },
         },
      });
      return { parcels: parcels, total: total };
   },
   /**
    * Complete dispatch - Assign receiver agency and calculate all financials
    * This is the ONLY method that handles financial logic (pricing calculations)
    * addItem and removeItem only handle tracking operations (no pricing)
    */
   completeDispatch: async (
      dispatchId: number,
      receiver_agency_id: number,
      sender_agency_id: number
   ): Promise<Dispatch> => {
      // Validate receiver agency exists
      const receiverAgency = await prisma.agency.findUnique({
         where: { id: receiver_agency_id },
         select: {
            id: true,
            parent_agency_id: true,
         },
      });

      if (!receiverAgency) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Receiver agency with id ${receiver_agency_id} not found`);
      }

      // Get dispatch with all parcels
      const dispatch = await prisma.dispatch.findUnique({
         where: { id: dispatchId },
         include: {
            parcels: {
               include: {
                  agency: true, // Necesario para obtener agency_id
                  order_items: {
                     include: {
                        rate: {
                           include: {
                              product: true,
                              pricing_agreement: true,
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
      }

      // Calculate declared_cost_in_cents using the utility function
      const declared_cost_in_cents = calculateDispatchCost(dispatch);

      // Determinar deudas jerárquicas
      const hierarchyDebts = await determineHierarchyDebts(
         sender_agency_id,
         receiver_agency_id,
         dispatch.parcels,
         dispatchId
      );

      // Usar transacción para asegurar consistencia
      const updatedDispatch = await prisma.$transaction(async (tx) => {
         // Actualizar despacho
         const updated = await tx.dispatch.update({
            where: { id: dispatchId },
            data: {
               declared_cost_in_cents,
               receiver_agency_id,
               status: DispatchStatus.DISPATCHED,
            },
         });

         // Crear registros de deuda usando el cliente de transacción
         if (hierarchyDebts.length > 0) {
            await tx.interAgencyDebt.createMany({
               data: hierarchyDebts.map((debtInfo) => ({
                  debtor_agency_id: debtInfo.debtor_agency_id,
                  creditor_agency_id: debtInfo.creditor_agency_id,
                  dispatch_id: dispatchId,
                  amount_in_cents: debtInfo.amount_in_cents,
                  original_sender_agency_id: debtInfo.original_sender_agency_id,
                  relationship: debtInfo.relationship,
                  status: DebtStatus.PENDING,
                  notes: `Deuda generada por despacho ${dispatchId}. Relación: ${debtInfo.relationship}`,
               })),
            });
         }

         return updated;
      });

      return updatedDispatch;
   },
   /**
    * Receive parcel in dispatch - Reconciliation process
    * Used when receiving agency scans parcels to verify dispatch contents
    * 1. If parcel is already in dispatch -> mark as RECEIVED_IN_DISPATCH
    * 2. If parcel is NOT in dispatch but exists in DB -> add to dispatch and mark as received
    *    (This handles cases where sender agency didn't scan the parcel)
    * 3. If parcel doesn't exist -> throw error
    * Also updates dispatch status to RECEIVING or RECEIVED based on parcel states
    *
    * NOTE: All validations happen INSIDE the transaction to prevent race conditions
    */
   receiveInDispatch: async (
      tracking_number: string,
      dispatchId: number,
      user_id: string
   ): Promise<{ parcel: Parcel; wasAdded: boolean }> => {
      // All logic inside transaction to prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
         // 1. Verify dispatch exists (fresh data)
         const dispatch = await tx.dispatch.findUnique({
            where: { id: dispatchId },
         });

         if (!dispatch) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
         }

         // 2. Find parcel with fresh data
         const parcel = await tx.parcel.findUnique({
            where: { tracking_number },
         });

         if (!parcel) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
         }

         // 3. Check if parcel is already in THIS dispatch
         const isInThisDispatch = parcel.dispatch_id === dispatchId;

         // 4. Check if parcel is in ANOTHER dispatch (race condition protection)
         if (parcel.dispatch_id && parcel.dispatch_id !== dispatchId) {
            throw new AppError(
               HttpStatusCodes.CONFLICT,
               `Parcel ${tracking_number} is already in dispatch ${parcel.dispatch_id}`
            );
         }

         let wasAdded = false;

         if (isInThisDispatch) {
            // Parcel is in this dispatch, just mark as received
            const updated = await tx.parcel.update({
               where: { tracking_number },
               data: {
                  status: Status.RECEIVED_IN_DISPATCH,
                  events: {
                     create: {
                        event_type: "RECEIVED_IN_DISPATCH",
                        user_id: user_id,
                        status: Status.RECEIVED_IN_DISPATCH,
                        dispatch_id: dispatchId,
                     },
                  },
               },
            });

            // Calculate and update dispatch status
            const newDispatchStatus = await calculateDispatchStatus(tx, dispatchId, dispatch.status);
            if (newDispatchStatus !== dispatch.status) {
               await tx.dispatch.update({
                  where: { id: dispatchId },
                  data: { status: newDispatchStatus },
               });
            }

            return { parcel: updated, wasAdded: false, parcelId: parcel.id };
         }

         // Parcel not in any dispatch, add to this dispatch and mark as received
         wasAdded = true;
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               dispatch_id: dispatchId,
               status: Status.RECEIVED_IN_DISPATCH,
               events: {
                  create: {
                     event_type: "RECEIVED_IN_DISPATCH",
                     user_id: user_id,
                     status: Status.RECEIVED_IN_DISPATCH,
                     dispatch_id: dispatchId,
                     notes: "Added during reception (not in original dispatch)",
                  },
               },
            },
         });

         // Recalculate dispatch weight since we added a parcel
         const weight = await recalculateDispatchWeight(tx, dispatchId);

         // Calculate and update dispatch status
         const newDispatchStatus = await calculateDispatchStatus(tx, dispatchId, dispatch.status);

         await tx.dispatch.update({
            where: { id: dispatchId },
            data: {
               weight,
               received_parcels_count: { increment: 1 },
               status: newDispatchStatus,
            },
         });

         return { parcel: updated, wasAdded: true, parcelId: parcel.id };
      });

      // Update order status based on parcel changes (outside transaction for performance)
      await updateOrderStatusFromParcel(result.parcelId);

      return { parcel: result.parcel, wasAdded: result.wasAdded };
   },
   /**
    * Get reception status summary for a dispatch
    * Returns: total expected (original parcels), received, missing, and added parcels
    * Used to track reconciliation progress when receiving agency verifies dispatch contents
    */
   getReceptionStatus: async (
      dispatchId: number
   ): Promise<{
      totalExpected: number;
      totalReceived: number;
      totalMissing: number;
      totalAdded: number;
      receivedParcels: Parcel[];
      missingParcels: Parcel[];
      addedParcels: Parcel[];
   }> => {
      // Get dispatch creation time to identify original parcels
      const dispatch = await prisma.dispatch.findUnique({
         where: { id: dispatchId },
         select: { created_at: true, updated_at: true, status: true },
      });

      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
      }

      // Get all parcels currently in dispatch
      const allParcelsInDispatch = await prisma.parcel.findMany({
         where: { dispatch_id: dispatchId },
         include: {
            events: {
               orderBy: { created_at: "asc" },
               select: {
                  status: true,
                  created_at: true,
               },
            },
         },
      });

      // Separate parcels: original (had IN_DISPATCH event before RECEIVED_IN_DISPATCH)
      // vs added (went directly to RECEIVED_IN_DISPATCH without IN_DISPATCH event)
      const originalParcels: Parcel[] = [];
      const addedParcels: Parcel[] = [];

      for (const parcel of allParcelsInDispatch) {
         // Check if parcel has IN_DISPATCH event before RECEIVED_IN_DISPATCH
         const hasInDispatchEvent = parcel.events.some((event) => event.status === Status.IN_DISPATCH);
         const hasReceivedEvent = parcel.events.some((event) => event.status === Status.RECEIVED_IN_DISPATCH);

         // If parcel has RECEIVED_IN_DISPATCH but never had IN_DISPATCH, it was added during reception
         if (hasReceivedEvent && !hasInDispatchEvent) {
            addedParcels.push(parcel);
         } else {
            originalParcels.push(parcel);
         }
      }

      const totalExpected = originalParcels.length; // Original parcels in dispatch
      const totalAdded = addedParcels.length;

      // Separate received and missing from original parcels
      const receivedParcels = originalParcels.filter((p) => p.status === Status.RECEIVED_IN_DISPATCH);
      const missingParcels = originalParcels.filter((p) => p.status !== Status.RECEIVED_IN_DISPATCH);

      const totalReceived = receivedParcels.length;
      const totalMissing = missingParcels.length;

      // Get all received parcels (original + added) for the response
      const allReceivedParcels = await prisma.parcel.findMany({
         where: {
            dispatch_id: dispatchId,
            status: Status.RECEIVED_IN_DISPATCH,
         },
         orderBy: { updated_at: "desc" },
      });

      return {
         totalExpected,
         totalReceived,
         totalMissing,
         totalAdded,
         receivedParcels: allReceivedParcels,
         missingParcels: missingParcels,
         addedParcels: addedParcels,
      };
   },

   /**
    * Create a dispatch from a list of tracking numbers (scan and create)
    * Creates a LOADING dispatch and adds all valid parcels in one transaction
    *
    * NOTE: Uses optimistic locking to prevent race conditions -
    * updateMany with conditions ensures only eligible parcels are added
    */
   createDispatchFromParcels: async (
      tracking_numbers: string[],
      sender_agency_id: number,
      user_id: string
   ): Promise<{
      dispatch: Dispatch;
      added: number;
      skipped: number;
      details: Array<{ tracking_number: string; status: "added" | "skipped"; reason?: string }>;
   }> => {
      // All logic inside transaction to prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
         const details: Array<{ tracking_number: string; status: "added" | "skipped"; reason?: string }> = [];

         // 1. Fetch all parcels with fresh data inside transaction
         const parcels = await tx.parcel.findMany({
            where: {
               tracking_number: { in: tracking_numbers },
            },
         });

         // Create a map for quick lookup
         const parcelMap = new Map(parcels.map((p) => [p.tracking_number, p]));

         // 2. Classify parcels with fresh data
         const toAdd: Parcel[] = [];
         for (const tn of tracking_numbers) {
            const parcel = parcelMap.get(tn);
            if (!parcel) {
               details.push({ tracking_number: tn, status: "skipped", reason: "Parcel not found" });
               continue;
            }
            if (parcel.dispatch_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: `Already in dispatch ${parcel.dispatch_id}`,
               });
               continue;
            }
            if (!isValidStatusForDispatch(parcel.status)) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: `Invalid status: ${parcel.status}. Allowed: ${ALLOWED_DISPATCH_STATUSES.join(", ")}`,
               });
               continue;
            }
            toAdd.push(parcel);
            details.push({ tracking_number: tn, status: "added" });
         }

         if (toAdd.length === 0) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "No valid parcels to add to dispatch");
         }

         // 3. Calculate total weight
         let totalWeight = 0;
         for (const p of toAdd) {
            totalWeight += Number(p.weight);
         }

         // 4. Create dispatch with LOADING status
         const created = await tx.dispatch.create({
            data: {
               sender_agency_id,
               created_by_id: user_id,
               status: DispatchStatus.LOADING,
               declared_parcels_count: toAdd.length,
               declared_weight: Math.round(totalWeight * 100) / 100,
            },
         });

         // 5. Update parcels with optimistic locking condition (dispatch_id must be null)
         const updateResult = await tx.parcel.updateMany({
            where: {
               id: { in: toAdd.map((p) => p.id) },
               dispatch_id: null, // ← Optimistic lock: only update if still available
               status: { in: ALLOWED_DISPATCH_STATUSES },
            },
            data: {
               dispatch_id: created.id,
               status: Status.IN_DISPATCH,
            },
         });

         // 6. If fewer parcels were updated than expected, some were "stolen" by concurrent request
         if (updateResult.count !== toAdd.length) {
            // Recalculate actual added parcels
            const actuallyAdded = await tx.parcel.findMany({
               where: { dispatch_id: created.id },
            });

            // Update dispatch counts to reflect actual added parcels
            let actualWeight = 0;
            for (const p of actuallyAdded) {
               actualWeight += Number(p.weight);
            }

            await tx.dispatch.update({
               where: { id: created.id },
               data: {
                  declared_parcels_count: actuallyAdded.length,
                  declared_weight: Math.round(actualWeight * 100) / 100,
                  status: actuallyAdded.length === 0 ? DispatchStatus.DRAFT : DispatchStatus.LOADING,
               },
            });

            // Update details to reflect actual results
            const addedIds = new Set(actuallyAdded.map((p) => p.id));
            for (const detail of details) {
               if (detail.status === "added") {
                  const parcel = parcelMap.get(detail.tracking_number);
                  if (parcel && !addedIds.has(parcel.id)) {
                     detail.status = "skipped";
                     detail.reason = "Concurrently added to another dispatch";
                  }
               }
            }

            // Create events only for actually added parcels
            if (actuallyAdded.length > 0) {
               await tx.parcelEvent.createMany({
                  data: actuallyAdded.map((p) => ({
                     parcel_id: p.id,
                     event_type: "ADDED_TO_DISPATCH",
                     notes: `Added to dispatch ${created.id}`,
                     user_id: user_id,
                     location_id: p.current_location_id || null,
                     status: Status.IN_DISPATCH,
                     dispatch_id: created.id,
                  })),
               });
            }

            return {
               dispatch: await tx.dispatch.findUniqueOrThrow({ where: { id: created.id } }),
               parcelIds: actuallyAdded.map((p) => p.id),
               details,
            };
         }

         // 7. Create events for all parcels (happy path)
         await tx.parcelEvent.createMany({
            data: toAdd.map((p) => ({
               parcel_id: p.id,
               event_type: "ADDED_TO_DISPATCH",
               notes: `Added to dispatch ${created.id}`,
               user_id: user_id,
               location_id: p.current_location_id || null,
               status: Status.IN_DISPATCH,
               dispatch_id: created.id,
            })),
         });

         return {
            dispatch: created,
            parcelIds: toAdd.map((p) => p.id),
            details,
         };
      });

      // Update order statuses for all added parcels (outside transaction for performance)
      for (const parcelId of result.parcelIds) {
         await updateOrderStatusFromParcel(parcelId);
      }

      return {
         dispatch: result.dispatch,
         added: result.parcelIds.length,
         skipped: result.details.filter((d) => d.status === "skipped").length,
         details: result.details,
      };
   },

   /**
    * Receive parcels without prior dispatch
    * Groups parcels by their original agency (sender) and creates RECEIVED dispatches
    * Used when agencies bring packages directly to warehouse without creating dispatch first
    *
    * Flow:
    * 1. Group parcels by their agency_id (original sender)
    * 2. For each group, create a dispatch with:
    *    - sender_agency_id = parcel.agency_id
    *    - receiver_agency_id = user's agency (warehouse)
    *    - status = RECEIVED
    * 3. Mark all parcels as RECEIVED_IN_DISPATCH
    * 4. Calculate financial totals
    */
   receiveParcelsWithoutDispatch: async (
      tracking_numbers: string[],
      receiver_agency_id: number,
      user_id: string
   ): Promise<{
      dispatches: Array<{
         dispatch: Dispatch;
         parcels_count: number;
         sender_agency_id: number;
      }>;
      total_added: number;
      skipped: number;
      details: Array<{ tracking_number: string; status: "added" | "skipped"; reason?: string; dispatch_id?: number }>;
   }> => {
      const result = await prisma.$transaction(async (tx) => {
         const details: Array<{
            tracking_number: string;
            status: "added" | "skipped";
            reason?: string;
            dispatch_id?: number;
         }> = [];

         // 1. Fetch all parcels
         const parcels = await tx.parcel.findMany({
            where: {
               tracking_number: { in: tracking_numbers },
            },
            include: {
               agency: true,
               order_items: {
                  include: {
                     rate: {
                        include: {
                           product: true,
                           service: true,
                           pricing_agreement: true,
                        },
                     },
                  },
               },
            },
         });

         const parcelMap = new Map(parcels.map((p) => [p.tracking_number, p]));

         // 2. Validate and group parcels by sender agency
         const parcelsByAgency = new Map<number, typeof parcels>();

         for (const tn of tracking_numbers) {
            const parcel = parcelMap.get(tn);
            if (!parcel) {
               details.push({ tracking_number: tn, status: "skipped", reason: "Parcel not found" });
               continue;
            }
            if (parcel.dispatch_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: `Already in dispatch ${parcel.dispatch_id}`,
               });
               continue;
            }
            if (!parcel.agency_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: "Parcel has no agency_id",
               });
               continue;
            }
            // Cannot receive from yourself
            if (parcel.agency_id === receiver_agency_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: "Cannot receive parcel from your own agency",
               });
               continue;
            }

            // Group by sender agency
            if (!parcelsByAgency.has(parcel.agency_id)) {
               parcelsByAgency.set(parcel.agency_id, []);
            }
            parcelsByAgency.get(parcel.agency_id)!.push(parcel);
         }

         if (parcelsByAgency.size === 0) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "No valid parcels to receive");
         }

         // 3. Create a RECEIVED dispatch for each sender agency
         const createdDispatches: Array<{ dispatch: Dispatch; parcels_count: number; sender_agency_id: number }> = [];

         for (const [sender_agency_id, agencyParcels] of parcelsByAgency) {
            // Calculate total weight
            let totalWeight = 0;
            for (const p of agencyParcels) {
               totalWeight += Number(p.weight);
            }

            // Create dispatch with RECEIVED status
            const dispatch = await tx.dispatch.create({
               data: {
                  sender_agency_id,
                  receiver_agency_id,
                  created_by_id: user_id,
                  received_by_id: user_id,
                  status: DispatchStatus.RECEIVED,
                  declared_parcels_count: agencyParcels.length,
                  received_parcels_count: agencyParcels.length,
                  declared_weight: Math.round(totalWeight * 100) / 100,
                  weight: Math.round(totalWeight * 100) / 100,
               },
            });

            // Update all parcels in this group
            await tx.parcel.updateMany({
               where: {
                  id: { in: agencyParcels.map((p) => p.id) },
                  dispatch_id: null, // Optimistic lock
               },
               data: {
                  dispatch_id: dispatch.id,
                  status: Status.RECEIVED_IN_DISPATCH,
               },
            });

            // Create parcel events
            await tx.parcelEvent.createMany({
               data: agencyParcels.map((p) => ({
                  parcel_id: p.id,
                  event_type: "RECEIVED_IN_DISPATCH" as any,
                  notes: `Received without prior dispatch. Dispatch ${dispatch.id} created.`,
                  user_id,
                  location_id: p.current_location_id || null,
                  status: Status.RECEIVED_IN_DISPATCH,
                  dispatch_id: dispatch.id,
               })),
            });

            // Mark as added in details
            for (const p of agencyParcels) {
               details.push({
                  tracking_number: p.tracking_number,
                  status: "added",
                  dispatch_id: dispatch.id,
               });
            }

            createdDispatches.push({
               dispatch,
               parcels_count: agencyParcels.length,
               sender_agency_id,
            });
         }

         return {
            dispatches: createdDispatches,
            details,
            parcelIds: Array.from(parcelsByAgency.values())
               .flat()
               .map((p) => p.id),
         };
      });

      // Update order statuses for all added parcels (outside transaction for performance)
      for (const parcelId of result.parcelIds) {
         await updateOrderStatusFromParcel(parcelId);
      }

      // Calculate totals
      const addedCount = result.details.filter((d) => d.status === "added").length;
      const skippedCount = result.details.filter((d) => d.status === "skipped").length;

      return {
         dispatches: result.dispatches,
         total_added: addedCount,
         skipped: skippedCount,
         details: result.details,
      };
   },

   /**
    * Finalize dispatch reception - Recalculate costs based on ACTUALLY received parcels
    * This should be called after all parcels have been scanned by the receiving agency
    *
    * What it does:
    * 1. Calculate actual cost based on received parcels only (status = RECEIVED_IN_DISPATCH)
    * 2. Cancel old debts (set status to CANCELLED)
    * 3. Create new debts with actual amounts
    * 4. Update dispatch with actual cost and set status to RECEIVED
    * 5. Record discrepancy if declared != actual
    */
   finalizeDispatchReception: async (
      dispatchId: number,
      user_id: string
   ): Promise<{
      dispatch: Dispatch;
      declared_cost_in_cents: number;
      actual_cost_in_cents: number;
      declared_parcels_count: number;
      received_parcels_count: number;
      has_discrepancy: boolean;
      discrepancy_notes: string | null;
   }> => {
      // All logic inside transaction
      const result = await prisma.$transaction(async (tx) => {
         // 1. Get dispatch with received parcels and all pricing relations
         const dispatch = await tx.dispatch.findUnique({
            where: { id: dispatchId },
            include: {
               parcels: {
                  where: { status: Status.RECEIVED_IN_DISPATCH },
                  include: {
                     agency: true,
                     order_items: {
                        include: {
                           rate: {
                              include: {
                                 product: true,
                                 pricing_agreement: true,
                              },
                           },
                        },
                     },
                  },
               },
               inter_agency_debts: true,
            },
         });

         if (!dispatch) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
         }

         // Validate dispatch is in a receivable state
         if (dispatch.status !== DispatchStatus.DISPATCHED && dispatch.status !== DispatchStatus.RECEIVING) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Cannot finalize reception. Dispatch status is ${dispatch.status}, expected DISPATCHED or RECEIVING`
            );
         }

         if (!dispatch.receiver_agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, `Dispatch has no receiver agency assigned`);
         }

         // 2. Calculate actual cost based on received parcels
         const actual_cost_in_cents = calculateDispatchCost(dispatch);

         // Count received parcels
         const received_parcels_count = dispatch.parcels.length;

         // 3. Calculate actual weight
         let actualWeight = 0;
         for (const parcel of dispatch.parcels) {
            actualWeight += Number(parcel.weight);
         }

         // 4. Check for discrepancy
         const declared_cost_in_cents = dispatch.declared_cost_in_cents;
         const declared_parcels_count = dispatch.declared_parcels_count;
         const has_discrepancy =
            declared_cost_in_cents !== actual_cost_in_cents || declared_parcels_count !== received_parcels_count;

         let discrepancy_notes: string | null = null;
         if (has_discrepancy) {
            const costDiff = actual_cost_in_cents - declared_cost_in_cents;
            const parcelDiff = received_parcels_count - declared_parcels_count;
            discrepancy_notes = `Discrepancia detectada: Paquetes declarados=${declared_parcels_count}, recibidos=${received_parcels_count} (${
               parcelDiff >= 0 ? "+" : ""
            }${parcelDiff}). Costo declarado=${declared_cost_in_cents}, real=${actual_cost_in_cents} (${
               costDiff >= 0 ? "+" : ""
            }${costDiff} centavos)`;
         }

         // 5. Cancel old debts
         if (dispatch.inter_agency_debts.length > 0) {
            await tx.interAgencyDebt.updateMany({
               where: {
                  dispatch_id: dispatchId,
                  status: DebtStatus.PENDING,
               },
               data: {
                  status: DebtStatus.CANCELLED,
                  notes: `Cancelada por finalización de recepción. ${discrepancy_notes || "Sin discrepancia."}`,
               },
            });
         }

         // 6. Calculate new debts based on actually received parcels
         const newDebts = await determineHierarchyDebts(
            dispatch.sender_agency_id,
            dispatch.receiver_agency_id,
            dispatch.parcels,
            dispatchId
         );

         // 7. Create new debts with actual amounts
         if (newDebts.length > 0) {
            await tx.interAgencyDebt.createMany({
               data: newDebts.map((debtInfo) => ({
                  debtor_agency_id: debtInfo.debtor_agency_id,
                  creditor_agency_id: debtInfo.creditor_agency_id,
                  dispatch_id: dispatchId,
                  amount_in_cents: debtInfo.amount_in_cents,
                  original_sender_agency_id: debtInfo.original_sender_agency_id,
                  relationship: debtInfo.relationship,
                  status: DebtStatus.PENDING,
                  notes: `Deuda final basada en recepción real. ${discrepancy_notes || "Sin discrepancia."}`,
               })),
            });
         }

         // 8. Update dispatch with actual values
         const updatedDispatch = await tx.dispatch.update({
            where: { id: dispatchId },
            data: {
               cost_in_cents: actual_cost_in_cents,
               weight: Math.round(actualWeight * 100) / 100,
               received_parcels_count,
               status: has_discrepancy ? DispatchStatus.DISCREPANCY : DispatchStatus.RECEIVED,
               payment_notes: discrepancy_notes,
            },
         });

         return {
            dispatch: updatedDispatch,
            declared_cost_in_cents,
            actual_cost_in_cents,
            declared_parcels_count,
            received_parcels_count,
            has_discrepancy,
            discrepancy_notes,
         };
      });

      return result;
   },
};

export default dispatch;
