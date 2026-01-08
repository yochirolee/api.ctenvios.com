import { Router } from "express";
import repository from "../repositories";
import { Request, Response } from "express";
import { DispatchStatus, Parcel, Roles, Status } from "@prisma/client";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
const router = Router();

router.get("/", async (req: any, res: Response) => {
   const { page = 1, limit = 25 } = req.query;
   const user = req.user;
   if (!user.agency_id) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "User must be associated with an agency" });
   }
   //TODO if agency is FORWARDER, get all dispatches

   const { dispatches: rows, total } = await repository.dispatch.get(
      parseInt(page as string),
      parseInt(limit as string)
   );
   res.status(200).json({ rows, total });
});

// parcels in agency ready for dispatch
router.get("/ready-for-dispatch", async (req: any, res: Response) => {
   const { page = 1, limit = 25 } = req.query;
   const user = req.user;
   if (!user.agency_id) {
      return res.status(400).json({ message: "User not found" });
   }
   const { parcels, total } = await repository.dispatch.readyForDispatch(
      user.agency_id,
      parseInt(page as string),
      parseInt(limit as string)
   );
   res.status(200).json({ rows: parcels, total: total });
});

router.get("/:id/parcels", async (req: Request, res: Response) => {
   const dispatchId = parseInt(req.params.id);

   const { page = 1, limit = 25, status } = req.query;
   const { parcels, total } = await repository.dispatch.getParcelsInDispatch(
      dispatchId,
      status as Status | undefined,
      parseInt(page as string),
      parseInt(limit as string)
   );
   console.log(parcels);
   res.status(200).json({
      rows: parcels,
      total: total,
   });
});
router.post("/", async (req: any, res: Response) => {
   const user = req.user;
   const dispatch = await repository.dispatch.create({
      sender_agency_id: user.agency_id,
      created_by_id: user.id,
      status: DispatchStatus.DRAFT,
   });
   res.status(200).json(dispatch);
});

router.post("/:id/add-parcel", async (req: any, res: Response) => {
   try {
      const dispatchId = parseInt(req.params.id);
      // Remove this redundant query - addParcelToDispatch will validate dispatch exists
      // const dispatch = await repository.dispatch.getById(dispatchId);
      // if (!dispatch) {
      //    return res.status(HttpStatusCodes.NOT_FOUND).json({ message: "Dispatch not found" });
      // }

      const existingParcel = await repository.parcels.findParcelByHbl(req.body.hbl);
      if (!existingParcel) {
         return res.status(HttpStatusCodes.NOT_FOUND).json({ message: "Parcel not found" });
      }

      const parcelInDispatch = await repository.dispatch.addParcelToDispatch(
         existingParcel as Parcel,
         dispatchId,
         req.user.id
      );
      res.status(200).json(parcelInDispatch);
   } catch (error) {
      console.error(error);
      if (error instanceof AppError) {
         return res.status(error.status).json({ message: error.message });
      }
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
   }
});
router.delete("/:id/remove-parcel/:hbl", async (req: any, res: Response) => {
   try {
      const user = req.user;
      const hbl = req.params.hbl;
      if (!hbl) {
         return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "HBL is required" });
      }
      const parcel = await repository.dispatch.removeParcelFromDispatch(hbl, user.id);
      res.status(200).json(parcel);
   } catch (error) {
      if (error instanceof AppError) {
         return res.status(error.status).json({ message: error.message });
      }
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
   }
});

/**
 * Complete dispatch - Assign receiver agency and calculate all financials
 * This is the ONLY place where financial logic (pricing) is executed
 * Validates hierarchy and calculates pricing for all parcels
 */
router.post("/:id/complete-dispatch", async (req: any, res: Response) => {
   try {
      const dispatchId = parseInt(req.params.id);
      const user = req.user;
      //my parent agency id if not to my agency
      const parentAgency = await repository.agencies.getParent(user.agency_id);
      if (!parentAgency) {
         return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "Parent agency not found" });
      }
      const receiver_agency_id = parentAgency.id;

      if (!receiver_agency_id) {
         return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "receiver_agency_id is required" });
      }

      const dispatch = await repository.dispatch.getById(dispatchId);
      if (!dispatch) {
         return res.status(HttpStatusCodes.NOT_FOUND).json({ message: "Dispatch not found" });
      }

      const updatedDispatch = await repository.dispatch.completeDispatch(
         dispatchId,
         receiver_agency_id,
         dispatch.sender_agency_id
      );

      res.status(200).json(updatedDispatch);
   } catch (error) {
      if (error instanceof AppError) {
         return res.status(error.status).json({ message: error.message });
      }
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
   }
});

/**
 * Receive parcel in dispatch - Reconciliation process
 * Used by receiving agency to scan and verify parcels
 * If parcel is in dispatch -> marks as received
 * If parcel is NOT in dispatch but exists -> adds to dispatch and marks as received
 */
router.post("/:id/receive-parcel", async (req: any, res: Response) => {
   try {
      const dispatchId = parseInt(req.params.id);
      const { tracking_number } = req.body;
      const user = req.user;

      if (!tracking_number) {
         return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "tracking_number is required" });
      }

      const result = await repository.dispatch.receiveInDispatch(tracking_number, dispatchId, user.id);
      res.status(200).json({
         parcel: result.parcel,
         wasAdded: result.wasAdded,
         message: result.wasAdded
            ? "Parcel was not in dispatch but was found and added"
            : "Parcel was already in dispatch and marked as received",
      });
   } catch (error) {
      if (error instanceof AppError) {
         return res.status(error.status).json({ message: error.message });
      }
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
   }
});

/**
 * Get reception status summary for a dispatch
 * Returns: total expected, received, missing, and added parcels
 * Used by receiving agency to track reconciliation progress
 */
router.get("/:id/reception-status", async (req: Request, res: Response) => {
   try {
      const dispatchId = parseInt(req.params.id);
      const status = await repository.dispatch.getReceptionStatus(dispatchId);
      res.status(200).json(status);
   } catch (error) {
      if (error instanceof AppError) {
         return res.status(error.status).json({ message: error.message });
      }
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
   }
});

/**
 * Delete dispatch
 * Only sender agency can delete, and only if status is DRAFT or CANCELLED
 * ROOT users can delete any dispatch regardless of agency
 * All parcels will be removed from dispatch and their previous status restored
 */
router.delete("/:id", async (req: any, res: Response) => {
   try {
      const dispatchId = parseInt(req.params.id);
      const user = req.user;

      // ROOT users can delete any dispatch, skip agency check
      const isRoot = user.role === Roles.ROOT;

      if (!isRoot && !user.agency_id) {
         return res.status(HttpStatusCodes.BAD_REQUEST).json({ message: "User must be associated with an agency" });
      }

      const deletedDispatch = await repository.dispatch.delete(dispatchId, isRoot ? null : user.agency_id, user.id);
      res.status(200).json({ message: "Dispatch deleted successfully", dispatch: deletedDispatch });
   } catch (error) {
      if (error instanceof AppError) {
         return res.status(error.status).json({ message: error.message });
      }
      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
   }
});

export default router;
