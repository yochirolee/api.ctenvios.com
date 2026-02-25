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
exports.isForwarderAgencyInTx = exports.isForwarderAgency = exports.validateCanReceiveFromInTx = exports.validateCanReceiveFrom = exports.validateUserCanModifyDispatch = exports.validateDispatchModifiable = exports.validateReceiverAgency = exports.getAgencyParentHierarchy = exports.validateParcelOwnershipInTx = exports.validateParcelOwnership = exports.getAllChildAgenciesInTx = exports.getAllChildAgenciesRecursively = exports.MODIFIABLE_DISPATCH_STATUSES = exports.IMMUTABLE_DISPATCH_STATUSES = void 0;
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const client_1 = require("@prisma/client");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
/**
 * Dispatch validation utilities
 * Following: TypeScript strict typing, Repository pattern separation
 */
/**
 * Immutable dispatch statuses - cannot add/remove parcels
 */
exports.IMMUTABLE_DISPATCH_STATUSES = [
    client_1.DispatchStatus.DISPATCHED,
    client_1.DispatchStatus.RECEIVING,
    client_1.DispatchStatus.RECEIVED,
    client_1.DispatchStatus.DISCREPANCY,
];
/**
 * Modifiable dispatch statuses - can add/remove parcels
 */
exports.MODIFIABLE_DISPATCH_STATUSES = [
    client_1.DispatchStatus.DRAFT,
    client_1.DispatchStatus.LOADING,
];
/**
 * Get all child agency IDs recursively (for use outside transactions)
 */
const getAllChildAgenciesRecursively = (parentId) => __awaiter(void 0, void 0, void 0, function* () {
    const getAllChildren = (agencyId) => __awaiter(void 0, void 0, void 0, function* () {
        const directChildren = yield prisma_client_1.default.agency.findMany({
            where: { parent_agency_id: agencyId },
            select: { id: true },
        });
        const childIds = directChildren.map((child) => child.id);
        const allChildIds = [...childIds];
        for (const childId of childIds) {
            const grandChildren = yield getAllChildren(childId);
            allChildIds.push(...grandChildren);
        }
        return allChildIds;
    });
    return getAllChildren(parentId);
});
exports.getAllChildAgenciesRecursively = getAllChildAgenciesRecursively;
/**
 * Get all child agency IDs recursively (for use inside transactions)
 */
const getAllChildAgenciesInTx = (tx, parentId) => __awaiter(void 0, void 0, void 0, function* () {
    const getAllChildren = (agencyId) => __awaiter(void 0, void 0, void 0, function* () {
        const directChildren = yield tx.agency.findMany({
            where: { parent_agency_id: agencyId },
            select: { id: true },
        });
        const childIds = directChildren.map((child) => child.id);
        const allChildIds = [...childIds];
        for (const childId of childIds) {
            const grandChildren = yield getAllChildren(childId);
            allChildIds.push(...grandChildren);
        }
        return allChildIds;
    });
    return getAllChildren(parentId);
});
exports.getAllChildAgenciesInTx = getAllChildAgenciesInTx;
/**
 * Validates that a parcel belongs to the agency or its child agencies
 * Rule: An agency can only dispatch parcels from itself or its child agencies
 *
 * @param parcel_agency_id - The agency_id of the parcel
 * @param sender_agency_id - The agency creating the dispatch
 * @returns true if parcel belongs to sender or its children
 */
const validateParcelOwnership = (parcel_agency_id, sender_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!parcel_agency_id) {
        return false;
    }
    // Parcel belongs to the sender agency itself
    if (parcel_agency_id === sender_agency_id) {
        return true;
    }
    // Check if parcel belongs to a child agency
    const childAgencies = yield (0, exports.getAllChildAgenciesRecursively)(sender_agency_id);
    return childAgencies.includes(parcel_agency_id);
});
exports.validateParcelOwnership = validateParcelOwnership;
/**
 * Validates parcel ownership inside a transaction
 */
