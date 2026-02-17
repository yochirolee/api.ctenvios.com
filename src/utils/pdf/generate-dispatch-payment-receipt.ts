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
   HEADER_BG: "#f3f4f6",
   WHITE: "#ffffff",
};

const PAGE_WIDTH = 612;
const LEFT_MARGIN = 24;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN * 2;

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

   // Logo
   const logo = await getLogoBuffer();
   if (logo) {
      doc.image(logo, LEFT_MARGIN, y, { width: 48, height: 36 });
   }

   doc.font(FONTS.BOLD).fontSize(16).fillColor(COLORS.BLACK);
   doc.text(`Recibo de pagos - Dispatch #${data.id}`, LEFT_MARGIN + 60, y + 8);

   doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
   doc.text(
      `Emitido: ${formatDate(new Date())}  •  Origen: ${data.sender_agency.name}  →  Destino: ${data.receiver_agency?.name ?? "—"}`,
      LEFT_MARGIN + 60,
      y + 28,
      { width: CONTENT_WIDTH - 60 }
   );

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

   // Payments table header
   const colWidths = {
      num: 22,
      date: 70,
      method: 88,
      reference: 92,
      amount: 54,
      charge: 46,
      notes: 112,
      cobradoPor: 80,
   };

   doc.rect(LEFT_MARGIN, y, CONTENT_WIDTH, tableRowHeight).fill(COLORS.HEADER_BG);
   doc.rect(LEFT_MARGIN, y, CONTENT_WIDTH, tableRowHeight).stroke(COLORS.BORDER);
   let x = LEFT_MARGIN + 6;
   doc.font(FONTS.SEMIBOLD).fontSize(8).fillColor(COLORS.BLACK);
   doc.text("#", x, y + 6, { width: colWidths.num }); x += colWidths.num;
   doc.text("Fecha", x, y + 6, { width: colWidths.date }); x += colWidths.date;
   doc.text("Método", x, y + 6, { width: colWidths.method }); x += colWidths.method;
   doc.text("Referencia", x, y + 6, { width: colWidths.reference }); x += colWidths.reference;
   doc.text("Monto", x, y + 6, { width: colWidths.amount }); x += colWidths.amount;
   doc.text("Cargo", x, y + 6, { width: colWidths.charge }); x += colWidths.charge;
   doc.text("Notas", x, y + 6, { width: colWidths.notes }); x += colWidths.notes;
   doc.text("Cobrado por", x, y + 6, { width: colWidths.cobradoPor });
   y += tableRowHeight;

   if (data.payments.length === 0) {
      doc.rect(LEFT_MARGIN, y, CONTENT_WIDTH, tableRowHeight).stroke(COLORS.BORDER);
      doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.GRAY);
      doc.text("Sin pagos registrados", LEFT_MARGIN + 10, y + 6, { width: CONTENT_WIDTH - 20 });
      y += tableRowHeight;
   } else {
      for (let i = 0; i < data.payments.length; i++) {
         const p = data.payments[i];
         if (y > 680) {
            doc.addPage();
            y = 30;
         }
         doc.rect(LEFT_MARGIN, y, CONTENT_WIDTH, tableRowHeight).stroke(COLORS.BORDER);
         x = LEFT_MARGIN + 6;
         doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.BLACK);
         doc.text(String(i + 1), x, y + 6, { width: colWidths.num }); x += colWidths.num;
         doc.text(formatDate(p.date), x, y + 6, { width: colWidths.date }); x += colWidths.date;
         doc.text(PAYMENT_METHOD_LABELS[p.method] ?? p.method, x, y + 6, { width: colWidths.method }); x += colWidths.method;
         doc.text(truncate(p.reference, 18), x, y + 6, { width: colWidths.reference }); x += colWidths.reference;
         doc.text(formatCents(p.amount_in_cents), x, y + 6, { width: colWidths.amount }); x += colWidths.amount;
         doc.text(formatCents(p.charge_in_cents), x, y + 6, { width: colWidths.charge }); x += colWidths.charge;
         doc.text(truncate(p.notes, 26), x, y + 6, { width: colWidths.notes }); x += colWidths.notes;
         doc.text(truncate(p.paid_by?.name ?? null, 18), x, y + 6, { width: colWidths.cobradoPor });
         y += tableRowHeight;
      }
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
