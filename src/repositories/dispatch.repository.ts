import HttpStatusCodes from "../common/https-status-codes";
import prisma from "../lib/prisma.client";
import {
   Dispatch,
   DispatchStatus,
   Parcel,
   PaymentMethod,
   PaymentStatus,
   Prisma,
   Status,
   DebtStatus,
   Roles,
   AgencyType,
} from "@prisma/client";
import { AppError } from "../common/app-errors";
import parcelsRepository from "./parcels.repository";
import { calculateDispatchCostFromPdfLogic } from "../utils/dispatch-utils";
import interAgencyDebtsRepository from "./inter-agency-debts.repository";
import { determineHierarchyDebts, generateDispatchDebts, generateHierarchicalDebts } from "../utils/agency-hierarchy";
import { updateOrderStatusFromParcel } from "../utils/order-status-calculator";
import { buildParcelStatusDetails } from "../utils/parcel-status-details";
import {
   validateDispatchModifiable,
   validateParcelOwnershipInTx,
   getAgencyParentHierarchy,
   isForwarderAgencyInTx,
   getAllChildAgenciesInTx,
} from "../utils/dispatch-validation";
import { PAYMENT_CONFIG } from "../config/payment.config";
import { formatCents } from "../utils/utils";

// Allowed statuses for parcels to be added to dispatch
const ALLOWED_DISPATCH_STATUSES: Status[] = [
   Status.IN_AGENCY,
   Status.IN_PALLET,
   Status.IN_DISPATCH,
   Status.RECEIVED_IN_DISPATCH,
   Status.IN_WAREHOUSE,
];

interface DispatchParcelListItem {
   id: number;
   tracking_number: string;
   description: string;
   weight: Prisma.Decimal;
   status: Status;
   order_id: number | null;
   agency: { id: number; name: string } | null;
   updated_at: Date;
}

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
   currentStatus: DispatchStatus,
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
 * Derive holder agency: who currently has the parcel.
 * - No dispatch → agency_id (origin). With dispatch RECEIVED/DISCREPANCY → receiver; else → sender.
 */
