import PDFKit from "pdfkit";
import * as bwipjs from "bwip-js";
import { promises as fs } from "fs";
import * as path from "path";
import { Unit } from "@prisma/client";
import type { OrderPdfDetails } from "../repositories/orders.repository";
import { formatName } from "./capitalize";
import { calculate_row_subtotal, formatCents } from "./utils";

// Pre-calculate all financial totals
function calculateOrderTotals(order: OrderPdfDetails) {
   const subtotal_in_cents = order.items.reduce(
      (acc, item) =>
         acc +
         calculate_row_subtotal(
            item.price_in_cents,
            item.weight,
            item.customs_fee_in_cents,
            item.charge_fee_in_cents || 0,
            item.insurance_fee_in_cents || 0,
            item.unit as Unit
         ),
      0
   );
   const total_delivery_fee_in_cents = order.items.reduce((acc, item) => acc + (item.delivery_fee_in_cents || 0), 0);
   const total_insurance_in_cents = order.items.reduce((acc, item) => acc + (item.insurance_fee_in_cents || 0), 0);
   const items_charge_in_cents = order.items.reduce((acc, item) => acc + (item.charge_fee_in_cents || 0), 0);

   const payments_charge_in_cents = order.payments.reduce((acc, payment) => acc + (payment.charge_in_cents || 0), 0);

   const items_fee_amount = formatCents(items_charge_in_cents);
   const payments_fee_amount = formatCents(payments_charge_in_cents);
   const subtotal = formatCents(subtotal_in_cents);
   const totalWeight = order.items.reduce((acc, item) => acc + item.weight, 0);
   const insuranceAmount = formatCents(total_insurance_in_cents);
   const deliveryFeeAmount = formatCents(total_delivery_fee_in_cents);
   const paidAmount = formatCents(order.paid_in_cents);
   const totalAmount = formatCents(order.total_in_cents);
   const balance = formatCents(order.total_in_cents - order.paid_in_cents);

   return {
      subtotal,
      totalWeight,
      items_fee_amount,
      payments_fee_amount,
      insuranceAmount,
      deliveryFeeAmount,
      paidAmount,
      totalAmount,
      balance,
   };
}

// Cache for logos and barcodes to avoid regeneration
const logoCache = new Map<string, Buffer>();
const barcodeCache = new Map<string, Buffer>();

// Font paths
const FONT_PATHS = {
   REGULAR: path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf"),
   MEDIUM: path.join(process.cwd(), "assets", "fonts", "Inter-Medium.ttf"),
   SEMIBOLD: path.join(process.cwd(), "assets", "fonts", "Inter-SemiBold.ttf"),
   BOLD: path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf"),
} as const;

// Font names (after registration)
const FONTS = {
   REGULAR: "Inter-Regular",
   MEDIUM: "Inter-Medium",
   SEMIBOLD: "Inter-SemiBold",
   BOLD: "Inter-Bold",
   NORMAL: "Inter-Regular", // Alias for compatibility
} as const;

// Modern color scheme
const COLORS = {
   PRIMARY: "#2563eb",
   PRIMARY_FOREGROUND: "#ffffff",
   BACKGROUND: "#ffffff",
   MUTED: "#f9fafb",
   BORDER: "#e5e7eb",
   FOREGROUND: "#111827",
   MUTED_FOREGROUND: "#6b7280",
   DESTRUCTIVE: "#dc2626",
   BLACK: "#000000",
   WHITE: "#ffffff",
} as const;

const ASSETS_PATH = path.join(process.cwd(), "assets");
const DEFAULT_LOGO_FILENAME = "ctelogo.png";

const LAYOUT = {
   PAGE_HEIGHT: 792,
   PAGE_WIDTH: 612,
   BOTTOM_MARGIN: 80,
   LEFT_MARGIN: 0,
   RIGHT_MARGIN: 612,
   FOOTER_Y: 730,
} as const;

