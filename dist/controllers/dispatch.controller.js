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
exports.dispatchController = void 0;
const client_1 = require("@prisma/client");
const repositories_1 = __importDefault(require("../repositories"));
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const generate_dispatch_pdf_1 = require("../utils/pdf/generate-dispatch-pdf");
const generate_dispatch_payment_receipt_1 = require("../utils/pdf/generate-dispatch-payment-receipt");
const isAdminRole = (role) => role === client_1.Roles.ROOT;
const assertDirectDispatchVisibility = (user, dispatch) => {
    if (isAdminRole(user.role)) {
        return;
    }
    if (!user.agency_id) {
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
    }
    const canView = dispatch.sender_agency_id === user.agency_id || dispatch.receiver_agency_id === user.agency_id;
    if (!canView) {
        throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You are not authorized to view this dispatch");
    }
};
exports.dispatchController = {
    /**
     * GET /dispatches/verify-parcel/:hbl - Look up parcel by HBL; returns parcel + dispatch (if any).
     */
    verifyParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const hbl = req.params.hbl;
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "HBL is required");
        }
        const parcel = yield repositories_1.default.parcels.getByHblForVerify(hbl);
        if (!parcel) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Parcel not found");
        }
        res.status(200).json(parcel);
    }),
    /**
     * Get all dispatches with pagination and filters
     * ROOT/ADMIN can see all, others only their agency's
     */
    getAll: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { page = "1", limit = "25", status, payment_status, dispatch_id, agency_id: queryAgencyId } = req.query;
        const user = req.user;
        const isAdmin = isAdminRole(user.role);
        if (!isAdmin && !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        // Validate dispatch status if provided
        const validStatuses = Object.values(client_1.DispatchStatus);
        if (status && !validStatuses.includes(status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid status. Valid values: ${validStatuses.join(", ")}`);
        }
        // Validate payment status if provided
        const validPaymentStatuses = Object.values(client_1.PaymentStatus);
        if (payment_status && !validPaymentStatuses.includes(payment_status)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Invalid payment_status. Valid values: ${validPaymentStatuses.join(", ")}`);
        }
        // Agency filter: direct-by-default visibility
        let agencyFilter;
        if (queryAgencyId !== undefined && queryAgencyId !== "") {
            const parsed = parseInt(queryAgencyId, 10);
            if (Number.isNaN(parsed)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid agency_id");
            }
            if (!isAdmin && parsed !== user.agency_id) {
                throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "You can only query dispatches for your own agency");
            }
            agencyFilter = parsed;
        }
        else {
            // ROOT/ADMIN see all; all other users see only their own agency
            if (isAdmin) {
                agencyFilter = undefined;
            }
            else if (user.agency_id) {
                agencyFilter = user.agency_id;
            }
            else {
                agencyFilter = undefined;
            }
        }
        const { dispatches: rows, total } = yield repositories_1.default.dispatch.get(parseInt(page), parseInt(limit), agencyFilter, status, payment_status, dispatch_id ? parseInt(dispatch_id) : undefined);
        res.status(200).json({ rows, total });
    }),
    /**
     * Get a specific dispatch by ID
     */
    getById: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const dispatch = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        assertDirectDispatchVisibility(user, dispatch);
        res.status(200).json(dispatch);
    }),
    /**
     * Generate PDF manifest for a dispatch
     */
    generateDispatchPdf: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const dispatchForAccess = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatchForAccess) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        const dispatch = yield repositories_1.default.dispatch.getByIdWithDetails(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        // Cast to DispatchPdfDetails - the repository includes all needed relations
        const pdfDoc = yield (0, generate_dispatch_pdf_1.generateDispatchPDF)(dispatch);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="dispatch-${dispatch.id}.pdf"`);
        pdfDoc.pipe(res);
        pdfDoc.end();
    }),
    /**
     * GET /dispatches/:id/payment-receipt - Generate PDF receipt of all payments for a dispatch (notes, references, etc.)
     */
    generatePaymentReceiptPdf: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const dispatchForAccess = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatchForAccess) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        assertDirectDispatchVisibility(user, dispatchForAccess);
        const dispatch = yield repositories_1.default.dispatch.getByIdWithDetails(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        const data = {
            id: dispatch.id,
            cost_in_cents: dispatch.cost_in_cents,
            paid_in_cents: dispatch.paid_in_cents,
            payment_status: dispatch.payment_status,
            created_at: dispatch.created_at,
            sender_agency: dispatch.sender_agency,
            receiver_agency: dispatch.receiver_agency,
            payments: dispatch.payments,
        };
        const pdfDoc = yield (0, generate_dispatch_payment_receipt_1.generateDispatchPaymentReceiptPDF)(data);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="dispatch-${dispatch.id}-payment-receipt.pdf"`);
        pdfDoc.pipe(res);
        pdfDoc.end();
    }),
    /**
     * Get parcels ready for dispatch in user's agency (uses unified parcels listFiltered)
     */
    getReadyForDispatch: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { page = "1", limit = "25" } = req.query;
        const user = req.user;
        if (!user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        const { rows, total } = yield repositories_1.default.parcels.getReadyForDispatchByAgency(user.agency_id, parseInt(page), parseInt(limit));
        res.status(200).json({ rows, total });
    }),
    /**
     * Get parcels in a specific dispatch
     */
    getParcelsInDispatch: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const { page = "1", limit = "25", status } = req.query;
        const user = req.user;
        const dispatch = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        assertDirectDispatchVisibility(user, dispatch);
        const { parcels, total } = yield repositories_1.default.dispatch.getParcelsInDispatch(dispatchId, status, parseInt(page), parseInt(limit));
        res.status(200).json({ rows: parcels, total });
    }),
    /**
     * Create dispatch from scanned parcels
     * Takes an array of tracking numbers, creates a dispatch, and adds all valid parcels
     */
    createFromParcels: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const { tracking_numbers } = req.body;
        if (!user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        if (!Array.isArray(tracking_numbers) || tracking_numbers.length === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "tracking_numbers array is required");
        }
        const result = yield repositories_1.default.dispatch.createDispatchFromParcels(tracking_numbers, user.agency_id, user.id);
        res.status(201).json(result);
    }),
    /**
     * Receive parcels without prior dispatch
     * Groups parcels by their original agency (sender) and creates RECEIVED dispatches
     * Used when agencies bring packages directly to warehouse without creating dispatch first
     */
    receiveParcelsWithoutDispatch: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const { tracking_numbers } = req.body;
        if (!user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        if (!Array.isArray(tracking_numbers) || tracking_numbers.length === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "tracking_numbers array is required");
        }
        const result = yield repositories_1.default.dispatch.receiveParcelsWithoutDispatch(tracking_numbers, user.agency_id, // receiver_agency_id (warehouse receiving the parcels)
        user.id);
        res.status(201).json(result);
    }),
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
    smartReceive: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        const { tracking_numbers } = req.body;
        if (!user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        if (!Array.isArray(tracking_numbers) || tracking_numbers.length === 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "tracking_numbers array is required");
        }
        const result = yield repositories_1.default.dispatch.smartReceive(tracking_numbers, user.agency_id, user.id);
        res.status(200).json(result);
    }),
    /**
     * Create an empty dispatch (DRAFT status)
     */
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = req.user;
        if (!user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        const dispatch = yield repositories_1.default.dispatch.create({
            sender_agency_id: user.agency_id,
            created_by_id: user.id,
            status: client_1.DispatchStatus.DRAFT,
        });
        res.status(201).json(dispatch);
    }),
    /**
     * Add a parcel to dispatch by tracking number
     *
     * Validations (handled in repository):
     * - Dispatch must be in DRAFT or LOADING status (ROOT can bypass)
     * - Parcel must belong to sender agency or its child agencies
     * - Parcel must have valid status and not be in another dispatch
     */
    addParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = Number(req.params.id);
        if (!Number.isFinite(dispatchId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid dispatch id");
        }
        const { hbl } = req.body;
        const user = req.user;
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "hbl is required");
        }
        // Pass user role for ROOT bypass capability
        const parcelInDispatch = yield repositories_1.default.dispatch.addParcelToDispatch(hbl, dispatchId, user.id, user.role);
        res.status(200).json(parcelInDispatch);
    }),
    /**
     * Add parcels to dispatch by order id
     */
    addParcelsByOrderId: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = Number(req.params.id);
        if (!Number.isFinite(dispatchId)) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid dispatch id");
        }
        const { order_id } = req.body;
        const user = req.user;
        if (order_id == null || !Number.isFinite(Number(order_id))) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "order_id is required and must be a positive number");
        }
        const parcels = yield repositories_1.default.dispatch.addParcelsByOrderId(Number(order_id), dispatchId, user.id, user.role);
        res.status(200).json(parcels);
    }),
    /**
     * Remove a parcel from dispatch
     *
     * Validations (handled in repository):
     * - Dispatch must be in DRAFT or LOADING status (ROOT can bypass)
     * - Once DISPATCHED, parcels cannot be removed (except by ROOT)
     */
    removeParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { hbl } = req.params;
        const user = req.user;
        if (!hbl) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "HBL is required");
        }
        // Pass user role for ROOT bypass capability
        const parcel = yield repositories_1.default.dispatch.removeParcelFromDispatch(hbl, user.id, user.role);
        res.status(200).json(parcel);
    }),
    /**
     * Finalize dispatch creation - Assign receiver agency and calculate all financials
     * This is the ONLY place where financial logic (pricing) is executed
     * Validates hierarchy and calculates pricing for all parcels
     *
     * @body receiver_agency_id - Optional. If not provided, defaults to parent agency
     */
    finalizeCreate: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const { receiver_agency_id: requestedReceiverId } = req.body || {};
        if (!user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        const dispatch = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        // Determine receiver agency: use provided value or default to sender's parent agency
        let receiverAgencyId;
        if (requestedReceiverId) {
            // Validate that requested receiver agency exists
            const receiverAgency = yield repositories_1.default.agencies.getById(requestedReceiverId);
            if (!receiverAgency) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Receiver agency with id ${requestedReceiverId} not found`);
            }
            receiverAgencyId = requestedReceiverId;
        }
        else {
            // Default to parent agency of the SENDER (dispatch.sender_agency_id), not the user's agency
            const parentAgency = yield repositories_1.default.agencies.getParent(dispatch.sender_agency_id);
            if (!parentAgency) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Sender agency has no parent. Please specify receiver_agency_id");
            }
            receiverAgencyId = parentAgency.id;
        }
        // Validate: agency cannot receive dispatch from itself
        if (receiverAgencyId === dispatch.sender_agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "An agency cannot receive dispatches from itself. Please specify a different receiver_agency_id");
        }
        const updatedDispatch = yield repositories_1.default.dispatch.finalizeDispatchCreation(dispatchId, receiverAgencyId, dispatch.sender_agency_id);
        res.status(200).json(updatedDispatch);
    }),
    /**
     * Receive parcel in dispatch - Reconciliation process
     * Used by receiving agency to scan and verify parcels
     * If parcel is in dispatch -> marks as received
     * If parcel is NOT in dispatch but exists -> adds to dispatch and marks as received
     */
    receiveParcel: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const { tracking_number } = req.body;
        const user = req.user;
        if (!tracking_number) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "tracking_number is required");
        }
        const result = yield repositories_1.default.dispatch.receiveInDispatch(tracking_number, dispatchId, user.id);
        res.status(200).json({
            parcel: result.parcel,
            wasAdded: result.wasAdded,
            message: result.wasAdded
                ? "Parcel was not in dispatch but was found and added"
                : "Parcel was already in dispatch and marked as received",
        });
    }),
    /**
     * Get reception status summary for a dispatch
     * Returns: total expected, received, missing, and added parcels
     * Used by receiving agency to track reconciliation progress
     */
    getReceptionStatus: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const status = yield repositories_1.default.dispatch.getReceptionStatus(dispatchId);
        res.status(200).json(status);
    }),
    /**
     * Finalize dispatch reception - Recalculate costs based on actually received parcels
     * Called by receiving agency when done scanning all parcels
     * - Recalculates actual cost based on received parcels only
     * - Cancels old debts and creates new ones with actual amounts
     * - Sets status to RECEIVED (or DISCREPANCY if mismatch)
     */
    finalizeReception: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const result = yield repositories_1.default.dispatch.finalizeDispatchReception(dispatchId, user.id);
        res.status(200).json(Object.assign({ message: result.has_discrepancy
                ? "Reception finalized with discrepancy detected"
                : "Reception finalized successfully" }, result));
    }),
    /**
     * Delete dispatch
     * Only sender agency can delete, and only if status is DRAFT or CANCELLED
     * ROOT users can delete any dispatch regardless of agency or status
     * All parcels will be removed from dispatch and their previous status restored
     */
    delete: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const isRoot = user.role === client_1.Roles.ROOT;
        if (!isRoot && !user.agency_id) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User must be associated with an agency");
        }
        const deletedDispatch = yield repositories_1.default.dispatch.delete(dispatchId, isRoot ? null : user.agency_id, user.id, user.role);
        res.status(200).json({ message: "Dispatch deleted successfully", dispatch: deletedDispatch });
    }),
    /**
     * Get all payments for a dispatch
     */
    getPayments: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const dispatch = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        assertDirectDispatchVisibility(user, dispatch);
        const payments = yield repositories_1.default.dispatch.getPayments(dispatchId);
        res.status(200).json(payments);
    }),
    /**
     * Add a payment to a dispatch. Only allowed when dispatch status is RECEIVED.
     */
    addPayment: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        const { amount_in_cents, charge_in_cents, method, reference, date, notes } = req.body;
        // only allowed when dispatch status is RECEIVED, and the receiver agency is the same as the user's agency
        const dispatch = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        if (dispatch.status !== client_1.DispatchStatus.RECEIVED) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Dispatch status must be RECEIVED");
        }
        if (dispatch.receiver_agency_id !== user.agency_id &&
            user.role !== client_1.Roles.ROOT &&
            user.role !== client_1.Roles.ADMINISTRATOR &&
            user.role !== client_1.Roles.AGENCY_SUPERVISOR) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User is not authorized to add a payment to this dispatch");
        }
        const payment = yield repositories_1.default.dispatch.addPayment(dispatchId, { amount_in_cents, charge_in_cents, method, reference, date, notes }, user.id);
        res.status(201).json(payment);
    }),
    /**
     * Delete a dispatch payment
     */
    deletePayment: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const dispatchId = parseInt(req.params.id);
        const paymentId = parseInt(req.params.paymentId);
        const user = req.user;
        const dispatch = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatch) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Dispatch not found");
        }
        if (dispatch.receiver_agency_id !== user.agency_id &&
            user.role !== client_1.Roles.ROOT &&
            user.role !== client_1.Roles.ADMINISTRATOR &&
            user.role !== client_1.Roles.AGENCY_SUPERVISOR) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "User is not authorized to delete this payment");
        }
        yield repositories_1.default.dispatch.deletePayment(dispatchId, paymentId);
        res.status(200).json({ message: "Payment deleted" });
    }),
};
exports.default = exports.dispatchController;
