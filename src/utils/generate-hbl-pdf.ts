import PDFKit from "pdfkit";
import { OrderItem } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { formatName } from "./capitalize";
import { FONTS, registerPdfFonts } from "./pdf-fonts";
import { OrderWithRelations } from "../types/order-with-relations";
import { toNumber } from "./utils";

const LOGO_PATH = path.join(process.cwd(), "assets", "ctelogo.png");

const COLUMN_GAP = 8;
const PAGE_MARGIN = 12;
const LINE_WIDTH = 0.1;
const CUSTOMS_SECTION_HEIGHT = 60;

const poundsToKilograms = (weight: number): string => {
   if (!weight) {
      return "0.00";
   }
   const kilograms = weight / 2.20462;
   return kilograms.toFixed(2);
};

const formatDate = (value: Date | string): string => {
   const safeDate = value instanceof Date ? value : new Date(value);
   const year = safeDate.getFullYear();
   const month = String(safeDate.getMonth() + 1).padStart(2, "0");
   const day = String(safeDate.getDate()).padStart(2, "0");
   return `${year}-${month}-${day}`;
};

const uppercase = (value: string | null | undefined): string => (value ? value.toUpperCase() : "");

interface ImageOptions {
   width?: number;
   height?: number;
}

const drawImageIfExists = (
   doc: PDFKit.PDFDocument,
   imagePath: string,
   x: number,
   y: number,
   options: ImageOptions = {}
): void => {
   if (fs.existsSync(imagePath)) {
      doc.image(imagePath, x, y, options);
   }
};

interface TableColumn {
   label: string;
   value: string;
   align?: "left" | "center" | "right";
   fontSize?: number;
   font?: string;
}

interface BoxOptions {
   label: string;
   value: string;
   height: number;
}

export const generateHblPdf = (order: OrderWithRelations): Promise<PDFKit.PDFDocument> => {
   const doc = new PDFKit({
      size: "LETTER",
      layout: "landscape",
      margin: PAGE_MARGIN,
   });

   registerPdfFonts(doc);

   return new Promise<PDFKit.PDFDocument>((resolve, reject) => {
      try {
         order.order_items.forEach((item, index) => {
            if (index > 0) {
               doc.addPage();
            }
            drawHblPage(doc, order, item);
         });
         resolve(doc);
      } catch (error) {
         reject(error);
      }
   });
};

const drawHblPage = (doc: PDFKit.PDFDocument, order: OrderWithRelations, item: OrderItem): void => {
   const pageWidth = doc.page.width;
   const pageHeight = doc.page.height;
   const columnWidth = (pageWidth - PAGE_MARGIN * 2 - COLUMN_GAP) / 2;
   const columnHeight = pageHeight - PAGE_MARGIN * 2;
   const leftX = PAGE_MARGIN;
   const rightX = leftX + columnWidth + COLUMN_GAP;
   const topY = PAGE_MARGIN;

   drawHblSection(doc, order, item, leftX, topY, columnWidth, columnHeight);
   drawHblSection(doc, order, item, rightX, topY, columnWidth, columnHeight);
};

