import PDFKit from "pdfkit";
import * as bwipjs from "bwip-js";
import * as path from "path";
import { promises as fs } from "fs";
import { formatCents, toNumber } from "../utils";
import { getPricingBetweenAgencies, clearPricingCache } from "../agency-hierarchy";
import { calculate_row_subtotal } from "../utils";



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
   payments?: Array<{
      id: number;
      amount_in_cents: number;
      charge_in_cents: number;
      method: string;
      reference: string | null;
      date: Date;
      notes: string | null;
      paid_by: { id: string; name: string } | null;
   }>;
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
      order: {
         id: number;
         _count?: { parcels: number };
         receiver?: {
            first_name: string;
            last_name: string;
            city: { name: string } | null;
            province: { name: string } | null;
         };
         order_items: Array<{
            parcel_id: number | null;
            description: string | null;
            weight: any;
            unit: string;
            price_in_cents: number;
            insurance_fee_in_cents: number | null;
            customs_fee_in_cents: number;
            delivery_fee_in_cents: number | null;
            charge_fee_in_cents?: number | null;
            service_id: number;
            service: { id: number } | null;
            rate: {
               price_in_cents: number;
               product: { id: number; unit: string; name?: string } | null;
               service: { id: number } | null;
               pricing_agreement: { price_in_cents: number } | null;
            } | null;
         }>;
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
   /** Background for rows where the order is split (not all parcels in this dispatch) */
   SPLIT_ORDER_BG: "#fef3c7",
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
   doc.text(`${dispatch.sender_agency.address || ""} • ${dispatch.sender_agency.phone || ""}`, leftMargin + 60, y + 28);

   // Right side - Dispatch number and info
   const rightX = PAGE_WIDTH - 260;

   doc.font(FONTS.BOLD).fontSize(18).fillColor(COLORS.FOREGROUND);
   doc.text(`Dispatch ${dispatch.id}`, rightX, y + 6, { align: "right", width: 240 });

   doc.font(FONTS.REGULAR).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
   doc.text(`Fecha: ${formatDate(dispatch.created_at)}`, rightX, y + 28, { align: "right", width: 240 });

   // Order count, weight and items stats (weight from parcels when dispatch.weight is 0)
   const orderCount = new Set(
      dispatch.parcels.map((p) => p.order_id ?? p.order?.id).filter((id): id is number => id != null)
   ).size;
   const dispatchWeight = toNumber(dispatch.weight);
   const summedWeight =
      dispatchWeight > 0
         ? dispatchWeight
         : dispatch.parcels.reduce((acc, p) => acc + toNumber(p.weight), 0);
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
   const statusColor =
      dispatch.status === "RECEIVED"
         ? COLORS.SUCCESS
         : dispatch.status === "DISPATCHED"
         ? COLORS.PRIMARY
         : COLORS.WARNING;
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

   // Order items for a parcel come from parcel.order.order_items (filtered by parcel_id)
   type ParcelWithOrder = (typeof dispatch.parcels)[number];
   const getOrderItemsForParcel = (parcel: ParcelWithOrder) =>
      parcel.order?.order_items?.filter((it) => it.parcel_id === parcel.id) ?? [];

   // Pre-calculate parcel financials using pricing agreement between sender↔receiver agencies
   interface ParcelFinancials {
      unitRateInCents: number;
      insuranceInCents: number;
      customsInCents: number;
      chargeInCents: number;
      subtotalInCents: number;
      unit: string;
   }
   const parcelFinancials = new Map<number, ParcelFinancials>();
   const sender_agency_id = dispatch.sender_agency.id;
   const receiver_agency_id = dispatch.receiver_agency?.id;

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
               sender_agency_id, // buyer (sender agency is buying the service)
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
         const itemCharge = item.charge_fee_in_cents || 0;

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
         unitRateInCents: totalPriceInCents, // Rate for PER_LB, or sum of prices for Fixed
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
   const pesoWidth = 32;
   const precioWidth = 28;
   const arancelWidth = 35;
   const cargoWidth = 35;
   const seguroWidth = 35;
   const hblWidth = 85;
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
   const parcelsInDispatchByOrderId = new Map<number, number>();
   for (const p of dispatch.parcels) {
      const oid = p.order_id ?? p.order?.id ?? null;
      if (oid != null) parcelsInDispatchByOrderId.set(oid, (parcelsInDispatchByOrderId.get(oid) ?? 0) + 1);
   }
   const isSplitOrder = (parcel: (typeof dispatch.parcels)[number]): boolean => {
      const oid = parcel.order_id ?? parcel.order?.id ?? null;
      if (oid == null) return false;
      const total = parcel.order?._count?.parcels ?? 0;
      const inDispatch = parcelsInDispatchByOrderId.get(oid) ?? 0;
      return total > 0 && inDispatch < total;
   };

   // Helper function to draw table headers
   const drawTableHeaders = (headerY: number): number => {
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

   // Table rows – description wraps to multiple lines; row height varies
   const minRowHeight = 20;
   const rowPaddingVertical = 4;
   const rowFontSize = 8;
   const bottomMargin = 60;
   doc.font(FONTS.REGULAR).fontSize(rowFontSize);
   const rowContentY = (rowY: number) => rowY + rowPaddingVertical;

   const maxDescriptionLines = 3;
   const lineHeight = doc.currentLineHeight();
   const lineGap = 3;

   for (const [index, parcel] of dispatch.parcels.entries()) {
      const parcelItems = getOrderItemsForParcel(parcel);
      const descriptionLine =
         parcelItems.length > 0
            ? parcelItems
                 .map((item) => item.description || "")
                 .filter(Boolean)
                 .join(", ") || "N/A"
            : "N/A";
      const productNames = parcelItems
         .filter((item) => (item.unit || item.rate?.product?.unit || "PER_LB") === "FIXED" && item.rate?.product?.name)
         .map((item) => item.rate!.product!.name!);
      const productNameLine =
         productNames.length > 0
            ? productNames.length === 1
               ? productNames[0]
               : productNames.join(", ")
            : "";

      let descriptionTruncated = descriptionLine;
      const maxDescHeight = maxDescriptionLines * lineHeight;
      if (
         descriptionTruncated &&
         doc.heightOfString(descriptionTruncated, { width: descriptionWidth }) > maxDescHeight
      ) {
         let truncated = descriptionTruncated;
         while (
            truncated.length > 0 &&
            doc.heightOfString(truncated + "…", { width: descriptionWidth }) > maxDescHeight
         ) {
            truncated = truncated.slice(0, -1);
         }
         descriptionTruncated = truncated + "…";
      }

      doc.font(FONTS.BOLD).fontSize(rowFontSize);
      const productNameWidth = productNameLine ? doc.widthOfString(productNameLine + " ") : 0;
      doc.font(FONTS.REGULAR).fontSize(rowFontSize);
      const descriptionWidthNeeded = doc.widthOfString(descriptionTruncated);
      const fitsOneLine =
         productNameLine &&
         descriptionTruncated &&
         productNameWidth + descriptionWidthNeeded <= descriptionWidth;

      const productNameHeight = productNameLine
         ? doc.heightOfString(productNameLine, { width: descriptionWidth })
         : 0;
      const descriptionHeight = descriptionTruncated
         ? doc.heightOfString(descriptionTruncated, { width: descriptionWidth })
         : 0;
      const descHeight = fitsOneLine
         ? lineHeight
         : Math.ceil(productNameHeight) +
           (productNameLine && descriptionTruncated ? lineGap : 0) +
           Math.ceil(descriptionHeight);
      // Single-line compact height for ALL rows that fit in one line. Use tolerance so
      // description-only and product+description one-line rows all get the same classification.
      const oneLineThreshold = lineHeight * 1.2;
      const isSingleLine = descHeight <= oneLineThreshold;
      const padding = isSingleLine ? 3 : rowPaddingVertical;
      const rowContentHeight = descHeight + padding * 2;
      const rowLineBuffer = isSingleLine ? 1 : 4;
      const extraWrapBuffer = isSingleLine ? 0 : (descHeight > lineHeight ? 3 : 0);
      const rowMin = isSingleLine ? 16 : minRowHeight;
      // Use one fixed height for all single-line rows so they look identical
      const SINGLE_LINE_ROW_HEIGHT = 18;
      const actualRowHeight = isSingleLine
         ? SINGLE_LINE_ROW_HEIGHT
         : Math.max(rowMin, rowContentHeight + rowLineBuffer + extraWrapBuffer);

      if (y + actualRowHeight > doc.page.height - bottomMargin - 50) {
         doc.addPage();
         y = 20;
         y = drawTableHeaders(y);
      }

      const financials = parcelFinancials.get(parcel.id) || {
         unitRateInCents: 0,
         insuranceInCents: 0,
         customsInCents: 0,
         chargeInCents: 0,
         subtotalInCents: 0,
         unit: "PER_LB",
      };

      const contentY = y + padding;
      const isSplit = isSplitOrder(parcel);

      if (isSplit) {
         doc.rect(leftMargin, y, rightMargin - leftMargin, actualRowHeight).fill(COLORS.SPLIT_ORDER_BG);
      }

      doc.font(FONTS.REGULAR).fontSize(rowFontSize).fillColor(COLORS.FOREGROUND);
      const orderId = parcel.order_id ?? parcel.order?.id ?? "—";
      doc.text(String(orderId), orderX, contentY, { width: orderWidth });

      doc.text(parcel.tracking_number, hblX, contentY, { width: hblWidth });

      if (fitsOneLine) {
         doc.font(FONTS.BOLD).fontSize(rowFontSize).fillColor(COLORS.FOREGROUND);
         doc.text(productNameLine!, descriptionX, contentY, { width: descriptionWidth });
         doc.font(FONTS.REGULAR).fontSize(rowFontSize).fillColor(COLORS.FOREGROUND);
         doc.text(descriptionTruncated, descriptionX + productNameWidth, contentY, {
            width: descriptionWidth - productNameWidth,
         });
      } else {
         let descY = contentY;
         if (productNameLine) {
            doc.font(FONTS.BOLD).fontSize(rowFontSize).fillColor(COLORS.FOREGROUND);
            doc.text(productNameLine, descriptionX, descY, { width: descriptionWidth });
            descY += productNameHeight + lineGap;
            doc.font(FONTS.REGULAR).fontSize(rowFontSize).fillColor(COLORS.FOREGROUND);
         }
         doc.text(descriptionTruncated, descriptionX, descY, { width: descriptionWidth });
      }

      const insuranceColor = financials.insuranceInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
      doc.font(FONTS.REGULAR).fontSize(7).fillColor(insuranceColor);
      doc.text(formatCents(financials.insuranceInCents), seguroX, contentY, { width: seguroWidth, align: "right" });

      const cargoColor = financials.chargeInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
      doc.fillColor(cargoColor);
      doc.text(formatCents(financials.chargeInCents), cargoX, contentY, { width: cargoWidth, align: "right" });

      const customsColor = financials.customsInCents === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
      doc.fillColor(customsColor);
      doc.text(formatCents(financials.customsInCents), arancelX, contentY, { width: arancelWidth, align: "right" });

      doc.fillColor(COLORS.FOREGROUND);
      doc.text(formatCents(financials.unitRateInCents), precioX, contentY, { width: precioWidth, align: "right" });
      doc.text(`${toNumber(parcel.weight).toFixed(2)}`, pesoX, contentY, { width: pesoWidth, align: "right" });

      doc.font(FONTS.SEMIBOLD).fontSize(7).fillColor(COLORS.FOREGROUND);
      doc.text(formatCents(financials.subtotalInCents), subtotalX, contentY, { width: subtotalWidth, align: "right" });

      doc.strokeColor(COLORS.BORDER)
         .lineWidth(0.5)
         .moveTo(leftMargin, y + actualRowHeight)
         .lineTo(rightMargin, y + actualRowHeight)
         .stroke();

      y += actualRowHeight;
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
   const deliverySummedForOrderId = new Set<number>();
   for (const parcel of dispatch.parcels) {
      const orderId = parcel.order_id ?? parcel.order?.id ?? null;
      if (orderId == null || deliverySummedForOrderId.has(orderId)) continue;
      deliverySummedForOrderId.add(orderId);
      const items =
         parcel.order?.order_items ?? [];
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
   doc.text(formatCents(grandSubtotalInCents), valueX - 60, totalsY, { width: 60, align: "right" });
   totalsY += 14;

   // Delivery
   doc.text("Delivery:", labelX, totalsY);
   doc.text(formatCents(grandDeliveryInCents), valueX - 60, totalsY, { width: 60, align: "right" });
   totalsY += 16;

   // Total line
   doc.moveTo(labelX, totalsY - 4)
      .lineTo(valueX, totalsY - 4)
      .stroke(COLORS.BORDER);

   // Total
   doc.font(FONTS.BOLD).fontSize(11).fillColor(COLORS.PRIMARY);
   doc.text("TOTAL:", labelX, totalsY);
   doc.text(formatCents(grandTotalInCents), valueX - 70, totalsY, { width: 70, align: "right" });

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
}