function getHolderAgencyId(parcel: {
   agency_id: number | null;
   dispatch_id?: number | null;
   dispatch?: { status: DispatchStatus; sender_agency_id: number; receiver_agency_id: number | null } | null;
}): number | null {
   if (!parcel.dispatch_id || !parcel.dispatch) return parcel.agency_id;
   const { status, sender_agency_id, receiver_agency_id } = parcel.dispatch;
   if (status === DispatchStatus.RECEIVED || status === DispatchStatus.DISCREPANCY)
      return receiver_agency_id ?? parcel.agency_id;
   return sender_agency_id;
}

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
   dispatchId: number,
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
      dispatch_id?: number,
   ) => {
      // Build where clause with optional filters
      const where: Prisma.DispatchWhereInput = {
         // If dispatch_id is provided, filter by specific dispatch
         ...(dispatch_id && { id: dispatch_id }),
         // If agency_id is provided, filter by the agency that created the dispatch (creator's agency)
         ...(agency_id && {
            OR: [{ sender_agency_id: agency_id }, { receiver_agency_id: agency_id }],
         }),
         // If status is provided, filter by dispatch status
         ...(status && { status }),
         // If payment_status is provided, filter by payment status
         ...(payment_status && { payment_status }),
      };

      console.log(where, "where");
      const dispatches = await prisma.dispatch.findMany({
         where,
         skip: (page - 1) * limit,
         take: limit,
         select: {
            id: true,
            status: true,
            payment_status: true,
            paid_in_cents: true,
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
         include: { payments: true },
      });
      return dispatch;
   },

   /**
    * Get dispatch by ID with all details needed for PDF generation.
    * Selects only fields used by the PDF; parcels include order + order_items (with rate/product/service) for pricing and delivery.
    */
   getByIdWithDetails: async (id: number) => {
      const dispatch = await prisma.dispatch.findUnique({
         where: { id },
         include: {
            sender_agency: { select: { id: true, name: true, phone: true, address: true } },
            receiver_agency: { select: { id: true, name: true, phone: true, address: true } },
            created_by: { select: { id: true, name: true } },
            received_by: { select: { id: true, name: true } },
            parcels: {
               orderBy: { tracking_number: "asc" },
               include: {
                  order: {
                     include: {
                        receiver: { include: { city: true, province: true } },
                        order_items: {
                           include: {
                              service: true,
                              rate: {
                                 include: {
                                    product: true,
                                    service: true,
                                    pricing_agreement: {
                                       select: {
                                          id: true,
                                          price_in_cents: true,
                                          product: {
                                             select: {
                                                id: true,
                                                name: true,
                                             },
                                          },
                                       },
                                    },
                                 },
                              },
                           },
                        },
                        _count: { select: { parcels: true } },
                     },
                  },
               },
            },
            inter_agency_debts: {
               where: { status: DebtStatus.PENDING },
               select: {
                  id: true,
                  amount_in_cents: true,
                  debtor_agency: { select: { name: true } },
                  creditor_agency: { select: { name: true } },
               },
            },
            payments: {
               orderBy: { date: "desc" },
               select: {
                  id: true,
                  amount_in_cents: true,
                  charge_in_cents: true,
                  method: true,
                  reference: true,
                  date: true,
                  notes: true,
                  paid_by: { select: { id: true, name: true } },
               },
            },
            parcel_events: {
               where: {
                  dispatch_id: id,
               },
               orderBy: {
                  created_at: "asc",
               },
               select: {
                  parcel: {
                     include: {
                        order: {
                           include: {
                              receiver: { include: { city: true, province: true } },
                              order_items: {
                                 include: {
                                    service: true,
                                    rate: {
                                       include: {
                                          product: true,
                                          service: true,
                                          pricing_agreement: {
                                             select: {
                                                id: true,
                                                price_in_cents: true,
                                                product: {
                                                   select: {
                                                      id: true,
                                                      name: true,
                                                   },
                                                },
                                             },
                                          },
                                       },
                                    },
                                 },
                              },
                              _count: { select: { parcels: true } },
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      // Historical fallback for PDF: if parcels were moved to another dispatch later,
      // rebuild this dispatch parcel list from parcel_events linked to this dispatch.
      if (dispatch && dispatch.parcels.length === 0 && dispatch.parcel_events.length > 0) {
         const parcelsFromEvents = new Map<number, (typeof dispatch.parcels)[number]>();
         for (const event of dispatch.parcel_events) {
            if (!event.parcel) {
               continue;
            }
            if (!parcelsFromEvents.has(event.parcel.id)) {
               parcelsFromEvents.set(event.parcel.id, event.parcel as (typeof dispatch.parcels)[number]);
            }
         }
         dispatch.parcels = Array.from(parcelsFromEvents.values());
      }

      return dispatch;
   },
   getParcelsInDispatch: async (
      id: number,
      status: Status | undefined,
      page: number = 1,
      limit: number = 20,
   ): Promise<{ parcels: DispatchParcelListItem[]; total: number }> => {
      const where: Prisma.ParcelWhereInput = {
         dispatch_id: id,
         ...(status && { status }),
      };

      const [parcels, total] = await prisma.$transaction([
         prisma.parcel.findMany({
            where,
            orderBy: { updated_at: "desc" },
            take: limit,
            skip: (page - 1) * limit,
            select: {
               id: true,
               tracking_number: true,
               description: true,
               weight: true,
               status: true,
               order_id: true,
               agency: { select: { id: true, name: true } },
               updated_at: true,
            },
         }),
         prisma.parcel.count({ where }),
      ]);

      return { parcels, total };
   },

   /**
    * Get all payments for a dispatch (ordered by date desc). Same shape as order payments.
    */
   getPayments: async (dispatchId: number) => {
      const payments = await prisma.dispatchPayment.findMany({
         where: { dispatch_id: dispatchId },
         orderBy: { date: "desc" },
         include: {
            paid_by: { select: { id: true, name: true } },
         },
      });
      return payments;
   },

   /**
    * Recompute dispatch payment_status from sum of payments vs cost_in_cents.
    */
   recomputePaymentStatus: async (dispatchId: number): Promise<PaymentStatus> => {
      const [dispatch, sumResult] = await prisma.$transaction([
         prisma.dispatch.findUnique({
            where: { id: dispatchId },
            select: { cost_in_cents: true },
         }),
         prisma.dispatchPayment.aggregate({
            where: { dispatch_id: dispatchId },
            _sum: { amount_in_cents: true },
         }),
      ]);
      if (!dispatch) return PaymentStatus.PENDING;
      const totalPaid = sumResult._sum.amount_in_cents ?? 0;
      const cost = dispatch.cost_in_cents;
      const status: PaymentStatus =
         totalPaid >= cost ? PaymentStatus.PAID : totalPaid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PENDING;
      await prisma.dispatch.update({
         where: { id: dispatchId },
         data: { payment_status: status, paid_in_cents: totalPaid },
      });
      return status;
   },

   /**
    * Add a payment to a dispatch. Same logic as order payments:
    * - Only when dispatch status is RECEIVED
    * - Already PAID dispatches cannot receive more payments
    * - Card payments get a processing fee (charge_in_cents)
    * - Total amount cannot exceed dispatch cost_in_cents
    */
   addPayment: async (
      dispatchId: number,
      data: {
         amount_in_cents: number;
         charge_in_cents?: number;
         method: PaymentMethod;
         reference?: string | null;
         date?: Date | null;
         notes?: string | null;
      },
      paid_by_id: string,
   ) => {
      if (!data.amount_in_cents || data.amount_in_cents <= 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Payment amount must be greater than 0");
      }

      return prisma.$transaction(async (tx) => {
         const dispatch = await tx.dispatch.findUnique({
            where: { id: dispatchId },
            select: { status: true, cost_in_cents: true, payment_status: true },
         });
         if (!dispatch) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
         }
         if (dispatch.status !== DispatchStatus.RECEIVED) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               "Payments can only be added when the dispatch is RECEIVED. Complete reception first.",
            );
         }
         if (dispatch.payment_status === PaymentStatus.PAID) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "Dispatch is already paid");
         }

         let charge = data.charge_in_cents ?? 0;
         let notes = data.notes ?? null;
         if (data.method === PaymentMethod.CREDIT_CARD || data.method === PaymentMethod.DEBIT_CARD) {
            charge = Math.round(data.amount_in_cents * PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE);
            notes = `Card processing fee (${PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE * 100}%): ${formatCents(charge)}`;
         }

         const currentTotal =
            (
               await tx.dispatchPayment.aggregate({
                  where: { dispatch_id: dispatchId },
                  _sum: { amount_in_cents: true },
               })
            )._sum.amount_in_cents ?? 0;
         const cost = dispatch.cost_in_cents;
         const remainingBalance = cost - currentTotal;
         if (data.amount_in_cents > remainingBalance) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Payment amount (${formatCents(data.amount_in_cents)}) exceeds remaining balance (${formatCents(remainingBalance)})`,
            );
         }

         const payment = await tx.dispatchPayment.create({
            data: {
               dispatch_id: dispatchId,
               amount_in_cents: data.amount_in_cents,
               charge_in_cents: charge,
               method: data.method,
               reference: data.reference ?? null,
               date: data.date ?? new Date(),
               notes,
               paid_by_id,
            },
            include: {
               paid_by: { select: { id: true, name: true } },
            },
         });

         const totalPaid = currentTotal + data.amount_in_cents;
         const payment_status: PaymentStatus =
            totalPaid >= cost
               ? PaymentStatus.PAID
               : totalPaid > 0
                 ? PaymentStatus.PARTIALLY_PAID
                 : PaymentStatus.PENDING;
         await tx.dispatch.update({
            where: { id: dispatchId },
            data: { payment_status, paid_in_cents: totalPaid },
         });
         return payment;
      });
   },

   /**
    * Delete a dispatch payment and recompute dispatch payment_status.
    */
   deletePayment: async (dispatchId: number, paymentId: number) => {
      const payment = await prisma.dispatchPayment.findFirst({
         where: { id: paymentId, dispatch_id: dispatchId },
      });
      if (!payment) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Payment not found");
      }
      await prisma.dispatchPayment.delete({ where: { id: paymentId } });
      const [dispatch, sumResult] = await prisma.$transaction([
         prisma.dispatch.findUnique({ where: { id: dispatchId }, select: { cost_in_cents: true } }),
         prisma.dispatchPayment.aggregate({
            where: { dispatch_id: dispatchId },
            _sum: { amount_in_cents: true },
         }),
      ]);
      const totalPaid = sumResult._sum.amount_in_cents ?? 0;
      const cost = dispatch?.cost_in_cents ?? 0;
      const payment_status: PaymentStatus =
         totalPaid >= cost ? PaymentStatus.PAID : totalPaid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PENDING;
      await prisma.dispatch.update({
         where: { id: dispatchId },
         data: { payment_status, paid_in_cents: totalPaid },
      });
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
   delete: async (id: number, user_agency_id: number | null, user_id: string, userRole?: Roles): Promise<Dispatch> => {
      const isRoot = userRole === Roles.ROOT;

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

      // Validate that user's agency is the sender agency (ROOT can delete any dispatch)
      if (!isRoot && user_agency_id !== null && dispatch.sender_agency_id !== user_agency_id) {
         throw new AppError(
            HttpStatusCodes.FORBIDDEN,
            `Only the sender agency can delete this dispatch. Your agency: ${user_agency_id}, Sender agency: ${dispatch.sender_agency_id}`,
         );
      }

      // Check if dispatch can be deleted (only DRAFT or CANCELLED can be deleted, ROOT can delete any)
      const deletableStatuses: DispatchStatus[] = [DispatchStatus.DRAFT, DispatchStatus.CANCELLED];
      if (!isRoot && !deletableStatuses.includes(dispatch.status)) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Dispatch with status ${dispatch.status} cannot be deleted. Only dispatches with status DRAFT or CANCELLED can be deleted.`,
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
            const statusDetails = buildParcelStatusDetails({ status: statusToRestore });

            // Update parcel: remove from dispatch and restore previous status
            await tx.parcel.update({
               where: { id: parcel.id },
               data: {
                  dispatch_id: null,
                  status: statusToRestore,
                  status_details: statusDetails,
                  events: {
                     create: {
                        event_type: "REMOVED_FROM_PALLET",
                        user_id: user_id,
                        status: statusToRestore,
                        status_details: statusDetails,
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
    * Validations:
    * - Dispatch must be in DRAFT or LOADING status (not DISPATCHED/RECEIVED) - ROOT can bypass
    * - Parcel must belong to sender agency or its child agencies
    * - Parcel must have valid status for dispatch
    * - Parcel must not already be in another dispatch
    *
    * NOTE: All validations happen INSIDE the transaction to prevent race conditions
    */
   addParcelToDispatch: async (
      tracking_number: string,
      dispatchId: number,
      user_id: string,
      userRole?: string,
   ): Promise<Dispatch> => {
      // All logic inside transaction to prevent race conditions
      const { updatedDispatch, parcelId } = await prisma.$transaction(async (tx) => {
         // 1. Fetch dispatch with fresh data FIRST to validate status and get sender_agency_id
         const currentDispatch = await tx.dispatch.findUnique({
            where: { id: dispatchId },
            select: { status: true, sender_agency_id: true },
         });

         if (!currentDispatch) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
         }

         // 2. VALIDATE: Dispatch must be modifiable (DRAFT or LOADING only) - ROOT can bypass
         validateDispatchModifiable(currentDispatch.status, userRole);

         // 3. Fetch parcel with fresh data inside transaction
         const parcel = await tx.parcel.findUnique({
            where: { tracking_number },
            select: {
               id: true,
               tracking_number: true,
               deleted_at: true,
               agency_id: true,
               status: true,
               dispatch_id: true,
               weight: true,
               current_location_id: true,
               dispatch: {
                  select: {
                     status: true,
                  },
               },
            },
         });

         if (!parcel) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
         }

         // 3.1 VALIDATE: Parcel must not be from a deleted order
         if (parcel.deleted_at) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Cannot add parcel ${tracking_number} - its order has been deleted`,
            );
         }

         // 4. VALIDATE: Parcel must belong to sender agency or its child agencies
         const isOwned = await validateParcelOwnershipInTx(tx, parcel.agency_id, currentDispatch.sender_agency_id);
         if (!isOwned) {
            throw new AppError(
               HttpStatusCodes.FORBIDDEN,
               `Parcel ${tracking_number} does not belong to agency ${currentDispatch.sender_agency_id} or its child agencies. ` +
                  `Parcel agency: ${parcel.agency_id}. An agency can only dispatch parcels from itself or its child agencies.`,
            );
         }

         // 5. Validate parcel status (with fresh data)
         if (!isValidStatusForDispatch(parcel.status)) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               `Parcel with status ${
                  parcel.status
               } cannot be added to dispatch. Allowed statuses: ${ALLOWED_DISPATCH_STATUSES.join(", ")}`,
            );
         }

         // 6. Check if parcel is already in a dispatch (with fresh data - prevents race condition)
         if (
            parcel.dispatch_id &&
            parcel.dispatch_id !== dispatchId &&
            (!parcel.dispatch ||
               (parcel.dispatch.status !== DispatchStatus.RECEIVED &&
                  parcel.dispatch.status !== DispatchStatus.DISCREPANCY))
         ) {
            throw new AppError(
               HttpStatusCodes.CONFLICT,
               `Parcel ${parcel.tracking_number} is already in dispatch ${parcel.dispatch_id}`,
            );
         }

         const statusDetails = buildParcelStatusDetails({ status: Status.IN_DISPATCH, dispatch_id: dispatchId });
         // 7. Update parcel status and connect to dispatch
         await tx.parcel.update({
            where: { id: parcel.id },
            data: {
               dispatch_id: dispatchId,
               status: Status.IN_DISPATCH,
               status_details: statusDetails,
            },
         });

         // 8. Create event to register the parcel being added to dispatch
         await tx.parcelEvent.create({
            data: {
               parcel_id: parcel.id,
               event_type: "ADDED_TO_DISPATCH",
               user_id: user_id,
               location_id: parcel.current_location_id || null,
               status: Status.IN_DISPATCH,
               dispatch_id: dispatchId,
               status_details: statusDetails,
            },
         });

         // 9. Calculate new dispatch status (DRAFT -> LOADING when parcels added)
         const newStatus =
            currentDispatch.status === DispatchStatus.DRAFT ? DispatchStatus.LOADING : currentDispatch.status;

         // 10. Update dispatch with weight, count, and status
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
    * Add all parcels from an order to dispatch (like containers add by order id).
    * Validations: same as addParcelToDispatch per parcel (dispatch modifiable, ownership, status, not in another dispatch).
    */
   addParcelsByOrderId: async (
      order_id: number,
      dispatchId: number,
      user_id: string,
      userRole?: string,
   ): Promise<Parcel[]> => {
      const parcels = await prisma.parcel.findMany({
         where: { order_id },
      });
      if (parcels.length === 0) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `No parcels found for order ${order_id}`);
      }

      const addedParcels: Parcel[] = [];
      let totalWeight = 0;

      await prisma.$transaction(async (tx) => {
         const currentDispatch = await tx.dispatch.findUnique({
            where: { id: dispatchId },
            select: { status: true, sender_agency_id: true },
         });
         if (!currentDispatch) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
         }
         validateDispatchModifiable(currentDispatch.status, userRole);

         for (const parcel of parcels) {
            const parcelFresh = await tx.parcel.findUnique({
               where: { id: parcel.id },
               select: {
                  id: true,
                  tracking_number: true,
                  deleted_at: true,
                  agency_id: true,
                  status: true,
                  dispatch_id: true,
                  weight: true,
                  current_location_id: true,
                  dispatch: {
                     select: {
                        status: true,
                     },
                  },
               },
            });
            if (!parcelFresh) {
               throw new AppError(HttpStatusCodes.NOT_FOUND, `Parcel ${parcel.id} not found`);
            }

            if (parcelFresh.deleted_at) {
               throw new AppError(
                  HttpStatusCodes.BAD_REQUEST,
                  `Cannot add parcel ${parcelFresh.tracking_number} - its order has been deleted`,
               );
            }
            const isOwned = await validateParcelOwnershipInTx(tx, parcelFresh.agency_id, currentDispatch.sender_agency_id);
            if (!isOwned) {
               throw new AppError(
                  HttpStatusCodes.FORBIDDEN,
                  `Parcel ${parcelFresh.tracking_number} does not belong to agency ${currentDispatch.sender_agency_id} or its child agencies. Parcel agency: ${parcelFresh.agency_id}.`,
               );
            }
            if (!isValidStatusForDispatch(parcelFresh.status)) {
               throw new AppError(
                  HttpStatusCodes.BAD_REQUEST,
                  `Parcel ${parcelFresh.tracking_number} has status ${
                     parcelFresh.status
                  }. Allowed: ${ALLOWED_DISPATCH_STATUSES.join(", ")}`,
               );
            }
            if (
               parcelFresh.dispatch_id &&
               parcelFresh.dispatch_id !== dispatchId &&
               (!parcelFresh.dispatch ||
                  (parcelFresh.dispatch.status !== DispatchStatus.RECEIVED &&
                     parcelFresh.dispatch.status !== DispatchStatus.DISCREPANCY))
            ) {
               // Batch mode: skip parcels currently assigned to another active dispatch
               // and continue processing the rest.
               continue;
            }
            if (parcelFresh.dispatch_id === dispatchId) {
               continue; // already in this dispatch
            }

            const statusDetails = buildParcelStatusDetails({ status: Status.IN_DISPATCH, dispatch_id: dispatchId });
            await tx.parcel.update({
               where: { id: parcelFresh.id },
               data: {
                  dispatch_id: dispatchId,
                  status: Status.IN_DISPATCH,
                  status_details: statusDetails,
               },
            });
            await tx.parcelEvent.create({
               data: {
                  parcel_id: parcelFresh.id,
                  event_type: "ADDED_TO_DISPATCH",
                  user_id,
                  location_id: parcelFresh.current_location_id || null,
                  status: Status.IN_DISPATCH,
                  dispatch_id: dispatchId,
                  status_details: statusDetails,
                  notes: `Added to dispatch (batch from order #${order_id})`,
               },
            });
            totalWeight += Number(parcelFresh.weight);
            addedParcels.push(
               await tx.parcel.findUniqueOrThrow({
                  where: { id: parcelFresh.id },
                  include: { dispatch: true },
               }),
            );
         }

         if (addedParcels.length > 0) {
            const newStatus =
               currentDispatch.status === DispatchStatus.DRAFT ? DispatchStatus.LOADING : currentDispatch.status;
            await tx.dispatch.update({
               where: { id: dispatchId },
               data: {
                  declared_weight: { increment: totalWeight },
                  declared_parcels_count: { increment: addedParcels.length },
                  status: newStatus,
               },
            });
         }
      });

      if (addedParcels.length > 0) {
         await updateOrderStatusFromParcel(addedParcels[0].id);
      }
      return addedParcels;
   },
   /**
    * Remove parcel from dispatch - Tracking only (no financial logic)
    * Handles: parcel status restoration, tracking events, dispatch weight, dispatch status
    * Financial logic (pricing) is handled only in completeDispatch
    *
    * Validations:
    * - Dispatch must be in DRAFT or LOADING status (not DISPATCHED/RECEIVED) - ROOT can bypass
    *
    * NOTE: All validations happen INSIDE the transaction to prevent race conditions
    */
   removeParcelFromDispatch: async (hbl: string, user_id: string, userRole?: string): Promise<Parcel> => {
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

         // 2. VALIDATE: Dispatch must be modifiable (DRAFT or LOADING only) - ROOT can bypass
         validateDispatchModifiable(currentDispatchStatus, userRole);

         // 3. Get previous status from ParcelEvent history (inside transaction)
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

         const statusDetails = buildParcelStatusDetails({ status: statusToRestore });
         // 4. Update parcel: remove from dispatch and restore previous status
         const updated = await tx.parcel.update({
            where: { tracking_number: hbl },
            data: {
               dispatch_id: null,
               status: statusToRestore,
               status_details: statusDetails,
               events: {
                  create: {
                     event_type: "REMOVED_FROM_DISPATCH",
                     user_id: user_id,
                     status: statusToRestore,
                     status_details: statusDetails,
                     notes: `Removed from dispatch ${dispatchId}, restored to ${statusToRestore}`,
                  },
               },
            },
         });

         // 5. Count remaining parcels after removal
         const remainingParcelsCount = await tx.parcel.count({
            where: { dispatch_id: dispatchId },
         });

         // 6. Determine new dispatch status based on remaining parcels
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

         // 7. Update dispatch with recalculated weight and status
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
      limit: number,
   ): Promise<{ parcels: DispatchParcelListItem[]; total: number }> => {
      const where: Prisma.ParcelWhereInput = {
         agency_id,
         dispatch_id: null,
         status: {
            in: ALLOWED_DISPATCH_STATUSES,
         },
         deleted_at: null,
      };

      const [parcels, total] = await prisma.$transaction([
         prisma.parcel.findMany({
            where,
            orderBy: {
               updated_at: "desc",
            },
            select: {
               id: true,
               tracking_number: true,
               description: true,
               weight: true,
               status: true,
               order_id: true,
               agency: { select: { id: true, name: true } },
               updated_at: true,
            },
            skip: (page - 1) * limit,
            take: limit,
         }),
         prisma.parcel.count({ where }),
      ]);

      return { parcels, total };
   },
   /**
    * Finalize dispatch creation - assign receiver and declared pricing.
    * Debt creation is intentionally deferred to reception/smartReceive.
    */
   finalizeDispatchCreation: async (
      dispatchId: number,
      receiver_agency_id: number,
      sender_agency_id: number,
   ): Promise<Dispatch> => {
      // Validate receiver agency exists
      const receiverAgency = await prisma.agency.findUnique({
         where: { id: receiver_agency_id },
         select: {
            id: true,
            parent_agency_id: true,
         },
      });

      console.log(dispatchId, receiver_agency_id, sender_agency_id, "dispatchId, receiver_agency_id, sender_agency_id");

      if (!receiverAgency) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Receiver agency with id ${receiver_agency_id} not found`);
      }

      // Get dispatch with all parcels (order + order_items for PDF-style cost: inter-agency rate, fees, delivery)
      const dispatch = await prisma.dispatch.findUnique({
         where: { id: dispatchId },
         include: {
            parcels: {
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
                  order: {
                     select: {
                        id: true,
                        order_items: { select: { delivery_fee_in_cents: true } },
                     },
                  },
               },
            },
         },
      });


      console.log(dispatch, "dispatch");

      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
      }

      const declared_cost_in_cents = await calculateDispatchCostFromPdfLogic(
         dispatch.parcels,
         sender_agency_id,
         receiver_agency_id,
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
      user_id: string,
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
               `Parcel ${tracking_number} is already in dispatch ${parcel.dispatch_id}`,
            );
         }

         let wasAdded = false;

         if (isInThisDispatch) {
            const statusDetails = buildParcelStatusDetails({
               status: Status.RECEIVED_IN_DISPATCH,
               dispatch_id: dispatchId,
            });
            // Parcel is in this dispatch, just mark as received
            const updated = await tx.parcel.update({
               where: { tracking_number },
               data: {
                  status: Status.RECEIVED_IN_DISPATCH,
                  status_details: statusDetails,
                  events: {
                     create: {
                        event_type: "RECEIVED_IN_DISPATCH",
                        user_id: user_id,
                        status: Status.RECEIVED_IN_DISPATCH,
                        dispatch_id: dispatchId,
                        status_details: statusDetails,
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
         const statusDetails = buildParcelStatusDetails({
            status: Status.RECEIVED_IN_DISPATCH,
            dispatch_id: dispatchId,
         });
         const updated = await tx.parcel.update({
            where: { tracking_number },
            data: {
               dispatch_id: dispatchId,
               status: Status.RECEIVED_IN_DISPATCH,
               status_details: statusDetails,
               events: {
                  create: {
                     event_type: "RECEIVED_IN_DISPATCH",
                     user_id: user_id,
                     status: Status.RECEIVED_IN_DISPATCH,
                     dispatch_id: dispatchId,
                     status_details: statusDetails,
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
      dispatchId: number,
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
    * Validations:
    * - Parcel must belong to sender agency or its child agencies
    * - Parcel must have valid status for dispatch
    * - Parcel must not already be in another dispatch
    *
    * NOTE: Uses optimistic locking to prevent race conditions -
    * updateMany with conditions ensures only eligible parcels are added
    */
   createDispatchFromParcels: async (
      tracking_numbers: string[],
      sender_agency_id: number,
      user_id: string,
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

         // 2. Get allowed agency IDs (sender + all children) for ownership validation
         const allowedAgencyIds = new Set<number>([sender_agency_id]);
         const childAgencies = await getAllChildAgenciesInTx(tx);
         childAgencies.forEach((id) => allowedAgencyIds.add(id));

         // Helper to get child agencies within transaction
         async function getAllChildAgenciesInTx(txClient: typeof tx): Promise<number[]> {
            const getAllChildren = async (agencyId: number): Promise<number[]> => {
               const directChildren = await txClient.agency.findMany({
                  where: { parent_agency_id: agencyId },
                  select: { id: true },
               });
               const childIds = directChildren.map((c) => c.id);
               const allChildIds = [...childIds];
               for (const childId of childIds) {
                  const grandChildren = await getAllChildren(childId);
                  allChildIds.push(...grandChildren);
               }
               return allChildIds;
            };
            return getAllChildren(sender_agency_id);
         }

         // 3. Classify parcels with fresh data
         const toAdd: Parcel[] = [];
         for (const tn of tracking_numbers) {
            const parcel = parcelMap.get(tn);
            if (!parcel) {
               details.push({ tracking_number: tn, status: "skipped", reason: "Parcel not found" });
               continue;
            }
            // Validate ownership
            if (!parcel.agency_id || !allowedAgencyIds.has(parcel.agency_id)) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: `Parcel does not belong to agency ${sender_agency_id} or its child agencies. Parcel agency: ${parcel.agency_id}`,
               });
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
               status_details: buildParcelStatusDetails({
                  status: Status.IN_DISPATCH,
                  dispatch_id: created.id,
               }),
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
               const statusDetails = buildParcelStatusDetails({
                  status: Status.IN_DISPATCH,
                  dispatch_id: created.id,
               });
               await tx.parcelEvent.createMany({
                  data: actuallyAdded.map((p) => ({
                     parcel_id: p.id,
                     event_type: "ADDED_TO_DISPATCH",
                     notes: `Added to dispatch ${created.id}`,
                     user_id: user_id,
                     location_id: p.current_location_id || null,
                     status: Status.IN_DISPATCH,
                     dispatch_id: created.id,
                     status_details: statusDetails,
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
         const statusDetails = buildParcelStatusDetails({
            status: Status.IN_DISPATCH,
            dispatch_id: created.id,
         });
         await tx.parcelEvent.createMany({
            data: toAdd.map((p) => ({
               parcel_id: p.id,
               event_type: "ADDED_TO_DISPATCH",
               notes: `Added to dispatch ${created.id}`,
               user_id: user_id,
               location_id: p.current_location_id || null,
               status: Status.IN_DISPATCH,
               dispatch_id: created.id,
               status_details: statusDetails,
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
      user_id: string,
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

         // Determine if receiver is FORWARDER (for status determination)
         const receiverIsForwarder = await isForwarderAgencyInTx(tx, receiver_agency_id);
         const receiverChildAgencies = await getAllChildAgenciesInTx(tx, receiver_agency_id);

         // Intermediary receptions keep parcels in dispatch flow.
         // Only forwarder receptions move parcels to warehouse.
         const receivedParcelStatus = receiverIsForwarder ? Status.IN_WAREHOUSE : Status.IN_DISPATCH;

         // 1. Fetch all parcels (order for delivery in PDF-style cost)
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
               order: {
                  select: {
                     id: true,
                     order_items: { select: { delivery_fee_in_cents: true } },
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

            const holder_agency_id = parcel.agency_id;

            if (!holder_agency_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: "Parcel has no agency_id",
               });
               continue;
            }
            // Cannot receive from yourself
            if (holder_agency_id === receiver_agency_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: "Cannot receive parcel from your own agency",
               });
               continue;
            }

            // Validate receiver can receive from this holder
            // FORWARDER can receive from anyone, regular agencies only from their children
            if (!receiverIsForwarder && !receiverChildAgencies.includes(holder_agency_id)) {
               const holderAgency = await tx.agency.findUnique({
                  where: { id: holder_agency_id },
                  select: { name: true },
               });
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  reason: `Cannot receive from agency "${holderAgency?.name || holder_agency_id}" - not a child agency`,
               });
               continue;
            }

            // Group by sender agency (holder)
            if (!parcelsByAgency.has(holder_agency_id)) {
               parcelsByAgency.set(holder_agency_id, []);
            }
            parcelsByAgency.get(holder_agency_id)!.push(parcel);
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

            // Create dispatch with RECEIVED status (cost = PDF logic: inter-agency rate + fees + delivery)
            const receivedCost = await calculateDispatchCostFromPdfLogic(
               agencyParcels,
               sender_agency_id,
               receiver_agency_id,
            );
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
                  cost_in_cents: receivedCost,
                  declared_cost_in_cents: receivedCost,
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
                  status: receivedParcelStatus,
                  status_details: buildParcelStatusDetails({
                     status: receivedParcelStatus,
                     dispatch_id: dispatch.id,
                  }),
               },
            });

            // Create parcel events
            const statusDetails = buildParcelStatusDetails({
               status: receivedParcelStatus,
               dispatch_id: dispatch.id,
            });
            await tx.parcelEvent.createMany({
               data: agencyParcels.map((p) => ({
                  parcel_id: p.id,
                  event_type: "RECEIVED_IN_DISPATCH" as const,
                  notes: `Received without prior dispatch. Dispatch ${dispatch.id} created.${
                     receiverIsForwarder ? " (arrived at warehouse)" : ""
                  }`,
                  user_id,
                  location_id: p.current_location_id || null,
                  status: receivedParcelStatus,
                  dispatch_id: dispatch.id,
                  status_details: statusDetails,
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
      user_id: string,
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
         // 1. Get dispatch with received parcels and all pricing relations (order for delivery in cost)
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
                                 service: true,
                                 pricing_agreement: true,
                              },
                           },
                        },
                     },
                     order: {
                        select: {
                           id: true,
                           order_items: { select: { delivery_fee_in_cents: true } },
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
               `Cannot finalize reception. Dispatch status is ${dispatch.status}, expected DISPATCHED or RECEIVING`,
            );
         }

         if (!dispatch.receiver_agency_id) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, `Dispatch has no receiver agency assigned`);
         }

         // 2. Calculate actual cost (same as dispatch PDF: inter-agency rate + fees + delivery)
         const actual_cost_in_cents = await calculateDispatchCostFromPdfLogic(
            dispatch.parcels,
            dispatch.sender_agency_id,
            dispatch.receiver_agency_id,
         );

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
            dispatchId,
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

   /**
    * Smart Receive - Intelligent parcel reception
    *
    * NEW LOGIC:
    * 1. If ALL parcels from a dispatch are received → Mark dispatch as RECEIVED (NO new dispatch)
    * 2. If PARTIAL parcels from a dispatch are received → Extract to new dispatch, original becomes PARTIAL_RECEIVED
    * 3. Surplus parcels (without dispatch) from same agency as a dispatch → Add to that dispatch
    * 4. Parcels without dispatch and no related dispatch → Create new RECEIVED dispatch
    *
    * Following: Repository pattern, Transaction safety
    */
   smartReceive: async (
      tracking_numbers: string[],
      receiver_agency_id: number,
      user_id: string,
   ): Promise<{
      summary: {
         total_scanned: number;
         total_received: number;
         total_skipped: number;
         surplus_added: number;
      };
      reception_dispatches: Array<{
         dispatch_id: number;
         sender_agency_id: number;
         parcels_count: number;
         status: "RECEIVED";
         is_new: boolean;
         origin_dispatch?: {
            dispatch_id: number;
            original_parcels_count: number;
            remaining_parcels_count: number;
            new_status: string;
         };
         surplus_parcels?: number;
      }>;
      accounting_dispatches: Array<{
         dispatch_id: number;
         sender_agency_id: number;
         receiver_agency_id: number;
         parcels_count: number;
         status: "RECEIVED";
         origin_dispatch_id?: number;
      }>;
      details: Array<{
         tracking_number: string;
         status: "received" | "skipped";
         action: "received_in_dispatch" | "extracted_from_dispatch" | "surplus_added" | "already_processed" | "error";
         dispatch_id?: number;
         origin_dispatch_id?: number;
         reason?: string;
      }>;
      debts_created: Array<{
         debtor_agency_id: number;
         creditor_agency_id: number;
         amount_in_cents: number;
         weight_in_lbs: number;
         parcels_count: number;
         dispatch_id: number;
      }>;
   }> => {
      const result = await prisma.$transaction(async (tx) => {
         const details: Array<{
            tracking_number: string;
            status: "received" | "skipped";
            action:
               | "received_in_dispatch"
               | "extracted_from_dispatch"
               | "surplus_added"
               | "already_processed"
               | "error";
            dispatch_id?: number;
            origin_dispatch_id?: number;
            reason?: string;
         }> = [];

         // ========== 1. FETCH ALL PARCELS WITH DISPATCH INFO ==========
         const parcels = await tx.parcel.findMany({
            where: {
               tracking_number: { in: tracking_numbers },
            },
            include: {
               agency: true,
               dispatch: {
                  select: {
                     id: true,
                     status: true,
                     sender_agency_id: true,
                     receiver_agency_id: true,
                  },
               },
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
               order: {
                  select: {
                     id: true,
                     order_items: { select: { delivery_fee_in_cents: true } },
                  },
               },
            },
         });

         const parcelMap = new Map(parcels.map((p) => [p.tracking_number, p]));

         // ========== 2. CLASSIFY PARCELS ==========

         // Determine if receiver is FORWARDER (for status determination)
         const receiverIsForwarder = await isForwarderAgencyInTx(tx, receiver_agency_id);
         // Get all child agencies of receiver (for reception validation)
         const receiverChildAgencies = await getAllChildAgenciesInTx(tx, receiver_agency_id);

         // Intermediary receptions keep parcels in dispatch flow.
         // Only forwarder receptions move parcels to warehouse.
         const receivedParcelStatus = receiverIsForwarder ? Status.IN_WAREHOUSE : Status.IN_DISPATCH;

         // Group 1: Parcels without dispatch - group by billing sender (potential surplus)
         const withoutDispatch = new Map<number, typeof parcels>();
         // Accounting groups: C -> B when A receives C parcels without dispatch
         const accountingGroups = new Map<
            string,
            {
               sender_agency_id: number;
               receiver_agency_id: number;
               parcels: typeof parcels;
               origin_dispatch_ids: number[];
            }
         >();
         // Cache to resolve billing sender for holder agencies
         const billingSenderCache = new Map<number, number>();
         const resolveBillingSender = async (holderAgencyId: number): Promise<number> => {
            if (billingSenderCache.has(holderAgencyId)) {
               return billingSenderCache.get(holderAgencyId)!;
            }

            const hierarchy = await getAgencyParentHierarchy(holderAgencyId);
            const receiverIndex = hierarchy.indexOf(receiver_agency_id);

            // If receiver is not in hierarchy or receiver is direct parent, bill the holder itself
            let billingSenderId = holderAgencyId;
            if (receiverIndex > 0) {
               // receiverIndex > 0 means there is a parent between holder and receiver
               billingSenderId = hierarchy[receiverIndex - 1];
            }

            billingSenderCache.set(holderAgencyId, billingSenderId);
            return billingSenderId;
         };
         const addToAccountingGroups = (
            senderAgencyId: number,
            receiverAgencyId: number,
            parcelsToAdd: typeof parcels,
            originDispatchId?: number,
         ): void => {
            if (senderAgencyId === receiverAgencyId || parcelsToAdd.length === 0) {
               return;
            }
            const accountingKey = `${senderAgencyId}-${receiverAgencyId}`;
            if (!accountingGroups.has(accountingKey)) {
               accountingGroups.set(accountingKey, {
                  sender_agency_id: senderAgencyId,
                  receiver_agency_id: receiverAgencyId,
                  parcels: [],
                  origin_dispatch_ids: [],
               });
            }
            const group = accountingGroups.get(accountingKey)!;
            group.parcels.push(...parcelsToAdd);
            if (originDispatchId && !group.origin_dispatch_ids.includes(originDispatchId)) {
               group.origin_dispatch_ids.push(originDispatchId);
            }
         };

         // Helper to validate if receiver can receive from holder
         const canReceiveFrom = (holder_agency_id: number): boolean => {
            // FORWARDER can receive from anyone
            if (receiverIsForwarder) {
               return true;
            }
            // Regular agencies can only receive from their child agencies
            return receiverChildAgencies.includes(holder_agency_id);
         };

         // Group 2: Parcels IN a dispatch - group by dispatch_id
         const inDispatch = new Map<
            number,
            {
               dispatch: NonNullable<(typeof parcels)[0]["dispatch"]>;
               parcels: typeof parcels;
            }
         >();

         for (const tn of tracking_numbers) {
            const parcel = parcelMap.get(tn);

            if (!parcel) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  action: "error",
                  reason: "Parcel not found",
               });
               continue;
            }

            const holder_agency_id = getHolderAgencyId(parcel);

            if (!holder_agency_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  action: "error",
                  reason: "Parcel has no agency (derive from dispatch or agency_id)",
               });
               continue;
            }

            // Cannot receive from yourself (check holder, not creator)
            if (holder_agency_id === receiver_agency_id) {
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  action: "error",
                  reason: "Cannot receive parcel - already in your agency",
               });
               continue;
            }

            // Validate receiver can receive from this holder
            // FORWARDER can receive from anyone, regular agencies only from their children
            if (!canReceiveFrom(holder_agency_id)) {
               const holderAgency = await tx.agency.findUnique({
                  where: { id: holder_agency_id },
                  select: { name: true },
               });
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  action: "error",
                  reason: `Cannot receive from agency "${holderAgency?.name || holder_agency_id}" - not a child agency`,
               });
               continue;
            }

            // NO DISPATCH: Group by billing sender (will check for surplus later)
            if (!parcel.dispatch_id || !parcel.dispatch) {
               const billingSenderId = await resolveBillingSender(holder_agency_id);
               if (!withoutDispatch.has(billingSenderId)) {
                  withoutDispatch.set(billingSenderId, []);
               }
               withoutDispatch.get(billingSenderId)!.push(parcel);

               // If holder is a child/grandchild, create accounting group (holder -> billing sender)
               if (billingSenderId !== holder_agency_id) {
                  addToAccountingGroups(holder_agency_id, billingSenderId, [parcel]);
               }
               continue;
            }

            const dispatchData = parcel.dispatch;

            // DISPATCH ALREADY COMPLETED (RECEIVED/DISCREPANCY):
            // The parcel already completed its journey in that dispatch.
            // It can now be received in a NEW dispatch by the next agency in the chain.
            // Example: C→B (D1 RECEIVED), now B→A should create a new dispatch D2
            if (dispatchData.status === DispatchStatus.RECEIVED || dispatchData.status === DispatchStatus.DISCREPANCY) {
               // Holder for RECEIVED/DISCREPANCY is the receiver; ensure parcel is at that agency before moving on
               if (holder_agency_id === dispatchData.receiver_agency_id) {
                  // Parcel completed previous journey, treat as "without active dispatch"
                  const billingSenderId = await resolveBillingSender(holder_agency_id);
                  if (!withoutDispatch.has(billingSenderId)) {
                     withoutDispatch.set(billingSenderId, []);
                  }
                  withoutDispatch.get(billingSenderId)!.push(parcel);

                  // If holder is different from billing sender, create accounting group
                  if (billingSenderId !== holder_agency_id) {
                     addToAccountingGroups(holder_agency_id, billingSenderId, [parcel]);
                  }
                  continue;
               }

               // If holder doesn't match dispatch receiver, parcel not yet at destination
               details.push({
                  tracking_number: tn,
                  status: "skipped",
                  action: "already_processed",
                  dispatch_id: dispatchData.id,
                  reason: `Parcel's dispatch ${dispatchData.id} is ${dispatchData.status} but parcel location mismatch`,
               });
               continue;
            }

            // IN DISPATCH (DRAFT, LOADING, DISPATCHED, RECEIVING, PARTIAL_RECEIVED)
            if (
               dispatchData.status === DispatchStatus.DRAFT ||
               dispatchData.status === DispatchStatus.LOADING ||
               dispatchData.status === DispatchStatus.DISPATCHED ||
               dispatchData.status === DispatchStatus.RECEIVING ||
               dispatchData.status === DispatchStatus.PARTIAL_RECEIVED
            ) {
               // Validate receiver assignment (for DISPATCHED/RECEIVING/PARTIAL_RECEIVED)
               // Allow pass-through reception when assigned receiver is a descendant
               // of the scanning receiver (e.g., dispatch assigned to B but scanned by A).
               if (
                  (dispatchData.status === DispatchStatus.DISPATCHED ||
                     dispatchData.status === DispatchStatus.RECEIVING ||
                     dispatchData.status === DispatchStatus.PARTIAL_RECEIVED) &&
                  dispatchData.receiver_agency_id &&
                  dispatchData.receiver_agency_id !== receiver_agency_id
               ) {
                  let canReceiveAsAncestor = false;
                  if (receiverIsForwarder) {
                     canReceiveAsAncestor = true;
                  } else {
                     const assignedReceiverHierarchy = await getAgencyParentHierarchy(dispatchData.receiver_agency_id);
                     canReceiveAsAncestor = assignedReceiverHierarchy.includes(receiver_agency_id);
                  }

                  if (canReceiveAsAncestor) {
                     // Continue: this receiver can process the dispatch as an ancestor/forwarder.
                  } else {
                  details.push({
                     tracking_number: tn,
                     status: "skipped",
                     action: "error",
                     dispatch_id: dispatchData.id,
                     reason: `Dispatch ${dispatchData.id} is assigned to agency ${dispatchData.receiver_agency_id}, not ${receiver_agency_id}`,
                  });
                  continue;
                  }
               }

               if (!inDispatch.has(dispatchData.id)) {
                  inDispatch.set(dispatchData.id, { dispatch: dispatchData, parcels: [] });
               }
               inDispatch.get(dispatchData.id)!.parcels.push(parcel);
               continue;
            }

            // Unknown status
            details.push({
               tracking_number: tn,
               status: "skipped",
               action: "error",
               dispatch_id: dispatchData.id,
               reason: `Unknown dispatch status: ${dispatchData.status}`,
            });
         }

         // ========== 3. IDENTIFY SURPLUS PARCELS ==========
         // Surplus = parcels without dispatch but from an agency that has a dispatch being received
         const dispatchAgencies = new Set<number>();
         for (const [, { dispatch }] of inDispatch) {
            dispatchAgencies.add(dispatch.sender_agency_id);
         }

         // Map of agency_id -> dispatch_id for surplus assignment
         const agencyToDispatch = new Map<number, number>();
         for (const [dispatchId, { dispatch }] of inDispatch) {
            if (!agencyToDispatch.has(dispatch.sender_agency_id)) {
               agencyToDispatch.set(dispatch.sender_agency_id, dispatchId);
            }
         }

         // Separate surplus from truly without-dispatch parcels
         const surplusParcels = new Map<number, typeof parcels>(); // dispatch_id -> parcels
         const trulyWithoutDispatch = new Map<number, typeof parcels>(); // agency_id -> parcels

         for (const [agencyId, agencyParcels] of withoutDispatch) {
            if (dispatchAgencies.has(agencyId)) {
               // These are surplus - will be added to existing dispatch
               const targetDispatchId = agencyToDispatch.get(agencyId)!;
               if (!surplusParcels.has(targetDispatchId)) {
                  surplusParcels.set(targetDispatchId, []);
               }
               surplusParcels.get(targetDispatchId)!.push(...agencyParcels);
            } else {
               // Truly without dispatch - will create new dispatch
               trulyWithoutDispatch.set(agencyId, agencyParcels);
            }
         }

         // ========== 4. PROCESS DISPATCHES ==========
         const receptionDispatches: Array<{
            dispatch_id: number;
            sender_agency_id: number;
            parcels_count: number;
            status: "RECEIVED";
            is_new: boolean;
            origin_dispatch?: {
               dispatch_id: number;
               original_parcels_count: number;
               remaining_parcels_count: number;
               new_status: string;
            };
            surplus_parcels?: number;
         }> = [];
         const receptionDispatchParcels = new Map<number, typeof parcels>();
         const receptionDispatchBillingSender = new Map<number, number>();
         const accountingDispatches: Array<{
            dispatch_id: number;
            sender_agency_id: number;
            receiver_agency_id: number;
            parcels_count: number;
            status: "RECEIVED";
            origin_dispatch_id?: number;
         }> = [];
         const accountingDispatchParcels = new Map<number, typeof parcels>();

         const parcelIdsProcessed: number[] = [];
         let surplusCount = 0;

         // ----- 4A. Process parcels IN dispatch -----
         for (const [dispatchId, { dispatch: dispatchData, parcels: receivedParcels }] of inDispatch) {
            const billingSenderId = await resolveBillingSender(dispatchData.sender_agency_id);
            // Get all parcels currently in this dispatch
            const totalParcelsInDispatch = await tx.parcel.count({
               where: { dispatch_id: dispatchId },
            });

            // Get surplus parcels for this dispatch (if any)
            const dispatchSurplus = surplusParcels.get(dispatchId) || [];

            // CASE A: Receiving ALL parcels from dispatch (possibly + surplus)
            if (receivedParcels.length === totalParcelsInDispatch) {
               // Calculate total weight including surplus
               let totalWeight = 0;
               for (const p of receivedParcels) {
                  totalWeight += Number(p.weight);
               }
               for (const p of dispatchSurplus) {
                  totalWeight += Number(p.weight);
               }

               // Add surplus parcels to this dispatch
               if (dispatchSurplus.length > 0) {
                  await tx.parcel.updateMany({
                     where: { id: { in: dispatchSurplus.map((p) => p.id) } },
                     data: {
                        dispatch_id: dispatchId,
                        status: receivedParcelStatus,
                        status_details: buildParcelStatusDetails({
                           status: receivedParcelStatus,
                           dispatch_id: dispatchId,
                        }),
                     },
                  });

                  const statusDetails = buildParcelStatusDetails({
                     status: receivedParcelStatus,
                     dispatch_id: dispatchId,
                  });
                  await tx.parcelEvent.createMany({
                     data: dispatchSurplus.map((p) => ({
                        parcel_id: p.id,
                        event_type: "RECEIVED_IN_DISPATCH" as const,
                        notes: `Smart receive: Surplus added to dispatch ${dispatchId}${
                           receiverIsForwarder ? " (arrived at warehouse)" : ""
                        }`,
                        user_id,
                        status: receivedParcelStatus,
                        dispatch_id: dispatchId,
                        status_details: statusDetails,
                     })),
                  });

                  for (const p of dispatchSurplus) {
                     details.push({
                        tracking_number: p.tracking_number,
                        status: "received",
                        action: "surplus_added",
                        dispatch_id: dispatchId,
                     });
                     parcelIdsProcessed.push(p.id);
                     surplusCount++;
                  }
               }

               // Mark existing parcels as received
               await tx.parcel.updateMany({
                  where: { id: { in: receivedParcels.map((p) => p.id) } },
                  data: {
                     status: receivedParcelStatus,
                     status_details: buildParcelStatusDetails({
                        status: receivedParcelStatus,
                        dispatch_id: dispatchId,
                     }),
                  },
               });

               const statusDetails = buildParcelStatusDetails({
                  status: receivedParcelStatus,
                  dispatch_id: dispatchId,
               });
               await tx.parcelEvent.createMany({
                  data: receivedParcels.map((p) => ({
                     parcel_id: p.id,
                     event_type: "RECEIVED_IN_DISPATCH" as const,
                     notes: `Smart receive: Received in dispatch ${dispatchId}${
                        receiverIsForwarder ? " (arrived at warehouse)" : ""
                     }`,
                     user_id,
                     status: receivedParcelStatus,
                     dispatch_id: dispatchId,
                     status_details: statusDetails,
                  })),
               });

               // Update dispatch as RECEIVED (cost = PDF logic: inter-agency rate + fees + delivery)
               const finalParcelCount = receivedParcels.length + dispatchSurplus.length;
               const allParcelsForCost = [...receivedParcels, ...dispatchSurplus];
               const cost_in_cents = await calculateDispatchCostFromPdfLogic(
                  allParcelsForCost,
                  dispatchData.sender_agency_id,
                  dispatchData.receiver_agency_id ?? receiver_agency_id,
               );
               await tx.dispatch.update({
                  where: { id: dispatchId },
                  data: {
                     status: DispatchStatus.RECEIVED,
                     receiver_agency_id: dispatchData.receiver_agency_id || receiver_agency_id,
                     received_by_id: user_id,
                     received_parcels_count: finalParcelCount,
                     declared_parcels_count: finalParcelCount,
                     declared_weight: Math.round(totalWeight * 100) / 100,
                     weight: Math.round(totalWeight * 100) / 100,
                     cost_in_cents,
                     declared_cost_in_cents: cost_in_cents,
                  },
               });

               for (const p of receivedParcels) {
                  details.push({
                     tracking_number: p.tracking_number,
                     status: "received",
                     action: "received_in_dispatch",
                     dispatch_id: dispatchId,
                  });
                  parcelIdsProcessed.push(p.id);
               }

               receptionDispatches.push({
                  dispatch_id: dispatchId,
                  sender_agency_id: dispatchData.sender_agency_id,
                  parcels_count: finalParcelCount,
                  status: "RECEIVED",
                  is_new: false,
                  surplus_parcels: dispatchSurplus.length > 0 ? dispatchSurplus.length : undefined,
               });
               const dispatchParcels = [...receivedParcels, ...dispatchSurplus];
               receptionDispatchParcels.set(dispatchId, dispatchParcels);
               receptionDispatchBillingSender.set(dispatchId, billingSenderId);
               if (billingSenderId !== dispatchData.sender_agency_id) {
                  addToAccountingGroups(dispatchData.sender_agency_id, billingSenderId, dispatchParcels, dispatchId);
               }
            }
            // CASE B: Receiving PARTIAL parcels from dispatch → Extract to new dispatch
            else {
               // Calculate weight of parcels being extracted
               let extractedWeight = 0;
               for (const p of receivedParcels) {
                  extractedWeight += Number(p.weight);
               }

               // Include surplus in the new reception dispatch
               for (const p of dispatchSurplus) {
                  extractedWeight += Number(p.weight);
               }

               // Create NEW reception dispatch (cost = PDF logic)
               const extractedParcels = [...receivedParcels, ...dispatchSurplus];
               const extractedCost = await calculateDispatchCostFromPdfLogic(
                  extractedParcels,
                  dispatchData.sender_agency_id,
                  receiver_agency_id,
               );
               const receptionDispatch = await tx.dispatch.create({
                  data: {
                     sender_agency_id: dispatchData.sender_agency_id,
                     receiver_agency_id,
                     created_by_id: user_id,
                     received_by_id: user_id,
                     status: DispatchStatus.RECEIVED,
                     declared_parcels_count: extractedParcels.length,
                     received_parcels_count: extractedParcels.length,
                     declared_weight: Math.round(extractedWeight * 100) / 100,
                     weight: Math.round(extractedWeight * 100) / 100,
                     cost_in_cents: extractedCost,
                     declared_cost_in_cents: extractedCost,
                     origin_dispatch_id: dispatchId,
                  },
               });

               // Move parcels from origin to new reception dispatch
               await tx.parcel.updateMany({
                  where: { id: { in: receivedParcels.map((p) => p.id) } },
                  data: {
                     dispatch_id: receptionDispatch.id,
                     status: receivedParcelStatus,
                     status_details: buildParcelStatusDetails({
                        status: receivedParcelStatus,
                        dispatch_id: receptionDispatch.id,
                     }),
                  },
               });

               const statusDetails = buildParcelStatusDetails({
                  status: receivedParcelStatus,
                  dispatch_id: receptionDispatch.id,
               });
               await tx.parcelEvent.createMany({
                  data: receivedParcels.map((p) => ({
                     parcel_id: p.id,
                     event_type: "RECEIVED_IN_DISPATCH" as const,
                     notes: `Smart receive: Extracted from dispatch ${dispatchId} to reception dispatch ${
                        receptionDispatch.id
                     }${receiverIsForwarder ? " (arrived at warehouse)" : ""}`,
                     user_id,
                     status: receivedParcelStatus,
                     dispatch_id: receptionDispatch.id,
                     status_details: statusDetails,
                  })),
               });

               // Add surplus parcels to the new reception dispatch
               if (dispatchSurplus.length > 0) {
                  await tx.parcel.updateMany({
                     where: { id: { in: dispatchSurplus.map((p) => p.id) } },
                     data: {
                        dispatch_id: receptionDispatch.id,
                        status: receivedParcelStatus,
                        status_details: buildParcelStatusDetails({
                           status: receivedParcelStatus,
                           dispatch_id: receptionDispatch.id,
                        }),
                     },
                  });

                  const statusDetailsSurplus = buildParcelStatusDetails({
                     status: receivedParcelStatus,
                     dispatch_id: receptionDispatch.id,
                  });
                  await tx.parcelEvent.createMany({
                     data: dispatchSurplus.map((p) => ({
                        parcel_id: p.id,
                        event_type: "RECEIVED_IN_DISPATCH" as const,
                        notes: `Smart receive: Surplus added to reception dispatch ${receptionDispatch.id}${
                           receiverIsForwarder ? " (arrived at warehouse)" : ""
                        }`,
                        user_id,
                        status: receivedParcelStatus,
                        dispatch_id: receptionDispatch.id,
                        status_details: statusDetailsSurplus,
                     })),
                  });

                  for (const p of dispatchSurplus) {
                     details.push({
                        tracking_number: p.tracking_number,
                        status: "received",
                        action: "surplus_added",
                        dispatch_id: receptionDispatch.id,
                     });
                     parcelIdsProcessed.push(p.id);
                     surplusCount++;
                  }
               }

               // Count remaining parcels in origin dispatch
               const remainingParcelCount = await tx.parcel.count({
                  where: { dispatch_id: dispatchId },
               });

               // Recalculate origin dispatch weight
               const remainingParcels = await tx.parcel.findMany({
                  where: { dispatch_id: dispatchId },
                  select: { weight: true },
               });
               let remainingWeight = 0;
               for (const p of remainingParcels) {
                  remainingWeight += Number(p.weight);
               }

               // Update origin dispatch as PARTIAL_RECEIVED
               await tx.dispatch.update({
                  where: { id: dispatchId },
                  data: {
                     status: DispatchStatus.PARTIAL_RECEIVED,
                     declared_parcels_count: remainingParcelCount,
                     declared_weight: Math.round(remainingWeight * 100) / 100,
                     receiver_agency_id: dispatchData.receiver_agency_id || receiver_agency_id,
                  },
               });

               for (const p of receivedParcels) {
                  details.push({
                     tracking_number: p.tracking_number,
                     status: "received",
                     action: "extracted_from_dispatch",
                     dispatch_id: receptionDispatch.id,
                     origin_dispatch_id: dispatchId,
                  });
                  parcelIdsProcessed.push(p.id);
               }

               receptionDispatches.push({
                  dispatch_id: receptionDispatch.id,
                  sender_agency_id: dispatchData.sender_agency_id,
                  parcels_count: receivedParcels.length + dispatchSurplus.length,
                  status: "RECEIVED",
                  is_new: true,
                  origin_dispatch: {
                     dispatch_id: dispatchId,
                     original_parcels_count: totalParcelsInDispatch,
                     remaining_parcels_count: remainingParcelCount,
                     new_status: DispatchStatus.PARTIAL_RECEIVED,
                  },
                  surplus_parcels: dispatchSurplus.length > 0 ? dispatchSurplus.length : undefined,
               });
               const dispatchParcels = [...receivedParcels, ...dispatchSurplus];
               receptionDispatchParcels.set(receptionDispatch.id, dispatchParcels);
               receptionDispatchBillingSender.set(receptionDispatch.id, billingSenderId);
               if (billingSenderId !== dispatchData.sender_agency_id) {
                  addToAccountingGroups(
                     dispatchData.sender_agency_id,
                     billingSenderId,
                     dispatchParcels,
                     receptionDispatch.id,
                  );
               }
            }

            // Remove processed surplus from map
            surplusParcels.delete(dispatchId);
         }

         // ----- 4B. Parcels WITHOUT dispatch (no related dispatch being received): Create new dispatch -----
         for (const [sender_agency_id, agencyParcels] of trulyWithoutDispatch) {
            let totalWeight = 0;
            for (const p of agencyParcels) {
               totalWeight += Number(p.weight);
            }

            const newDispatchCost = await calculateDispatchCostFromPdfLogic(
               agencyParcels,
               sender_agency_id,
               receiver_agency_id,
            );
            const newDispatch = await tx.dispatch.create({
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
                  cost_in_cents: newDispatchCost,
                  declared_cost_in_cents: newDispatchCost,
               },
            });

            await tx.parcel.updateMany({
               where: { id: { in: agencyParcels.map((p) => p.id) } },
               data: {
                  dispatch_id: newDispatch.id,
                  status: receivedParcelStatus,
                  status_details: buildParcelStatusDetails({
                     status: receivedParcelStatus,
                     dispatch_id: newDispatch.id,
                  }),
               },
            });

            const statusDetails = buildParcelStatusDetails({
               status: receivedParcelStatus,
               dispatch_id: newDispatch.id,
            });
            await tx.parcelEvent.createMany({
               data: agencyParcels.map((p) => ({
                  parcel_id: p.id,
                  event_type: "RECEIVED_IN_DISPATCH" as const,
                  notes: `Smart receive: Created reception dispatch ${newDispatch.id}${
                     receiverIsForwarder ? " (arrived at warehouse)" : ""
                  }`,
                  user_id,
                  status: receivedParcelStatus,
                  dispatch_id: newDispatch.id,
                  status_details: statusDetails,
               })),
            });

            for (const p of agencyParcels) {
               details.push({
                  tracking_number: p.tracking_number,
                  status: "received",
                  action: "received_in_dispatch",
                  dispatch_id: newDispatch.id,
               });
               parcelIdsProcessed.push(p.id);
            }

            receptionDispatches.push({
               dispatch_id: newDispatch.id,
               sender_agency_id,
               parcels_count: agencyParcels.length,
               status: "RECEIVED",
               is_new: true,
            });
            receptionDispatchParcels.set(newDispatch.id, [...agencyParcels]);
            receptionDispatchBillingSender.set(newDispatch.id, sender_agency_id);
         }

         // ========== 5. CREATE ACCOUNTING DISPATCHES (C -> B) ==========
         for (const [, group] of accountingGroups) {
            const totalWeight = group.parcels.reduce((sum, p) => sum + Number(p.weight), 0);
            const matchingReceptionDispatch = receptionDispatches.find(
               (d) => d.sender_agency_id === group.receiver_agency_id,
            );
            const linkedOriginDispatchId = group.origin_dispatch_ids[0] ?? matchingReceptionDispatch?.dispatch_id;

            const accountingCost = await calculateDispatchCostFromPdfLogic(
               group.parcels,
               group.sender_agency_id,
               group.receiver_agency_id,
            );
            const accountingDispatch = await tx.dispatch.create({
               data: {
                  sender_agency_id: group.sender_agency_id,
                  receiver_agency_id: group.receiver_agency_id,
                  created_by_id: user_id,
                  received_by_id: user_id,
                  status: DispatchStatus.RECEIVED,
                  declared_parcels_count: group.parcels.length,
                  received_parcels_count: group.parcels.length,
                  declared_weight: Math.round(totalWeight * 100) / 100,
                  weight: Math.round(totalWeight * 100) / 100,
                  cost_in_cents: accountingCost,
                  declared_cost_in_cents: accountingCost,
                  origin_dispatch_id: linkedOriginDispatchId,
               },
            });

            accountingDispatches.push({
               dispatch_id: accountingDispatch.id,
               sender_agency_id: group.sender_agency_id,
               receiver_agency_id: group.receiver_agency_id,
               parcels_count: group.parcels.length,
               status: "RECEIVED",
               origin_dispatch_id: linkedOriginDispatchId,
            });
            accountingDispatchParcels.set(accountingDispatch.id, [...group.parcels]);
         }

         // ========== 6. GENERATE DEBTS ==========
         // Get all processed parcels with their info for debt calculation
         const createdDebts: Array<{
            debtor_agency_id: number;
            creditor_agency_id: number;
            amount_in_cents: number;
            weight_in_lbs: number;
            parcels_count: number;
            dispatch_id: number;
         }> = [];

         // Prevent duplicated debts when smartReceive processes an existing dispatch
         // that already has pending debts created at dispatch finalization time.
         const dispatchIdsForDebtRefresh = [
            ...receptionDispatchParcels.keys(),
            ...accountingDispatchParcels.keys(),
         ];
         if (dispatchIdsForDebtRefresh.length > 0) {
            await tx.interAgencyDebt.updateMany({
               where: {
                  dispatch_id: { in: dispatchIdsForDebtRefresh },
                  status: DebtStatus.PENDING,
               },
               data: {
                  status: DebtStatus.CANCELLED,
                  notes:
                     "Cancelled by smartReceive debt refresh: recalculating debts from received parcels.",
               },
            });
         }

         // Debts for reception dispatches (B -> A)
         for (const [dispatchId, dispatchParcels] of receptionDispatchParcels) {
            const dispatchInfo = receptionDispatches.find((d) => d.dispatch_id === dispatchId);
            if (!dispatchInfo) {
               continue;
            }
            const billingSenderId = receptionDispatchBillingSender.get(dispatchId) || dispatchInfo.sender_agency_id;

            const debtInfos = await generateDispatchDebts(
               receiver_agency_id,
               dispatchParcels.map((p) => ({
                  id: p.id,
                  order_id: p.order_id,
                  holder_agency_id: billingSenderId,
                  agency_id: p.agency_id,
                  weight: p.weight,
                  order: p.order,
                  order_items: p.order_items.map((oi) => ({
                     weight: oi.weight,
                     price_in_cents: oi.price_in_cents,
                     customs_fee_in_cents: oi.customs_fee_in_cents,
                     insurance_fee_in_cents: oi.insurance_fee_in_cents,
                     delivery_fee_in_cents: oi.delivery_fee_in_cents,
                     charge_fee_in_cents: oi.charge_fee_in_cents,
                     rate: oi.rate
                        ? {
                             product_id: oi.rate.product_id,
                             service_id: oi.rate.service_id,
                             product: { unit: oi.rate.product.unit },
                          }
                        : null,
                  })),
               })),
               dispatchId,
            );

            for (const debtInfo of debtInfos) {
               await tx.interAgencyDebt.create({
                  data: {
                     debtor_agency_id: debtInfo.debtor_agency_id,
                     creditor_agency_id: debtInfo.creditor_agency_id,
                     dispatch_id: dispatchId,
                     amount_in_cents: debtInfo.amount_in_cents,
                     original_sender_agency_id: debtInfo.debtor_agency_id,
                     relationship: debtInfo.relationship,
                     status: DebtStatus.PENDING,
                     notes: `Smart receive: ${debtInfo.parcels_count} parcels, ${debtInfo.weight_in_lbs.toFixed(
                        2,
                     )} lbs`,
                  },
               });

               createdDebts.push({
                  debtor_agency_id: debtInfo.debtor_agency_id,
                  creditor_agency_id: debtInfo.creditor_agency_id,
                  amount_in_cents: debtInfo.amount_in_cents,
                  weight_in_lbs: debtInfo.weight_in_lbs,
                  parcels_count: debtInfo.parcels_count,
                  dispatch_id: dispatchId,
               });
            }
         }

         // Debts for accounting dispatches (C -> B)
         for (const [dispatchId, dispatchParcels] of accountingDispatchParcels) {
            const dispatchInfo = accountingDispatches.find((d) => d.dispatch_id === dispatchId);
            if (!dispatchInfo) {
               continue;
            }

            const debtInfos = await generateDispatchDebts(
               dispatchInfo.receiver_agency_id,
               dispatchParcels.map((p) => ({
                  id: p.id,
                  order_id: p.order_id,
                  holder_agency_id: dispatchInfo.sender_agency_id,
                  agency_id: p.agency_id,
                  weight: p.weight,
                  order: p.order,
                  order_items: p.order_items.map((oi) => ({
                     weight: oi.weight,
                     price_in_cents: oi.price_in_cents,
                     customs_fee_in_cents: oi.customs_fee_in_cents,
                     insurance_fee_in_cents: oi.insurance_fee_in_cents,
                     delivery_fee_in_cents: oi.delivery_fee_in_cents,
                     charge_fee_in_cents: oi.charge_fee_in_cents,
                     rate: oi.rate
                        ? {
                             product_id: oi.rate.product_id,
                             service_id: oi.rate.service_id,
                             product: { unit: oi.rate.product.unit },
                          }
                        : null,
                  })),
               })),
               dispatchId,
            );

            for (const debtInfo of debtInfos) {
               await tx.interAgencyDebt.create({
                  data: {
                     debtor_agency_id: debtInfo.debtor_agency_id,
                     creditor_agency_id: debtInfo.creditor_agency_id,
                     dispatch_id: dispatchId,
                     amount_in_cents: debtInfo.amount_in_cents,
                     original_sender_agency_id: debtInfo.debtor_agency_id,
                     relationship: debtInfo.relationship,
                     status: DebtStatus.PENDING,
                     notes: `Accounting dispatch: ${debtInfo.parcels_count} parcels, ${debtInfo.weight_in_lbs.toFixed(
                        2,
                     )} lbs`,
                  },
               });

               createdDebts.push({
                  debtor_agency_id: debtInfo.debtor_agency_id,
                  creditor_agency_id: debtInfo.creditor_agency_id,
                  amount_in_cents: debtInfo.amount_in_cents,
                  weight_in_lbs: debtInfo.weight_in_lbs,
                  parcels_count: debtInfo.parcels_count,
                  dispatch_id: dispatchId,
               });
            }
         }

         // ========== 7. BUILD RESULT ==========
         const totalReceived = details.filter((d) => d.status === "received").length;
         const totalSkipped = details.filter((d) => d.status === "skipped").length;

         return {
            summary: {
               total_scanned: tracking_numbers.length,
               total_received: totalReceived,
               total_skipped: totalSkipped,
               surplus_added: surplusCount,
            },
            reception_dispatches: receptionDispatches,
            accounting_dispatches: accountingDispatches,
            details,
            parcelIds: parcelIdsProcessed,
            debts_created: createdDebts,
         };
      });

      // Update order statuses outside transaction
      for (const parcelId of result.parcelIds) {
         await updateOrderStatusFromParcel(parcelId);
      }

      return {
         summary: result.summary,
         reception_dispatches: result.reception_dispatches,
         accounting_dispatches: result.accounting_dispatches,
         details: result.details,
         debts_created: result.debts_created,
      };
   },
};

export default dispatch;
