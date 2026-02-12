"use strict";
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
exports.generateBulkCTEnviosLabels = exports.generateCTEnviosLabels = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const client_1 = require("@prisma/client");
const bwip_js_1 = __importDefault(require("bwip-js"));
const qrcode_1 = __importDefault(require("qrcode"));
const capitalize_1 = require("../capitalize");
const pdf_fonts_1 = require("./pdf-fonts");
const utils_1 = require("../utils");
const generateCTEnviosLabels = (order) => {
    // 4x6 inch labels (288x432 points at 72 DPI)
    const labelWidth = 288; // 4 inches * 72 points/inch
    const labelHeight = 432; // 6 inches * 72 points/inch
    const doc = new pdfkit_1.default({
        size: [labelWidth, labelHeight],
        margin: 10,
    });
    // Register custom fonts
    (0, pdf_fonts_1.registerPdfFonts)(doc);
    // Check if order is deleted
    const isDeleted = !!order.deleted_at;
    // Generate two labels per item (main label + province/city label)
    return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            for (let i = 0; i < order.order_items.length; i++) {
                if (i > 0) {
                    doc.addPage(); // New page for each main label
                }
                // Generate main label
                yield generateCleanCTEnviosLabel(doc, order, order.order_items[i], i, labelWidth, labelHeight);
                // Add cancelled watermark if order is deleted
                if (isDeleted) {
                    addLabelCancelledWatermark(doc, labelWidth, labelHeight);
                }
                // Generate province/city label
                doc.addPage();
                yield generateProvinceLabel(doc, order, order.order_items[i], i, labelWidth, labelHeight);
                // Add cancelled watermark to province label if order is deleted
                if (isDeleted) {
                    addLabelCancelledWatermark(doc, labelWidth, labelHeight);
                }
            }
            resolve(doc);
        }
        catch (error) {
            reject(error);
        }
    }));
};
exports.generateCTEnviosLabels = generateCTEnviosLabels;
// Export internal functions for bulk generation
const generateBulkCTEnviosLabels = (orders) => {
    // 4x6 inch labels (288x432 points at 72 DPI)
    const labelWidth = 288; // 4 inches * 72 points/inch
    const labelHeight = 432; // 6 inches * 72 points/inch
    const doc = new pdfkit_1.default({
        size: [labelWidth, labelHeight],
        margin: 10,
    });
    // Register custom fonts
    (0, pdf_fonts_1.registerPdfFonts)(doc);
    // Generate labels for all invoices using the existing internal functions
    return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            let isFirstLabel = true;
            for (const order of orders) {
                const isDeleted = !!order.deleted_at;
                for (let i = 0; i < order.order_items.length; i++) {
                    if (!isFirstLabel) {
                        doc.addPage(); // New page for each main label
                    }
                    isFirstLabel = false;
                    // Generate main label using existing function
                    yield generateCleanCTEnviosLabel(doc, order, order.order_items[i], i, labelWidth, labelHeight);
                    // Add cancelled watermark if order is deleted
                    if (isDeleted) {
                        addLabelCancelledWatermark(doc, labelWidth, labelHeight);
                    }
                    // Generate province/city label
                    doc.addPage();
                    yield generateProvinceLabel(doc, order, order.order_items[i], i, labelWidth, labelHeight);
                    // Add cancelled watermark to province label if order is deleted
                    if (isDeleted) {
                        addLabelCancelledWatermark(doc, labelWidth, labelHeight);
                    }
                }
            }
            resolve(doc);
        }
        catch (error) {
            reject(error);
        }
    }));
};
exports.generateBulkCTEnviosLabels = generateBulkCTEnviosLabels;
function generateCleanCTEnviosLabel(doc, order, item, itemIndex, labelWidth, labelHeight) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const margin = 10;
        let currentY = 2;
        // Header with transport type letter and barcode
        const barcodeText = item.hbl || `REF${order.id.toString().padStart(8, "0")}${(itemIndex + 1).toString().padStart(3, "0")}`;
        // Large letter for transport type (left side)
        const transportLetter = order.service.service_type === client_1.ServiceType.AIR
            ? "A"
            : order.service.service_type === client_1.ServiceType.MARITIME
                ? "M"
                : "M";
        // Draw border around the letter - aligned left with company name
        doc.rect(margin, currentY + 5, 50, 50).stroke();
        // Center the letter in the square (square is 50x50, font size 34)
        // Adjust Y position to visually center the letter
        doc.fontSize(34)
            .font(pdf_fonts_1.FONTS.BOLD)
            .fillColor("#000000")
            .text(transportLetter, margin, currentY + 10, { width: 50, align: "center" });
        // Company name removed from top section
        // Date moved below Caribe Travel Express
        // TRANSCARGO beside both squares - right aligned
        doc.fontSize(14)
            .font(pdf_fonts_1.FONTS.BOLD)
            .fillColor("#000000")
            .text(`${order.service.provider.name.toUpperCase()}`, margin + 140, currentY + 10, {
            width: labelWidth - margin - 145,
            align: "right",
        });
        // Weight area beside M square
        const weightSquareX = margin + 60; // Right beside M square (M is at margin, width 50, plus 10px gap)
        const weightSquareY = currentY + 5; // Same Y as M square
        const weightSquareWidth = 70; // Increased width to prevent overlap
        // Weight area without border
        // Weight text - lbs above, kg below
        const weight = (0, utils_1.toNumber)(item.weight);
        const weightLbs = `${weight.toFixed(2)} lbs`;
        const weightKg = `${(weight / 2.20462).toFixed(2)} kg`;
        // Pounds on top - left aligned, larger font size
        doc.fontSize(12)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .fillColor("#000000")
            .text(weightLbs, weightSquareX, weightSquareY + 14, {
            width: weightSquareWidth,
            align: "left",
        });
        // Kilograms below - left aligned, larger font size
        doc.fontSize(12)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .fillColor("#000000")
            .text(weightKg, weightSquareX, weightSquareY + 28, {
            width: weightSquareWidth,
            align: "left",
        });
        // Caribe Travel Express beside both squares - right aligned
        doc.fontSize(7)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .fillColor("#000000")
            .text(((_a = order === null || order === void 0 ? void 0 : order.service) === null || _a === void 0 ? void 0 : _a.forwarder.name) || "", margin + 140, currentY + 30, {
            width: labelWidth - margin - 145,
            align: "right",
        });
        // Date below Caribe Travel Express
        doc.fontSize(7)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .fillColor("#000000")
            .text(`${new Date().toISOString().split("T")[0]}`, margin + 140, currentY + 40, {
            width: labelWidth - margin - 145,
            align: "right",
        });
        currentY += 65;
        // Barcode dimensions (declared outside try block for scope access)
        const barcodeWidth = 200; // Expanded barcode for even better scanning
        const barcodeX = margin; // Aligned to the left margin
        // SUPER FAST Barcode - Optimized for maximum reading speed
        try {
            const barcodeBuffer = yield bwip_js_1.default.toBuffer({
                bcid: "code128",
                text: barcodeText,
                scale: 3, // Optimal scale: 0.5mm per bar (industry standard for fastest reading)
                height: 20, // Increased height for better readability (minimum 15mm recommended)
                includetext: false, // Clean appearance, no text duplication
                backgroundcolor: "ffffff", // Pure white background for maximum contrast
                barcolor: "000000", // Pure black bars for maximum contrast
                rotate: "N", // No rotation - fastest processing
                parsefnc: true, // Enable FNC characters for better compatibility
                addontextxoffset: 0, // No addon text offset
                addontextyoffset: 0, // No addon text offset
            });
            doc.image(barcodeBuffer, barcodeX, currentY + 5, {
                width: barcodeWidth,
                height: 40, // Increased height for super fast scanning (minimum 15mm)
            });
        }
        catch (error) {
            console.error("Barcode generation error:", error);
            doc.fontSize(12)
                .font(pdf_fonts_1.FONTS.BOLD)
                .text(`ERROR: ${barcodeText}`, barcodeX, currentY + 20, {
                width: barcodeWidth,
                align: "center",
            });
        }
        // HBL moved to below both barcode and QR
        // QR Code dimensions (declared outside try block for scope access)
        const qrWidth = 40; // Same height as optimized barcode
        const qrHeight = 40; // Same height as optimized barcode
        const qrX = labelWidth - margin - qrWidth; // Aligned to right edge
        const qrY = currentY + 5; // Same Y as barcode
        // SUPER FAST QR Code - Optimized for maximum reading speed
        try {
            const qrData = `${item.hbl || barcodeText}`;
            const QRCode = require("qrcode");
            const qrCodeDataURL = yield QRCode.toDataURL(qrData, {
                width: 200, // High resolution for crisp rendering at 50x50
                margin: 0, // Minimal margin for maximum data space and faster processing
                color: {
                    dark: "#000000", // Pure black for maximum contrast
                    light: "#ffffff", // Pure white for maximum contrast
                },
                errorCorrectionLevel: "L", // Low error correction = faster reading (7% recovery)
                version: undefined, // Auto-select smallest version for fastest processing
                maskPattern: undefined, // Auto-select optimal mask pattern
            });
            const qrBuffer = Buffer.from(qrCodeDataURL.split(",")[1], "base64");
            doc.image(qrBuffer, qrX, qrY, {
                width: qrWidth,
                height: qrHeight,
            });
        }
        catch (error) {
            console.error("QR code generation error:", error);
        }
        // HBL below both barcode and QR (spans across full width)
        doc.fontSize(22)
            .font(pdf_fonts_1.FONTS.BOLD)
            .fillColor("#000000")
            .text(`${item.hbl || barcodeText}`, barcodeX, currentY + 50, {
            width: qrX + qrWidth - barcodeX, // From barcode start to QR end
            align: "center",
        });
        //Description
        currentY += 85;
        doc.fontSize(10)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text(((_b = item.description) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || "", margin, currentY, {
            width: labelWidth - margin * 2,
            height: 45, // Limit height to ~3 lines
            ellipsis: true,
        });
        // Service section with border
        currentY += 50;
        //Sender Info
        const senderInfo = (0, capitalize_1.formatName)(order.customer.first_name, order.customer.middle_name, order.customer.last_name, order.customer.second_last_name, 35 // Max length for label display (includes second_last_name)
        );
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text("Env:", margin + 5, currentY);
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text(senderInfo.toUpperCase(), margin + 35, currentY);
        // Transport type checkboxes
        currentY += 10;
        //Dashed line
        doc.lineWidth(0.1)
            .dash(5, { space: 5 })
            .moveTo(margin + 10, currentY + 5)
            .lineTo(labelWidth - margin * 2 - 10, currentY + 5)
            .stroke()
            .undash();
        currentY += 10;
        const recipientName = (0, capitalize_1.formatName)(order.receiver.first_name, order.receiver.middle_name, order.receiver.last_name, order.receiver.second_last_name, 35 // Max length for label display (includes second_last_name)
        );
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text("Para:", margin + 5, currentY + 5);
        // Smart name formatting with width constraints and font sizing
        const maxNameWidth = labelWidth - margin - 65 - 10;
        const nameUpperCase = recipientName.toUpperCase();
        // Use smaller font for very long names
        const nameFontSize = nameUpperCase.length > 35 ? 8 : 10;
        doc.fontSize(nameFontSize)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(nameUpperCase, margin + 35, currentY + 5, {
            width: maxNameWidth,
            height: 20,
            ellipsis: true,
        });
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text("Tel:", margin + 5, currentY + 20);
        doc.fontSize(10)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(`${order.receiver.mobile || ""}${order.receiver.mobile && order.receiver.phone ? " - " : ""}${order.receiver.phone || ""}`, margin + 35, currentY + 20);
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text("CI:", margin + 5, currentY + 35);
        doc.fontSize(10)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(order.receiver.ci || "", margin + 35, currentY + 35);
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text("Dir:", margin + 5, currentY + 50);
        // Address (regular text)
        doc.fontSize(9)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text(order.receiver.address, margin + 35, currentY + 50, {
            width: labelWidth - margin - 35 - 10,
        });
        // Province and Municipality (bold text) - positioned dynamically after address
        const addressHeight = doc.heightOfString(order.receiver.address, {
            width: labelWidth - margin - 35 - 10,
        });
        doc.fontSize(10)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(`${((_c = order.receiver.province) === null || _c === void 0 ? void 0 : _c.name) || ""} / ${((_d = order.receiver.city) === null || _d === void 0 ? void 0 : _d.name) || ""}`, margin, currentY + 50 + addressHeight + 5, {
            width: labelWidth - margin * 2,
            align: "center",
        });
        // Update currentY to account for dynamic address height plus province/city text
        const provinceCityHeight = doc.heightOfString(`${((_e = order.receiver.province) === null || _e === void 0 ? void 0 : _e.name) || ""} / ${((_f = order.receiver.city) === null || _f === void 0 ? void 0 : _f.name) || ""}`, {
            width: labelWidth - margin * 2,
        });
        currentY += 50 + addressHeight + 5 + provinceCityHeight + 10; // 10 points margin
        // SUPER FAST Footer QR Code - Maximum speed optimization
        try {
            // Optimized data: only essential info for fastest processing
            const qrData = `${item.hbl || `REF${order.id.toString().padStart(8, "0")}${(itemIndex + 1).toString().padStart(3, "0")}`}`;
            const qrCodeDataURL = yield qrcode_1.default.toDataURL(qrData, {
                width: 280, // Very high resolution for ultra-crisp rendering
                margin: 0, // No margin for maximum speed and data space
                color: {
                    dark: "#000000", // Pure black for maximum contrast
                    light: "#ffffff", // Pure white for maximum contrast
                },
                errorCorrectionLevel: "L", // Low error correction (7% recovery) = FASTEST reading
                version: undefined, // Auto-select smallest version for speed
                maskPattern: undefined, // Auto-select optimal mask for speed
            });
            const qrBuffer = Buffer.from(qrCodeDataURL.split(",")[1], "base64");
            // Position QR with safe bottom margin to avoid page overflow
            const qrSize = 80;
            const qrY = labelHeight - qrSize - 25; // Safe margin to prevent overflow
            const qrX = margin + 4; // Left aligned with small offset
            doc.image(qrBuffer, qrX, qrY, {
                width: qrSize,
                height: qrSize,
            });
            // Provider name below QR code
            doc.fontSize(8)
                .font(pdf_fonts_1.FONTS.BOLD)
                .fillColor("#000000")
                .text(order.service.provider.name.toUpperCase(), qrX, qrY + qrSize + 2, {
                width: qrSize,
                align: "center",
            });
        }
        catch (error) {
            console.error("QR code generation error:", error);
            // Enhanced fallback with error handling - positioned at bottom with provider name
            const qrSize = 70;
            const qrY = labelHeight - qrSize - 20; // Same safe margin as main QR
            const qrX = margin + 8;
            // Provider name below fallback QR
            doc.fontSize(8)
                .font(pdf_fonts_1.FONTS.BOLD)
                .fillColor("#000000")
                .text(order.service.provider.name.toUpperCase(), qrX, qrY + qrSize + 2, {
                width: qrSize,
                align: "center",
            });
        }
        // Large tracking number in center - positioned safely within page bounds.
        // Use smaller font for 5+ digit order IDs so they don't wrap and cause an extra page.
        const orderIdStr = String(order.id);
        const orderIdFontSize = orderIdStr.length >= 5 ? 16 : 20;
        const orderIdWidth = 80; // Enough for 5+ digits without wrap
        const orderIdX = labelWidth - 170;
        doc.fontSize(orderIdFontSize)
            .font(pdf_fonts_1.FONTS.BOLD)
            .fillColor("#000000")
            .text(orderIdStr, orderIdX, labelHeight - 40, { width: orderIdWidth, align: "center" });
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text("Factura", orderIdX - 5, labelHeight - 50, { width: orderIdWidth, align: "center" });
        // Pack number
        doc.fontSize(8)
            .font(pdf_fonts_1.FONTS.REGULAR)
            .text("Paquete", labelWidth - 85, labelHeight - 50, { width: 60, align: "center" });
        doc.fontSize(orderIdFontSize)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(`${itemIndex + 1}-${order.order_items.length}`, labelWidth - 85, labelHeight - 40, {
            width: 80,
            align: "center",
        });
    });
}
function addLabelCancelledWatermark(doc, labelWidth, labelHeight) {
    // Save current state
    doc.save();
    // Set watermark properties
    doc.fillColor("#dc2626"); // Red color
    doc.opacity(0.35);
    doc.font(pdf_fonts_1.FONTS.BOLD);
    doc.fontSize(48);
    // Rotate and position watermark diagonally across the label
    const centerX = labelWidth / 2;
    const centerY = labelHeight / 2;
    doc.rotate(-45, { origin: [centerX, centerY] });
    doc.text("ANULADA", centerX - 100, centerY - 20, {
        width: 200,
        align: "center",
    });
    // Restore state
    doc.restore();
}
function generateProvinceLabel(doc, order, item, itemIndex, labelWidth, labelHeight) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const margin = 8;
        let currentY = margin + 50;
        // Province and City (main content - large and centered)
        doc.fontSize(40)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(((_a = order.receiver.province) === null || _a === void 0 ? void 0 : _a.name.toUpperCase()) || "", margin, currentY + 50, {
            width: labelWidth - margin * 2,
            align: "center",
        });
        doc.fontSize(30)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(((_b = order.receiver.city) === null || _b === void 0 ? void 0 : _b.name.toUpperCase()) || "", margin, currentY + 160, {
            width: labelWidth - margin * 2,
            align: "center",
        });
        // Use 2-digit DPA codes (from seed), not database ids
        doc.fontSize(40)
            .font(pdf_fonts_1.FONTS.BOLD)
            .text(`${(_d = (_c = order.receiver.province) === null || _c === void 0 ? void 0 : _c.code) !== null && _d !== void 0 ? _d : ""} - ${(_f = (_e = order.receiver.city) === null || _e === void 0 ? void 0 : _e.code) !== null && _f !== void 0 ? _f : ""}`, margin, labelHeight - 60, {
            width: labelWidth - margin * 2,
            align: "center",
        });
    });
}