const drawHblSection = (
   doc: PDFKit.PDFDocument,
   order: OrderWithRelations,
   item: OrderItem,
   x: number,
   y: number,
   width: number,
   height: number
): void => {
   const contentPadding = 8;
   const contentX = x + contentPadding;
   const contentWidth = width - contentPadding * 2;
   doc.lineWidth(LINE_WIDTH);

   const shipperName = uppercase(
      formatName(
         order.customer.first_name,
         order.customer.middle_name,
         order.customer.last_name,
         order.customer.second_last_name
      )
   );
   const consigneeName = uppercase(
      formatName(
         order.receiver.first_name,
         order.receiver.middle_name,
         order.receiver.last_name,
         order.receiver.second_last_name
      )
   );

   const issueDate = formatDate(order.created_at);
   const hblNumber = uppercase(item.hbl);
   const mblNumber = uppercase("");
   const exportReference = `ORDER #${order.id}`;
   const forwardingAgent = uppercase(order.service.forwarder.name);
   const notifyParty = uppercase(order.service.provider.name);

   const weight = toNumber(item.weight); // weight is Decimal, needs conversion
   const weightKg = poundsToKilograms(weight);
   const volume = item.volume ?? 0; // volume is Float?, already a number
   const packageCount = item.quantity ?? 1;
   const movementType = uppercase(order.service.service_type);

   const shipperDetails = [
      shipperName,
      order.customer.identity_document ? `CI: ${order.customer.identity_document}` : "",
      order.customer.mobile ? `TEL: ${order.customer.mobile}` : "",
      order.customer.address ? uppercase(order.customer.address) : "",
   ]
      .filter(Boolean)
      .join("\n");

   const consigneeDetails = [
      consigneeName,
      `CI: ${order.receiver.ci}`,
      order.receiver.mobile ? `TEL: ${order.receiver.mobile}` : "",
      uppercase(order.receiver.address),
      `${uppercase(order.receiver.province?.name)} / ${uppercase(order.receiver.city?.name)}`,
   ]
      .filter(Boolean)
      .join("\n");

   doc.rect(x, y, width, height).stroke();

   const logoWidth = 50;
   const logoHeight = 32;
   const logoY = y + 6;
   drawImageIfExists(doc, LOGO_PATH, x + 8, logoY, { width: logoWidth, height: logoHeight });

   let cursorY = y + 8;

   doc.font(FONTS.BOLD)
      .fontSize(11)
      .text("CARIBE TRAVEL EXPRESS", contentX + logoWidth / 2, cursorY, {
         width: contentWidth - logoWidth / 2,
         align: "center",
      });
   cursorY += 14;

   doc.font(FONTS.SEMIBOLD)
      .fontSize(9)
      .text("COMBINED TRANSPORT BILL OF LADING", contentX + logoWidth / 2, cursorY, {
         width: contentWidth - logoWidth / 2,
         align: "center",
      });
   cursorY += 18;

   cursorY = drawTableRow(doc, x, cursorY, width, 22, [
      { label: "MBL NUMBER", value: mblNumber },
      { label: "HBL NUMBER", value: hblNumber, align: "right" },
   ]);

   cursorY = drawTableRow(doc, x, cursorY, width, 22, [
      { label: "EXPORT REFERENCES", value: exportReference },
      { label: "FORWARDING AGENT", value: forwardingAgent, fontSize: 7, font: FONTS.MEDIUM },
   ]);

   cursorY = drawLabeledBox(doc, x, cursorY, width, {
      label: "CONSIGNEES/RECEIVERS SHOULD APPLY FOR RELEASE TO",
      value: notifyParty,
      height: 22,
   });

   cursorY = drawLabeledBox(doc, x, cursorY, width, {
      label: "SHIPPER",
      value: shipperDetails,
      height: 58,
   });

   cursorY = drawLabeledBox(doc, x, cursorY, width, {
      label: "CONSIGNED TO",
      value: consigneeDetails,
      height: 72,
   });

   cursorY = drawLabeledBox(doc, x, cursorY, width, {
      label: "NOTIFY PARTY/INTERMEDIATE CONSIGNEE",
      value: notifyParty,
      height: 26,
   });

   cursorY = drawTableRow(doc, x, cursorY, width, 22, [
      { label: "NO. CONTENEDOR", value: "" },
      { label: "PORT OF LOADING", value: "", fontSize: 7, font: FONTS.MEDIUM },
      { label: "PORT OF DISCHARGE", value: "", fontSize: 7, font: FONTS.MEDIUM },
   ]);

   cursorY = drawCargoTable(doc, x, cursorY, width, {
      marksAndNumbers: hblNumber,
      packageCount: packageCount.toString(),
      commodities: uppercase(item.description),
      grossWeight: `${weightKg} KG`,
      volume: `${volume?.toFixed ? volume.toFixed(2) : Number(volume).toFixed(2)} M3`,
   });

   cursorY = drawLabeledBox(doc, x, cursorY, width, {
      label: "ABOVE PARTICULARS AS DECLARED BY SHIPPER",
      value: "",
      height: 20,
   });

   cursorY = drawInformationRow(doc, x, cursorY, width, [
      { label: "DATE AT", value: issueDate },
      { label: "DATE OF ISSUED", value: issueDate },
      { label: "SIGNED AS AGENT FOR THE CARRIER", value: forwardingAgent },
      { label: "FREIGHT AND CHARGES", value: "AS AGREED" },
      { label: "TYPE OF MOV", value: movementType },
   ]);

   const customsY = Math.min(cursorY + 6, y + height - CUSTOMS_SECTION_HEIGHT - 6);
   drawCustomsSection(doc, x, customsY, width, notifyParty);
};

const drawTableRow = (
   doc: PDFKit.PDFDocument,
   x: number,
   y: number,
   width: number,
   height: number,
   columns: TableColumn[]
): number => {
   doc.lineWidth(LINE_WIDTH);
   doc.save();
   doc.rect(x, y, width, height);
   const columnWidth = width / columns.length;
   for (let index = 1; index < columns.length; index += 1) {
      const columnX = x + columnWidth * index;
      doc.moveTo(columnX, y).lineTo(columnX, y + height);
   }
   doc.stroke();
   doc.restore();

   columns.forEach((column, index) => {
      const columnX = x + columnWidth * index;
      doc.font(FONTS.MEDIUM)
         .fontSize(6)
         .text(column.label, columnX + 4, y + 2, { width: columnWidth - 8, align: column.align ?? "left" });
      doc.font(column.font ?? FONTS.BOLD)
         .fontSize(column.fontSize ?? 8)
         .text(column.value, columnX + 4, y + 10, { width: columnWidth - 8, align: column.align ?? "left" });
   });

   return y + height;
};

