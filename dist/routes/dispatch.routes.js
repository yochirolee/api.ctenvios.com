"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const dispatch_controller_1 = __importDefault(require("../controllers/dispatch.controller"));
const router = (0, express_1.Router)();
const dispatchIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^\d+$/, "Dispatch ID must be a number").transform(Number),
});
const addByOrderBodySchema = zod_1.z.object({
    order_id: zod_1.z.number().int().positive("Order ID is required"),
});
// GET /dispatches - Get all dispatches with filters
router.get("/", auth_middleware_1.authMiddleware, dispatch_controller_1.default.getAll);
// GET /dispatches/ready-for-dispatch - Get parcels ready for dispatch in user's agency
// MUST be before /:id to avoid matching "ready-for-dispatch" as an ID
router.get("/ready-for-dispatch", auth_middleware_1.authMiddleware, dispatch_controller_1.default.getReadyForDispatch);
// POST /dispatches/from-parcels - Create dispatch from scanned parcels
// MUST be before /:id routes
router.post("/from-parcels", auth_middleware_1.authMiddleware, dispatch_controller_1.default.createFromParcels);
// POST /dispatches/receive-parcels - Receive parcels without prior dispatch
// Groups by sender agency and creates RECEIVED dispatches
router.post("/receive-parcels", auth_middleware_1.authMiddleware, dispatch_controller_1.default.receiveParcelsWithoutDispatch);
// POST /dispatches/smart-receive - Intelligent parcel reception (RECOMMENDED)
// Handles all scenarios: new dispatches, pending dispatches, and existing dispatches
router.post("/smart-receive", auth_middleware_1.authMiddleware, dispatch_controller_1.default.smartReceive);
// GET /dispatches/:id - Get a specific dispatch
router.get("/:id", auth_middleware_1.authMiddleware, dispatch_controller_1.default.getById);
//Generate dispatch PDF with parcels and financials
router.get("/:id/pdf", dispatch_controller_1.default.generateDispatchPdf);
// GET /dispatches/:id/parcels - Get parcels in a specific dispatch
router.get("/:id/parcels", auth_middleware_1.authMiddleware, dispatch_controller_1.default.getParcelsInDispatch);
// GET /dispatches/:id/reception-status - Get reception status summary
router.get("/:id/reception-status", auth_middleware_1.authMiddleware, dispatch_controller_1.default.getReceptionStatus);
// POST /dispatches - Create an empty dispatch (DRAFT status)
router.post("/", auth_middleware_1.authMiddleware, dispatch_controller_1.default.create);
// POST /dispatches/:id/add-parcel - Add parcel to dispatch
router.post("/:id/add-parcel", auth_middleware_1.authMiddleware, dispatch_controller_1.default.addParcel);
// POST /dispatches/:id/add-by-order - Add parcels to dispatch by order id (like containers /parcels/by-order)
router.post("/:id/add-parcels-by-order", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)({ params: dispatchIdParamSchema, body: addByOrderBodySchema }), dispatch_controller_1.default.addParcelsByOrderId);
// POST /dispatches/:id/finalize-create - Finalize dispatch creation with financials
router.post("/:id/finalize-create", auth_middleware_1.authMiddleware, dispatch_controller_1.default.finalizeCreate);
// POST /dispatches/:id/receive-parcel - Receive parcel during reconciliation
router.post("/:id/receive-parcel", auth_middleware_1.authMiddleware, dispatch_controller_1.default.receiveParcel);
// POST /dispatches/:id/finalize-reception - Finalize reception and recalculate costs
router.post("/:id/finalize-reception", auth_middleware_1.authMiddleware, dispatch_controller_1.default.finalizeReception);
// DELETE /dispatches/:id/remove-parcel/:hbl - Remove parcel from dispatch
router.delete("/:id/remove-parcel/:hbl", auth_middleware_1.authMiddleware, dispatch_controller_1.default.removeParcel);
// DELETE /dispatches/:id - Delete dispatch
router.delete("/:id", auth_middleware_1.authMiddleware, dispatch_controller_1.default.delete);
exports.default = router;
