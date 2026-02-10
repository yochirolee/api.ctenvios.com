"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.generateDispatchPDF = generateDispatchPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const bwipjs = __importStar(require("bwip-js"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const utils_1 = require("../utils");
const agency_hierarchy_1 = require("../agency-hierarchy");
const utils_2 = require("../utils");
// Font paths
const FONT_PATHS = {
    REGULAR: path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf"),
    MEDIUM: path.join(process.cwd(), "assets", "fonts", "Inter-Medium.ttf"),
    SEMIBOLD: path.join(process.cwd(), "assets", "fonts", "Inter-SemiBold.ttf"),
    BOLD: path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf"),
};
const FONTS = {
    REGULAR: "Inter-Regular",
    MEDIUM: "Inter-Medium",
    SEMIBOLD: "Inter-SemiBold",
    BOLD: "Inter-Bold",
};
const COLORS = {
    PRIMARY: "#2563eb",
    PRIMARY_FOREGROUND: "#ffffff",
    BACKGROUND: "#ffffff",
    MUTED: "#f9fafb",
    BORDER: "#e5e7eb",
    FOREGROUND: "#111827",
    MUTED_FOREGROUND: "#6b7280",
    BLACK: "#000000",
    SUCCESS: "#16a34a",
    WARNING: "#d97706",
    DESTRUCTIVE: "#dc2626",
    /** Background for rows where the order is split (not all parcels in this dispatch) */
    SPLIT_ORDER_BG: "#fef3c7",
};
// Cache for logo
const logoCache = new Map();
function getLogoBuffer() {
    return __awaiter(this, void 0, void 0, function* () {
        const logoPath = path.join(process.cwd(), "assets", "ctelogo.png");
        if (logoCache.has(logoPath)) {
            return logoCache.get(logoPath) || null;
        }
        try {
            const buffer = yield fs_1.promises.readFile(logoPath);
            logoCache.set(logoPath, buffer);
            return buffer;
        }
        catch (_a) {
            return null;
        }
    });
}
function generateBarcode(text) {
    return __awaiter(this, void 0, void 0, function* () {
        return bwipjs.toBuffer({
            bcid: "code128",
            text: text,
            scale: 2,
            height: 8,
            includetext: false,
        });
    });
}
function formatDate(date) {
    if (!date)
        return "N/A";
    return new Date(date).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
function getStatusLabel(status) {
    const statusLabels = {
        DRAFT: "Borrador",
        LOADING: "Cargando",
        DISPATCHED: "Despachado",
        RECEIVING: "Recibiendo",
        RECEIVED: "Recibido",
        DISCREPANCY: "Discrepancia",
        CANCELLED: "Cancelado",
    };
    return statusLabels[status] || status;
}
function generateDispatchPDF(dispatch) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        const doc = new pdfkit_1.default({
            size: "LETTER",
            margin: 0,
            bufferPages: true,
        });
        // Register fonts
        doc.registerFont(FONTS.REGULAR, FONT_PATHS.REGULAR);
        doc.registerFont(FONTS.MEDIUM, FONT_PATHS.MEDIUM);
        doc.registerFont(FONTS.SEMIBOLD, FONT_PATHS.SEMIBOLD);
        doc.registerFont(FONTS.BOLD, FONT_PATHS.BOLD);
        const PAGE_WIDTH = 612;
        const pageWidth = PAGE_WIDTH - 40; // Content width with margins
        const leftMargin = 20;
        let y = 20;
        // === HEADER - Similar to Order PDF ===
        const logo = yield getLogoBuffer();
        // Logo
        if (logo) {
            doc.image(logo, leftMargin, y + 6, { width: 48, height: 36 });
        }
        // Sender Agency name and info (next to logo)
        doc.font(FONTS.BOLD).fontSize(18).fillColor("#0d4fa3");
        doc.text(dispatch.sender_agency.name, leftMargin + 60, y + 6);
        doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
        doc.text(`${dispatch.sender_agency.address || ""} • ${dispatch.sender_agency.phone || ""}`, leftMargin + 60, y + 28);
        // Right side - Dispatch number and info
        const rightX = PAGE_WIDTH - 260;
        doc.font(FONTS.BOLD).fontSize(18).fillColor(COLORS.FOREGROUND);
        doc.text(`Dispatch ${dispatch.id}`, rightX, y + 6, { align: "right", width: 240 });
        doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
        doc.text(`Fecha: ${formatDate(dispatch.created_at)}`, rightX, y + 28, { align: "right", width: 240 });
        // Order count, weight and items stats (weight from parcels when dispatch.weight is 0)
        const orderCount = new Set(dispatch.parcels.map((p) => { var _a, _b; return (_a = p.order_id) !== null && _a !== void 0 ? _a : (_b = p.order) === null || _b === void 0 ? void 0 : _b.id; }).filter((id) => id != null)).size;
        const dispatchWeight = (0, utils_1.toNumber)(dispatch.weight);
        const summedWeight = dispatchWeight > 0
            ? dispatchWeight
            : dispatch.parcels.reduce((acc, p) => acc + (0, utils_1.toNumber)(p.weight), 0);
        const totalWeight = summedWeight.toFixed(2);
        doc.font(FONTS.SEMIBOLD).fontSize(9).fillColor(COLORS.FOREGROUND);
        doc.text(`Orders: ${orderCount}  •  Items: ${dispatch.parcels.length}  •  Weight: ${totalWeight} lbs`, rightX, y + 40, {
            align: "right",
            width: 240,
        });
        y += 60;
        // === SERVICE BAR with barcode ===
        const barHeight = 36;
        doc.rect(0, y, PAGE_WIDTH, barHeight).fill(COLORS.MUTED);
        doc.rect(0, y, PAGE_WIDTH, barHeight).stroke(COLORS.BORDER);
        // Status badge (left side of bar)
        const statusColor = dispatch.status === "RECEIVED"
            ? COLORS.SUCCESS
            : dispatch.status === "DISPATCHED"
                ? COLORS.PRIMARY
                : COLORS.WARNING;
        doc.roundedRect(leftMargin, y + 8, 20, 20, 4).fill(statusColor);
        doc.font(FONTS.BOLD).fontSize(12).fillColor(COLORS.PRIMARY_FOREGROUND);
        doc.text(getStatusLabel(dispatch.status).charAt(0), leftMargin, y + 12, { width: 20, align: "center" });
        // Destination agency name
        doc.font(FONTS.MEDIUM).fontSize(11).fillColor(COLORS.FOREGROUND);
        doc.text(`→ ${((_a = dispatch.receiver_agency) === null || _a === void 0 ? void 0 : _a.name) || "No asignado"}`, leftMargin + 30, y + 12);
        // Barcode on the right
        try {
            const barcode = yield generateBarcode(`${dispatch.id}`);
            doc.image(barcode, PAGE_WIDTH - 140, y + 6, { width: 120, height: 24 });
        }
        catch (e) {
            // Barcode generation failed, continue without it
        }
        y += barHeight + 15;
        // === PARCELS TABLE ===
        doc.font(FONTS.BOLD).fontSize(12).fillColor(COLORS.FOREGROUND);
        doc.text("DETALLE DE BULTOS", leftMargin, y);
        y += 20;
        const getOrderItemsForParcel = (parcel) => { var _a, _b, _c; return (_c = (_b = (_a = parcel.order) === null || _a === void 0 ? void 0 : _a.order_items) === null || _b === void 0 ? void 0 : _b.filter((it) => it.parcel_id === parcel.id)) !== null && _c !== void 0 ? _c : []; };
        const parcelFinancials = new Map();
        const sender_agency_id = dispatch.sender_agency.id;
        const receiver_agency_id = (_b = dispatch.receiver_agency) === null || _b === void 0 ? void 0 : _b.id;
        for (const parcel of dispatch.parcels) {
            const items = getOrderItemsForParcel(parcel);
            let totalInsuranceInCents = 0;
            let totalCustomsInCents = 0;
            let totalChargeInCents = 0;
            let totalSubtotalInCents = 0;
            let totalPriceInCents = 0;
            let displayUnit = "PER_LB";
            let isFirstItem = true;
            for (const item of items) {
                // Get product_id and service_id from the rate (consistent with PricingAgreement)
                const product_id = (_d = (_c = item.rate) === null || _c === void 0 ? void 0 : _c.product) === null || _d === void 0 ? void 0 : _d.id;
                const service_id = ((_f = (_e = item.rate) === null || _e === void 0 ? void 0 : _e.service) === null || _f === void 0 ? void 0 : _f.id) || ((_g = item.service) === null || _g === void 0 ? void 0 : _g.id) || item.service_id;
                const unit = item.unit || ((_j = (_h = item.rate) === null || _h === void 0 ? void 0 : _h.product) === null || _j === void 0 ? void 0 : _j.unit) || "PER_LB";
                const itemWeight = (0, utils_1.toNumber)(item.weight);
                // Get the pricing agreement rate between sender↔receiver agencies
                // This is the inter-agency price, NOT the client price (price_in_cents)
                let unitRateInCents = 0;
                if (receiver_agency_id && product_id && service_id) {
                    const agreementRate = yield (0, agency_hierarchy_1.getPricingBetweenAgencies)(receiver_agency_id, // seller (receiver agency is selling transport service)
                    sender_agency_id, // buyer (sender agency is buying the service)
                    product_id, service_id);
                    if (agreementRate !== null) {
                        unitRateInCents = agreementRate;
                    }
                }
                // Fallback: use the rate's original pricing_agreement (still inter-agency, not client price)
                // This handles cases where no specific agreement exists between sender↔receiver
                if (unitRateInCents === 0 && ((_l = (_k = item.rate) === null || _k === void 0 ? void 0 : _k.pricing_agreement) === null || _l === void 0 ? void 0 : _l.price_in_cents)) {
                    unitRateInCents = item.rate.pricing_agreement.price_in_cents;
                }
                // Handle price display based on unit type
                if (isFirstItem) {
                    displayUnit = unit;
                    isFirstItem = false;
                }
                // For PER_LB: show the rate (same for all items typically)
                // For Fixed: sum all prices since each item is a fixed price
                if (unit === "PER_LB") {
                    if (totalPriceInCents === 0) {
                        totalPriceInCents = unitRateInCents; // Show rate for PER_LB
                    }
                }
                else {
                    // Fixed price items: accumulate the prices
                    totalPriceInCents += unitRateInCents;
                }
                const itemInsurance = item.insurance_fee_in_cents || 0;
                const itemCustoms = item.customs_fee_in_cents || 0;
                const itemCharge = item.charge_fee_in_cents || 0;
                // Calculate subtotal using the inter-agency pricing agreement rate
                const itemSubtotal = (0, utils_2.calculate_row_subtotal)(unitRateInCents, itemWeight, itemCustoms, itemCharge, itemInsurance, unit);
                totalInsuranceInCents += itemInsurance;
                totalCustomsInCents += itemCustoms;
                totalChargeInCents += itemCharge;
                totalSubtotalInCents += itemSubtotal;
            }
            parcelFinancials.set(parcel.id, {
                unitRateInCents: totalPriceInCents, // Rate for PER_LB, or sum of prices for Fixed
                insuranceInCents: totalInsuranceInCents,
                customsInCents: totalCustomsInCents,
                chargeInCents: totalChargeInCents,
                subtotalInCents: totalSubtotalInCents,
                unit: displayUnit,
            });
        }
        // Clear pricing cache after calculation
        (0, agency_hierarchy_1.clearPricingCache)();
        // Table layout - matching order PDF style (white/black, no colored header)
        // Calculate column positions from right edge
        const rightMargin = PAGE_WIDTH - 20;
        const columnGap = 5;
        const subtotalWidth = 55;
        const pesoWidth = 32;
        const precioWidth = 28;
        const arancelWidth = 35;
        const cargoWidth = 35;
        const seguroWidth = 35;
        const hblWidth = 92;
        const orderWidth = 28;
        // Position: Orden first, then Hbl, then Descripción
        const orderX = leftMargin;
        const hblX = orderX + orderWidth + columnGap;
        const descriptionX = hblX + hblWidth + columnGap;
        // Position from right to left (financial columns); Peso tight to Subtotal (more to the right)
        const subtotalX = rightMargin - subtotalWidth;
        const pesoX = subtotalX - pesoWidth;
        const precioX = pesoX - columnGap - precioWidth;
        const arancelX = precioX - columnGap - arancelWidth;
        const cargoX = arancelX - columnGap - cargoWidth;
        const seguroX = cargoX - columnGap - seguroWidth;
        const descriptionWidth = seguroX - descriptionX - columnGap;
        // How many parcels in this dispatch per order_id (for split detection)
        const parcelsInDispatchByOrderId = new Map();
        for (const p of dispatch.parcels) {
            const oid = (_p = (_m = p.order_id) !== null && _m !== void 0 ? _m : (_o = p.order) === null || _o === void 0 ? void 0 : _o.id) !== null && _p !== void 0 ? _p : null;
            if (oid != null)
                parcelsInDispatchByOrderId.set(oid, ((_q = parcelsInDispatchByOrderId.get(oid)) !== null && _q !== void 0 ? _q : 0) + 1);
        }
        const isSplitOrder = (parcel) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const oid = (_c = (_a = parcel.order_id) !== null && _a !== void 0 ? _a : (_b = parcel.order) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : null;
            if (oid == null)
                return false;
            const total = (_f = (_e = (_d = parcel.order) === null || _d === void 0 ? void 0 : _d._count) === null || _e === void 0 ? void 0 : _e.parcels) !== null && _f !== void 0 ? _f : 0;
            const inDispatch = (_g = parcelsInDispatchByOrderId.get(oid)) !== null && _g !== void 0 ? _g : 0;
            return total > 0 && inDispatch < total;
        };
        // Helper function to draw table headers
        const drawTableHeaders = (headerY) => {
            const headers = [
                { text: "Orden", x: orderX, width: orderWidth, align: "left" },
                { text: "Hbl", x: hblX, width: hblWidth, align: "left" },
                { text: "Descripción", x: descriptionX, width: descriptionWidth, align: "left" },
                { text: "Seguro", x: seguroX, width: seguroWidth, align: "right" },
                { text: "Cargo", x: cargoX, width: cargoWidth, align: "right" },
                { text: "Arancel", x: arancelX, width: arancelWidth, align: "right" },
                { text: "Precio", x: precioX, width: precioWidth, align: "right" },
                { text: "Peso", x: pesoX, width: pesoWidth, align: "right" },
                { text: "Subtotal", x: subtotalX, width: subtotalWidth, align: "right" },
            ];
            doc.font(FONTS.SEMIBOLD).fontSize(7).fillColor(COLORS.MUTED_FOREGROUND);
            headers.forEach((header) => {
                doc.text(header.text, header.x, headerY, {
                    width: header.width,
                    align: header.align,
                    characterSpacing: 0.3,
                });
            });
            // Draw border at bottom of header
            doc.strokeColor(COLORS.BORDER)
                .lineWidth(1)
                .moveTo(leftMargin, headerY + 12)
                .lineTo(rightMargin, headerY + 12)
                .stroke();
            return headerY + 15;
        };
        // Draw initial headers
        y = drawTableHeaders(y + 10);
        // Table rows – center text vertically using measured line height
        const rowHeight = 22;
        const rowFontSize = 8;
        doc.font(FONTS.REGULAR).fontSize(rowFontSize);
        // Baseline at row center so text stays inside row (PDFKit y = baseline; most height is above it)
        const textY = (rowY) => rowY + rowHeight / 2;
        const bottomMargin = 60;
        for (const [index, parcel] of dispatch.parcels.entries()) {
            // Check if we need a new page
            if (y + rowHeight > doc.page.height - bottomMargin - 50) {
                doc.addPage();
                y = 20;
                y = drawTableHeaders(y);
            }
            // Get pre-calculated financials for this parcel
            const financials = parcelFinancials.get(parcel.id) || {
                unitRateInCents: 0,
                insuranceInCents: 0,
                customsInCents: 0,
                chargeInCents: 0,
                subtotalInCents: 0,
                unit: "PER_LB",
            };
            const rowTextY = textY(y);
            const isSplit = isSplitOrder(parcel);
            // Background for split orders (not all parcels of this order are in this dispatch)
            if (isSplit) {
                doc.rect(leftMargin, y, rightMargin - leftMargin, rowHeight).fill(COLORS.SPLIT_ORDER_BG);
            }
            // Orden (Order ID)
            doc.font(FONTS.REGULAR).fontSize(rowFontSize).fillColor(COLORS.FOREGROUND);
            const orderId = (_t = (_r = parcel.order_id) !== null && _r !== void 0 ? _r : (_s = parcel.order) === null || _s === void 0 ? void 0 : _s.id) !== null && _t !== void 0 ? _t : "—";
            doc.text(String(orderId), orderX, rowTextY, { width: orderWidth });
            // HBL
            doc.text(parcel.tracking_number, hblX, rowTextY, { width: hblWidth });
            // Description (trimmed) from order items for this parcel
            const parcelItems = getOrderItemsForParcel(parcel);
            const description = parcelItems.length > 0
                ? parcelItems
                    .map((item) => item.description || "")
                    .filter(Boolean)
                    .join(", ") || "N/A"
                : "N/A";
            const descTrimmed = description.length > 28 ? description.substring(0, 28) + "…" : description;
            doc.text(descTrimmed, descriptionX, rowTextY, { width: descriptionWidth });
            // Seguro (Insurance)
            const insuranceColor = financials.insuranceInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
            doc.font(FONTS.REGULAR).fontSize(7).fillColor(insuranceColor);
            doc.text((0, utils_1.formatCents)(financials.insuranceInCents), seguroX, rowTextY, { width: seguroWidth, align: "right" });
            // Cargo (Charge)
            const cargoColor = financials.chargeInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
            doc.fillColor(cargoColor);
            doc.text((0, utils_1.formatCents)(financials.chargeInCents), cargoX, rowTextY, { width: cargoWidth, align: "right" });
            // Arancel (Customs)
            const customsColor = financials.customsInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
            doc.fillColor(customsColor);
            doc.text((0, utils_1.formatCents)(financials.customsInCents), arancelX, rowTextY, { width: arancelWidth, align: "right" });
            // Precio
            doc.fillColor(COLORS.FOREGROUND);
            doc.text((0, utils_1.formatCents)(financials.unitRateInCents), precioX, rowTextY, { width: precioWidth, align: "right" });
            // Peso (Weight)
            doc.text(`${(0, utils_1.toNumber)(parcel.weight).toFixed(2)}`, pesoX, rowTextY, { width: pesoWidth, align: "right" });
            // Subtotal
            doc.font(FONTS.SEMIBOLD).fontSize(7).fillColor(COLORS.FOREGROUND);
            doc.text((0, utils_1.formatCents)(financials.subtotalInCents), subtotalX, rowTextY, { width: subtotalWidth, align: "right" });
            // Row border
            doc.strokeColor(COLORS.BORDER)
                .lineWidth(0.5)
                .moveTo(leftMargin, y + rowHeight)
                .lineTo(rightMargin, y + rowHeight)
                .stroke();
            y += rowHeight;
        }
        y += 10;
        // === DISPATCH TOTALS ===
        // Calculate grand totals
        let grandSubtotalInCents = 0;
        let grandDeliveryInCents = 0;
        for (const parcel of dispatch.parcels) {
            const financials = parcelFinancials.get(parcel.id);
            if (financials) {
                grandSubtotalInCents += financials.subtotalInCents;
            }
        }
        // Delivery: sum per order once (order_items.delivery_fee_in_cents). If parcel_id is set we use
        // items for that parcel; otherwise we use all order_items for the order so delivery is not 0.
        const deliverySummedForOrderId = new Set();
        for (const parcel of dispatch.parcels) {
            const orderId = (_w = (_u = parcel.order_id) !== null && _u !== void 0 ? _u : (_v = parcel.order) === null || _v === void 0 ? void 0 : _v.id) !== null && _w !== void 0 ? _w : null;
            if (orderId == null || deliverySummedForOrderId.has(orderId))
                continue;
            deliverySummedForOrderId.add(orderId);
            const items = (_y = (_x = parcel.order) === null || _x === void 0 ? void 0 : _x.order_items) !== null && _y !== void 0 ? _y : [];
            for (const item of items) {
                grandDeliveryInCents += item.delivery_fee_in_cents || 0;
            }
        }
        const grandTotalInCents = grandSubtotalInCents + grandDeliveryInCents;
        // Totals box - aligned to the right
        const totalsBoxWidth = 180;
        const totalsBoxX = leftMargin + pageWidth - totalsBoxWidth;
        const totalsBoxHeight = 60;
        doc.roundedRect(totalsBoxX, y, totalsBoxWidth, totalsBoxHeight, 4).fillAndStroke(COLORS.MUTED, COLORS.BORDER);
        const labelX = totalsBoxX + 10;
        const valueX = totalsBoxX + totalsBoxWidth - 10;
        let totalsY = y + 10;
        // Subtotal
        doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.FOREGROUND);
        doc.text("Subtotal:", labelX, totalsY);
        doc.text((0, utils_1.formatCents)(grandSubtotalInCents), valueX - 60, totalsY, { width: 60, align: "right" });
        totalsY += 14;
        // Delivery
        doc.text("Delivery:", labelX, totalsY);
        doc.text((0, utils_1.formatCents)(grandDeliveryInCents), valueX - 60, totalsY, { width: 60, align: "right" });
        totalsY += 16;
        // Total line
        doc.moveTo(labelX, totalsY - 4)
            .lineTo(valueX, totalsY - 4)
            .stroke(COLORS.BORDER);
        // Total
        doc.font(FONTS.BOLD).fontSize(11).fillColor(COLORS.PRIMARY);
        doc.text("TOTAL:", labelX, totalsY);
        doc.text((0, utils_1.formatCents)(grandTotalInCents), valueX - 70, totalsY, { width: 70, align: "right" });
        y += totalsBoxHeight + 15;
        // === SIGNATURE SECTION ===
        y = doc.page.height - 80;
        doc.moveTo(leftMargin, y + 30)
            .lineTo(leftMargin + 150, y + 30)
            .stroke(COLORS.BORDER);
        doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
        doc.text("Firma Origen", leftMargin, y + 35);
        doc.moveTo(PAGE_WIDTH - 170, y + 30)
            .lineTo(PAGE_WIDTH - 20, y + 30)
            .stroke(COLORS.BORDER);
        doc.text("Firma Destino", PAGE_WIDTH - 170, y + 35);
        return doc;
    });
}
