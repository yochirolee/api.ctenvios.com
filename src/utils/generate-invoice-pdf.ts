import PDFKit from "pdfkit";
import * as bwipjs from "bwip-js";
import { promises as fs } from "fs";
import * as path from "path";
import { Order, Customer, Receiver, Agency, Service, Item, Unit } from "@prisma/client";
import { formatName } from "./capitalize";
import { calculate_row_subtotal, formatCents } from "./utils";

interface OrderWithRelations extends Order {
   customer: Customer;
   receiver: Receiver & {
      province?: { name: string };
      city?: { name: string };
   };
   total_in_cents: number;
   paid_in_cents: number;
   charge_in_cents: number;
   agency: Agency;
   service: Service;
   items: Item[];
}

// Pre-calculate all financial totals //have to move this to the utils
function calculateInvoiceTotals(order: OrderWithRelations) {
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

   const subtotal = formatCents(subtotal_in_cents);
   const totalWeight = order.items.reduce((acc, item) => acc + item.weight, 0);
   const chargeAmount = formatCents(order.charge_in_cents || 0);
   const deliveryFeeAmount = formatCents(total_delivery_fee_in_cents);
   const paidAmount = formatCents(order.paid_in_cents);
   const totalAmount = formatCents(order.total_in_cents);
   const balance = formatCents(order.total_in_cents - order.paid_in_cents);

   return {
      subtotal,
      totalWeight,
      chargeAmount,
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

const COLORS = {
   BLACK: "#000000",
   GRAY: "#808080",
   DARK_GRAY: "#1b1c1c",
   LIGHT_GRAY: "#F3F4F6",
   BORDER_GRAY: "#E5E7EB",
   BLUE: "#4682B4",
   RED: "#FF0000",
   WHITE: "#FFFFFF",
} as const;

const LAYOUT = {
   PAGE_HEIGHT: 792,
   BOTTOM_MARGIN: 100,
   LEFT_MARGIN: 20,
   RIGHT_MARGIN: 572,
   FOOTER_Y: 710,
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
      // Fallback to default fonts if custom fonts fail to load
   }
}

export const generateInvoicePDF = async (invoice: OrderWithRelations): Promise<PDFKit.PDFDocument> => {
   try {
      const doc = new PDFKit({ margin: 10, size: "letter" });
      registerCustomFonts(doc);
      await generateOptimizedInvoice(doc, invoice);
      return doc;
   } catch (error) {
      throw new Error(`Invoice generation failed: ${error}`);
   }
};

async function generateOptimizedInvoice(doc: PDFKit.PDFDocument, invoice: OrderWithRelations) {
   // Pre-load assets
   const [logoBuffer, barcodeBuffer] = await Promise.all([
      loadLogo(invoice.agency.logo ?? undefined),
      generateBarcode(invoice.id),
   ]);

   // Pre-calculate values
   const calculations = calculateInvoiceTotals(invoice);
   const formattedData = formatInvoiceData(invoice);

   let currentPage = 1;

   // Generate first page with header and footer
   await generatePageHeader(doc, invoice, logoBuffer, barcodeBuffer, formattedData, calculations, true);
   addFooterToPage(doc, invoice, currentPage, 1); // Temporary total pages, will be updated later
   generateSenderRecipientInfo(doc, invoice, formattedData);

   // Generate items table with pagination (headers and footers will be added to new pages)
   const result = await generateItemsTableOptimized(
      doc,
      invoice,
      calculations,
      logoBuffer,
      barcodeBuffer,
      formattedData
   );
   const totalPages = result.totalPages;

   // Update all page numbers with correct total
   updateAllPageNumbers(doc, totalPages);
}

// Optimized asset loading with caching
async function loadLogo(logoUrl?: string): Promise<Buffer | null> {
   if (!logoUrl) return null;

   const cacheKey = logoUrl;
   if (logoCache.has(cacheKey)) {
      return logoCache.get(cacheKey)!;
   }

   try {
      let logoBuffer: Buffer;

      // Check if it's a URL or local file path
      if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
         // Load from URL
         const response = await fetch(logoUrl);
         if (!response.ok) {
            throw new Error(`Failed to fetch logo from URL: ${response.status} ${response.statusText}`);
         }
         const arrayBuffer = await response.arrayBuffer();
         logoBuffer = Buffer.from(arrayBuffer);
      } else {
         // Load from local file (fallback for backward compatibility)
         const logoPath = path.join(process.cwd(), "assets", logoUrl);
         logoBuffer = await fs.readFile(logoPath);
      }

      logoCache.set(cacheKey, logoBuffer);
      return logoBuffer;
   } catch (error) {
      console.log(`Logo ${logoUrl} could not be loaded:`, error);
      return null;
   }
}

