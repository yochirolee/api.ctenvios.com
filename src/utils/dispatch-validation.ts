import prisma from "../lib/prisma.client";
import { AgencyType, DispatchStatus, Prisma } from "@prisma/client";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

/**
 * Dispatch validation utilities
 * Following: TypeScript strict typing, Repository pattern separation
 */

/**
 * Immutable dispatch statuses - cannot add/remove parcels
 */
export const IMMUTABLE_DISPATCH_STATUSES: DispatchStatus[] = [
   DispatchStatus.DISPATCHED,
   DispatchStatus.RECEIVING,
   DispatchStatus.RECEIVED,
   DispatchStatus.DISCREPANCY,
];

/**
 * Modifiable dispatch statuses - can add/remove parcels
 */
export const MODIFIABLE_DISPATCH_STATUSES: DispatchStatus[] = [
   DispatchStatus.DRAFT,
   DispatchStatus.LOADING,
];

/**
 * Get all child agency IDs recursively (for use outside transactions)
 */
export const getAllChildAgenciesRecursively = async (parentId: number): Promise<number[]> => {
   const getAllChildren = async (agencyId: number): Promise<number[]> => {
      const directChildren = await prisma.agency.findMany({
         where: { parent_agency_id: agencyId },
         select: { id: true },
      });

      const childIds = directChildren.map((child) => child.id);
      const allChildIds = [...childIds];

      for (const childId of childIds) {
         const grandChildren = await getAllChildren(childId);
         allChildIds.push(...grandChildren);
      }

      return allChildIds;
   };

   return getAllChildren(parentId);
};

/**
 * Get all child agency IDs recursively (for use inside transactions)
 */
export const getAllChildAgenciesInTx = async (
   tx: Prisma.TransactionClient,
   parentId: number
): Promise<number[]> => {
   const getAllChildren = async (agencyId: number): Promise<number[]> => {
      const directChildren = await tx.agency.findMany({
         where: { parent_agency_id: agencyId },
         select: { id: true },
      });

      const childIds = directChildren.map((child) => child.id);
      const allChildIds = [...childIds];

      for (const childId of childIds) {
         const grandChildren = await getAllChildren(childId);
         allChildIds.push(...grandChildren);
      }

      return allChildIds;
   };

   return getAllChildren(parentId);
};

/**
 * Validates that a parcel belongs to the agency or its child agencies
 * Rule: An agency can only dispatch parcels from itself or its child agencies
 * 
 * @param parcel_agency_id - The agency_id of the parcel
 * @param sender_agency_id - The agency creating the dispatch
 * @returns true if parcel belongs to sender or its children
 */
export const validateParcelOwnership = async (
   parcel_agency_id: number | null,
   sender_agency_id: number
): Promise<boolean> => {
   if (!parcel_agency_id) {
      return false;
   }

   // Parcel belongs to the sender agency itself
   if (parcel_agency_id === sender_agency_id) {
      return true;
   }

   // Check if parcel belongs to a child agency
   const childAgencies = await getAllChildAgenciesRecursively(sender_agency_id);
   return childAgencies.includes(parcel_agency_id);
};

/**
 * Validates parcel ownership inside a transaction
 */
export const validateParcelOwnershipInTx = async (
   tx: Prisma.TransactionClient,
   parcel_agency_id: number | null,
   sender_agency_id: number
): Promise<boolean> => {
   if (!parcel_agency_id) {
      return false;
   }

   if (parcel_agency_id === sender_agency_id) {
      return true;
   }

   const childAgencies = await getAllChildAgenciesInTx(tx, sender_agency_id);
   return childAgencies.includes(parcel_agency_id);
};

/**
 * Gets the hierarchy of parent agencies (parent, grandparent, etc.)
 */
export const getAgencyParentHierarchy = async (agencyId: number): Promise<number[]> => {
   const hierarchy: number[] = [];
   let currentAgencyId: number | null = agencyId;

   while (currentAgencyId) {
      const agency: { parent_agency_id: number | null } | null = await prisma.agency.findUnique({
         where: { id: currentAgencyId },
         select: { parent_agency_id: true },
      });

      if (agency?.parent_agency_id) {
         hierarchy.push(agency.parent_agency_id);
         currentAgencyId = agency.parent_agency_id;
      } else {
         break;
      }
   }

   return hierarchy;
};

/**
 * Validates that receiver agency is valid for the sender
 * Rules:
 * - FORWARDER can receive from any agency
 * - Regular agencies can only send to agencies in their parent hierarchy
 */
export const validateReceiverAgency = async (
   sender_agency_id: number,
   receiver_agency_id: number
): Promise<void> => {
   // Cannot send to yourself
   if (sender_agency_id === receiver_agency_id) {
      throw new AppError(
         HttpStatusCodes.BAD_REQUEST,
         "An agency cannot send a dispatch to itself"
      );
   }

   const receiverAgency = await prisma.agency.findUnique({
      where: { id: receiver_agency_id },
      select: { id: true, agency_type: true, name: true },
   });

   if (!receiverAgency) {
      throw new AppError(HttpStatusCodes.NOT_FOUND, `Receiver agency ${receiver_agency_id} not found`);
   }

   // FORWARDER can receive from any agency
   if (receiverAgency.agency_type === AgencyType.FORWARDER) {
      return;
   }

   // For non-FORWARDER receivers, validate hierarchy
   const senderHierarchy = await getAgencyParentHierarchy(sender_agency_id);

   if (!senderHierarchy.includes(receiver_agency_id)) {
      throw new AppError(
         HttpStatusCodes.FORBIDDEN,
         `Agency "${receiverAgency.name}" (${receiver_agency_id}) is not in the hierarchy of sender agency. ` +
         `Sender can only dispatch to parent agencies or FORWARDER agencies.`
      );
   }
};