const validateParcelOwnershipInTx = (tx, parcel_agency_id, sender_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!parcel_agency_id) {
        return false;
    }
    if (parcel_agency_id === sender_agency_id) {
        return true;
    }
    const childAgencies = yield (0, exports.getAllChildAgenciesInTx)(tx, sender_agency_id);
    return childAgencies.includes(parcel_agency_id);
});
exports.validateParcelOwnershipInTx = validateParcelOwnershipInTx;
/**
 * Gets the hierarchy of parent agencies (parent, grandparent, etc.)
 */
const getAgencyParentHierarchy = (agencyId) => __awaiter(void 0, void 0, void 0, function* () {
    const hierarchy = [];
    let currentAgencyId = agencyId;
    while (currentAgencyId) {
        const agency = yield prisma_client_1.default.agency.findUnique({
            where: { id: currentAgencyId },
            select: { parent_agency_id: true },
        });
        if (agency === null || agency === void 0 ? void 0 : agency.parent_agency_id) {
            hierarchy.push(agency.parent_agency_id);
            currentAgencyId = agency.parent_agency_id;
        }
        else {
            break;
        }
    }
    return hierarchy;
});
exports.getAgencyParentHierarchy = getAgencyParentHierarchy;
/**
 * Validates that receiver agency is valid for the sender
 * Rules:
 * - FORWARDER can receive from any agency
 * - Regular agencies can only send to agencies in their parent hierarchy
 */
const validateReceiverAgency = (sender_agency_id, receiver_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
    // Cannot send to yourself
    if (sender_agency_id === receiver_agency_id) {
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "An agency cannot send a dispatch to itself");
    }
    const receiverAgency = yield prisma_client_1.default.agency.findUnique({
        where: { id: receiver_agency_id },
        select: { id: true, agency_type: true, name: true },
    });
    if (!receiverAgency) {
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Receiver agency ${receiver_agency_id} not found`);
    }
    // FORWARDER can receive from any agency
    if (receiverAgency.agency_type === client_1.AgencyType.FORWARDER) {
        return;
    }
    // For non-FORWARDER receivers, validate hierarchy
    const senderHierarchy = yield (0, exports.getAgencyParentHierarchy)(sender_agency_id);
    if (!senderHierarchy.includes(receiver_agency_id)) {
        throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, `Agency "${receiverAgency.name}" (${receiver_agency_id}) is not in the hierarchy of sender agency. ` +
            `Sender can only dispatch to parent agencies or FORWARDER agencies.`);
    }
});
exports.validateReceiverAgency = validateReceiverAgency;
/**
 * Validates if dispatch can be modified (add/remove parcels)
 * Throws error if dispatch is in an immutable status
 *
 * @param status - Current dispatch status
 * @param userRole - Optional user role. ROOT users can bypass this validation.
 */
const validateDispatchModifiable = (status, userRole) => {
    // ROOT users can modify any dispatch regardless of status
    if (userRole === 'ROOT') {
        return;
    }
    if (exports.IMMUTABLE_DISPATCH_STATUSES.includes(status)) {
        throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, `Cannot modify dispatch with status ${status}. ` +
            `Parcels can only be added/removed when dispatch is in DRAFT or LOADING status.`);
    }
};
exports.validateDispatchModifiable = validateDispatchModifiable;
/**
 * Validates that user belongs to the sender agency of a dispatch
 */
const validateUserCanModifyDispatch = (user_agency_id, dispatch_sender_agency_id, user_role) => {
    const adminRoles = ['ROOT', 'ADMINISTRATOR'];
    if (adminRoles.includes(user_role)) {
        return; // Admins can modify any dispatch
    }
    if (!user_agency_id) {
        throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, "User must be associated with an agency to modify dispatches");
    }
    if (user_agency_id !== dispatch_sender_agency_id) {
        throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, `Only the sender agency can modify this dispatch. ` +
            `Your agency: ${user_agency_id}, Sender agency: ${dispatch_sender_agency_id}`);
    }
};
exports.validateUserCanModifyDispatch = validateUserCanModifyDispatch;
/**
 * Validates that a receiver agency can receive parcels from a sender agency
 * Rules:
 * - FORWARDER can receive from any agency
 * - Regular agencies can only receive from their child agencies (descendants)
 *
 * @param receiver_agency_id - The agency receiving the parcels
 * @param sender_agency_id - The agency sending the parcels (current holder)
 * @throws AppError if receiver cannot receive from sender
 */
const validateCanReceiveFrom = (receiver_agency_id, sender_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
    // Cannot receive from yourself
    if (receiver_agency_id === sender_agency_id) {
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot receive parcels from your own agency");
    }
    const receiverAgency = yield prisma_client_1.default.agency.findUnique({
        where: { id: receiver_agency_id },
        select: { agency_type: true, name: true },
    });
    if (!receiverAgency) {
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Receiver agency ${receiver_agency_id} not found`);
    }
    // FORWARDER can receive from any agency
    if (receiverAgency.agency_type === client_1.AgencyType.FORWARDER) {
        return;
    }
    // For non-FORWARDER receivers: can only receive from their descendants
    const childAgencies = yield (0, exports.getAllChildAgenciesRecursively)(receiver_agency_id);
    if (!childAgencies.includes(sender_agency_id)) {
        const senderAgency = yield prisma_client_1.default.agency.findUnique({
            where: { id: sender_agency_id },
            select: { name: true },
        });
        throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, `Agency "${receiverAgency.name}" can only receive from its child agencies. ` +
            `Agency "${(senderAgency === null || senderAgency === void 0 ? void 0 : senderAgency.name) || sender_agency_id}" is not a descendant.`);
    }
});
exports.validateCanReceiveFrom = validateCanReceiveFrom;
/**
 * Validates reception inside a transaction
 */