const drawLabeledBox = (doc: PDFKit.PDFDocument, x: number, y: number, width: number, options: BoxOptions): number => {
   doc.lineWidth(LINE_WIDTH);
   doc.rect(x, y, width, options.height).stroke();
   doc.font(FONTS.MEDIUM)
      .fontSize(6)
      .text(options.label, x + 4, y + 2, { width: width - 8 });
   if (options.value) {
      doc.font(FONTS.REGULAR)
         .fontSize(8)
         .text(options.value, x + 4, y + 10, { width: width - 8, height: options.height - 12, ellipsis: true });
   }
   return y + options.height;
};

const drawCargoTable = (
   doc: PDFKit.PDFDocument,
   x: number,
   y: number,
   width: number,
   data: {
      marksAndNumbers: string;
      packageCount: string;
      commodities: string;
      grossWeight: string;
      volume: string;
   }
): number => {
   const headerHeight = 22;
   const bodyHeight = 150;

   const columnWidths = [width * 0.32, width * 0.12, width * 0.32, width * 0.12, width * 0.12];

   doc.lineWidth(LINE_WIDTH);
   doc.save();
   doc.rect(x, y, width, headerHeight);
   doc.moveTo(x, y + headerHeight).lineTo(x + width, y + headerHeight);

   let currentX = x;
   columnWidths.forEach((columnWidth) => {
      currentX += columnWidth;
      doc.moveTo(currentX, y).lineTo(currentX, y + headerHeight + bodyHeight);
   });
   doc.rect(x, y, width, headerHeight + bodyHeight);
   doc.stroke();
   doc.restore();

   const headers = ["MARKS AND NUMBERS", "N PACK", "DESCRIPTION OF COMMODITIES", "GW (KG)", "M (M3)"];
   currentX = x;
   headers.forEach((header, index) => {
      doc.font(FONTS.MEDIUM)
         .fontSize(7)
         .text(header, currentX + 4, y + 4, { width: columnWidths[index] - 8, align: "left" });
      currentX += columnWidths[index];
   });

   currentX = x;
   const bodyValues = [data.marksAndNumbers, data.packageCount, data.commodities, data.grossWeight, data.volume];
   const bodyStyles: Array<{ font: string; fontSize: number; align: "left" | "center" | "right" | "justify" }> = [
      { font: FONTS.MEDIUM, fontSize: 7, align: "left" },
      { font: FONTS.MEDIUM, fontSize: 7, align: "center" },
      { font: FONTS.MEDIUM, fontSize: 7, align: "left" },
      { font: FONTS.MEDIUM, fontSize: 7, align: "center" },
      { font: FONTS.MEDIUM, fontSize: 7, align: "center" },
   ];

   bodyValues.forEach((value, index) => {
      const { font, fontSize, align } = bodyStyles[index];
      doc.font(font)
         .fontSize(fontSize)
         .text(value, currentX + 4, y + headerHeight + 10, { width: columnWidths[index] - 8, align });
      currentX += columnWidths[index];
   });

   return y + headerHeight + bodyHeight;
};

const drawInformationRow = (
   doc: PDFKit.PDFDocument,
   x: number,
   y: number,
   width: number,
   columns: TableColumn[]
): number => {
   const height = 45;
   doc.lineWidth(LINE_WIDTH);
   doc.save();
   doc.rect(x, y, width, height);
   const columnWidth = width / columns.length;
   for (let index = 1; index < columns.length; index += 1) {
      const columnX = x + columnWidth * index;
      doc.moveTo(columnX, y).lineTo(columnX, y + height);
   }
   doc.stroke();
   doc.restore();

   columns.forEach((column, index) => {
      const columnX = x + columnWidth * index;
      doc.font(FONTS.NORMAL)
         .fontSize(6)
         .text(column.label, columnX + 4, y + 4, { width: columnWidth - 8, align: "left" });
      doc.font(column.font ?? FONTS.NORMAL)
         .fontSize(column.fontSize ?? 6)
         .text(column.value, columnX + 4, y + 20, {
            width: columnWidth - 8,
            align: column.align ?? "left",
         });
   });

   return y + height;
};

const drawCustomsSection = (
   doc: PDFKit.PDFDocument,
   x: number,
   y: number,
   width: number,
   notifyParty: string
): void => {
   doc.font(FONTS.MEDIUM)
      .fontSize(7)
      .text("SOLO PARA USO DE LA ADUANA", x + 4, y + 50);

   doc.font(FONTS.MEDIUM)
      .fontSize(6)
      .text(`${uppercase(notifyParty)}`, x + 4, y + 40);

   doc.font(FONTS.REGULAR)
      .fontSize(6)
      .text("NOMBRE", x + 120, y + 40);
   doc.font(FONTS.REGULAR)
      .fontSize(6)
      .text("BUQUE:", x + width / 2, y + 40);
   doc.font(FONTS.REGULAR)
      .fontSize(6)
      .text("MANIFIESTO:", x + width / 2 + 120, y + 40);
};
