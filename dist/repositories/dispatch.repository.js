"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
const app_errors_1 = require("../common/app-errors");
const parcels_repository_1 = __importDefault(require("./parcels.repository"));
const dispatch_utils_1 = require("../utils/dispatch-utils");
// Allowed statuses for parcels to be added to dispatch
const ALLOWED_DISPATCH_STATUSES = [
    client_1.Status.IN_AGENCY,
    client_1.Status.IN_PALLET,
    client_1.Status.IN_DISPATCH,
    client_1.Status.IN_WAREHOUSE,
];
/**
 * Validates if a parcel status allows it to be added to dispatch
 */
const isValidStatusForDispatch = (status) => {
    return ALLOWED_DISPATCH_STATUSES.includes(status);
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
const recalculateDispatchWeight = (prismaClient, dispatchId) => __awaiter(void 0, void 0, void 0, function* () {
    // Get all parcels in dispatch
    const parcels = yield prismaClient.parcel.findMany({
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
});
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
    get: (page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatches = yield prisma_client_1.default.dispatch.findMany({
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                status: true,
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
        const total = yield prisma_client_1.default.dispatch.count();
        return { dispatches, total };
    }),
    getById: (id) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatch = yield prisma_client_1.default.dispatch.findUnique({
            where: { id: id },
        });
        return dispatch;
    }),
    getParcelsInDispatch: (id_1, status_1, ...args_1) => __awaiter(void 0, [id_1, status_1, ...args_1], void 0, function* (id, status, page = 1, limit = 20) {
        console.log("status", status);
        // Validate and ensure limit is always applied
        const parcels = yield prisma_client_1.default.parcel.findMany({
            where: { dispatch_id: id, status: status },
            orderBy: { updated_at: "desc" },
            take: limit,
            skip: (page - 1) * limit,
        });
        const total = yield prisma_client_1.default.parcel.count({
            where: { dispatch_id: id, status: status },
        });
        return { parcels: parcels, total: total };
    }),
    create: (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        const newDispatch = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Ensure status is DRAFT if not provided
            const dispatchData = Object.assign(Object.assign({}, dispatch), { status: dispatch.status || client_1.DispatchStatus.DRAFT });
            const created = yield tx.dispatch.create({
                data: dispatchData,
            });
            return created;
        }));
        return newDispatch;
    }),
    getItemByParcelId: (parcelId) => __awaiter(void 0, void 0, void 0, function* () {
        const item = yield prisma_client_1.default.parcel.findFirst({
            where: { id: parcelId },
        });
        return item;
    }),
    update: (id, dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedDispatch = yield prisma_client_1.default.dispatch.update({
            where: { id: id },
            data: dispatch,
        });
        return updatedDispatch;
    }),
    delete: (id, user_agency_id, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Get dispatch with all parcels
        const dispatch = yield prisma_client_1.default.dispatch.findUnique({
            where: { id },
            include: {
                parcels: true,
            },
        });
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Dispatch with id ${id} not found`);
        }
        // Validate that user's agency is the sender agency (skip check if user_agency_id is null, meaning ROOT user)
        if (user_agency_id !== null && dispatch.sender_agency_id !== user_agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, `Only the sender agency can delete this dispatch. Your agency: ${user_agency_id}, Sender agency: ${dispatch.sender_agency_id}`);
        }
        // Check if dispatch can be deleted (only DRAFT or CANCELLED can be deleted)
        const deletableStatuses = [client_1.DispatchStatus.DRAFT, client_1.DispatchStatus.CANCELLED];
        if (!deletableStatuses.includes(dispatch.status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Dispatch with status ${dispatch.status} cannot be deleted. Only dispatches with status DRAFT or CANCELLED can be deleted.`);
        }
        // Use transaction to ensure all updates succeed
        const deletedDispatch = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Restore all parcels from dispatch
            for (const parcel of dispatch.parcels) {
                // Get previous status from ParcelEvent history
                const previousStatus = yield parcels_repository_1.default.getPreviousStatus(parcel.id);
                const statusToRestore = previousStatus || client_1.Status.IN_AGENCY;
                // Update parcel: remove from dispatch and restore previous status
                yield tx.parcel.update({
                    where: { id: parcel.id },
                    data: {
                        dispatch_id: null,
                        status: statusToRestore,
                        events: {
                            create: {
                                user_id: user_id,
                                status: statusToRestore,
                            },
                        },
                    },
                });
            }
            // Delete the dispatch
            const deleted = yield tx.dispatch.delete({
                where: { id },
            });
            return deleted;
        }));
        return deletedDispatch;
    }),
    /**
     * Add parcel to dispatch - Tracking only (no financial logic)
     * Handles: parcel status update, tracking events, dispatch weight, dispatch status
     * Financial logic (pricing) is handled only in completeDispatch
     */
    addParcelToDispatch: (parcel, dispatchId, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Validate parcel status before adding
        if (!isValidStatusForDispatch(parcel.status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel with status ${parcel.status} cannot be added to dispatch. Allowed statuses: ${ALLOWED_DISPATCH_STATUSES.join(", ")}`);
        }
        // Check if parcel is already in a dispatch
        if (parcel.dispatch_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.CONFLICT, `Parcel ${parcel.tracking_number} is already in dispatch ${parcel.dispatch_id}`);
        }
        // Use transaction to ensure parcel update, dispatch update, and event creation all succeed
        const updatedDispatch = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update the parcel status and connect it to dispatch
            yield tx.parcel.update({
                where: { id: parcel.id },
                data: {
                    dispatch_id: dispatchId,
                    status: client_1.Status.IN_DISPATCH,
                },
            });
            // Create event to register the parcel being added to dispatch
            yield tx.parcelEvent.create({
                data: {
                    parcel_id: parcel.id,
                    user_id: user_id,
                    location_id: parcel.current_location_id || null,
                    status: client_1.Status.IN_DISPATCH,
                },
            });
            // Update dispatch - removed unnecessary include to avoid extra query
            const updatedDispatch = yield tx.dispatch.update({
                where: { id: dispatchId },
                data: {
                    declared_weight: {
                        increment: parcel.weight,
                    },
                    declared_parcels_count: {
                        increment: 1,
                    },
                },
            });
            return updatedDispatch;
        }));
        return updatedDispatch;
    }),
    /**
     * Remove parcel from dispatch - Tracking only (no financial logic)
     * Handles: parcel status restoration, tracking events, dispatch weight, dispatch status
     * Financial logic (pricing) is handled only in completeDispatch
     */
    removeParcelFromDispatch: (hbl, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Get parcel first to access its dispatch_id
        const parcel = yield prisma_client_1.default.parcel.findUnique({
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
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${hbl} not found`);
        }
        if (!parcel.dispatch_id || !parcel.dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Parcel ${hbl} is not in any dispatch`);
        }
        // Get previous status from ParcelEvent history
        const previousStatus = yield parcels_repository_1.default.getPreviousStatus(parcel.id);
        const statusToRestore = previousStatus || client_1.Status.IN_AGENCY;
        // Store dispatch info in constants to ensure TypeScript knows they're not null
        const dispatchId = parcel.dispatch_id;
        const dispatch = parcel.dispatch;
        // Use transaction to ensure all updates succeed
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update parcel: remove from dispatch and restore previous status
            const updated = yield tx.parcel.update({
                where: { tracking_number: hbl },
                data: {
                    dispatch_id: null,
                    status: statusToRestore,
                    events: {
                        create: {
                            user_id: user_id,
                            status: statusToRestore,
                        },
                    },
                },
            });
            // Count remaining parcels after removal
            const remainingParcelsCount = yield tx.parcel.count({
                where: { dispatch_id: dispatchId },
            });
            // Determine status: if no parcels left, change to DRAFT
            const newStatus = remainingParcelsCount === 0 ? client_1.DispatchStatus.DRAFT : dispatch.status;
            // Update dispatch with recalculated weight and status
            // Note: cost_in_cents is NOT updated here - only in completeDispatch
            yield tx.dispatch.update({
                where: { id: dispatchId },
                data: {
                    declared_weight: {
                        decrement: parcel.weight,
                    },
                    declared_parcels_count: {
                        decrement: 1,
                    },
                    status: newStatus,
                },
            });
            return updated;
        }));
        return updatedParcel;
    }),
    readyForDispatch: (agency_id, page, limit) => __awaiter(void 0, void 0, void 0, function* () {
        const parcels = yield prisma_client_1.default.parcel.findMany({
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
        const total = yield prisma_client_1.default.parcel.count({
            where: {
                agency_id,
                dispatch_id: null,
                status: {
                    in: ALLOWED_DISPATCH_STATUSES,
                },
            },
        });
        return { parcels: parcels, total: total };
    }),
    /**
     * Complete dispatch - Assign receiver agency and calculate all financials
     * This is the ONLY method that handles financial logic (pricing calculations)
     * addItem and removeItem only handle tracking operations (no pricing)
     */
    completeDispatch: (dispatchId, receiver_agency_id, sender_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Validate receiver agency exists
        const receiverAgency = yield prisma_client_1.default.agency.findUnique({
            where: { id: receiver_agency_id },
            select: {
                id: true,
                parent_agency_id: true,
            },
        });
        if (!receiverAgency) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Receiver agency with id ${receiver_agency_id} not found`);
        }
        // Get dispatch with all parcels
        const dispatch = yield prisma_client_1.default.dispatch.findUnique({
            where: { id: dispatchId },
            include: {
                parcels: {
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
                },
            },
        });
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
        }
        // Calculate declared_cost_in_cents using the utility function
        const declared_cost_in_cents = (0, dispatch_utils_1.calculateDispatchCost)(dispatch);
        console.log("declared_cost_in_cents", declared_cost_in_cents);
        // Update dispatch with declared_cost_in_cents and status
        const updatedDispatch = yield prisma_client_1.default.dispatch.update({
            where: { id: dispatchId },
            data: {
                declared_cost_in_cents,
                status: client_1.DispatchStatus.DISPATCHED,
            },
        });
        return updatedDispatch;
    }),
    /**
     * Receive parcel in dispatch - Reconciliation process
     * Used when receiving agency scans parcels to verify dispatch contents
     * 1. If parcel is already in dispatch -> mark as RECEIVED_IN_DISPATCH
     * 2. If parcel is NOT in dispatch but exists in DB -> add to dispatch and mark as received
     *    (This handles cases where sender agency didn't scan the parcel)
     * 3. If parcel doesn't exist -> throw error
     */
    receiveInDispatch: (tracking_number, dispatchId, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Verify dispatch exists
        const dispatch = yield prisma_client_1.default.dispatch.findUnique({
            where: { id: dispatchId },
        });
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
        }
        // First, check if parcel is already in this dispatch
        const parcelInDispatch = yield prisma_client_1.default.parcel.findFirst({
            where: {
                tracking_number: tracking_number,
                dispatch_id: dispatchId,
            },
        });
        let wasAdded = false;
        if (parcelInDispatch) {
            // Parcel exists in dispatch, mark as received
            const updatedParcel = yield prisma_client_1.default.parcel.update({
                where: { tracking_number: tracking_number },
                data: {
                    status: client_1.Status.RECEIVED_IN_DISPATCH,
                    events: {
                        create: {
                            user_id: user_id,
                            status: client_1.Status.RECEIVED_IN_DISPATCH,
                        },
                    },
                },
            });
            return { parcel: updatedParcel, wasAdded: false };
        }
        // Parcel not in dispatch, find the parcel by tracking_number
        const existingParcel = yield parcels_repository_1.default.findParcelByHbl(tracking_number);
        if (!existingParcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Parcel with tracking number ${tracking_number} not found`);
        }
        // Parcel exists but sender agency didn't scan it into dispatch
        // Add it to dispatch and mark as received
        wasAdded = true;
        const updatedParcel = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update parcel: add to dispatch and mark as received
            const updated = yield tx.parcel.update({
                where: { tracking_number: tracking_number },
                data: {
                    dispatch_id: dispatchId,
                    status: client_1.Status.RECEIVED_IN_DISPATCH,
                    events: {
                        create: {
                            user_id: user_id,
                            status: client_1.Status.RECEIVED_IN_DISPATCH,
                        },
                    },
                },
            });
            // Recalculate dispatch weight since we added a parcel
            const weight = yield recalculateDispatchWeight(tx, dispatchId);
            yield tx.dispatch.update({
                where: { id: dispatchId },
                data: { weight },
            });
            return updated;
        }));
        return { parcel: updatedParcel, wasAdded: true };
    }),
    /**
     * Get reception status summary for a dispatch
     * Returns: total expected (original parcels), received, missing, and added parcels
     * Used to track reconciliation progress when receiving agency verifies dispatch contents
     */
    getReceptionStatus: (dispatchId) => __awaiter(void 0, void 0, void 0, function* () {
        // Get dispatch creation time to identify original parcels
        const dispatch = yield prisma_client_1.default.dispatch.findUnique({
            where: { id: dispatchId },
            select: { created_at: true, updated_at: true, status: true },
        });
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Dispatch with id ${dispatchId} not found`);
        }
        // Get all parcels currently in dispatch
        const allParcelsInDispatch = yield prisma_client_1.default.parcel.findMany({
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
        const originalParcels = [];
        const addedParcels = [];
        for (const parcel of allParcelsInDispatch) {
            // Check if parcel has IN_DISPATCH event before RECEIVED_IN_DISPATCH
            const hasInDispatchEvent = parcel.events.some((event) => event.status === client_1.Status.IN_DISPATCH);
            const hasReceivedEvent = parcel.events.some((event) => event.status === client_1.Status.RECEIVED_IN_DISPATCH);
            // If parcel has RECEIVED_IN_DISPATCH but never had IN_DISPATCH, it was added during reception
            if (hasReceivedEvent && !hasInDispatchEvent) {
                addedParcels.push(parcel);
            }
            else {
                originalParcels.push(parcel);
            }
        }
        const totalExpected = originalParcels.length; // Original parcels in dispatch
        const totalAdded = addedParcels.length;
        // Separate received and missing from original parcels
        const receivedParcels = originalParcels.filter((p) => p.status === client_1.Status.RECEIVED_IN_DISPATCH);
        const missingParcels = originalParcels.filter((p) => p.status !== client_1.Status.RECEIVED_IN_DISPATCH);
        const totalReceived = receivedParcels.length;
        const totalMissing = missingParcels.length;
        // Get all received parcels (original + added) for the response
        const allReceivedParcels = yield prisma_client_1.default.parcel.findMany({
            where: {
                dispatch_id: dispatchId,
                status: client_1.Status.RECEIVED_IN_DISPATCH,
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
    }),
};
exports.default = dispatch;