const validateCanReceiveFromInTx = (tx, receiver_agency_id, sender_agency_id) => __awaiter(void 0, void 0, void 0, function* () {
    // Cannot receive from yourself
    if (receiver_agency_id === sender_agency_id) {
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot receive parcels from your own agency");
    }
    const receiverAgency = yield tx.agency.findUnique({
        where: { id: receiver_agency_id },
        select: { agency_type: true, name: true },
    });
    if (!receiverAgency) {
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `Receiver agency ${receiver_agency_id} not found`);
    }
    // FORWARDER can receive from any agency
    if (receiverAgency.agency_type === client_1.AgencyType.FORWARDER) {
        return;
    }
    // For non-FORWARDER receivers: can only receive from their descendants
    const childAgencies = yield (0, exports.getAllChildAgenciesInTx)(tx, receiver_agency_id);
    if (!childAgencies.includes(sender_agency_id)) {
        const senderAgency = yield tx.agency.findUnique({
            where: { id: sender_agency_id },
            select: { name: true },
        });
        throw new app_errors_1.AppError(https_status_codes_1.default.FORBIDDEN, `Agency "${receiverAgency.name}" can only receive from its child agencies. ` +
            `Agency "${(senderAgency === null || senderAgency === void 0 ? void 0 : senderAgency.name) || sender_agency_id}" is not a descendant.`);
    }
});
exports.validateCanReceiveFromInTx = validateCanReceiveFromInTx;
/**
 * Checks if an agency is a FORWARDER (for status determination)
 */
const isForwarderAgency = (agencyId) => __awaiter(void 0, void 0, void 0, function* () {
    const agency = yield prisma_client_1.default.agency.findUnique({
        where: { id: agencyId },
        select: { agency_type: true },
    });
    return (agency === null || agency === void 0 ? void 0 : agency.agency_type) === client_1.AgencyType.FORWARDER;
});
exports.isForwarderAgency = isForwarderAgency;
/**
 * Checks if an agency is a FORWARDER inside a transaction
 */
const isForwarderAgencyInTx = (tx, agencyId) => __awaiter(void 0, void 0, void 0, function* () {
    const agency = yield tx.agency.findUnique({
        where: { id: agencyId },
        select: { agency_type: true },
    });
    return (agency === null || agency === void 0 ? void 0 : agency.agency_type) === client_1.AgencyType.FORWARDER;
});
exports.isForwarderAgencyInTx = isForwarderAgencyInTx;
