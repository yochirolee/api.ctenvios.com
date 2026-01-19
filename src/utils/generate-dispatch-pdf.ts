import PDFKit from "pdfkit";
import * as bwipjs from "bwip-js";
import * as path from "path";
import { promises as fs } from "fs";
import { formatCents, toNumber } from "./utils";
import { getPricingBetweenAgencies, clearPricingCache } from "./agency-hierarchy";
import { calculate_row_subtotal } from "./utils";

// Simple capitalize helper for single names
function capitalize(str: string | null | undefined): string {
   if (!str) return "";
   return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Type for dispatch with details from repository
export interface DispatchPdfDetails {
   id: number;
   status: string;
   payment_status: string;
   declared_parcels_count: number;
   received_parcels_count: number;
   declared_weight: any;
   weight: any;
   declared_cost_in_cents: number;
   cost_in_cents: number;
   payment_method: string;
   payment_reference: string | null;
   payment_date: Date | null;
   created_at: Date;
   updated_at: Date;
   sender_agency: {
      id: number;
      name: string;
      phone: string;
      address: string;
   };
   receiver_agency: {
      id: number;
      name: string;
      phone: string;
      address: string;
   } | null;
   created_by: {
      id: string;
      first_name: string;
      last_name: string;
   };
   received_by: {
      id: string;
      first_name: string;
      last_name: string;
   } | null;
   parcels: Array<{
      id: number;
      tracking_number: string;
      status: string;
      weight: any;
      order_id: number | null;
      order_items: Array<{
         id: number;
         description: string | null;
         weight: any;
         unit: string;
         price_in_cents: number;
         insurance_fee_in_cents: number | null;
         customs_fee_in_cents: number;
         delivery_fee_in_cents: number | null;
         service_id: number;
         service: { id: number } | null;
         rate: {
            price_in_cents: number;
            product: { id: number; unit: string } | null;
            service: { id: number } | null;
            pricing_agreement: {
               price_in_cents: number;
            } | null;
         } | null;
      }>;
      order: {
         id: number;
         receiver: {
            first_name: string;
            last_name: string;
            city: { name: string } | null;
            province: { name: string } | null;
         };
      } | null;
   }>;
   inter_agency_debts: Array<{
      id: number;
      amount_in_cents: number;
      debtor_agency: { name: string };
      creditor_agency: { name: string };
   }>;
}

// Font paths
const FONT_PATHS = {
   REGULAR: path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf"),
   MEDIUM: path.join(process.cwd(), "assets", "fonts", "Inter-Medium.ttf"),
   SEMIBOLD: path.join(process.cwd(), "assets", "fonts", "Inter-SemiBold.ttf"),
   BOLD: path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf"),
} as const;

const FONTS = {
   REGULAR: "Inter-Regular",
   MEDIUM: "Inter-Medium",
   SEMIBOLD: "Inter-SemiBold",
   BOLD: "Inter-Bold",
} as const;

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
};

// Cache for logo
const logoCache = new Map<string, Buffer>();

async function getLogoBuffer(): Promise<Buffer | null> {
   const logoPath = path.join(process.cwd(), "assets", "ctelogo.png");
   if (logoCache.has(logoPath)) {
      return logoCache.get(logoPath) || null;
   }
   try {
      const buffer = await fs.readFile(logoPath);
      logoCache.set(logoPath, buffer);
      return buffer;
   } catch {
      return null;
   }
}

async function generateBarcode(text: string): Promise<Buffer> {
   return bwipjs.toBuffer({
      bcid: "code128",
      text: text,
      scale: 2,
      height: 8,
      includetext: false,
   });
}

function formatDate(date: Date | null | undefined): string {
   if (!date) return "N/A";
   return new Date(date).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
   });
}

