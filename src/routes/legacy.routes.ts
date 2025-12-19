import { Router, Response } from "express";
import { legacyMysqlDb } from "../services/legacy-myslq-db";
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
 * GET /api/v1/legacy/orders/:id/parcels
 * Get parcels for a specific invoice ID and return in API order format
 * Query params: defaultUserId, defaultServiceId
 */
router.get("/orders/:id/parcels", authMiddleware, async (req: any, res: Response): Promise<void> => {
   const user = req.user;

   if (!user) {
      throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
   }

   const { id } = req.params;
   const { defaultUserId, defaultServiceId } = req.query;

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

   // Format response without database searches
   const firstParcel = legacyParcels[0];

   const formattedOrder = {
      order_id: invoiceId,
      customer_id: null,
      customer: {
         id: null,
         first_name: firstParcel.sender?.split(" ")[0] || "",
         middle_name: firstParcel.sender?.split(" ")[1] || null,
         last_name: firstParcel.sender?.split(" ").slice(-1)[0] || "",
         second_last_name: null,
         mobile: firstParcel.senderMobile || "",
         email: firstParcel.senderEmail || null,
         address: null,
         identity_document: null,
      },
      receiver_id: null,
      receiver: {
         id: null,
         first_name: firstParcel.receiver?.split(" ")[0] || "",
         middle_name: firstParcel.receiver?.split(" ")[1] || null,
         last_name: firstParcel.receiver?.split(" ").slice(-1)[0] || "",
         second_last_name: null,
         ci: firstParcel.receiverCi || null,
         mobile: firstParcel.receiverMobile || null,
         email: null,
         phone: null,
         address:
            [firstParcel.cll, firstParcel.entre_cll, firstParcel.no, firstParcel.apto, firstParcel.reparto]
               .filter(Boolean)
               .join(", ") || "",
         province_id: firstParcel.stateId || null,
         city_id: firstParcel.cityId || null,
      },
      service_id: defaultServiceId ? parseInt(defaultServiceId as string) : 1,
      service: { id: defaultServiceId ? parseInt(defaultServiceId as string) : 1, name: "Maritimo" },
      agency_id: firstParcel.agencyId || null,
      agency: { id: firstParcel.agencyId || null, name: firstParcel.agency || "" },
      parcels: legacyParcels.map((parcel) => ({
         id: parcel.id,
         tracking_number: parcel.hbl || "",
         description: parcel.description || "",
         weight: parseFloat(parcel.weight) || 0,
         status: parcel.dispatchStatus === 3 ? "DELIVERED" : parcel.dispatchStatus === 4 ? "RETURNED" : "IN_TRANSIT",
         agency_id: parcel.agencyId || null,
         order_id: invoiceId,
         service_id: defaultServiceId ? parseInt(defaultServiceId as string) : 1,
         created_at: parcel.invoiceDate || new Date().toISOString(),
         updated_at: new Date().toISOString(),
         user_id: (defaultUserId as string) || user.id,
         legacy_parcel_id: parcel.hbl || "",
      })),
      paid_in_cents: 0,
      requires_home_delivery: true,
      created_at: firstParcel.invoiceDate || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: (defaultUserId as string) || user.id,
      user: null,
      payment_status: "PENDING",
      stage: "BILLING",
      status:
         firstParcel.dispatchStatus === 3 ? "DELIVERED" : firstParcel.dispatchStatus === 4 ? "RETURNED" : "IN_TRANSIT",
      partner_id: null,
      partner_order_id: null,
      discounts: [],
      payments: [],
      issues: [],
      legacy_invoice_id: invoiceId,
   };

   res.status(200).json(formattedOrder);
});

export default router;