// Register custom fonts with PDFKit
function registerCustomFonts(doc: PDFKit.PDFDocument): void {
   try {
      doc.registerFont(FONTS.REGULAR, FONT_PATHS.REGULAR);
      doc.registerFont(FONTS.MEDIUM, FONT_PATHS.MEDIUM);
      doc.registerFont(FONTS.SEMIBOLD, FONT_PATHS.SEMIBOLD);
      doc.registerFont(FONTS.BOLD, FONT_PATHS.BOLD);
   } catch (error) {
      console.warn("Failed to register custom fonts, falling back to Helvetica:", error);
   }
}

export const generateOrderPDF = async (order: OrderPdfDetails): Promise<PDFKit.PDFDocument> => {
   try {
      const doc = new PDFKit({ margin: 0, size: "letter" });
      registerCustomFonts(doc);
      await generateModernOrder(doc, order);
      return doc;
   } catch (error) {
      throw new Error(`Order PDF generation failed: ${error}`);
   }
};

async function generateModernOrder(doc: PDFKit.PDFDocument, order: OrderPdfDetails) {
   // Pre-load assets
   const [logoBuffer, barcodeBuffer] = await Promise.all([loadLogo(), generateBarcode(order.id)]);

   // Pre-calculate values
   const calculations = calculateOrderTotals(order);
   const formattedData = formatOrderData(order);

   // Generate first page with header and sections
   let currentY = await generateModernHeader(doc, order, logoBuffer, formattedData);
   currentY = await generateBarcodeSection(doc, order, barcodeBuffer, calculations, currentY);
   currentY = generateContactGrid(doc, order, formattedData, currentY);

   // Generate items table with pagination
   const result = await generateModernTable(
      doc,
      order,
      calculations,
      currentY,
      logoBuffer,
      barcodeBuffer,
      formattedData
   );
   const totalPages = result.totalPages;

   // Add footer to all pages
   addModernFooterToAllPages(doc, order, totalPages);
}

// Optimized asset loading with caching
async function loadLogo(logoUrl?: string): Promise<Buffer | null> {
   const source = logoUrl?.trim() || DEFAULT_LOGO_FILENAME;
   const cacheKey = source;
   if (logoCache.has(cacheKey)) {
      return logoCache.get(cacheKey)!;
   }

   try {
      let logoBuffer: Buffer;

      if (source.startsWith("http://") || source.startsWith("https://")) {
         const response = await fetch(source);
         if (!response.ok) {
            throw new Error(`Failed to fetch logo from URL: ${response.status} ${response.statusText}`);
         }
         const arrayBuffer = await response.arrayBuffer();
         logoBuffer = Buffer.from(arrayBuffer);
      } else {
         const logoPath = path.isAbsolute(source) ? source : path.join(ASSETS_PATH, source);
         logoBuffer = await fs.readFile(logoPath);
      }

      logoCache.set(cacheKey, logoBuffer);
      return logoBuffer;
   } catch (error) {
      console.log(`Logo ${source} could not be loaded:`, error);
      if (source !== DEFAULT_LOGO_FILENAME) {
         return loadLogo(DEFAULT_LOGO_FILENAME);
      }
      return null;
   }
}

async function generateBarcode(orderId: number): Promise<Buffer | null> {
   const cacheKey = String(orderId);
   if (barcodeCache.has(cacheKey)) {
      return barcodeCache.get(cacheKey)!;
   }

   try {
      const barcodeBuffer = await bwipjs.toBuffer({
         bcid: "code128",
         text: cacheKey,
         scale: 3,
         height: 10,
         includetext: false,
         textxalign: "center",
      });

      barcodeCache.set(cacheKey, barcodeBuffer);
      return barcodeBuffer;
   } catch (error) {
      console.log("Barcode generation failed:", error);
      return null;
   }
}

// Pre-format all string data
function formatOrderData(order: OrderPdfDetails) {
   const senderName = formatName(
      order.customer.first_name,
      order.customer.middle_name,
      order.customer.last_name,
      order.customer.second_last_name,
      30
   );

   const recipientName = formatName(
      order.receiver.first_name,
      order.receiver.middle_name,
      order.receiver.last_name,
      order.receiver.second_last_name,
      30
   );

   const date = new Date(order.created_at);
   const formattedDate = `${date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
   })} ${date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
   })}`;

   const location = `${order.receiver.city?.name || ""} ${order.receiver.province?.name || ""}`.trim();
   const fullAddress = location ? `${order.receiver.address}, ${location}` : order.receiver.address;

   const totalWeightValue = order.items.reduce((acc, item) => acc + item.weight, 0);
   const totalWeightLabel = `${totalWeightValue.toFixed(2)} lbs`;
   const itemsCount = `${order.items.length}`;

   return {
      senderName,
      recipientName,
      formattedDate,
      fullAddress,
      totalWeightLabel,
      itemsCount,
   };
}