function getStatusLabel(status: string): string {
   const statusLabels: Record<string, string> = {
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

function getPaymentStatusLabel(status: string): string {
   const statusLabels: Record<string, string> = {
      PENDING: "Pendiente",
      PARTIAL: "Parcial",
      PAID: "Pagado",
      OVERDUE: "Vencido",
   };
   return statusLabels[status] || status;
}

export async function generateDispatchPDF(dispatch: DispatchPdfDetails): Promise<PDFKit.PDFDocument> {
   const doc = new PDFKit({
      size: "LETTER",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
   });

   // Register fonts
   doc.registerFont(FONTS.REGULAR, FONT_PATHS.REGULAR);
   doc.registerFont(FONTS.MEDIUM, FONT_PATHS.MEDIUM);
   doc.registerFont(FONTS.SEMIBOLD, FONT_PATHS.SEMIBOLD);
   doc.registerFont(FONTS.BOLD, FONT_PATHS.BOLD);

   const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
   let y = doc.page.margins.top;

   // === HEADER ===
   const logo = await getLogoBuffer();
   if (logo) {
      doc.image(logo, doc.page.margins.left, y, { height: 40 });
   }

   // Title
   doc.font(FONTS.BOLD).fontSize(18).fillColor(COLORS.FOREGROUND);
   doc.text("MANIFIESTO DE DESPACHO", doc.page.margins.left + 150, y + 5);

   doc.font(FONTS.MEDIUM).fontSize(12).fillColor(COLORS.PRIMARY);
   doc.text(`#${dispatch.id}`, doc.page.margins.left + 150, y + 28);

   // Barcode for dispatch ID
   try {
      const barcode = await generateBarcode(`${dispatch.id}`);
      doc.image(barcode, pageWidth - 60, y, { width: 100, height: 30 });
   } catch (e) {
      // Barcode generation failed, continue without it
   }

   y += 55;

   // Status badges
   doc.font(FONTS.SEMIBOLD).fontSize(9);
   const statusColor = dispatch.status === "RECEIVED" ? COLORS.SUCCESS : dispatch.status === "DISPATCHED" ? COLORS.PRIMARY : COLORS.WARNING;
   doc.roundedRect(doc.page.margins.left, y, 80, 18, 4).fill(statusColor);
   doc.fillColor(COLORS.PRIMARY_FOREGROUND).text(getStatusLabel(dispatch.status), doc.page.margins.left + 5, y + 4, { width: 70, align: "center" });

   const paymentColor = dispatch.payment_status === "PAID" ? COLORS.SUCCESS : COLORS.WARNING;
   doc.roundedRect(doc.page.margins.left + 90, y, 80, 18, 4).fill(paymentColor);
   doc.fillColor(COLORS.PRIMARY_FOREGROUND).text(getPaymentStatusLabel(dispatch.payment_status), doc.page.margins.left + 95, y + 4, { width: 70, align: "center" });

   y += 30;

   // === AGENCIES INFO ===
   doc.fillColor(COLORS.FOREGROUND);
   const colWidth = (pageWidth - 20) / 2;

   // Sender Agency
   doc.roundedRect(doc.page.margins.left, y, colWidth, 80, 4).fillAndStroke(COLORS.MUTED, COLORS.BORDER);
   doc.fillColor(COLORS.FOREGROUND).font(FONTS.SEMIBOLD).fontSize(10);
   doc.text("ORIGEN", doc.page.margins.left + 10, y + 8);
   doc.font(FONTS.BOLD).fontSize(11);
   doc.text(dispatch.sender_agency.name, doc.page.margins.left + 10, y + 22);
   doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text(dispatch.sender_agency.address || "", doc.page.margins.left + 10, y + 38);
   doc.text(dispatch.sender_agency.phone || "", doc.page.margins.left + 10, y + 50);

   // Receiver Agency
   const receiverX = doc.page.margins.left + colWidth + 20;
   doc.roundedRect(receiverX, y, colWidth, 80, 4).fillAndStroke(COLORS.MUTED, COLORS.BORDER);
   doc.fillColor(COLORS.FOREGROUND).font(FONTS.SEMIBOLD).fontSize(10);
   doc.text("DESTINO", receiverX + 10, y + 8);
   doc.font(FONTS.BOLD).fontSize(11);
   doc.text(dispatch.receiver_agency?.name || "No asignado", receiverX + 10, y + 22);
   if (dispatch.receiver_agency) {
      doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.MUTED_FOREGROUND);
      doc.text(dispatch.receiver_agency.address || "", receiverX + 10, y + 38);
      doc.text(dispatch.receiver_agency.phone || "", receiverX + 10, y + 50);
   }

   y += 95;

   // === SUMMARY BOX ===
   doc.roundedRect(doc.page.margins.left, y, pageWidth, 55, 4).fillAndStroke(COLORS.MUTED, COLORS.BORDER);

   const summaryColWidth = pageWidth / 5;
   const summaryItems = [
      { label: "Bultos Declarados", value: dispatch.declared_parcels_count.toString() },
      { label: "Bultos Recibidos", value: dispatch.received_parcels_count.toString() },
      { label: "Peso Declarado", value: `${toNumber(dispatch.declared_weight).toFixed(2)} lbs` },
      { label: "Peso Real", value: `${toNumber(dispatch.weight).toFixed(2)} lbs` },
      { label: "Costo Total", value: formatCents(dispatch.cost_in_cents) },
   ];

   summaryItems.forEach((item, i) => {
      const x = doc.page.margins.left + i * summaryColWidth + 10;
      doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
      doc.text(item.label, x, y + 10);
      doc.font(FONTS.BOLD).fontSize(14).fillColor(COLORS.FOREGROUND);
      doc.text(item.value, x, y + 25);
   });

   y += 70;

   // === DATES INFO ===
   doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text(`Creado: ${formatDate(dispatch.created_at)} por ${capitalize(dispatch.created_by.first_name)} ${capitalize(dispatch.created_by.last_name)}`, doc.page.margins.left, y);
   if (dispatch.received_by) {
      doc.text(`Recibido: ${formatDate(dispatch.updated_at)} por ${capitalize(dispatch.received_by.first_name)} ${capitalize(dispatch.received_by.last_name)}`, doc.page.margins.left + 300, y);
   }

   y += 20;

   // === PARCELS TABLE ===
   doc.font(FONTS.BOLD).fontSize(12).fillColor(COLORS.FOREGROUND);
   doc.text("DETALLE DE BULTOS", doc.page.margins.left, y);
   y += 20;

   // Pre-calculate parcel financials using pricing agreement between sender↔receiver agencies
   interface ParcelFinancials {
      unitRateInCents: number;   // The agreed rate ($/lb or fixed) - for display
      insuranceInCents: number;
      customsInCents: number;
      chargeInCents: number;
      subtotalInCents: number;   // Calculated with calculate_row_subtotal
      unit: string;              // PER_LB or fixed
   }
   const parcelFinancials = new Map<number, ParcelFinancials>();
   const sender_agency_id = dispatch.sender_agency.id;
   const receiver_agency_id = dispatch.receiver_agency?.id;

   for (const parcel of dispatch.parcels) {
      let totalInsuranceInCents = 0;
      let totalCustomsInCents = 0;
      let totalChargeInCents = 0;
      let totalSubtotalInCents = 0;
      let totalPriceInCents = 0;  // Sum of all prices (for fixed) or first rate (for PER_LB)
      let displayUnit = "PER_LB";
      let isFirstItem = true;

      for (const item of parcel.order_items) {
         // Get product_id and service_id from the rate (consistent with PricingAgreement)
         const product_id = item.rate?.product?.id;
         const service_id = item.rate?.service?.id || item.service?.id || item.service_id;
         const unit = item.unit || item.rate?.product?.unit || "PER_LB";
         const itemWeight = toNumber(item.weight);

         // Get the pricing agreement rate between sender↔receiver agencies
         // This is the inter-agency price, NOT the client price (price_in_cents)
         let unitRateInCents = 0;
         if (receiver_agency_id && product_id && service_id) {
            const agreementRate = await getPricingBetweenAgencies(
               receiver_agency_id, // seller (receiver agency is selling transport service)
               sender_agency_id,   // buyer (sender agency is buying the service)
               product_id,
               service_id
            );
            if (agreementRate !== null) {
               unitRateInCents = agreementRate;
            }
         }

         // Fallback: use the rate's original pricing_agreement (still inter-agency, not client price)
         // This handles cases where no specific agreement exists between sender↔receiver
         if (unitRateInCents === 0 && item.rate?.pricing_agreement?.price_in_cents) {
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
         } else {
            // Fixed price items: accumulate the prices
            totalPriceInCents += unitRateInCents;
         }

         const itemInsurance = item.insurance_fee_in_cents || 0;
         const itemCustoms = item.customs_fee_in_cents || 0;
         const itemCharge = (item as any).charge_fee_in_cents || 0;

         // Calculate subtotal using the inter-agency pricing agreement rate
         const itemSubtotal = calculate_row_subtotal(
            unitRateInCents,
            itemWeight,
            itemCustoms,
            itemCharge,
            itemInsurance,
            unit
         );

         totalInsuranceInCents += itemInsurance;
         totalCustomsInCents += itemCustoms;
         totalChargeInCents += itemCharge;
         totalSubtotalInCents += itemSubtotal;
      }

      parcelFinancials.set(parcel.id, {
         unitRateInCents: totalPriceInCents,  // Rate for PER_LB, or sum of prices for Fixed
         insuranceInCents: totalInsuranceInCents,
         customsInCents: totalCustomsInCents,
         chargeInCents: totalChargeInCents,
         subtotalInCents: totalSubtotalInCents,
         unit: displayUnit,
      });
   }
   
   // Clear pricing cache after calculation
   clearPricingCache();

   // Table header - columns: Orden, Hbl, Descripción, Peso, Precio, Seguro, Aduanal, Subtotal
   const tableColWidths = [40, 85, 140, 50, 50, 50, 50, 55];
   const tableHeaders = ["Orden", "Hbl", "Descripción", "Peso", "Precio", "Seguro", "Aduanal", "Subtotal"];

   doc.roundedRect(doc.page.margins.left, y, pageWidth, 20, 2).fill(COLORS.PRIMARY);
   doc.font(FONTS.SEMIBOLD).fontSize(8).fillColor(COLORS.PRIMARY_FOREGROUND);

   let headerX = doc.page.margins.left + 5;
   tableHeaders.forEach((header, i) => {
      doc.text(header, headerX, y + 6, { width: tableColWidths[i] - 10 });
      headerX += tableColWidths[i];
   });

   y += 22;

   // Table rows
   const rowHeight = 28;
   for (const [index, parcel] of dispatch.parcels.entries()) {
      // Check if we need a new page
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 50) {
         doc.addPage();
         y = doc.page.margins.top;
      }

      const bgColor = index % 2 === 0 ? COLORS.BACKGROUND : COLORS.MUTED;
      doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill(bgColor);

      let cellX = doc.page.margins.left + 5;

      // Get pre-calculated financials for this parcel
      const financials = parcelFinancials.get(parcel.id) || {
         unitRateInCents: 0,
         insuranceInCents: 0,
         customsInCents: 0,
         chargeInCents: 0,
         subtotalInCents: 0,
         unit: "PER_LB",
      };

      // Order ID
      doc.font(FONTS.MEDIUM).fontSize(7).fillColor(COLORS.PRIMARY);
      doc.text(parcel.order_id ? `#${parcel.order_id}` : "N/A", cellX, y + 8, { width: tableColWidths[0] - 5 });
      cellX += tableColWidths[0];

      // HBL
      doc.font(FONTS.MEDIUM).fontSize(6).fillColor(COLORS.FOREGROUND);
      doc.text(parcel.tracking_number, cellX, y + 8, { width: tableColWidths[1] - 5 });
      cellX += tableColWidths[1];

      // Description (from order_items)
      const description = parcel.order_items.length > 0
         ? parcel.order_items.map(item => item.description || "").filter(Boolean).join(", ") || "N/A"
         : "N/A";
      doc.font(FONTS.REGULAR).fontSize(6).fillColor(COLORS.FOREGROUND);
      doc.text(description.substring(0, 50) + (description.length > 50 ? "..." : ""), cellX, y + 8, { width: tableColWidths[2] - 5 });
      cellX += tableColWidths[2];

      // Weight
      doc.font(FONTS.REGULAR).fontSize(7).fillColor(COLORS.FOREGROUND);
      doc.text(`${toNumber(parcel.weight).toFixed(2)}`, cellX, y + 8, { width: tableColWidths[3] - 5, align: "right" });
      cellX += tableColWidths[3];

      // Precio (unit rate from pricing agreement - $/lb or fixed)
      doc.font(FONTS.REGULAR).fontSize(7).fillColor(COLORS.FOREGROUND);
      doc.text(formatCents(financials.unitRateInCents), cellX, y + 8, { width: tableColWidths[4] - 5, align: "right" });
      cellX += tableColWidths[4];

      // Insurance (Seguro)
      const insuranceColor = financials.insuranceInCents > 0 ? COLORS.FOREGROUND : COLORS.MUTED_FOREGROUND;
      doc.font(FONTS.REGULAR).fontSize(7).fillColor(insuranceColor);
      doc.text(formatCents(financials.insuranceInCents), cellX, y + 8, { width: tableColWidths[5] - 5, align: "right" });
      cellX += tableColWidths[5];

      // Customs (Aduanal)
      const customsColor = financials.customsInCents > 0 ? COLORS.FOREGROUND : COLORS.MUTED_FOREGROUND;
      doc.font(FONTS.REGULAR).fontSize(7).fillColor(customsColor);
      doc.text(formatCents(financials.customsInCents), cellX, y + 8, { width: tableColWidths[6] - 5, align: "right" });
      cellX += tableColWidths[6];

      // Subtotal (calculated with calculate_row_subtotal - same as order PDF)
      doc.font(FONTS.SEMIBOLD).fontSize(7).fillColor(COLORS.PRIMARY);
      doc.text(formatCents(financials.subtotalInCents), cellX, y + 8, { width: tableColWidths[7] - 5, align: "right" });

      y += rowHeight;
   }

   // Bottom border line
   doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(COLORS.BORDER);

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
      // Sum delivery fees from order_items
      for (const item of parcel.order_items) {
         grandDeliveryInCents += item.delivery_fee_in_cents || 0;
      }
   }

   const grandTotalInCents = grandSubtotalInCents + grandDeliveryInCents;

   // Totals box - aligned to the right
   const totalsBoxWidth = 180;
   const totalsBoxX = doc.page.margins.left + pageWidth - totalsBoxWidth;
   const totalsBoxHeight = 60;

   doc.roundedRect(totalsBoxX, y, totalsBoxWidth, totalsBoxHeight, 4).fillAndStroke(COLORS.MUTED, COLORS.BORDER);

   const labelX = totalsBoxX + 10;
   const valueX = totalsBoxX + totalsBoxWidth - 10;
   let totalsY = y + 10;

   // Subtotal
   doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.FOREGROUND);
   doc.text("Subtotal:", labelX, totalsY);
   doc.text(formatCents(grandSubtotalInCents), valueX - 60, totalsY, { width: 60, align: "right" });
   totalsY += 14;

   // Delivery
   doc.text("Delivery:", labelX, totalsY);
   doc.text(formatCents(grandDeliveryInCents), valueX - 60, totalsY, { width: 60, align: "right" });
   totalsY += 16;

   // Total line
   doc.moveTo(labelX, totalsY - 4).lineTo(valueX, totalsY - 4).stroke(COLORS.BORDER);

   // Total
   doc.font(FONTS.BOLD).fontSize(11).fillColor(COLORS.PRIMARY);
   doc.text("TOTAL:", labelX, totalsY);
   doc.text(formatCents(grandTotalInCents), valueX - 70, totalsY, { width: 70, align: "right" });

   y += totalsBoxHeight + 15;

   // === DEBTS SECTION (if any) ===
   if (dispatch.inter_agency_debts.length > 0) {
      if (y + 80 > doc.page.height - doc.page.margins.bottom) {
         doc.addPage();
         y = doc.page.margins.top;
      }

      doc.font(FONTS.BOLD).fontSize(10).fillColor(COLORS.FOREGROUND);
      doc.text("DEUDAS INTER-AGENCIA", doc.page.margins.left, y);
      y += 15;

      dispatch.inter_agency_debts.forEach((debt) => {
         doc.font(FONTS.REGULAR).fontSize(9).fillColor(COLORS.FOREGROUND);
         doc.text(`${debt.debtor_agency.name} → ${debt.creditor_agency.name}: ${formatCents(debt.amount_in_cents)}`, doc.page.margins.left + 10, y);
         y += 14;
      });
   }

   // === SIGNATURE SECTION ===
   y = doc.page.height - doc.page.margins.bottom - 60;
   
   doc.moveTo(doc.page.margins.left, y + 30).lineTo(doc.page.margins.left + 150, y + 30).stroke(COLORS.BORDER);
   doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text("Firma Origen", doc.page.margins.left, y + 35);

   doc.moveTo(pageWidth - 110, y + 30).lineTo(pageWidth + 40, y + 30).stroke(COLORS.BORDER);
   doc.text("Firma Destino", pageWidth - 110, y + 35);

   // Footer
   doc.font(FONTS.REGULAR).fontSize(7).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, doc.page.margins.left, doc.page.height - 25);
   doc.text("CTEnvios - Sistema de Gestión de Paquetes", pageWidth - 100, doc.page.height - 25);

   return doc;
}