async function generateBarcode(invoiceId: number): Promise<Buffer | null> {
   const cacheKey = String(invoiceId);
   if (barcodeCache.has(cacheKey)) {
      return barcodeCache.get(cacheKey)!;
   }

   try {
      const barcodeBuffer = await bwipjs.toBuffer({
         bcid: "code128",
         text: cacheKey.padStart(6, "0"),
         scale: 3,
         height: 8,
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
function formatInvoiceData(invoice: OrderWithRelations) {
   const senderName = formatName(
      invoice.customer.first_name,
      invoice.customer.middle_name,
      invoice.customer.last_name,
      invoice.customer.second_last_name,
      30
   );

   const recipientName = formatName(
      invoice.receiver.first_name,
      invoice.receiver.middle_name,
      invoice.receiver.last_name,
      invoice.receiver.second_last_name,
      30
   );

   const date = new Date(invoice.created_at);
   const formattedDate = `${date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
   })} ${date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
   })}`;

   const location = `${invoice.receiver.city?.name || ""} ${invoice.receiver.province?.name || ""}`.trim();

   const fullAddress = location ? `${invoice.receiver.address}, ${location}` : invoice.receiver.address;

   return {
      senderName,
      recipientName,
      formattedDate,
      fullAddress,
   };
}

async function generatePageHeader(
   doc: PDFKit.PDFDocument,
   invoice: OrderWithRelations,
   logoBuffer: Buffer | null,
   barcodeBuffer: Buffer | null,
   formattedData: ReturnType<typeof formatInvoiceData>,
   calculations: ReturnType<typeof calculateInvoiceTotals>,
   isFirstPage: boolean = false
) {
   let currentY = 10;

   // Use optimized text rendering
   const textStyle = new TextStyler(doc);

   // Add logo or placeholder
   if (logoBuffer) {
      doc.image(logoBuffer, 30, currentY, { width: 50, height: 50 });
   } else {
      // Draw placeholder box with company name initial or generic logo placeholder
      const companyInitial = invoice.agency.name.charAt(0).toUpperCase();

      // Draw rounded rectangle placeholder
      doc.fillColor("#F3F4F6")
         .roundedRect(30, currentY, 50, 50, 5)
         .fill()
         .strokeColor("#E5E7EB")
         .lineWidth(1)
         .roundedRect(30, currentY, 50, 50, 5)
         .stroke();

      // Add company initial or generic text in the center
      textStyle.style(FONTS.BOLD, 24, "#9CA3AF").text(companyInitial, 30, currentY + 15, {
         width: 50,
         align: "center",
      });
   }
   currentY += 60;

   // Company information
   textStyle.style(FONTS.SEMIBOLD, 12, COLORS.BLACK).text(invoice.agency.name, 30, currentY);

   currentY += 16;

   textStyle
      .style(FONTS.NORMAL, 9, COLORS.GRAY)
      .text(`Address: ${invoice.agency.address}`, 30, currentY)
      .text(`Phone: ${invoice.agency.phone}`, 30, currentY + 12);

   // Right side information
   textStyle
      .style(FONTS.SEMIBOLD, 16, COLORS.BLACK)
      .text(`Invoice ${invoice.id}`, 450, 20, { align: "right", width: 122 });

   textStyle
      .style(FONTS.NORMAL, 12, COLORS.BLACK)
      .text(`Items: ${invoice.items.length}`, 450, 37, { align: "right", width: 122 });

   // Total weight
   textStyle
      .style(FONTS.NORMAL, 9, COLORS.GRAY)
      .text(`Total Weight: ${calculations.totalWeight.toFixed(2)} lbs`, 450, 51, {
         align: "right",
         width: 122,
      });

   // Date - aligned to the right
   textStyle.style(FONTS.NORMAL, 9, COLORS.GRAY).text(`Fecha: ${formattedData.formattedDate}`, 450, 65, {
      align: "right",
      width: 130,
   });

   // Add barcode if available
   if (barcodeBuffer) {
      doc.image(barcodeBuffer, 320, 25, { width: 80, height: 20 });
      textStyle
         .style(FONTS.NORMAL, 8, COLORS.BLACK)
         .text(String(invoice.id).padStart(6, "0"), 320, 50, { align: "center", width: 80 });
   }

   return isFirstPage ? 120 : 110;
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

function generateSenderRecipientInfo(
   doc: PDFKit.PDFDocument,
   invoice: OrderWithRelations,
   formattedData: ReturnType<typeof formatInvoiceData>
) {
   const textStyle = new TextStyler(doc);
   let currentY = 115;

   // Left side - Sender information
   textStyle.style(FONTS.MEDIUM, 10, COLORS.DARK_GRAY).text(formattedData.senderName, 40, currentY);

   currentY += 14;

   // Sender phone
   if (invoice.customer.mobile) {
      textStyle
         .style(FONTS.NORMAL, 9, COLORS.DARK_GRAY)
         .text(`Tel: ${invoice.customer.mobile}`, 40, currentY, { width: 100, align: "left" });
      currentY += 14;
   }

   // Sender address
   if (invoice.customer.address) {
      textStyle
         .style(FONTS.NORMAL, 9, COLORS.DARK_GRAY)
         .text(`Dirección: ${invoice.customer.address}`, 40, currentY, { width: 250 });
   }

   // Right side - Recipient information
   let recipientY = 117;
   const recipientFontSize = formattedData.recipientName.length > 25 ? 9 : 10;

   textStyle
      .style(FONTS.MEDIUM, recipientFontSize, COLORS.DARK_GRAY)
      .text(formattedData.recipientName, 320, recipientY, {
         width: 250,
         height: 16,
         ellipsis: true,
      });

   recipientY += 14;

   // Recipient phone
   if (invoice.receiver.mobile || invoice.receiver.phone) {
      const phoneText = `Tel: ${invoice.receiver.mobile || ""}${
         invoice.receiver.mobile && invoice.receiver.phone ? " - " : ""
      }${invoice.receiver.phone || ""}`;

      textStyle
         .style(FONTS.NORMAL, 9, COLORS.DARK_GRAY)
         .text(phoneText, 320, recipientY, { width: 250, align: "left" });
      recipientY += 14;
   }

   // Recipient CI
   if (invoice.receiver.ci) {
      textStyle
         .style(FONTS.NORMAL, 9, COLORS.DARK_GRAY)
         .text(`CI: ${invoice.receiver.ci}`, 320, recipientY, { width: 100, align: "left" });
      recipientY += 14;
   }

   // Recipient address with location
   textStyle
      .style(FONTS.NORMAL, 9, COLORS.DARK_GRAY)
      .text(`Dir: ${formattedData.fullAddress}`, 320, recipientY, { width: 250 });
}

async function generateItemsTableOptimized(
   doc: PDFKit.PDFDocument,
   invoice: OrderWithRelations,
   calculations: ReturnType<typeof calculateInvoiceTotals>,
   logoBuffer: Buffer | null,
   barcodeBuffer: Buffer | null,
   formattedData: ReturnType<typeof formatInvoiceData>
) {
   let currentY = 200;
   let currentPage = 1;
   const textStyle = new TextStyler(doc);

   // Batch process items for better performance
   const processedItems = invoice.items.map((item, index) => ({
      ...item,
      hbl: item.hbl || `CTE${String(invoice.id).padStart(6, "0")}${String(index + 1).padStart(6, "0")}`,
      subtotal_in_cents: calculate_row_subtotal(
         item.price_in_cents,
         item.weight,
         item.customs_fee_in_cents,
         item.charge_fee_in_cents || 0,
         item.insurance_fee_in_cents || 0,
         item.unit as Unit
      ),
   }));

   const addNewPageWithHeaderFooter = async () => {
      doc.addPage();
      currentPage++;

      // Add header to new page
      await generatePageHeader(doc, invoice, logoBuffer, barcodeBuffer, formattedData, calculations, false);

      // Add footer to new page
      addFooterToPage(doc, invoice, currentPage, currentPage); // We'll update total pages later

      return addOptimizedTableHeaders(doc, 130, textStyle);
   };

   // Add table headers
   currentY = addOptimizedTableHeaders(doc, currentY, textStyle);

   // Process items in batches to avoid memory issues with large invoices
   const BATCH_SIZE = 50;
   for (let i = 0; i < processedItems.length; i += BATCH_SIZE) {
      const batch = processedItems.slice(i, i + BATCH_SIZE);

      for (const item of batch) {
         const descriptionHeight = doc.heightOfString(item.description, { width: 150 });
         const rowHeight = Math.max(25, descriptionHeight + 16);

         // Check page break
         if (currentY + rowHeight > LAYOUT.PAGE_HEIGHT - LAYOUT.BOTTOM_MARGIN) {
            currentY = await addNewPageWithHeaderFooter();
         }

         // Render row efficiently
         renderTableRow(doc, item, currentY, rowHeight, textStyle);
         currentY += rowHeight;
      }
   }

   // Check if we need space for totals (reserve about 250 points)
   if (currentY + 250 > LAYOUT.PAGE_HEIGHT - LAYOUT.BOTTOM_MARGIN) {
      currentY = await addNewPageWithHeaderFooter();
   }

   // Add totals section
   renderTotalsSection(doc, calculations, currentY + 30, textStyle);

   return { totalPages: currentPage };
}

function addOptimizedTableHeaders(doc: PDFKit.PDFDocument, y: number, textStyle: TextStyler): number {
   const headers = [
      { text: "HBL", x: 30, width: 100, align: "left" },
      { text: "Descripcion", x: 140, width: 150, align: "left" },
      { text: "Seguro", x: 300, width: 40, align: "right" },
      { text: "Cargo", x: 340, width: 40, align: "right" },
      { text: "Arancel", x: 385, width: 40, align: "right" },
      { text: "Precio", x: 430, width: 40, align: "right" },
      { text: "Peso", x: 470, width: 40, align: "right" },
      { text: "Subtotal", x: 520, width: 40, align: "right" },
   ];

   textStyle.style(FONTS.NORMAL, 9, COLORS.GRAY);

   headers.forEach((header) => {
      textStyle.text(header.text, header.x, y, {
         width: header.width,
         align: header.align as any,
      });
   });
   // Add border
   doc.strokeColor(COLORS.BORDER_GRAY)
      .lineWidth(0.3)
      .moveTo(25, y + 10)
      .lineTo(572, y + 10)
      .stroke();

   return y + 10;
}

function renderTableRow(
   doc: PDFKit.PDFDocument,
   item: any,
   currentY: number,
   rowHeight: number,
   textStyle: TextStyler
) {
   const verticalCenter = currentY + rowHeight / 2 - 4;

   const rowData = [
      { text: item.hbl, x: 30, y: verticalCenter, width: 100, color: COLORS.DARK_GRAY },
      { text: item.description, x: 140, y: currentY + 8, width: 150, color: COLORS.DARK_GRAY },
      {
         text: `${formatCents(item.insurance_fee_in_cents || 0)}`,
         x: 300,
         y: verticalCenter,
         width: 40,
         align: "right",
         color: (item.insurance_fee_in_cents || 0) === 0 ? COLORS.GRAY : COLORS.DARK_GRAY,
      },
      {
         text: `${formatCents(item.charge_fee_in_cents || 0)}`,
         x: 340,
         y: verticalCenter,
         width: 40,
         align: "right",
         color: (item.charge_fee_in_cents || 0) === 0 ? COLORS.GRAY : COLORS.DARK_GRAY,
      },
      {
         text: `${formatCents(item.customs_fee_in_cents || 0)}`,
         x: 385,
         y: verticalCenter,
         width: 40,
         align: "right",
         color: (item.customs_fee_in_cents || 0) === 0 ? COLORS.GRAY : COLORS.DARK_GRAY,
      },
      {
         text: `${formatCents(item.price_in_cents || 0)}`,
         x: 430,
         y: verticalCenter,
         width: 40,
         align: "right",
         color: COLORS.DARK_GRAY,
      },
      {
         text: `${item.weight.toFixed(2)}`,
         x: 470,
         y: verticalCenter,
         width: 40,
         align: "right",
         color: COLORS.DARK_GRAY,
      },
      {
         text: `${formatCents(item.subtotal_in_cents)}`,
         x: 520,
         y: verticalCenter,
         width: 40,
         align: "right",
         color: COLORS.DARK_GRAY,
      },
   ];

   rowData.forEach((data) => {
      textStyle.style(FONTS.NORMAL, 8.5, data.color).text(data.text, data.x, data.y, {
         width: data.width,
         align: data.align as any,
      });
   });

   // Row border
   doc.strokeColor(COLORS.LIGHT_GRAY)
      .lineWidth(0.2)
      .moveTo(25, currentY + rowHeight)
      .lineTo(572, currentY + rowHeight)
      .stroke();
}

function renderTotalsSection(
   doc: PDFKit.PDFDocument,
   calculations: ReturnType<typeof calculateInvoiceTotals>,
   startY: number,
   textStyle: TextStyler
) {
   let currentY = startY;

   const totals = [
      { label: "Subtotal:", value: calculations.subtotal },
      { label: "Delivery:", value: calculations.deliveryFeeAmount },
      { label: "Seguro:", value: "$0.00" },
      { label: "Cargo:", value: calculations.chargeAmount },
      { label: "Descuento:", value: "$0.00" },
      { label: "Total:", value: calculations.totalAmount, bold: true },
      { label: "Paid:", value: calculations.paidAmount },
      { label: "Balance:", value: calculations.balance, isBalance: true },
   ];

   totals.forEach((total, index) => {
      const font = total.bold ? FONTS.SEMIBOLD : FONTS.NORMAL;
      const size = total.bold ? 10.5 : index >= totals.length - 2 ? 9 : 8.5;

      // Determine color: balance can be red, $0.00 values are gray, others are black
      let valueColor: string = COLORS.BLACK;
      if (total.isBalance && total.value !== "$0.00") {
         valueColor = COLORS.RED;
      } else if (total.value === "$0.00" && !total.bold) {
         valueColor = COLORS.GRAY;
      }

      textStyle.style(font, size, COLORS.BLACK).text(total.label, 380, currentY, { width: 80, align: "right" });

      textStyle.style(font, size, valueColor).text(total.value, 520, currentY, { width: 50, align: "right" });

      currentY += 15;
   });
}

function addFooterToPage(
   doc: PDFKit.PDFDocument,
   order: OrderWithRelations,
   currentPage: number,
   totalPages: number = 1
) {
   const textStyle = new TextStyler(doc);

   // Tracking info
   textStyle.style(FONTS.SEMIBOLD, 10, COLORS.BLUE).text(`Tracking: ${order.agency.website}`, 40, LAYOUT.FOOTER_Y, {
      align: "center",
      width: 532,
   });

   // Legal disclaimer
   textStyle
      .style(FONTS.NORMAL, 7, COLORS.GRAY)
      .text(
         "Al realizar este envío, declaro que soy responsable de toda la información proporcionada y que el contenido enviado no infringe las leyes de los Estados Unidos ni las regulaciones aduanales de la República de Cuba. También declaro estar de acuerdo con los términos y condiciones de la empresa.",
         40,
         LAYOUT.FOOTER_Y + 15,
         { width: 532, align: "justify", lineGap: 1 }
      );

   // Terms link
   textStyle
      .style(FONTS.NORMAL, 8, COLORS.BLACK)
      .text("Para términos y condiciones completos visite: https://ctenvios.com/terms", 40, LAYOUT.FOOTER_Y + 35, {
         align: "center",
         width: 532,
         underline: true,
      });

   // Page number
   textStyle
      .style(FONTS.NORMAL, 8, COLORS.GRAY)
      .text(`Página ${currentPage} de ${totalPages}`, 40, LAYOUT.FOOTER_Y + 50, {
         align: "right",
         width: 532,
      });
}

// Optimized page number updates
function updateAllPageNumbers(doc: PDFKit.PDFDocument, totalPages: number) {
   const range = doc.bufferedPageRange();
   const textStyle = new TextStyler(doc);

   for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      // Clear old page number
      doc.fillColor(COLORS.WHITE)
         .rect(450, LAYOUT.FOOTER_Y + 50, 122, 10)
         .fill();

      // Add new page number
      textStyle.style(FONTS.NORMAL, 8, COLORS.GRAY).text(`Página ${i + 1} de ${totalPages}`, 40, LAYOUT.FOOTER_Y + 50, {
         align: "right",
         width: 532,
      });
   }
}

// Utility function to clear caches periodically
export function clearInvoiceCaches() {
   logoCache.clear();
   barcodeCache.clear();
}