async function generateModernHeader(
   doc: PDFKit.PDFDocument,
   order: OrderPdfDetails,
   logoBuffer: Buffer | null,
   formattedData: ReturnType<typeof formatOrderData>
): Promise<number> {
   const textStyle = new TextStyler(doc);
   const headerHeight = 90;

   // Logo section (no blue background)
   let logoX = 20;
   let logoY = 20;

   if (logoBuffer) {
      // Draw light border around logo

      doc.image(logoBuffer, logoX, logoY + 6, { width: 48, height: 36 });
   } else {
      // Draw placeholder with light background and border
      const companyInitial = order.agency.name?.charAt(0).toUpperCase() || "";
      doc.fillColor(COLORS.MUTED).roundedRect(logoX, logoY, 48, 48, 8).fill();
      doc.strokeColor(COLORS.BORDER).lineWidth(1).roundedRect(logoX, logoY, 48, 48, 8).stroke();

      textStyle.style(FONTS.BOLD, 20, COLORS.MUTED_FOREGROUND).text(companyInitial, logoX, logoY + 14, {
         width: 48,
         align: "center",
      });
   }

   // Company name next to logo
   const companyNameY = logoY + 6;
   textStyle.style(FONTS.BOLD, 18, "#0d4fa3").text(order.agency.name || "", logoX + 60, companyNameY);

   // Company info below name with proper spacing
   const addressY = logoY + 28;
   textStyle
      .style(FONTS.REGULAR, 8, COLORS.MUTED_FOREGROUND)
      .text(`${order.agency.address || ""} • ${order.agency.phone || ""}`, logoX + 60, addressY);

   // Right side - Order number and date aligned with left side
   const rightX = LAYOUT.PAGE_WIDTH - 260;

   // Order title - on same line as agency name
   textStyle.style(FONTS.BOLD, 18, COLORS.FOREGROUND).text(`Order ${order.id}`, rightX, companyNameY, {
      align: "right",
      width: 240,
      lineBreak: false,
   });

   // Date - on same line as address
   textStyle
      .style(FONTS.REGULAR, 8, COLORS.MUTED_FOREGROUND)
      .text(`Fecha: ${formattedData.formattedDate}`, rightX, addressY, {
         align: "right",
         width: 240,
      });

   // Order stats (items and weight) on a single line below the date
   const statsX = rightX;
   const statsY = addressY + 12;
   const statsWidth = 240;
   const statsLine = `Weight: ${formattedData.totalWeightLabel}   •   Items: ${formattedData.itemsCount}`;
   textStyle
      .style(FONTS.SEMIBOLD, 10, COLORS.FOREGROUND)
      .text(statsLine, statsX, statsY, { width: statsWidth, align: "right" });

   // Draw bottom border for header section
   doc.strokeColor(COLORS.BORDER).lineWidth(1).moveTo(0, headerHeight).lineTo(LAYOUT.PAGE_WIDTH, headerHeight).stroke();

   return headerHeight;
}

