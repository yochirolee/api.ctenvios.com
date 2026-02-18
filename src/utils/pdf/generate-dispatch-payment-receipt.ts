import PDFKit from "pdfkit";
import * as path from "path";
import { promises as fs } from "fs";
import { PaymentMethod } from "@prisma/client";
import { formatCents } from "../utils";
import { registerPdfFonts, FONTS, FONT_PATHS } from "./pdf-fonts";

/**
 * Data required to generate the dispatch payment receipt PDF.
 * Matches the shape returned by dispatch repository with payments included.
 */
export interface DispatchPaymentReceiptData {
   id: number;
   cost_in_cents: number;
   paid_in_cents: number;
   payment_status: string;
   created_at: Date;
   sender_agency: {
      id: number;
      name: string;
      phone?: string | null;
      address?: string | null;
   };
   receiver_agency: {
      id: number;
      name: string;
      phone?: string | null;
      address?: string | null;
   } | null;
   payments: Array<{
      id: number;
      amount_in_cents: number;
      charge_in_cents: number;
      method: PaymentMethod;
      reference: string | null;
      date: Date;
      notes: string | null;
      paid_by: { id: string; name: string } | null;
   }>;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
   [PaymentMethod.CASH]: "Efectivo",
   [PaymentMethod.CREDIT_CARD]: "Tarjeta de crédito",
   [PaymentMethod.DEBIT_CARD]: "Tarjeta de débito",
   [PaymentMethod.BANK_TRANSFER]: "Transferencia bancaria",
   [PaymentMethod.PAYPAL]: "PayPal",
   [PaymentMethod.ZELLE]: "Zelle",
   [PaymentMethod.CHECK]: "Cheque",
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

const logoCache = new Map<string, Buffer>();

async function getLogoBuffer(): Promise<Buffer | null> {
   const logoPath = path.join(process.cwd(), "assets", "ctelogo.png");
   if (logoCache.has(logoPath)) {
      return logoCache.get(logoPath) ?? null;
   }
   try {
      const buffer = await fs.readFile(logoPath);
      logoCache.set(logoPath, buffer);
      return buffer;
   } catch {
      return null;
   }
}

function formatDate(date: Date | null | undefined): string {
   if (!date) return "—";
   return new Date(date).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
   });
}

function truncate(str: string | null | undefined, maxLen: number): string {
   const s = str ?? "—";
   if (s.length <= maxLen) return s;
   return s.slice(0, maxLen - 1) + "…";
}

/**
 * Generate a PDF receipt listing all payments for a dispatch (notes, references, amounts, paid_by).
 */
