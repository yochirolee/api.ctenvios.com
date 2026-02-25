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
exports.generateDispatchPaymentReceiptPDF = generateDispatchPaymentReceiptPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const client_1 = require("@prisma/client");
const utils_1 = require("../utils");
const pdf_fonts_1 = require("./pdf-fonts");
const PAYMENT_METHOD_LABELS = {
    [client_1.PaymentMethod.CASH]: "Efectivo",
    [client_1.PaymentMethod.CREDIT_CARD]: "Tarjeta de crédito",
    [client_1.PaymentMethod.DEBIT_CARD]: "Tarjeta de débito",
    [client_1.PaymentMethod.BANK_TRANSFER]: "Transferencia bancaria",
    [client_1.PaymentMethod.PAYPAL]: "PayPal",
    [client_1.PaymentMethod.ZELLE]: "Zelle",
    [client_1.PaymentMethod.CHECK]: "Cheque",
};
const COLORS = {
    BLACK: "#000000",
    GRAY: "#6b7280",
    BORDER: "#e5e7eb",
    MUTED_FOREGROUND: "#6b7280",
};
const PAGE_WIDTH = 612;
const LEFT_MARGIN = 20;
const RIGHT_MARGIN = PAGE_WIDTH - 20;
const CONTENT_WIDTH = RIGHT_MARGIN - LEFT_MARGIN;
const logoCache = new Map();
function getLogoBuffer() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const logoPath = path.join(process.cwd(), "assets", "ctelogo.png");
        if (logoCache.has(logoPath)) {
            return (_a = logoCache.get(logoPath)) !== null && _a !== void 0 ? _a : null;
        }
        try {
            const buffer = yield fs_1.promises.readFile(logoPath);
            logoCache.set(logoPath, buffer);
            return buffer;
        }
        catch (_b) {
            return null;
        }
    });
}
function formatDate(date) {
    if (!date)
        return "—";
    return new Date(date).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
function truncate(str, maxLen) {
    const s = str !== null && str !== void 0 ? str : "—";
    if (s.length <= maxLen)
        return s;
    return s.slice(0, maxLen - 1) + "…";
}
/**
 * Generate a PDF receipt listing all payments for a dispatch (notes, references, amounts, paid_by).
 */
function generateDispatchPaymentReceiptPDF(data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const doc = new pdfkit_1.default({
            size: "LETTER",
            margin: 0,
            bufferPages: true,
        });
        (0, pdf_fonts_1.registerPdfFonts)(doc);
        let y = 30;
        const lineHeight = 14;
        const tableRowHeight = 20;
        // Logo left; title and date right-aligned (Emitido on top, Dispatch # below)
        const logo = yield getLogoBuffer();
        if (logo) {
            doc.image(logo, LEFT_MARGIN, y, { width: 48, height: 36 });
        }
        doc.font(pdf_fonts_1.FONTS.BOLD).fontSize(16).fillColor(COLORS.BLACK);
        doc.text(`Dispatch #${data.id}`, LEFT_MARGIN, y + 6, {
            width: CONTENT_WIDTH,
            align: "right",
        });
        doc.font(pdf_fonts_1.FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
        doc.text(`Emitido: ${formatDate(new Date())}`, LEFT_MARGIN, y + 30, {
            width: CONTENT_WIDTH,
            align: "right",
        });
        // Origen / Destino to the right of the logo, vertically centered with logo (logo height 36, center at y+18)
        const originDestinoX = LEFT_MARGIN + (logo ? 54 : 0);
        const originDestinoWidth = CONTENT_WIDTH - (logo ? 54 : 0);
        const logoCenterY = y + 18;
        const originDestinoLineHeight = 11;
        const originDestinoStartY = logoCenterY - originDestinoLineHeight;
        doc.font(pdf_fonts_1.FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
        doc.text(`Origen: ${data.sender_agency.name}`, originDestinoX, originDestinoStartY, { width: originDestinoWidth });
        doc.text(`Destino: ${(_b = (_a = data.receiver_agency) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "—"}`, originDestinoX, originDestinoStartY + originDestinoLineHeight, {
            width: originDestinoWidth,
        });
        y += 56;
        // Dispatch summary
        doc.font(pdf_fonts_1.FONTS.SEMIBOLD).fontSize(10).fillColor(COLORS.BLACK);
        doc.text("Resumen del dispatch", LEFT_MARGIN, y);
        y += lineHeight;
        doc.font(pdf_fonts_1.FONTS.REGULAR).fontSize(9).fillColor(COLORS.BLACK);
        doc.text(`Costo total: ${(0, utils_1.formatCents)(data.cost_in_cents)}`, LEFT_MARGIN, y);
        y += lineHeight;
        doc.text(`Pagado: ${(0, utils_1.formatCents)(data.paid_in_cents)}  •  Estado: ${data.payment_status}`, LEFT_MARGIN, y);
        y += lineHeight + 8;
        // Payments table – same look as dispatch/order; column widths sum to full content width (minus cell padding)
        const tableContentWidth = CONTENT_WIDTH - 12; // 6px padding each side
        const colWidths = {
            num: 28,
            date: 72,
            method: 100,
            reference: 110,
            amount: 56,
            charge: 48,
            cobradoPor: tableContentWidth - (28 + 72 + 100 + 110 + 56 + 48), // rest of width
        };
        const headerY = y + 10;
        let x = LEFT_MARGIN + 6;
        doc.font(pdf_fonts_1.FONTS.SEMIBOLD).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
        doc.text("#", x, headerY, { width: colWidths.num });
        x += colWidths.num;
        doc.text("Fecha", x, headerY, { width: colWidths.date });
        x += colWidths.date;
        doc.text("Método", x, headerY, { width: colWidths.method });
        x += colWidths.method;
        doc.text("Referencia", x, headerY, { width: colWidths.reference });
        x += colWidths.reference;
        doc.text("Monto", x, headerY, { width: colWidths.amount });
        x += colWidths.amount;
        doc.text("Cargo", x, headerY, { width: colWidths.charge });
        x += colWidths.charge;
        doc.text("Cobrado por", x, headerY, { width: colWidths.cobradoPor });
        doc.strokeColor(COLORS.BORDER)
            .lineWidth(1)
            .moveTo(LEFT_MARGIN, headerY + 12)
            .lineTo(RIGHT_MARGIN, headerY + 12)
            .stroke();
        y = headerY + 15;
        if (data.payments.length === 0) {
            doc.font(pdf_fonts_1.FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
            doc.text("Sin pagos registrados", LEFT_MARGIN + 10, y + 6, { width: CONTENT_WIDTH - 20 });
            y += tableRowHeight;
            doc.strokeColor(COLORS.BORDER)
                .lineWidth(0.5)
                .moveTo(LEFT_MARGIN, y)
                .lineTo(RIGHT_MARGIN, y)
                .stroke();
        }
        else {
            for (let i = 0; i < data.payments.length; i++) {
                const p = data.payments[i];
                if (y > 680) {
                    doc.addPage();
                    y = 30;
                }
                x = LEFT_MARGIN + 6;
                doc.font(pdf_fonts_1.FONTS.REGULAR).fontSize(8).fillColor(COLORS.BLACK);
                doc.text(String(i + 1), x, y + 6, { width: colWidths.num });
                x += colWidths.num;
                doc.text(formatDate(p.date), x, y + 6, { width: colWidths.date });
                x += colWidths.date;
                doc.text((_c = PAYMENT_METHOD_LABELS[p.method]) !== null && _c !== void 0 ? _c : p.method, x, y + 6, { width: colWidths.method });
                x += colWidths.method;
                doc.text(truncate(p.reference, 18), x, y + 6, { width: colWidths.reference });
                x += colWidths.reference;
                doc.text((0, utils_1.formatCents)(p.amount_in_cents), x, y + 6, { width: colWidths.amount });
                x += colWidths.amount;
                doc.text((0, utils_1.formatCents)(p.charge_in_cents), x, y + 6, { width: colWidths.charge });
                x += colWidths.charge;
                doc.text(truncate((_e = (_d = p.paid_by) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : null, 18), x, y + 6, { width: colWidths.cobradoPor });
                y += tableRowHeight;
                doc.strokeColor(COLORS.BORDER)
                    .lineWidth(0.5)
                    .moveTo(LEFT_MARGIN, y)
                    .lineTo(RIGHT_MARGIN, y)
                    .stroke();
            }
        }
        // Notes section below the table (full notes for each payment)
        const paymentsWithNotes = data.payments.filter((p) => p.notes && p.notes.trim() !== "");
        if (paymentsWithNotes.length > 0) {
            y += 10;
            doc.font(pdf_fonts_1.FONTS.SEMIBOLD).fontSize(9).fillColor(COLORS.BLACK);
            doc.text("Notas", LEFT_MARGIN, y);
            y += lineHeight + 4;
            doc.font(pdf_fonts_1.FONTS.REGULAR).fontSize(8).fillColor(COLORS.BLACK);
            const notesWidth = CONTENT_WIDTH;
            for (let i = 0; i < data.payments.length; i++) {
                const p = data.payments[i];
                const notes = ((_f = p.notes) !== null && _f !== void 0 ? _f : "").trim();
                if (notes === "")
                    continue;
                if (y > 700) {
                    doc.addPage();
                    y = 30;
                }
                doc.font(pdf_fonts_1.FONTS.SEMIBOLD).fontSize(8).fillColor(COLORS.BLACK);
                doc.text(`#${i + 1}:`, LEFT_MARGIN, y, { width: 24 });
                doc.font(pdf_fonts_1.FONTS.REGULAR).fontSize(8).fillColor(COLORS.BLACK);
                const notesHeight = doc.heightOfString(notes, { width: notesWidth - 28 });
                doc.text(notes, LEFT_MARGIN + 28, y, { width: notesWidth - 28 });
                y += notesHeight + 6;
            }
            y += 6;
        }
        y += 12;
        // Totals
        const totalCharges = data.payments.reduce((sum, p) => sum + p.charge_in_cents, 0);
        doc.font(pdf_fonts_1.FONTS.SEMIBOLD).fontSize(10).fillColor(COLORS.BLACK);
        doc.text(`Total pagos: ${(0, utils_1.formatCents)(data.paid_in_cents)}`, LEFT_MARGIN, y);
        y += lineHeight;
        if (totalCharges > 0) {
            doc.text(`Total cargos: ${(0, utils_1.formatCents)(totalCharges)}`, LEFT_MARGIN, y);
            y += lineHeight;
        }
        doc.text(`Costo del dispatch: ${(0, utils_1.formatCents)(data.cost_in_cents)}`, LEFT_MARGIN, y);
        y += lineHeight;
        const balance = data.cost_in_cents - data.paid_in_cents;
        if (balance !== 0) {
            doc.font(balance > 0 ? pdf_fonts_1.FONTS.SEMIBOLD : pdf_fonts_1.FONTS.REGULAR).fillColor(COLORS.BLACK);
            doc.text(`Saldo ${balance > 0 ? "pendiente" : "a favor"}: ${(0, utils_1.formatCents)(Math.abs(balance))}`, LEFT_MARGIN, y);
        }
        // Caller must pipe() then end() the doc (e.g. in the controller)
        return doc;
    });
}