async function generateBarcodeSection(
   doc: PDFKit.PDFDocument,
   order: OrderPdfDetails,
   barcodeBuffer: Buffer | null,
   calculations: ReturnType<typeof calculateOrderTotals>,
   startY: number
): Promise<number> {
   const textStyle = new TextStyler(doc);
   const sectionHeight = 35;
   const barcodeHeight = 22;
   const transportLetter = order.service.service_type === "MARITIME" ? "M" : "A";
   const transportSquareSize = 30;
   const transportSquarePadding = 10;

   // Summary information on the left - vertically centered
   const summaryX = 20;
   const summaryY = startY + (sectionHeight - 10) / 2; // Center text vertically (10 is approximate text height)

   const squareX = summaryX;
   const squareY = startY + (sectionHeight - transportSquareSize) / 2;

      doc.strokeColor(COLORS.FOREGROUND)
      .lineWidth(1.5)
      .rect(squareX, squareY, transportSquareSize, transportSquareSize)
      .stroke();

   doc.fontSize(transportSquareSize - 8)
      .font(FONTS.BOLD)
      .fillColor(COLORS.FOREGROUND)
      .text(transportLetter, squareX, squareY + 3, { width: transportSquareSize, align: "center" });

   const serviceLabelX = squareX + transportSquareSize + transportSquarePadding;
   textStyle.style(FONTS.SEMIBOLD, 10, COLORS.FOREGROUND).text(order.service.name, serviceLabelX, summaryY);

   // Barcode on the right side - vertically centered and aligned with Order text
   if (barcodeBuffer) {
      const barcodeX = LAYOUT.PAGE_WIDTH - 130; // Align with Order text right edge (30pt margin)
      const barcodeY = startY + (sectionHeight - barcodeHeight) / 2; // Equal top and bottom margins

      doc.image(barcodeBuffer, barcodeX, barcodeY, { width: 110, height: barcodeHeight });
   }

   return startY + sectionHeight;
}

function generateContactGrid(
   doc: PDFKit.PDFDocument,
   order: OrderPdfDetails,
   formattedData: ReturnType<typeof formatOrderData>,
   startY: number
): number {
   const textStyle = new TextStyler(doc);
   const sectionHeight = 90;
   const leftX = 20;
   const rightX = 306; // Center of letter page: 612/2 = 306
   let currentY = startY + 25;

   // Draw border at top
   doc.strokeColor(COLORS.BORDER).lineWidth(1).moveTo(0, startY).lineTo(LAYOUT.PAGE_WIDTH, startY).stroke();

   // Left column - Sender (Remitente)
   textStyle
      .style(FONTS.SEMIBOLD, 7, COLORS.MUTED_FOREGROUND)
      .text("REMITENTE", leftX, currentY, { characterSpacing: 0.5 });

   currentY += 15;
   textStyle.style(FONTS.SEMIBOLD, 9, COLORS.FOREGROUND).text(formattedData.senderName || "", leftX, currentY, {
      width: 240,
   });

   currentY += 14;
   if (order.customer.mobile) {
      textStyle
         .style(FONTS.REGULAR, 8, COLORS.MUTED_FOREGROUND)
         .text(`Tel: ${order.customer.mobile || ""}`, leftX, currentY);
      currentY += 12;
   }

   if (order.customer.address) {
      textStyle
         .style(FONTS.REGULAR, 8, COLORS.MUTED_FOREGROUND)
         .text(`Dir: ${order.customer.address || ""}`, leftX, currentY, {
            width: 240,
         });
   }

   // Right column - Recipient (Destinatario)
   let recipientY = startY + 25;
   textStyle
      .style(FONTS.SEMIBOLD, 7, COLORS.MUTED_FOREGROUND)
      .text("DESTINATARIO", rightX, recipientY, { characterSpacing: 0.5 });

   recipientY += 15;
   textStyle.style(FONTS.SEMIBOLD, 9, COLORS.FOREGROUND).text(formattedData.recipientName || "", rightX, recipientY, {
      width: 240,
   });

   recipientY += 14;
   if (order.receiver.mobile || order.receiver.phone) {
      const phoneText = `Tel: ${order.receiver.mobile || ""}${
         order.receiver.mobile && order.receiver.phone ? " - " : ""
      }${order.receiver.phone || ""}`;
      textStyle.style(FONTS.REGULAR, 8, COLORS.MUTED_FOREGROUND).text(phoneText, rightX, recipientY);
      recipientY += 12;
   }

   if (order.receiver.ci) {
      textStyle.style(FONTS.REGULAR, 8, COLORS.MUTED_FOREGROUND).text(`CI: ${order.receiver.ci}`, rightX, recipientY);
      recipientY += 12;
   }

   textStyle
      .style(FONTS.REGULAR, 8, COLORS.MUTED_FOREGROUND)
      .text(`Dir: ${formattedData.fullAddress || ""}`, rightX, recipientY, {
         width: 240,
      });

   return startY + sectionHeight;
}

