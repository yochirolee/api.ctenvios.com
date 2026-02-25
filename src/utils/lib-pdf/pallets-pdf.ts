import { PDF, rgb } from "@libpdf/core";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

export interface PalletLabelData {
   pallet_id: number;
   parcels_count: number;
   created_at: Date;
   total_weight_lbs: number;
   agency_name: string;
   created_by_name: string;
}

const PAGE_WIDTH = 4 * 72; // 4 inches
const PAGE_HEIGHT = 6 * 72; // 6 inches
const MARGIN = 18;
const COLORS = {
   BLACK: rgb(0, 0, 0),
   WHITE: rgb(1, 1, 1),
};

const formatDate = (date: Date): string => {
   return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
   });
};

const clampText = (value: string, max: number): string => {
   if (value.length <= max) return value;
   return `${value.slice(0, max - 1)}...`;
};

const drawCenteredText = (
   page: ReturnType<PDF["addPage"]>,
   text: string,
   boxX: number,
   boxY: number,
   boxWidth: number,
   size: number
): void => {
   const estimatedWidth = text.length * size * 0.52;
   const x = Math.max(boxX, boxX + (boxWidth - estimatedWidth) / 2);
   page.drawText(text, { x, y: boxY, size, color: COLORS.BLACK });
};

export const generatePalletLabelPdf = async (data: PalletLabelData): Promise<Buffer> => {
   const pdf = PDF.create();
   const page = pdf.addPage({ width: PAGE_WIDTH, height: PAGE_HEIGHT });

   const contentWidth = PAGE_WIDTH - MARGIN * 2;
   const frameX = MARGIN - 8;
   const frameY = MARGIN - 8;
   const frameW = contentWidth + 16;
   const frameH = PAGE_HEIGHT - (MARGIN - 8) * 2;
   const topY = frameY + frameH;

   // Outer frame
   page.drawRectangle({
      x: frameX,
      y: frameY,
      width: frameW,
      height: frameH,
      borderColor: COLORS.BLACK,
      borderWidth: 1,
   });

   // Header
   const headerH = 28;
   page.drawRectangle({
      x: frameX,
      y: topY - headerH,
      width: frameW,
      height: headerH,
      borderColor: COLORS.BLACK,
      borderWidth: 1,
   });
   page.drawText("PALLET LABEL", {
      x: MARGIN,
      y: topY - headerH + 7,
      size: 15,
      color: COLORS.BLACK,
   });
   const headerDate = formatDate(data.created_at);
   const headerDateSize = 12;
   const headerDateWidth = headerDate.length * (headerDateSize * 0.52);
   page.drawText(headerDate, {
      x: PAGE_WIDTH - MARGIN - headerDateWidth,
      y: topY - headerH + 9,
      size: headerDateSize,
      color: COLORS.BLACK,
   });

   // Main ID block
   const idLabelY = topY - headerH - 18;
   page.drawText("Pallet ID", {
      x: MARGIN,
      y: idLabelY,
      size: 12,
      color: COLORS.BLACK,
   });
   const palletIdText = String(data.pallet_id);
   const palletIdFontSize = 90;
   const estimatedIdWidth = palletIdText.length * (palletIdFontSize * 0.56);
   const centeredIdX = Math.max(MARGIN, MARGIN + (contentWidth - estimatedIdWidth) / 2);
   page.drawText(palletIdText, {
      x: centeredIdX,
      y: idLabelY - 95,
      size: palletIdFontSize,
      color: COLORS.BLACK,
   });

   // Metrics block (centered text + clear hierarchy)
   const metricsY = 188;
   const colWidth = contentWidth / 2;
   const labelY = metricsY + 33;
   const valueY = metricsY + 10;
   drawCenteredText(page, "Parcels", MARGIN, labelY, colWidth, 11);
    drawCenteredText(page, "Weight (lbs)", MARGIN + colWidth, labelY, colWidth, 11);
   drawCenteredText(page, String(data.parcels_count), MARGIN, valueY, colWidth, 22);
   drawCenteredText(page, data.total_weight_lbs.toFixed(2), MARGIN + colWidth, valueY, colWidth, 22);

   // Agency / creator block
   const infoY = 128;
   page.drawRectangle({
      x: MARGIN,
      y: infoY,
      width: contentWidth,
      height: 50,
      borderColor: COLORS.BLACK,
      borderWidth: 1,
   });
   page.drawLine({
      start: { x: MARGIN, y: infoY + 25 },
      end: { x: MARGIN + contentWidth, y: infoY + 25 },
      thickness: 1,
      color: COLORS.BLACK,
   });
   page.drawText(`Agency: ${clampText(data.agency_name, 34)}`, {
      x: MARGIN + 4,
      y: infoY + 32,
      size: 12,
      color: COLORS.BLACK,
   });
   page.drawText(`Created by: ${clampText(data.created_by_name, 28)}`, {
      x: MARGIN + 4,
      y: infoY + 8,
      size: 12,
      color: COLORS.BLACK,
   });

   // QR with pallet id
   const qrPng = await QRCode.toBuffer(String(data.pallet_id), {
      type: "png",
      margin: 1,
      width: 96,
   });
   const qrImage = pdf.embedPng(new Uint8Array(qrPng));
   const qrSize = 72;
   const qrX = PAGE_WIDTH - MARGIN - qrSize;
   const qrY = MARGIN + 10;
   page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
   });

   // Barcode with pallet id
   const barcodePng = await bwipjs.toBuffer({
      bcid: "code128",
      text: String(data.pallet_id),
      scale: 2,
      height: 10,
      includetext: false,
      backgroundcolor: "FFFFFF",
   });
   const barcodeImage = pdf.embedPng(new Uint8Array(barcodePng));
   const barcodeX = MARGIN;
   const barcodeY = qrY;
   const qrGap = 22;
   const barcodeW = contentWidth - qrSize - qrGap;
   const barcodeH = qrSize;
   page.drawImage(barcodeImage, {
      x: barcodeX,
      y: barcodeY,
      width: barcodeW,
      height: barcodeH,
   });

   const bytes = await pdf.save();
   return Buffer.from(bytes);
};
