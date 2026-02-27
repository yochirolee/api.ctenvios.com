import { Response } from "express";
import { Dispatch, DispatchStatus, PaymentStatus, Roles, Status } from "@prisma/client";
import repository from "../repositories";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import { generateDispatchPDF, DispatchPdfDetails } from "../utils/pdf/generate-dispatch-pdf";
import {
   generateDispatchPaymentReceiptPDF,
   DispatchPaymentReceiptData,
} from "../utils/pdf/generate-dispatch-payment-receipt";

interface DispatchRequest {
   user?: {
      id: string;
      role: Roles;
      agency_id?: number;
   };
   query: {
      page?: string;
      limit?: string;
      status?: string;
      payment_status?: string;
      dispatch_id?: string;
      agency_id?: string;
   };
   body: any;
   params: {
      id?: string;
      hbl?: string;
      paymentId?: string;
   };
}

const isAdminRole = (role: Roles): boolean => role === Roles.ROOT;

const assertDirectDispatchVisibility = (
   user: NonNullable<DispatchRequest["user"]>,
   dispatch: Pick<Dispatch, "sender_agency_id" | "receiver_agency_id">,
): void => {
   if (isAdminRole(user.role)) {
      return;
   }
   if (!user.agency_id) {
      throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
   }
   const canView = dispatch.sender_agency_id === user.agency_id || dispatch.receiver_agency_id === user.agency_id;
   if (!canView) {
      throw new AppError(HttpStatusCodes.FORBIDDEN, "You are not authorized to view this dispatch");
   }
};