async function generateModernTable(
   doc: PDFKit.PDFDocument,
   order: OrderPdfDetails,
   calculations: ReturnType<typeof calculateOrderTotals>,
   startY: number,
   logoBuffer: Buffer | null,
   barcodeBuffer: Buffer | null,
   formattedData: ReturnType<typeof formatOrderData>
): Promise<{ totalPages: number }> {
   let currentY = startY + 35;
   let currentPage = 1;
   const textStyle = new TextStyler(doc);

   // Process items
   const processedItems = order.items.map((item, index) => ({
      ...item,
      hbl: item.hbl || `CTE${String(order.id).padStart(6, "0")}${String(index + 1).padStart(6, "0")}`,
      subtotal_in_cents: calculate_row_subtotal(
         item.price_in_cents,
         item.weight,
         item.customs_fee_in_cents,
         item.charge_fee_in_cents || 0,
         item.insurance_fee_in_cents || 0,
         item.unit as Unit
      ),
   }));

   const addNewPageWithHeader = async (includeTableHeaders: boolean = true): Promise<number> => {
      doc.addPage({ margin: 0 });
      currentPage++;

      // Only show header (no barcode section on continuation pages)
      let newY = await generateModernHeader(doc, order, logoBuffer, formattedData);
      newY += 20; // Add spacing after header

      // Only add table headers if needed (when there are items to render)
      if (includeTableHeaders) {
         newY = addModernTableHeaders(doc, newY, textStyle);
      }

      return newY;
   };

   // Add table headers
   currentY = addModernTableHeaders(doc, currentY, textStyle);

   // Render items
   for (const item of processedItems) {
      // Set font style for accurate height measurement
      doc.font(FONTS.REGULAR).fontSize(9);

      // Trim description if it exceeds 3 lines
      const maxHeight = 33; // Based on font size 9pt, ~11pt per line = 33pt for 3 lines

      let description = item.description;
      let descriptionHeight = doc.heightOfString(description, { width: 145 });

      // If description exceeds 3 lines, trim it
      if (descriptionHeight > maxHeight) {
         const words = description.split(" ");
         let trimmedDesc = "";

         for (let i = 0; i < words.length; i++) {
            const testDesc = trimmedDesc + (trimmedDesc ? " " : "") + words[i];
            const testHeight = doc.heightOfString(testDesc + "...", { width: 145 });

            if (testHeight > maxHeight) {
               break;
            }
            trimmedDesc = testDesc;
         }

         description = trimmedDesc + "...";
         descriptionHeight = doc.heightOfString(description, { width: 145 });
      }

      const rowHeight = Math.max(30, descriptionHeight + 20);

      // Check page break
      if (currentY + rowHeight > LAYOUT.PAGE_HEIGHT - LAYOUT.BOTTOM_MARGIN) {
         currentY = await addNewPageWithHeader(true); // Include headers for item continuation
      }

      renderModernTableRow(doc, { ...item, description }, currentY, rowHeight, textStyle);
      currentY += rowHeight;
   }

   // Check if we need space for totals
   if (currentY + 200 > LAYOUT.PAGE_HEIGHT - LAYOUT.BOTTOM_MARGIN) {
      currentY = await addNewPageWithHeader(false); // No headers needed, only totals
   }

   // Add totals section
   renderModernTotals(doc, calculations, currentY + 30, textStyle);

   return { totalPages: currentPage };
}

function addModernTableHeaders(doc: PDFKit.PDFDocument, y: number, textStyle: TextStyler): number {
   const headerY = y + 10;

   const headers = [
      { text: "HBL", x: 25, width: 100, align: "left" },
      { text: "Descripción", x: 110, width: 145, align: "left" },
      { text: "Seguro", x: 290, width: 48, align: "right" },
      { text: "Cargo", x: 348, width: 48, align: "right" },
      { text: "Arancel", x: 406, width: 48, align: "right" },
      { text: "Precio", x: 464, width: 42, align: "right" },
      { text: "Peso", x: 508, width: 33, align: "right" },
      { text: "Subtotal", x: 542, width: 50, align: "right" },
   ];

   textStyle.style(FONTS.SEMIBOLD, 7, COLORS.MUTED_FOREGROUND);

   headers.forEach((header) => {
      textStyle.text(header.text.toUpperCase(), header.x, headerY, {
         width: header.width,
         align: header.align as any,
         characterSpacing: 0.3,
      });
   });

   // Draw border at bottom
   doc.strokeColor(COLORS.BORDER)
      .lineWidth(1)
      .moveTo(20, headerY + 12)
      .lineTo(LAYOUT.PAGE_WIDTH - 20, headerY + 12)
      .stroke();

   return headerY + 15;
}

