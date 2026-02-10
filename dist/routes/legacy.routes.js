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
const legacy_myslq_db_1 = require("../services/legacy-myslq-db");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const router = (0, express_1.Router)();
router.get("/test", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, legacy_myslq_db_1.legacyMysqlDb)();
    const [rows] = yield db.execute("SELECT * from parcels limit 10");
    res.json(rows);
}));
/**
 * GET /api/v1/legacy/orders/:id/parcels
 * Get parcels for a specific invoice ID and return in API order format
 * Query params: defaultUserId, defaultServiceId
 */
router.get("/orders/:id/parcels", auth_middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const user = req.user;
    if (!user) {
        throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "User not authenticated");
    }
    const { id } = req.params;
    const { defaultUserId, defaultServiceId } = req.query;
    const invoiceId = parseInt(id);
    if (isNaN(invoiceId)) {
        throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid invoice ID");
    }
    const db = yield (0, legacy_myslq_db_1.legacyMysqlDb)();
    const [rows] = yield db.execute("SELECT * from parcels where invoiceId = ?", [invoiceId]);
    yield db.end();
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, `No parcels found for invoice ID ${invoiceId}`);
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
            first_name: ((_a = firstParcel.sender) === null || _a === void 0 ? void 0 : _a.split(" ")[0]) || "",
            middle_name: ((_b = firstParcel.sender) === null || _b === void 0 ? void 0 : _b.split(" ")[1]) || null,
            last_name: ((_c = firstParcel.sender) === null || _c === void 0 ? void 0 : _c.split(" ").slice(-1)[0]) || "",
            second_last_name: null,
            mobile: firstParcel.senderMobile || "",
            email: firstParcel.senderEmail || null,
            address: null,
            identity_document: null,
        },
        receiver_id: null,
        receiver: {
            id: null,
            first_name: ((_d = firstParcel.receiver) === null || _d === void 0 ? void 0 : _d.split(" ")[0]) || "",
            middle_name: ((_e = firstParcel.receiver) === null || _e === void 0 ? void 0 : _e.split(" ")[1]) || null,
            last_name: ((_f = firstParcel.receiver) === null || _f === void 0 ? void 0 : _f.split(" ").slice(-1)[0]) || "",
            second_last_name: null,
            ci: firstParcel.receiverCi || null,
            mobile: firstParcel.receiverMobile || null,
            email: null,
            phone: null,
            address: [firstParcel.cll, firstParcel.entre_cll, firstParcel.no, firstParcel.apto, firstParcel.reparto]
                .filter(Boolean)
                .join(", ") || "",
            province_id: firstParcel.stateId || null,
            province: firstParcel.province || null,
            city_id: firstParcel.cityId || null,
            city: firstParcel.city || null,
        },
        service_id: defaultServiceId ? parseInt(defaultServiceId) : 1,
        service: { id: defaultServiceId ? parseInt(defaultServiceId) : 1, name: "Maritimo" },
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
            service_id: defaultServiceId ? parseInt(defaultServiceId) : 1,
            created_at: parcel.invoiceDate || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: defaultUserId || user.id,
            legacy_parcel_id: parcel.hbl || "",
        })),
        paid_in_cents: 0,
        requires_home_delivery: true,
        created_at: firstParcel.invoiceDate || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: defaultUserId || user.id,
        user: null,
        payment_status: "PENDING",
        stage: "BILLING",
        status: firstParcel.dispatchStatus === 3 ? "DELIVERED" : firstParcel.dispatchStatus === 4 ? "RETURNED" : "IN_TRANSIT",
        partner_id: null,
        partner_order_id: null,
        discounts: [],
        payments: [],
        issues: [],
        legacy_invoice_id: invoiceId,
    };
    res.status(200).json(formattedOrder);
}));
exports.default = router;
