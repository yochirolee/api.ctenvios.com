import { Router, Request, Response } from "express";
import { legacyMysqlDb } from "../services/legacy-myslq-db";
import { legacyParserService } from "../services/legacy-parser.service";
import { authMiddleware } from "../middlewares/auth.middleware";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

const router = Router();

router.get("/test", async (req, res) => {
   const db = await legacyMysqlDb();
   const [rows] = await db.execute("SELECT * from parcels limit 10");
   res.json(rows);
});

/**
 * GET /api/v1/legacy/:id/parcels
 * Get parcels for a specific invoice ID and return in API order format
 * Query params: resolveRelations (default: true), defaultUserId, defaultServiceId
 */
router.get("/orders/:id/parcels", authMiddleware, async (req: any, res: Response): Promise<void> => {
   const user = req.user;

   if (!user) {
      throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
   }

   const { id } = req.params;
   const { resolveRelations = "true", defaultUserId, defaultServiceId } = req.query;

   const invoiceId = parseInt(id);
   if (isNaN(invoiceId)) {
      throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid invoice ID");
   }

   const db = await legacyMysqlDb();
   const [rows] = await db.execute<any[]>("SELECT * from parcels where invoiceId = ?", [invoiceId]);
   await db.end();

   if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError(HttpStatusCodes.NOT_FOUND, `No parcels found for invoice ID ${invoiceId}`);
   }

   // Transform legacy MySQL rows to match LegacyParcelItem interface
   const legacyParcels = rows.map((row) => ({
      id: row.id || 0,
      hbl: row.hbl || row.tracking_number || "",
      invoiceId: row.invoiceId || row.invoice_id || invoiceId,
      invoiceUser: row.invoiceUser || row.invoice_user || "",
      parcelType: row.parcelType || row.parcel_type || 4,
      description: row.description || "",
      senderId: row.senderId || row.sender_id || 0,
      sender: row.sender || "",
      receiverId: row.receiverId || row.receiver_id || 0,
      senderMobile: row.senderMobile || row.sender_mobile || "",
      senderEmail: row.senderEmail || row.sender_email || "",
      receiver: row.receiver || "",
      receiverMobile: row.receiverMobile || row.receiver_mobile || "",
      cll: row.cll || "",
      entre_cll: row.entre_cll || "",
      no: row.no || "",
      apto: row.apto || "",
      reparto: row.reparto || "",
      receiverCi: row.receiverCi || row.receiver_ci || "",
      city: row.city || "",
      province: row.province || "",
      invoiceDate: row.invoiceDate || row.invoice_date || new Date().toISOString(),
      currentLocation: row.currentLocation || row.current_location || 0,
      containerName: row.containerName || row.container_name || "",
      containerDate: row.containerDate || row.container_date || "",
      containerId: row.containerId || row.container_id || 0,
      cityId: row.cityId || row.city_id || 0,
      stateId: row.stateId || row.state_id || 0,
      palletId: row.palletId || row.pallet_id || 0,
      dispatchId: row.dispatchId || row.dispatch_id || 0,
      dispatchDate: row.dispatchDate || row.dispatch_date || "",
      dispatchStatus: row.dispatchStatus || row.dispatch_status || 0,
      palletDate: row.palletDate || row.pallet_date || "",
      agency: row.agency || "",
      agencyId: row.agencyId || row.agency_id || 0,
      weight: row.weight || "0.00",
   }));

   // Parse to API format
   const parsedOrder = await legacyParserService.parseLegacyOrderByInvoiceId(invoiceId, legacyParcels, {
      resolveRelations: resolveRelations !== "false",
      defaultUserId: (defaultUserId as string) || user.id,
      defaultServiceId: defaultServiceId ? parseInt(defaultServiceId as string) : 1,
   });

   if (!parsedOrder) {
      throw new AppError(HttpStatusCodes.NOT_FOUND, `Failed to parse order for invoice ID ${invoiceId}`);
   }

   console.log("parsedOrder", parsedOrder);

   res.status(200).json(parsedOrder);
});

export default router;