function renderModernTableRow(
   doc: PDFKit.PDFDocument,
   item: any,
   currentY: number,
   rowHeight: number,
   textStyle: TextStyler
) {
   const verticalCenter = currentY + rowHeight / 2 - 5;

   // HBL (monospace style)
   textStyle.style(FONTS.REGULAR, 8, COLORS.FOREGROUND).text(item.hbl, 20, verticalCenter, { width: 100 });

   // Description
   textStyle.style(FONTS.REGULAR, 7, COLORS.FOREGROUND).text(item.description, 110, verticalCenter, { width: 165 });

   // Seguro
   const insuranceColor = (item.insurance_fee_in_cents || 0) === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
   textStyle
      .style(FONTS.REGULAR, 7, insuranceColor)
      .text(`${formatCents(item.insurance_fee_in_cents || 0)}`, 290, verticalCenter, {
         width: 48,
         align: "right",
      });

   // Cargo
   const chargeColor = (item.charge_fee_in_cents || 0) === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
   textStyle
      .style(FONTS.REGULAR, 7, chargeColor)
      .text(`${formatCents(item.charge_fee_in_cents || 0)}`, 348, verticalCenter, {
         width: 48,
         align: "right",
      });

   // Arancel
   const customsColor = (item.customs_fee_in_cents || 0) === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
   textStyle
      .style(FONTS.REGULAR, 7, customsColor)
      .text(`${formatCents(item.customs_fee_in_cents || 0)}`, 406, verticalCenter, {
         width: 48,
         align: "right",
      });

   // Precio
   textStyle
      .style(FONTS.REGULAR, 7, COLORS.FOREGROUND)
      .text(`${formatCents(item.price_in_cents || 0)}`, 464, verticalCenter, {
         width: 42,
         align: "right",
      });

   // Peso
   textStyle.style(FONTS.REGULAR, 7, COLORS.MUTED_FOREGROUND).text(`${item.weight.toFixed(2)}`, 508, verticalCenter, {
      width: 33,
      align: "right",
   });

   // Subtotal
   textStyle
      .style(FONTS.REGULAR, 7, COLORS.FOREGROUND)
      .text(`${formatCents(item.subtotal_in_cents)}`, 542, verticalCenter, {
         width: 50,
         align: "right",
      });

   // Row border
   doc.strokeColor(COLORS.BORDER)
      .lineWidth(0.5)
      .moveTo(20, currentY + rowHeight)
      .lineTo(LAYOUT.PAGE_WIDTH - 20, currentY + rowHeight)
      .stroke();
}