export const dispatchController = {
   /**
    * GET /dispatches/verify-parcel/:hbl - Look up parcel by HBL; returns parcel + dispatch (if any).
    */
   verifyParcel: async (req: DispatchRequest, res: Response): Promise<void> => {
      const hbl = req.params.hbl;
      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "HBL is required");
      }
      const parcel = await repository.parcels.getByHblForVerify(hbl);
      if (!parcel) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Parcel not found");
      }
      res.status(200).json(parcel);
   },

   /**
    * Get all dispatches with pagination and filters
    * ROOT/ADMIN can see all, others only their agency's
    */
   getAll: async (req: DispatchRequest, res: Response): Promise<void> => {
      const { page = "1", limit = "25", status, payment_status, dispatch_id, agency_id: queryAgencyId } = req.query;
      const user = req.user!;

      const isAdmin = isAdminRole(user.role);

      if (!isAdmin && !user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      // Validate dispatch status if provided
      const validStatuses = Object.values(DispatchStatus);
      if (status && !validStatuses.includes(status as DispatchStatus)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, `Invalid status. Valid values: ${validStatuses.join(", ")}`);
      }

      // Validate payment status if provided
      const validPaymentStatuses = Object.values(PaymentStatus);
      if (payment_status && !validPaymentStatuses.includes(payment_status as PaymentStatus)) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            `Invalid payment_status. Valid values: ${validPaymentStatuses.join(", ")}`,
         );
      }

      // Agency filter: direct-by-default visibility
      let agencyFilter: number | undefined;
      if (queryAgencyId !== undefined && queryAgencyId !== "") {
         const parsed = parseInt(queryAgencyId, 10);
         if (Number.isNaN(parsed)) {
            throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid agency_id");
         }
         if (!isAdmin && parsed !== user.agency_id) {
            throw new AppError(HttpStatusCodes.FORBIDDEN, "You can only query dispatches for your own agency");
         }
         agencyFilter = parsed;
      } else {
         // ROOT/ADMIN see all; all other users see only their own agency
         if (isAdmin) {
            agencyFilter = undefined;
         } else if (user.agency_id) {
            agencyFilter = user.agency_id;
         } else {
            agencyFilter = undefined;
         }
      }

      const { dispatches: rows, total } = await repository.dispatch.get(
         parseInt(page),
         parseInt(limit),
         agencyFilter,
         status as DispatchStatus | undefined,
         payment_status as PaymentStatus | undefined,
         dispatch_id ? parseInt(dispatch_id) : undefined,
      );

      res.status(200).json({ rows, total });
   },

   /**
    * Get a specific dispatch by ID
    */
   getById: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;

      const dispatch = await repository.dispatch.getById(dispatchId);

      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }

      assertDirectDispatchVisibility(user, dispatch);

      res.status(200).json(dispatch);
   },

   /**
    * Generate PDF manifest for a dispatch
    */
   generateDispatchPdf: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;

      const dispatchForAccess = await repository.dispatch.getById(dispatchId);
      if (!dispatchForAccess) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }

      const dispatch = await repository.dispatch.getByIdWithDetails(dispatchId);

      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }

      // Cast to DispatchPdfDetails - the repository includes all needed relations
      const pdfDoc = await generateDispatchPDF(dispatch as unknown as DispatchPdfDetails);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="dispatch-${dispatch.id}.pdf"`);

      pdfDoc.pipe(res);
      pdfDoc.end();
   },

   /**
    * GET /dispatches/:id/payment-receipt - Generate PDF receipt of all payments for a dispatch (notes, references, etc.)
    */
   generatePaymentReceiptPdf: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;

      const dispatchForAccess = await repository.dispatch.getById(dispatchId);
      if (!dispatchForAccess) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }

      const dispatch = await repository.dispatch.getByIdWithDetails(dispatchId);
      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }
      const data: DispatchPaymentReceiptData = {
         id: dispatch.id,
         cost_in_cents: dispatch.cost_in_cents,
         paid_in_cents: dispatch.paid_in_cents,
         payment_status: dispatch.payment_status,
         created_at: dispatch.created_at,
         sender_agency: dispatch.sender_agency,
         receiver_agency: dispatch.receiver_agency,
         payments: dispatch.payments,
      };
      const pdfDoc = await generateDispatchPaymentReceiptPDF(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="dispatch-${dispatch.id}-payment-receipt.pdf"`);
      pdfDoc.pipe(res);
      pdfDoc.end();
   },

   /**
    * Get parcels ready for dispatch in user's agency (uses unified parcels listFiltered)
    */
   getReadyForDispatch: async (req: DispatchRequest, res: Response): Promise<void> => {
      const { page = "1", limit = "25" } = req.query;
      const user = req.user!;

      if (!user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      const { rows, total } = await repository.parcels.getReadyForDispatchByAgency(
         user.agency_id,
         parseInt(page),
         parseInt(limit),
      );

      res.status(200).json({ rows, total });
   },

   /**
    * Get parcels in a specific dispatch
    */
   getParcelsInDispatch: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const { page = "1", limit = "25", status } = req.query;
      const user = req.user!;

      const dispatch = await repository.dispatch.getById(dispatchId);
      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }
      assertDirectDispatchVisibility(user, dispatch);

      const { parcels, total } = await repository.dispatch.getParcelsInDispatch(
         dispatchId,
         status as any,
         parseInt(page),
         parseInt(limit),
      );

      res.status(200).json({ rows: parcels, total });
   },

   /**
    * Create dispatch from scanned parcels
    * Takes an array of tracking numbers, creates a dispatch, and adds all valid parcels
    */
   createFromParcels: async (req: DispatchRequest, res: Response): Promise<void> => {
      const user = req.user!;
      const { tracking_numbers } = req.body;

      if (!user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      if (!Array.isArray(tracking_numbers) || tracking_numbers.length === 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "tracking_numbers array is required");
      }

      const result = await repository.dispatch.createDispatchFromParcels(tracking_numbers, user.agency_id, user.id);

      res.status(201).json(result);
   },

   /**
    * Receive parcels without prior dispatch
    * Groups parcels by their original agency (sender) and creates RECEIVED dispatches
    * Used when agencies bring packages directly to warehouse without creating dispatch first
    */
   receiveParcelsWithoutDispatch: async (req: DispatchRequest, res: Response): Promise<void> => {
      const user = req.user!;
      const { tracking_numbers } = req.body;

      if (!user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      if (!Array.isArray(tracking_numbers) || tracking_numbers.length === 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "tracking_numbers array is required");
      }

      const result = await repository.dispatch.receiveParcelsWithoutDispatch(
         tracking_numbers,
         user.agency_id, // receiver_agency_id (warehouse receiving the parcels)
         user.id,
      );

      res.status(201).json(result);
   },

   /**
    * Smart Receive - Intelligent parcel reception
    * Automatically handles all scenarios:
    * - Parcels without dispatch → Creates new RECEIVED dispatch
    * - Parcels in DRAFT/LOADING dispatch → Finalizes and receives
    * - Parcels in DISPATCHED dispatch → Receives in existing dispatch
    * - Parcels already received → Skips with info
    *
    * This is the recommended endpoint for receiving parcels as it handles
    * all edge cases automatically.
    */
   smartReceive: async (req: DispatchRequest, res: Response): Promise<void> => {
      const user = req.user!;
      const { tracking_numbers } = req.body;

      if (!user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      if (!Array.isArray(tracking_numbers) || tracking_numbers.length === 0) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "tracking_numbers array is required");
      }

      const result = await repository.dispatch.smartReceive(tracking_numbers, user.agency_id, user.id);

      res.status(200).json(result);
   },

   /**
    * Create an empty dispatch (DRAFT status)
    */
   create: async (req: DispatchRequest, res: Response): Promise<void> => {
      const user = req.user!;

      if (!user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      const dispatch = await repository.dispatch.create({
         sender_agency_id: user.agency_id,
         created_by_id: user.id,
         status: DispatchStatus.DRAFT,
      });

      res.status(201).json(dispatch);
   },

   /**
    * Add a parcel to dispatch by tracking number
    *
    * Validations (handled in repository):
    * - Dispatch must be in DRAFT or LOADING status (ROOT can bypass)
    * - Parcel must belong to sender agency or its child agencies
    * - Parcel must have valid status and not be in another dispatch
    */
   addParcel: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = Number(req.params.id);
      if (!Number.isFinite(dispatchId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid dispatch id");
      }
      const { hbl } = req.body;
      const user = req.user!;

      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "hbl is required");
      }

      // Pass user role for ROOT bypass capability
      const parcelInDispatch = await repository.dispatch.addParcelToDispatch(hbl, dispatchId, user.id, user.role);

      res.status(200).json(parcelInDispatch);
   },

   /**
    * Add parcels to dispatch by order id
    */
   addParcelsByOrderId: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = Number(req.params.id);
      if (!Number.isFinite(dispatchId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid dispatch id");
      }
      const { order_id } = req.body as { order_id?: number };
      const user = req.user!;

      if (order_id == null || !Number.isFinite(Number(order_id))) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "order_id is required and must be a positive number");
      }

      const parcels = await repository.dispatch.addParcelsByOrderId(Number(order_id), dispatchId, user.id, user.role);

      res.status(200).json(parcels);
   },

   /**
    * Remove a parcel from dispatch
    *
    * Validations (handled in repository):
    * - Dispatch must be in DRAFT or LOADING status (ROOT can bypass)
    * - Once DISPATCHED, parcels cannot be removed (except by ROOT)
    */
   removeParcel: async (req: DispatchRequest, res: Response): Promise<void> => {
      const { hbl } = req.params;
      const user = req.user!;

      if (!hbl) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "HBL is required");
      }

      // Pass user role for ROOT bypass capability
      const parcel = await repository.dispatch.removeParcelFromDispatch(hbl, user.id, user.role);

      res.status(200).json(parcel);
   },

   /**
    * Finalize dispatch creation - Assign receiver agency and calculate all financials
    * This is the ONLY place where financial logic (pricing) is executed
    * Validates hierarchy and calculates pricing for all parcels
    *
    * @body receiver_agency_id - Optional. If not provided, defaults to parent agency
    */
   finalizeCreate: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;
      const { receiver_agency_id: requestedReceiverId } = req.body || {};

      if (!user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      const dispatch = await repository.dispatch.getById(dispatchId);
      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }

      // Determine receiver agency: use provided value or default to sender's parent agency
      let receiverAgencyId: number;

      if (requestedReceiverId) {
         // Validate that requested receiver agency exists
         const receiverAgency = await repository.agencies.getById(requestedReceiverId);
         if (!receiverAgency) {
            throw new AppError(HttpStatusCodes.NOT_FOUND, `Receiver agency with id ${requestedReceiverId} not found`);
         }
         receiverAgencyId = requestedReceiverId;
      } else {
         // Default to parent agency of the SENDER (dispatch.sender_agency_id), not the user's agency
         const parentAgency = await repository.agencies.getParent(dispatch.sender_agency_id);
         if (!parentAgency) {
            throw new AppError(
               HttpStatusCodes.BAD_REQUEST,
               "Sender agency has no parent. Please specify receiver_agency_id",
            );
         }
         receiverAgencyId = parentAgency.id;
      }

      // Validate: agency cannot receive dispatch from itself
      if (receiverAgencyId === dispatch.sender_agency_id) {
         throw new AppError(
            HttpStatusCodes.BAD_REQUEST,
            "An agency cannot receive dispatches from itself. Please specify a different receiver_agency_id",
         );
      }

      const updatedDispatch = await repository.dispatch.finalizeDispatchCreation(
         dispatchId,
         receiverAgencyId,
         dispatch.sender_agency_id,
      );

      res.status(200).json(updatedDispatch);
   },

   /**
    * Receive parcel in dispatch - Reconciliation process
    * Used by receiving agency to scan and verify parcels
    * If parcel is in dispatch -> marks as received
    * If parcel is NOT in dispatch but exists -> adds to dispatch and marks as received
    */
   receiveParcel: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const { tracking_number } = req.body;
      const user = req.user!;

      if (!tracking_number) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "tracking_number is required");
      }

      const result = await repository.dispatch.receiveInDispatch(tracking_number, dispatchId, user.id);

      res.status(200).json({
         parcel: result.parcel,
         wasAdded: result.wasAdded,
         message: result.wasAdded
            ? "Parcel was not in dispatch but was found and added"
            : "Parcel was already in dispatch and marked as received",
      });
   },

   /**
    * Get reception status summary for a dispatch
    * Returns: total expected, received, missing, and added parcels
    * Used by receiving agency to track reconciliation progress
    */
   getReceptionStatus: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);

      const status = await repository.dispatch.getReceptionStatus(dispatchId);

      res.status(200).json(status);
   },

   /**
    * Finalize dispatch reception - Recalculate costs based on actually received parcels
    * Called by receiving agency when done scanning all parcels
    * - Recalculates actual cost based on received parcels only
    * - Cancels old debts and creates new ones with actual amounts
    * - Sets status to RECEIVED (or DISCREPANCY if mismatch)
    */
   finalizeReception: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;

      const result = await repository.dispatch.finalizeDispatchReception(dispatchId, user.id);

      res.status(200).json({
         message: result.has_discrepancy
            ? "Reception finalized with discrepancy detected"
            : "Reception finalized successfully",
         ...result,
      });
   },

   /**
    * Delete dispatch
    * Only sender agency can delete, and only if status is DRAFT or CANCELLED
    * ROOT users can delete any dispatch regardless of agency or status
    * All parcels will be removed from dispatch and their previous status restored
    */
   delete: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;

      const isRoot = user.role === Roles.ROOT;

      if (!isRoot && !user.agency_id) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User must be associated with an agency");
      }

      const deletedDispatch = await repository.dispatch.delete(
         dispatchId,
         isRoot ? null : user.agency_id!,
         user.id,
         user.role,
      );

      res.status(200).json({ message: "Dispatch deleted successfully", dispatch: deletedDispatch });
   },

   /**
    * Get all payments for a dispatch
    */
   getPayments: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;
      const dispatch = await repository.dispatch.getById(dispatchId);
      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }
      assertDirectDispatchVisibility(user, dispatch);
      const payments = await repository.dispatch.getPayments(dispatchId);
      res.status(200).json(payments);
   },

   /**
    * Add a payment to a dispatch. Only allowed when dispatch status is RECEIVED.
    */
   addPayment: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const user = req.user!;
      const { amount_in_cents, charge_in_cents, method, reference, date, notes } = req.body;
      // only allowed when dispatch status is RECEIVED, and the receiver agency is the same as the user's agency
      const dispatch = await repository.dispatch.getById(dispatchId);
      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }
      if (dispatch.status !== DispatchStatus.RECEIVED) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Dispatch status must be RECEIVED");
      }
      if (
         dispatch.receiver_agency_id !== user.agency_id &&
         user.role !== Roles.ROOT &&
         user.role !== Roles.ADMINISTRATOR &&
         user.role !== Roles.AGENCY_SUPERVISOR
      ) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User is not authorized to add a payment to this dispatch");
      }
      const payment = await repository.dispatch.addPayment(
         dispatchId,
         { amount_in_cents, charge_in_cents, method, reference, date, notes },
         user.id,
      );
      res.status(201).json(payment);
   },

   /**
    * Delete a dispatch payment
    */
   deletePayment: async (req: DispatchRequest, res: Response): Promise<void> => {
      const dispatchId = parseInt(req.params.id!);
      const paymentId = parseInt(req.params.paymentId!);
      const user = req.user!;
      const dispatch = await repository.dispatch.getById(dispatchId);
      if (!dispatch) {
         throw new AppError(HttpStatusCodes.NOT_FOUND, "Dispatch not found");
      }

      if (
         dispatch.receiver_agency_id !== user.agency_id &&
         user.role !== Roles.ROOT &&
         user.role !== Roles.ADMINISTRATOR &&
         user.role !== Roles.AGENCY_SUPERVISOR
      ) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "User is not authorized to delete this payment");
      }
      await repository.dispatch.deletePayment(dispatchId, paymentId);
      res.status(200).json({ message: "Payment deleted" });
   },
};

export default dispatchController;
