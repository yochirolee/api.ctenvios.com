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



export async function generateDispatchPDF(dispatch: DispatchPdfDetails): Promise<PDFKit.PDFDocument> {
   const doc = new PDFKit({
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
   const logo = await getLogoBuffer();
   
   // Logo
   if (logo) {
      doc.image(logo, leftMargin, y + 6, { width: 48, height: 36 });
   }

   // Sender Agency name and info (next to logo)
   doc.font(FONTS.BOLD).fontSize(18).fillColor("#0d4fa3");
   doc.text(dispatch.sender_agency.name, leftMargin + 60, y + 6);
   
   doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text(
      `${dispatch.sender_agency.address || ""} • ${dispatch.sender_agency.phone || ""}`,
      leftMargin + 60,
      y + 28
   );

   // Right side - Dispatch number and info
   const rightX = PAGE_WIDTH - 260;
   
   doc.font(FONTS.BOLD).fontSize(18).fillColor(COLORS.FOREGROUND);
   doc.text(`Dispatch ${dispatch.id}`, rightX, y + 6, { align: "right", width: 240 });
   
   doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text(`Fecha: ${formatDate(dispatch.created_at)}`, rightX, y + 28, { align: "right", width: 240 });
   
   // Weight and Items stats
   const totalWeight = toNumber(dispatch.weight).toFixed(2);
   doc.font(FONTS.SEMIBOLD).fontSize(9).fillColor(COLORS.FOREGROUND);
   doc.text(`Weight: ${totalWeight} lbs  •  Items: ${dispatch.parcels.length}`, rightX, y + 40, { align: "right", width: 240 });

   y += 60;

   // === SERVICE BAR with barcode ===
   const barHeight = 36;
   doc.rect(0, y, PAGE_WIDTH, barHeight).fill(COLORS.MUTED);
   doc.rect(0, y, PAGE_WIDTH, barHeight).stroke(COLORS.BORDER);

   // Status badge (left side of bar)
   const statusColor = dispatch.status === "RECEIVED" ? COLORS.SUCCESS : dispatch.status === "DISPATCHED" ? COLORS.PRIMARY : COLORS.WARNING;
   doc.roundedRect(leftMargin, y + 8, 20, 20, 4).fill(statusColor);
   doc.font(FONTS.BOLD).fontSize(12).fillColor(COLORS.PRIMARY_FOREGROUND);
   doc.text(getStatusLabel(dispatch.status).charAt(0), leftMargin, y + 12, { width: 20, align: "center" });
   
   // Destination agency name
   doc.font(FONTS.MEDIUM).fontSize(11).fillColor(COLORS.FOREGROUND);
   doc.text(`→ ${dispatch.receiver_agency?.name || "No asignado"}`, leftMargin + 30, y + 12);

   // Barcode on the right
   try {
      const barcode = await generateBarcode(`${dispatch.id}`);
      doc.image(barcode, PAGE_WIDTH - 140, y + 6, { width: 120, height: 24 });
   } catch (e) {
      // Barcode generation failed, continue without it
   }

   y += barHeight + 15;

   // === PARCELS TABLE ===
   doc.font(FONTS.BOLD).fontSize(12).fillColor(COLORS.FOREGROUND);
   doc.text("DETALLE DE BULTOS", leftMargin, y);
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

   // Table layout - matching order PDF style (white/black, no colored header)
   // Calculate column positions from right edge
   const rightMargin = PAGE_WIDTH - 20;
   const columnGap = 5;
   const subtotalWidth = 55;
   const pesoWidth = 40;
   const precioWidth = 35;
   const arancelWidth = 35;
   const cargoWidth = 35;
   const seguroWidth = 35;

   // Position from right to left
   const subtotalX = rightMargin - subtotalWidth;
   const pesoX = subtotalX - columnGap - pesoWidth;
   const precioX = pesoX - columnGap - precioWidth;
   const arancelX = precioX - columnGap - arancelWidth;
   const cargoX = arancelX - columnGap - cargoWidth;
   const seguroX = cargoX - columnGap - seguroWidth;
   const descriptionX = 105;
   const descriptionWidth = seguroX - descriptionX - columnGap;

   // Helper function to draw table headers
   const drawTableHeaders = (headerY: number): number => {
      const headers = [
         { text: "Hbl", x: leftMargin, width: 90, align: "left" },
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
            align: header.align as any,
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

   // Table rows
   const rowHeight = 22;
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

      const textY = y + 2;

      // HBL
      doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.FOREGROUND);
      doc.text(parcel.tracking_number, leftMargin, textY, { width: 100 });

      // Description (from order_items)
      const description = parcel.order_items.length > 0
         ? parcel.order_items.map(item => item.description || "").filter(Boolean).join(", ") || "N/A"
         : "N/A";
      doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.FOREGROUND);
      doc.text(description.substring(0, 35) + (description.length > 35 ? "..." : ""), descriptionX, textY, { width: descriptionWidth });

      // Seguro (Insurance)
      const insuranceColor = financials.insuranceInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
      doc.font(FONTS.REGULAR).fontSize(7).fillColor(insuranceColor);
      doc.text(formatCents(financials.insuranceInCents), seguroX, textY, { width: seguroWidth, align: "right" });

      // Cargo (Charge)
      const cargoColor = financials.chargeInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
      doc.fillColor(cargoColor);
      doc.text(formatCents(financials.chargeInCents), cargoX, textY, { width: cargoWidth, align: "right" });

      // Arancel (Customs)
      const customsColor = financials.customsInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
      doc.fillColor(customsColor);
      doc.text(formatCents(financials.customsInCents), arancelX, textY, { width: arancelWidth, align: "right" });

      // Precio
      doc.fillColor(COLORS.FOREGROUND);
      doc.text(formatCents(financials.unitRateInCents), precioX, textY, { width: precioWidth, align: "right" });

      // Peso (Weight)
      doc.text(`${toNumber(parcel.weight).toFixed(2)}`, pesoX, textY, { width: pesoWidth, align: "right" });

      // Subtotal
      doc.font(FONTS.SEMIBOLD).fontSize(7).fillColor(COLORS.FOREGROUND);
      doc.text(formatCents(financials.subtotalInCents), subtotalX, textY, { width: subtotalWidth, align: "right" });

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
      // Sum delivery fees from order_items
      for (const item of parcel.order_items) {
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

   // === SIGNATURE SECTION ===
   y = doc.page.height - 80;
   
   doc.moveTo(leftMargin, y + 30).lineTo(leftMargin + 150, y + 30).stroke(COLORS.BORDER);
   doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text("Firma Origen", leftMargin, y + 35);

   doc.moveTo(PAGE_WIDTH - 170, y + 30).lineTo(PAGE_WIDTH - 20, y + 30).stroke(COLORS.BORDER);
   doc.text("Firma Destino", PAGE_WIDTH - 170, y + 35);

   return doc;
}
