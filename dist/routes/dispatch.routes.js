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
const express_1 = require("express");
const repositories_1 = __importDefault(require("../repositories"));
const client_1 = require("@prisma/client");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const router = (0, express_1.Router)();
router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = 1, limit = 25 } = req.query;
    const user = req.user;
    if (!user.agency_id) {
        return res.status(https_status_codes_1.default.BAD_REQUEST).json({ message: "User must be associated with an agency" });
    }
    const { dispatches: rows, total } = yield repositories_1.default.dispatch.get(parseInt(page), parseInt(limit));
    res.status(200).json({ rows, total });
}));
// parcels in agency ready for dispatch
router.get("/ready-for-dispatch", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = 1, limit = 25 } = req.query;
    const user = req.user;
    if (!user.agency_id) {
        return res.status(400).json({ message: "User not found" });
    }
    const { parcels, total } = yield repositories_1.default.dispatch.readyForDispatch(user.agency_id, parseInt(page), parseInt(limit));
    res.status(200).json({ rows: parcels, total: total });
}));
router.get("/:id/parcels", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const dispatchId = parseInt(req.params.id);
    const { page = 1, limit = 25, status } = req.query;
    const { parcels, total } = yield repositories_1.default.dispatch.getParcelsInDispatch(dispatchId, status, parseInt(page), parseInt(limit));
    res.status(200).json({
        rows: parcels,
        total: total,
    });
}));
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const dispatch = yield repositories_1.default.dispatch.create({
        sender_agency_id: user.agency_id,
        created_by_id: user.id,
        status: client_1.DispatchStatus.DRAFT,
    });
    res.status(200).json(dispatch);
}));
router.post("/:id/add-parcel", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dispatchId = parseInt(req.params.id);
        // Remove this redundant query - addParcelToDispatch will validate dispatch exists
        // const dispatch = await repository.dispatch.getById(dispatchId);
        // if (!dispatch) {
        //    return res.status(HttpStatusCodes.NOT_FOUND).json({ message: "Dispatch not found" });
        // }
        const existingParcel = yield repositories_1.default.parcels.findParcelByHbl(req.body.hbl);
        if (!existingParcel) {
            return res.status(https_status_codes_1.default.NOT_FOUND).json({ message: "Parcel not found" });
        }
        const parcelInDispatch = yield repositories_1.default.dispatch.addParcelToDispatch(existingParcel, dispatchId, req.user.id);
        res.status(200).json(parcelInDispatch);
    }
    catch (error) {
        console.error(error);
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({ message: error.message });
        }
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
}));
router.delete("/:id/remove-parcel/:hbl", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const hbl = req.params.hbl;
        if (!hbl) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({ message: "HBL is required" });
        }
        const parcel = yield repositories_1.default.dispatch.removeParcelFromDispatch(hbl, user.id);
        res.status(200).json(parcel);
    }
    catch (error) {
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({ message: error.message });
        }
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
}));
/**
 * Complete dispatch - Assign receiver agency and calculate all financials
 * This is the ONLY place where financial logic (pricing) is executed
 * Validates hierarchy and calculates pricing for all parcels
 */
router.post("/:id/complete-dispatch", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        //my parent agency id if not to my agency
        const parentAgency = yield repositories_1.default.agencies.getParent(user.agency_id);
        if (!parentAgency) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({ message: "Parent agency not found" });
        }
        const receiver_agency_id = parentAgency.id;
        if (!receiver_agency_id) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({ message: "receiver_agency_id is required" });
        }
        const dispatch = yield repositories_1.default.dispatch.getById(dispatchId);
        if (!dispatch) {
            return res.status(https_status_codes_1.default.NOT_FOUND).json({ message: "Dispatch not found" });
        }
        const updatedDispatch = yield repositories_1.default.dispatch.completeDispatch(dispatchId, receiver_agency_id, dispatch.sender_agency_id);
        res.status(200).json(updatedDispatch);
    }
    catch (error) {
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({ message: error.message });
        }
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
}));
/**
 * Receive parcel in dispatch - Reconciliation process
 * Used by receiving agency to scan and verify parcels
 * If parcel is in dispatch -> marks as received
 * If parcel is NOT in dispatch but exists -> adds to dispatch and marks as received
 */
router.post("/:id/receive-parcel", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dispatchId = parseInt(req.params.id);
        const { tracking_number } = req.body;
        const user = req.user;
        if (!tracking_number) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({ message: "tracking_number is required" });
        }
        const result = yield repositories_1.default.dispatch.receiveInDispatch(tracking_number, dispatchId, user.id);
        res.status(200).json({
            parcel: result.parcel,
            wasAdded: result.wasAdded,
            message: result.wasAdded
                ? "Parcel was not in dispatch but was found and added"
                : "Parcel was already in dispatch and marked as received",
        });
    }
    catch (error) {
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({ message: error.message });
        }
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
}));
/**
 * Get reception status summary for a dispatch
 * Returns: total expected, received, missing, and added parcels
 * Used by receiving agency to track reconciliation progress
 */
router.get("/:id/reception-status", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dispatchId = parseInt(req.params.id);
        const status = yield repositories_1.default.dispatch.getReceptionStatus(dispatchId);
        res.status(200).json(status);
    }
    catch (error) {
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({ message: error.message });
        }
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
}));
/**
 * Delete dispatch
 * Only sender agency can delete, and only if status is DRAFT or CANCELLED
 * ROOT users can delete any dispatch regardless of agency
 * All parcels will be removed from dispatch and their previous status restored
 */
router.delete("/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dispatchId = parseInt(req.params.id);
        const user = req.user;
        // ROOT users can delete any dispatch, skip agency check
        const isRoot = user.role === client_1.Roles.ROOT;
        if (!isRoot && !user.agency_id) {
            return res.status(https_status_codes_1.default.BAD_REQUEST).json({ message: "User must be associated with an agency" });
        }
        const deletedDispatch = yield repositories_1.default.dispatch.delete(dispatchId, isRoot ? null : user.agency_id, user.id);
        res.status(200).json({ message: "Dispatch deleted successfully", dispatch: deletedDispatch });
    }
    catch (error) {
        if (error instanceof app_errors_1.AppError) {
            return res.status(error.status).json({ message: error.message });
        }
        return res.status(https_status_codes_1.default.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
}));
exports.default = router;