export async function generateDispatchPaymentReceiptPDF(
   data: DispatchPaymentReceiptData
): Promise<PDFKit.PDFDocument> {
   const doc = new PDFKit({
      size: "LETTER",
      margin: 0,
      bufferPages: true,
   });

   registerPdfFonts(doc);

   let y = 30;
   const lineHeight = 14;
   const tableRowHeight = 20;

   // Logo left; title and date right-aligned (Emitido on top, Dispatch # below)
   const logo = await getLogoBuffer();
   if (logo) {
      doc.image(logo, LEFT_MARGIN, y, { width: 48, height: 36 });
   }

   doc.font(FONTS.BOLD).fontSize(16).fillColor(COLORS.BLACK);
   doc.text(`Dispatch #${data.id}`, LEFT_MARGIN, y + 6, {
      width: CONTENT_WIDTH,
      align: "right",
   });
   doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
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
   doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
   doc.text(`Origen: ${data.sender_agency.name}`, originDestinoX, originDestinoStartY, { width: originDestinoWidth });
   doc.text(`Destino: ${data.receiver_agency?.name ?? "—"}`, originDestinoX, originDestinoStartY + originDestinoLineHeight, {
      width: originDestinoWidth,
   });

   y += 56;

   // Dispatch summary
   doc.font(FONTS.SEMIBOLD).fontSize(10).fillColor(COLORS.BLACK);
   doc.text("Resumen del dispatch", LEFT_MARGIN, y);
   y += lineHeight;

   doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.BLACK);
   doc.text(`Costo total: ${formatCents(data.cost_in_cents)}`, LEFT_MARGIN, y);
   y += lineHeight;
   doc.text(`Pagado: ${formatCents(data.paid_in_cents)}  •  Estado: ${data.payment_status}`, LEFT_MARGIN, y);
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
   doc.font(FONTS.SEMIBOLD).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text("#", x, headerY, { width: colWidths.num }); x += colWidths.num;
   doc.text("Fecha", x, headerY, { width: colWidths.date }); x += colWidths.date;
   doc.text("Método", x, headerY, { width: colWidths.method }); x += colWidths.method;
   doc.text("Referencia", x, headerY, { width: colWidths.reference }); x += colWidths.reference;
   doc.text("Monto", x, headerY, { width: colWidths.amount }); x += colWidths.amount;
   doc.text("Cargo", x, headerY, { width: colWidths.charge }); x += colWidths.charge;
   doc.text("Cobrado por", x, headerY, { width: colWidths.cobradoPor });
   doc.strokeColor(COLORS.BORDER)
      .lineWidth(1)
      .moveTo(LEFT_MARGIN, headerY + 12)
      .lineTo(RIGHT_MARGIN, headerY + 12)
      .stroke();
   y = headerY + 15;

   if (data.payments.length === 0) {
      doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
      doc.text("Sin pagos registrados", LEFT_MARGIN + 10, y + 6, { width: CONTENT_WIDTH - 20 });
      y += tableRowHeight;
      doc.strokeColor(COLORS.BORDER)
         .lineWidth(0.5)
         .moveTo(LEFT_MARGIN, y)
         .lineTo(RIGHT_MARGIN, y)
         .stroke();
   } else {
      for (let i = 0; i < data.payments.length; i++) {
         const p = data.payments[i];
         if (y > 680) {
            doc.addPage();
            y = 30;
         }
         x = LEFT_MARGIN + 6;
         doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.BLACK);
         doc.text(String(i + 1), x, y + 6, { width: colWidths.num }); x += colWidths.num;
         doc.text(formatDate(p.date), x, y + 6, { width: colWidths.date }); x += colWidths.date;
         doc.text(PAYMENT_METHOD_LABELS[p.method] ?? p.method, x, y + 6, { width: colWidths.method }); x += colWidths.method;
         doc.text(truncate(p.reference, 18), x, y + 6, { width: colWidths.reference }); x += colWidths.reference;
         doc.text(formatCents(p.amount_in_cents), x, y + 6, { width: colWidths.amount }); x += colWidths.amount;
         doc.text(formatCents(p.charge_in_cents), x, y + 6, { width: colWidths.charge }); x += colWidths.charge;
         doc.text(truncate(p.paid_by?.name ?? null, 18), x, y + 6, { width: colWidths.cobradoPor });
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
      doc.font(FONTS.SEMIBOLD).fontSize(9).fillColor(COLORS.BLACK);
      doc.text("Notas", LEFT_MARGIN, y);
      y += lineHeight + 4;
      doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.BLACK);
      const notesWidth = CONTENT_WIDTH;
      for (let i = 0; i < data.payments.length; i++) {
         const p = data.payments[i];
         const notes = (p.notes ?? "").trim();
         if (notes === "") continue;
         if (y > 700) {
            doc.addPage();
            y = 30;
         }
         doc.font(FONTS.SEMIBOLD).fontSize(8).fillColor(COLORS.BLACK);
         doc.text(`#${i + 1}:`, LEFT_MARGIN, y, { width: 24 });
         doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.BLACK);
         const notesHeight = doc.heightOfString(notes, { width: notesWidth - 28 });
         doc.text(notes, LEFT_MARGIN + 28, y, { width: notesWidth - 28 });
         y += notesHeight + 6;
      }
      y += 6;
   }

   y += 12;

   // Totals
   const totalCharges = data.payments.reduce((sum, p) => sum + p.charge_in_cents, 0);
   doc.font(FONTS.SEMIBOLD).fontSize(10).fillColor(COLORS.BLACK);
   doc.text(`Total pagos: ${formatCents(data.paid_in_cents)}`, LEFT_MARGIN, y);
   y += lineHeight;
   if (totalCharges > 0) {
      doc.text(`Total cargos: ${formatCents(totalCharges)}`, LEFT_MARGIN, y);
      y += lineHeight;
   }
   doc.text(`Costo del dispatch: ${formatCents(data.cost_in_cents)}`, LEFT_MARGIN, y);
   y += lineHeight;
   const balance = data.cost_in_cents - data.paid_in_cents;
   if (balance !== 0) {
      doc.font(balance > 0 ? FONTS.SEMIBOLD : FONTS.REGULAR).fillColor(COLORS.BLACK);
      doc.text(`Saldo ${balance > 0 ? "pendiente" : "a favor"}: ${formatCents(Math.abs(balance))}`, LEFT_MARGIN, y);
   }

   // Caller must pipe() then end() the doc (e.g. in the controller)
   return doc;
}