/**
 * Validates if dispatch can be modified (add/remove parcels)
 * Throws error if dispatch is in an immutable status
 * 
 * @param status - Current dispatch status
 * @param userRole - Optional user role. ROOT users can bypass this validation.
 */
export const validateDispatchModifiable = (status: DispatchStatus, userRole?: string): void => {
   // ROOT users can modify any dispatch regardless of status
   if (userRole === 'ROOT') {
      return;
   }

   if (IMMUTABLE_DISPATCH_STATUSES.includes(status)) {
      throw new AppError(
         HttpStatusCodes.FORBIDDEN,
         `Cannot modify dispatch with status ${status}. ` +
         `Parcels can only be added/removed when dispatch is in DRAFT or LOADING status.`
      );
   }
};

/**
 * Validates that user belongs to the sender agency of a dispatch
 */
export const validateUserCanModifyDispatch = (
   user_agency_id: number | undefined,
   dispatch_sender_agency_id: number,
   user_role: string
): void => {
   const adminRoles = ['ROOT', 'ADMINISTRATOR'];
   
   if (adminRoles.includes(user_role)) {
      return; // Admins can modify any dispatch
   }

   if (!user_agency_id) {
      throw new AppError(
         HttpStatusCodes.FORBIDDEN,
         "User must be associated with an agency to modify dispatches"
      );
   }

   if (user_agency_id !== dispatch_sender_agency_id) {
      throw new AppError(
         HttpStatusCodes.FORBIDDEN,
         `Only the sender agency can modify this dispatch. ` +
         `Your agency: ${user_agency_id}, Sender agency: ${dispatch_sender_agency_id}`
      );
   }
};

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
export const validateCanReceiveFrom = async (
   receiver_agency_id: number,
   sender_agency_id: number
): Promise<void> => {
   // Cannot receive from yourself
   if (receiver_agency_id === sender_agency_id) {
      throw new AppError(
         HttpStatusCodes.BAD_REQUEST,
         "Cannot receive parcels from your own agency"
      );
   }

   const receiverAgency = await prisma.agency.findUnique({
      where: { id: receiver_agency_id },
      select: { agency_type: true, name: true },
   });

   if (!receiverAgency) {
      throw new AppError(HttpStatusCodes.NOT_FOUND, `Receiver agency ${receiver_agency_id} not found`);
   }

   // FORWARDER can receive from any agency
   if (receiverAgency.agency_type === AgencyType.FORWARDER) {
      return;
   }

   // For non-FORWARDER receivers: can only receive from their descendants
   const childAgencies = await getAllChildAgenciesRecursively(receiver_agency_id);

   if (!childAgencies.includes(sender_agency_id)) {
      const senderAgency = await prisma.agency.findUnique({
         where: { id: sender_agency_id },
         select: { name: true },
      });
      
      throw new AppError(
         HttpStatusCodes.FORBIDDEN,
         `Agency "${receiverAgency.name}" can only receive from its child agencies. ` +
         `Agency "${senderAgency?.name || sender_agency_id}" is not a descendant.`
      );
   }
};

/**
 * Validates reception inside a transaction
 */
export const validateCanReceiveFromInTx = async (
   tx: Prisma.TransactionClient,
   receiver_agency_id: number,
   sender_agency_id: number
): Promise<void> => {
   // Cannot receive from yourself
   if (receiver_agency_id === sender_agency_id) {
      throw new AppError(
         HttpStatusCodes.BAD_REQUEST,
         "Cannot receive parcels from your own agency"
      );
   }

   const receiverAgency = await tx.agency.findUnique({
      where: { id: receiver_agency_id },
      select: { agency_type: true, name: true },
   });

   if (!receiverAgency) {
      throw new AppError(HttpStatusCodes.NOT_FOUND, `Receiver agency ${receiver_agency_id} not found`);
   }

   // FORWARDER can receive from any agency
   if (receiverAgency.agency_type === AgencyType.FORWARDER) {
      return;
   }

   // For non-FORWARDER receivers: can only receive from their descendants
   const childAgencies = await getAllChildAgenciesInTx(tx, receiver_agency_id);

   if (!childAgencies.includes(sender_agency_id)) {
      const senderAgency = await tx.agency.findUnique({
         where: { id: sender_agency_id },
         select: { name: true },
      });
      
      throw new AppError(
         HttpStatusCodes.FORBIDDEN,
         `Agency "${receiverAgency.name}" can only receive from its child agencies. ` +
         `Agency "${senderAgency?.name || sender_agency_id}" is not a descendant.`
      );
   }
};

/**
 * Checks if an agency is a FORWARDER (for status determination)
 */
export const isForwarderAgency = async (agencyId: number): Promise<boolean> => {
   const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { agency_type: true },
   });
   return agency?.agency_type === AgencyType.FORWARDER;
};

/**
 * Checks if an agency is a FORWARDER inside a transaction
 */
export const isForwarderAgencyInTx = async (
   tx: Prisma.TransactionClient,
   agencyId: number
): Promise<boolean> => {
   const agency = await tx.agency.findUnique({
      where: { id: agencyId },
      select: { agency_type: true },
   });
   return agency?.agency_type === AgencyType.FORWARDER;
};