function renderModernTotals(
   doc: PDFKit.PDFDocument,
   calculations: ReturnType<typeof calculateOrderTotals>,
   startY: number,
   textStyle: TextStyler
) {
   let currentY = startY;

   const labelX = 320;
   const valueX = 485;
   const labelWidth = 120;
   const valueWidth = 110;

   const totals = [
      { label: "Subtotal:", value: calculations.subtotal, size: 9 },
      { label: "Delivery:", value: calculations.deliveryFeeAmount, size: 9 },
      { label: "Seguro:", value: calculations.insuranceAmount, size: 9 },
      { label: "Cargo:", value: calculations.items_fee_amount, size: 9 },
      { label: "Payment Fee:", value: calculations.payments_fee_amount, size: 9 },
      { label: "Descuento:", value: "$0.00", size: 9, color: COLORS.MUTED_FOREGROUND },
   ];

   totals.forEach((total) => {
      const labelColor = total.color || COLORS.MUTED_FOREGROUND;
      const valueColor = total.value === "$0.00" ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;

      textStyle.style(FONTS.REGULAR, total.size, labelColor).text(total.label, labelX, currentY, {
         width: labelWidth,
         align: "right",
      });

      textStyle.style(FONTS.REGULAR, total.size, valueColor).text(total.value, valueX, currentY, {
         width: valueWidth,
         align: "right",
      });

      currentY += 16;
   });

   currentY += 8;

   // Total
   textStyle.style(FONTS.SEMIBOLD, 12, COLORS.FOREGROUND).text("Total:", labelX, currentY, {
      width: labelWidth,
      align: "right",
   });

   textStyle.style(FONTS.BOLD, 12, COLORS.FOREGROUND).text(calculations.totalAmount, valueX, currentY, {
      width: valueWidth,
      align: "right",
   });

   currentY += 20;

   // Paid
   textStyle.style(FONTS.REGULAR, 9, COLORS.MUTED_FOREGROUND).text("Paid:", labelX, currentY, {
      width: labelWidth,
      align: "right",
   });

   const paidColor = calculations.paidAmount === "$0.00" ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
   textStyle.style(FONTS.REGULAR, 9, paidColor).text(calculations.paidAmount, valueX, currentY, {
      width: valueWidth,
      align: "right",
   });

   currentY += 16;

   currentY += 8;

   // Balance
   textStyle.style(FONTS.SEMIBOLD, 12, COLORS.FOREGROUND).text("Balance:", labelX, currentY, {
      width: labelWidth,
      align: "right",
   });

   const balanceColor = calculations.balance === "$0.00" ? COLORS.FOREGROUND : COLORS.DESTRUCTIVE;
   textStyle.style(FONTS.BOLD, 12, balanceColor).text(calculations.balance, valueX, currentY, {
      width: valueWidth,
      align: "right",
   });
}

function addModernFooterToAllPages(doc: PDFKit.PDFDocument, order: OrderPdfDetails, totalPages: number) {
   const range = doc.bufferedPageRange();
   const textStyle = new TextStyler(doc);

   for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Legal disclaimer
      textStyle
         .style(FONTS.REGULAR, 6, COLORS.MUTED_FOREGROUND)
         .text(
            "Al realizar este envío, declaro que soy responsable de toda la información proporcionada y que el contenido enviado no infringe las leyes de los Estados Unidos ni las regulaciones aduanales de la República de Cuba. También declaro estar de acuerdo con los términos y condiciones de la empresa.",
            20,
            LAYOUT.FOOTER_Y,
            { width: LAYOUT.PAGE_WIDTH - 40, align: "center", lineGap: 1 }
         );

      // Terms and Tracking (centered)
      textStyle
         .style(FONTS.REGULAR, 7, "#0d4fa3")
         .text(
            "Términos: https://ctenvios.com/terms  |  Tracking: https://ctenvios.com/tracking",
            20,
            LAYOUT.FOOTER_Y + 20,
            {
               align: "center",
               width: LAYOUT.PAGE_WIDTH - 40,
               underline: true,
            }
         );

      // Page number
      textStyle
         .style(FONTS.REGULAR, 7, COLORS.MUTED_FOREGROUND)
         .text(`Página ${i + 1} de ${totalPages}`, 20, LAYOUT.FOOTER_Y + 35, {
            align: "right",
            width: LAYOUT.PAGE_WIDTH - 40,
         });
   }
}

// Optimized text styling helper
class TextStyler {
   private doc: PDFKit.PDFDocument;
   private lastFont?: string;
   private lastSize?: number;
   private lastColor?: string;

   constructor(doc: PDFKit.PDFDocument) {
      this.doc = doc;
   }

   style(font: string, size: number, color: string) {
      if (this.lastFont !== font) {
         this.doc.font(font);
         this.lastFont = font;
      }
      if (this.lastSize !== size) {
         this.doc.fontSize(size);
         this.lastSize = size;
      }
      if (this.lastColor !== color) {
         this.doc.fillColor(color);
         this.lastColor = color;
      }
      return this;
   }

   text(text: string, x: number, y: number, options?: any) {
      this.doc.text(text, x, y, options);
      return this;
   }
}

// Utility function to clear caches periodically
export function clearOrderPdfCaches() {
   logoCache.clear();
   barcodeCache.clear();
}
