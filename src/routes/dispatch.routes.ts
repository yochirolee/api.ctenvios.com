import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import dispatchController from "../controllers/dispatch.controller";

const router = Router();

const dispatchIdParamSchema = z.object({
   id: z.string().regex(/^\d+$/, "Dispatch ID must be a number").transform(Number),
});
const addByOrderBodySchema = z.object({
   order_id: z.number().int().positive("Order ID is required"),
});

// GET /dispatches - Get all dispatches with filters
router.get("/", authMiddleware, dispatchController.getAll);

// GET /dispatches/ready-for-dispatch - Get parcels ready for dispatch in user's agency
// MUST be before /:id to avoid matching "ready-for-dispatch" as an ID
router.get("/ready-for-dispatch", authMiddleware, dispatchController.getReadyForDispatch);

// POST /dispatches/from-parcels - Create dispatch from scanned parcels
// MUST be before /:id routes
router.post("/from-parcels", authMiddleware, dispatchController.createFromParcels);

// POST /dispatches/receive-parcels - Receive parcels without prior dispatch
// Groups by sender agency and creates RECEIVED dispatches
router.post("/receive-parcels", authMiddleware, dispatchController.receiveParcelsWithoutDispatch);

// POST /dispatches/smart-receive - Intelligent parcel reception (RECOMMENDED)
// Handles all scenarios: new dispatches, pending dispatches, and existing dispatches
router.post("/smart-receive", authMiddleware, dispatchController.smartReceive);

// GET /dispatches/:id - Get a specific dispatch
router.get("/:id", authMiddleware, dispatchController.getById);

//Generate dispatch PDF with parcels and financials
router.get("/:id/pdf", dispatchController.generateDispatchPdf);

// GET /dispatches/:id/parcels - Get parcels in a specific dispatch
router.get("/:id/parcels", authMiddleware, dispatchController.getParcelsInDispatch);

// GET /dispatches/:id/reception-status - Get reception status summary
router.get("/:id/reception-status", authMiddleware, dispatchController.getReceptionStatus);

// POST /dispatches - Create an empty dispatch (DRAFT status)
router.post("/", authMiddleware, dispatchController.create);

// POST /dispatches/:id/add-parcel - Add parcel to dispatch
router.post("/:id/add-parcel", authMiddleware, dispatchController.addParcel);

// POST /dispatches/:id/add-by-order - Add parcels to dispatch by order id (like containers /parcels/by-order)
router.post(
   "/:id/add-parcels-by-order",
   authMiddleware,
   validate({ params: dispatchIdParamSchema, body: addByOrderBodySchema }),
   dispatchController.addParcelsByOrderId
);
// POST /dispatches/:id/finalize-create - Finalize dispatch creation with financials
router.post("/:id/finalize-create", authMiddleware, dispatchController.finalizeCreate);

// POST /dispatches/:id/receive-parcel - Receive parcel during reconciliation
router.post("/:id/receive-parcel", authMiddleware, dispatchController.receiveParcel);

// POST /dispatches/:id/finalize-reception - Finalize reception and recalculate costs
router.post("/:id/finalize-reception", authMiddleware, dispatchController.finalizeReception);

// DELETE /dispatches/:id/remove-parcel/:hbl - Remove parcel from dispatch
router.delete("/:id/remove-parcel/:hbl", authMiddleware, dispatchController.removeParcel);

// DELETE /dispatches/:id - Delete dispatch
router.delete("/:id", authMiddleware, dispatchController.delete);

export default router;
