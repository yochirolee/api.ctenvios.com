"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.generateOrderPDF = void 0;
exports.clearOrderPdfCaches = clearOrderPdfCaches;
const pdfkit_1 = __importDefault(require("pdfkit"));
const bwipjs = __importStar(require("bwip-js"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const capitalize_1 = require("./capitalize");
const utils_1 = require("./utils");
// Pre-calculate all financial totals
function calculateOrderTotals(order) {
    const subtotal_in_cents = order.order_items.reduce((acc, item) => {
        const weight = (0, utils_1.toNumber)(item.weight); // weight is Decimal, needs conversion
        return (acc +
            (0, utils_1.calculate_row_subtotal)(item.price_in_cents, // Int - already a number
            weight, item.customs_fee_in_cents, // Int - already a number
            item.charge_fee_in_cents || 0, // Int? - already a number
            item.insurance_fee_in_cents || 0, // Int? - already a number
            item.unit));
    }, 0);
    const total_delivery_fee_in_cents = order.order_items.reduce((acc, item) => {
        return acc + (item.delivery_fee_in_cents || 0); // Int? - already a number
    }, 0);
    const total_insurance_in_cents = order.order_items.reduce((acc, item) => {
        return acc + (item.insurance_fee_in_cents || 0); // Int? - already a number
    }, 0);
    const items_charge_in_cents = order.order_items.reduce((acc, item) => {
        return acc + (item.charge_fee_in_cents || 0); // Int? - already a number
    }, 0);
    const payments_charge_in_cents = order.payments.reduce((acc, payment) => {
        return acc + (payment.charge_in_cents || 0); // Int? - already a number
    }, 0);
    const discount_in_cents = order.discounts.reduce((acc, discount) => {
        return acc + (discount.discount_in_cents || 0); // Int? - already a number
    }, 0);
    const discount_amount = (0, utils_1.formatCents)(discount_in_cents);
    const items_fee_amount = (0, utils_1.formatCents)(items_charge_in_cents);
    const payments_fee_amount = (0, utils_1.formatCents)(payments_charge_in_cents);
    const subtotal = (0, utils_1.formatCents)(subtotal_in_cents);
    const totalWeight = order.order_items.reduce((acc, item) => {
        return acc + (0, utils_1.toNumber)(item.weight); // weight is Decimal, needs conversion
    }, 0);
    const insuranceAmount = (0, utils_1.formatCents)(total_insurance_in_cents);
    const deliveryFeeAmount = (0, utils_1.formatCents)(total_delivery_fee_in_cents);
    const paidAmount = (0, utils_1.formatCents)(order.paid_in_cents);
    const totalAmount = (0, utils_1.formatCents)(order.total_in_cents);
    const balance = (0, utils_1.formatCents)(order.total_in_cents - order.paid_in_cents);
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
        discount_amount,
    };
}
// Cache for logos and barcodes to avoid regeneration
const logoCache = new Map();
const barcodeCache = new Map();
// Font paths
const FONT_PATHS = {
    REGULAR: path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf"),
    MEDIUM: path.join(process.cwd(), "assets", "fonts", "Inter-Medium.ttf"),
    SEMIBOLD: path.join(process.cwd(), "assets", "fonts", "Inter-SemiBold.ttf"),
    BOLD: path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf"),
};
// Font names (after registration)
const FONTS = {
    REGULAR: "Inter-Regular",
    MEDIUM: "Inter-Medium",
    SEMIBOLD: "Inter-SemiBold",
    BOLD: "Inter-Bold",
    NORMAL: "Inter-Regular", // Alias for compatibility
};
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
};
const ASSETS_PATH = path.join(process.cwd(), "assets");
const DEFAULT_LOGO_FILENAME = "ctelogo.png";
const LAYOUT = {
    PAGE_HEIGHT: 792,
    PAGE_WIDTH: 612,
    BOTTOM_MARGIN: 80,
    LEFT_MARGIN: 0,
    RIGHT_MARGIN: 612,
    FOOTER_Y: 730,
};
// Register custom fonts with PDFKit
function registerCustomFonts(doc) {
    try {
        doc.registerFont(FONTS.REGULAR, FONT_PATHS.REGULAR);
        doc.registerFont(FONTS.MEDIUM, FONT_PATHS.MEDIUM);
        doc.registerFont(FONTS.SEMIBOLD, FONT_PATHS.SEMIBOLD);
        doc.registerFont(FONTS.BOLD, FONT_PATHS.BOLD);
    }
    catch (error) {
        console.warn("Failed to register custom fonts, falling back to Helvetica:", error);
    }
}
const generateOrderPDF = (order) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const doc = new pdfkit_1.default({ margin: 0, size: "letter" });
        registerCustomFonts(doc);
        yield generateModernOrder(doc, order);
        return doc;
    }
    catch (error) {
        throw new Error(`Order PDF generation failed: ${error}`);
    }
});
exports.generateOrderPDF = generateOrderPDF;
function generateModernOrder(doc, order) {
    return __awaiter(this, void 0, void 0, function* () {
        // Pre-load assets
        const [logoBuffer, barcodeBuffer] = yield Promise.all([loadLogo(), generateBarcode(order.id)]);
        // Pre-calculate values
        const calculations = calculateOrderTotals(order);
        const formattedData = formatOrderData(order);
        // Generate first page with header and sections
        let currentY = yield generateModernHeader(doc, order, logoBuffer, formattedData);
        currentY = yield generateBarcodeSection(doc, order, barcodeBuffer, calculations, currentY);
        currentY = generateContactGrid(doc, order, formattedData, currentY);
        // Generate items table with pagination
        const result = yield generateModernTable(doc, order, calculations, currentY, logoBuffer, barcodeBuffer, formattedData);
        const totalPages = result.totalPages;
        // Add footer to all pages
        addModernFooterToAllPages(doc, order, totalPages);
    });
}
// Optimized asset loading with caching
function loadLogo(logoUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const source = (logoUrl === null || logoUrl === void 0 ? void 0 : logoUrl.trim()) || DEFAULT_LOGO_FILENAME;
        const cacheKey = source;
        if (logoCache.has(cacheKey)) {
            return logoCache.get(cacheKey);
        }
        try {
            let logoBuffer;
            if (source.startsWith("http://") || source.startsWith("https://")) {
                const response = yield fetch(source);
                if (!response.ok) {
                    throw new Error(`Failed to fetch logo from URL: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = yield response.arrayBuffer();
                logoBuffer = Buffer.from(arrayBuffer);
            }
            else {
                const logoPath = path.isAbsolute(source) ? source : path.join(ASSETS_PATH, source);
                logoBuffer = yield fs_1.promises.readFile(logoPath);
            }
            logoCache.set(cacheKey, logoBuffer);
            return logoBuffer;
        }
        catch (error) {
            console.log(`Logo ${source} could not be loaded:`, error);
            if (source !== DEFAULT_LOGO_FILENAME) {
                return loadLogo(DEFAULT_LOGO_FILENAME);
            }
            return null;
        }
    });
}
function generateBarcode(orderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const cacheKey = String(orderId);
        if (barcodeCache.has(cacheKey)) {
            return barcodeCache.get(cacheKey);
        }
        try {
            const barcodeBuffer = yield bwipjs.toBuffer({
                bcid: "code128",
                text: cacheKey,
                scale: 3,
                height: 10,
                includetext: false,
                textxalign: "center",
            });
            barcodeCache.set(cacheKey, barcodeBuffer);
            return barcodeBuffer;
        }
        catch (error) {
            console.log("Barcode generation failed:", error);
            return null;
        }
    });
}
// Pre-format all string data
function formatOrderData(order) {
    var _a, _b;
    const senderName = (0, capitalize_1.formatName)(order.customer.first_name, order.customer.middle_name, order.customer.last_name, order.customer.second_last_name, 30);
    const recipientName = (0, capitalize_1.formatName)(order.receiver.first_name, order.receiver.middle_name, order.receiver.last_name, order.receiver.second_last_name, 30);
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
    const location = `${((_a = order.receiver.city) === null || _a === void 0 ? void 0 : _a.name) || ""} ${((_b = order.receiver.province) === null || _b === void 0 ? void 0 : _b.name) || ""}`.trim();
    const fullAddress = location ? `${order.receiver.address}, ${location}` : order.receiver.address;
    const totalWeightValue = order.order_items.reduce((acc, item) => acc + (0, utils_1.toNumber)(item.weight), 0);
    const roundedWeight = Math.round(totalWeightValue * 100) / 100;
    const totalWeightLabel = `${roundedWeight.toFixed(2)} lbs`;
    const itemsCount = `${order.order_items.length}`;
    return {
        senderName,
        recipientName,
        formattedDate,
        fullAddress,
        totalWeightLabel,
        itemsCount,
    };
}
function generateModernHeader(doc, order, logoBuffer, formattedData) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const textStyle = new TextStyler(doc);
        const headerHeight = 90;
        // Logo section (no blue background)
        let logoX = 20;
        let logoY = 20;
        if (logoBuffer) {
            // Draw light border around logo
            doc.image(logoBuffer, logoX, logoY + 6, { width: 48, height: 36 });
        }
        else {
            // Draw placeholder with light background and border
            const companyInitial = ((_a = order.agency.name) === null || _a === void 0 ? void 0 : _a.charAt(0).toUpperCase()) || "";
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
    });
}
function generateBarcodeSection(doc, order, barcodeBuffer, calculations, startY) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
function generateContactGrid(doc, order, formattedData, startY) {
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
        const phoneText = `Tel: ${order.receiver.mobile || ""}${order.receiver.mobile && order.receiver.phone ? " - " : ""}${order.receiver.phone || ""}`;
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
function generateModernTable(doc, order, calculations, startY, logoBuffer, barcodeBuffer, formattedData) {
    return __awaiter(this, void 0, void 0, function* () {
        let currentY = startY + 35;
        let currentPage = 1;
        const textStyle = new TextStyler(doc);
        // Process items
        const processedItems = order.order_items.map((item, index) => {
            const weight = (0, utils_1.toNumber)(item.weight); // weight is Decimal, needs conversion
            return Object.assign(Object.assign({}, item), { hbl: item.hbl || `CTE${String(order.id).padStart(6, "0")}${String(index + 1).padStart(6, "0")}`, subtotal_in_cents: (0, utils_1.calculate_row_subtotal)(item.price_in_cents, // Int - already a number
                weight, item.customs_fee_in_cents, // Int - already a number
                item.charge_fee_in_cents || 0, // Int? - already a number
                item.insurance_fee_in_cents || 0, // Int? - already a number
                item.unit) });
        });
        const addNewPageWithHeader = (...args_1) => __awaiter(this, [...args_1], void 0, function* (includeTableHeaders = true) {
            doc.addPage({ margin: 0 });
            currentPage++;
            // Only show header (no barcode section on continuation pages)
            let newY = yield generateModernHeader(doc, order, logoBuffer, formattedData);
            newY += 20; // Add spacing after header
            // Only add table headers if needed (when there are items to render)
            if (includeTableHeaders) {
                newY = addModernTableHeaders(doc, newY, textStyle);
            }
            return newY;
        });
        // Add table headers
        currentY = addModernTableHeaders(doc, currentY, textStyle);
        // Calculate column positions (same as in renderModernTableRow)
        const rightMargin = LAYOUT.PAGE_WIDTH - 20;
        const columnGap = 5;
        const subtotalWidth = 55;
        const pesoWidth = 40;
        const precioWidth = 35;
        const arancelWidth = 35;
        const cargoWidth = 35;
        const seguroWidth = 35;
        const subtotalX = rightMargin - subtotalWidth;
        const pesoX = subtotalX - columnGap - pesoWidth;
        const precioX = pesoX - columnGap - precioWidth;
        const arancelX = precioX - columnGap - arancelWidth;
        const cargoX = arancelX - columnGap - cargoWidth;
        const seguroX = cargoX - columnGap - seguroWidth;
        const descriptionX = 105;
        const descriptionWidth = seguroX - descriptionX - columnGap;
        // Render items
        for (const item of processedItems) {
            // Set font style for accurate height measurement
            doc.font(FONTS.REGULAR).fontSize(9);
            // Trim description if it exceeds 3 lines
            const maxHeight = 33; // Based on font size 9pt, ~11pt per line = 33pt for 3 lines
            let description = item.description;
            let descriptionHeight = doc.heightOfString(description, { width: descriptionWidth });
            // If description exceeds 3 lines, trim it
            if (descriptionHeight > maxHeight) {
                const words = description.split(" ");
                let trimmedDesc = "";
                for (let i = 0; i < words.length; i++) {
                    const testDesc = trimmedDesc + (trimmedDesc ? " " : "") + words[i];
                    const testHeight = doc.heightOfString(testDesc + "...", { width: descriptionWidth });
                    if (testHeight > maxHeight) {
                        break;
                    }
                    trimmedDesc = testDesc;
                }
                description = trimmedDesc + "...";
                descriptionHeight = doc.heightOfString(description, { width: descriptionWidth });
            }
            const rowHeight = Math.max(20, descriptionHeight + 12);
            // Check page break
            if (currentY + rowHeight > LAYOUT.PAGE_HEIGHT - LAYOUT.BOTTOM_MARGIN) {
                currentY = yield addNewPageWithHeader(true); // Include headers for item continuation
            }
            renderModernTableRow(doc, Object.assign(Object.assign({}, item), { description }), currentY, rowHeight, textStyle);
            currentY += rowHeight;
        }
        // Check if we need space for totals
        if (currentY + 200 > LAYOUT.PAGE_HEIGHT - LAYOUT.BOTTOM_MARGIN) {
            currentY = yield addNewPageWithHeader(false); // No headers needed, only totals
        }
        // Add totals section
        renderModernTotals(doc, calculations, currentY + 30, textStyle);
        return { totalPages: currentPage };
    });
}
function addModernTableHeaders(doc, y, textStyle) {
    const headerY = y + 10;
    // Calculate positions from right edge (PAGE_WIDTH - 20 = right margin)
    const rightMargin = LAYOUT.PAGE_WIDTH - 20;
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
    const headers = [
        { text: "HBL", x: 20, width: 90, align: "left" },
        { text: "Descripción", x: 105, width: seguroX - 105 - columnGap, align: "left" },
        { text: "Seguro", x: seguroX, width: seguroWidth, align: "right" },
        { text: "Cargo", x: cargoX, width: cargoWidth, align: "right" },
        { text: "Arancel", x: arancelX, width: arancelWidth, align: "right" },
        { text: "Precio", x: precioX, width: precioWidth, align: "right" },
        { text: "Peso", x: pesoX, width: pesoWidth, align: "right" },
        { text: "Subtotal", x: subtotalX, width: subtotalWidth, align: "right" },
    ];
    // Explicitly reset font to ensure consistent header styling across all pages
    doc.font(FONTS.SEMIBOLD).fontSize(8).fillColor(COLORS.MUTED_FOREGROUND);
    textStyle.style(FONTS.SEMIBOLD, 7, COLORS.MUTED_FOREGROUND);
    headers.forEach((header) => {
        textStyle.text(header.text.charAt(0).toUpperCase() + header.text.slice(1).toLowerCase(), header.x, headerY, {
            width: header.width,
            align: header.align,
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
function renderModernTableRow(doc, item, currentY, rowHeight, textStyle) {
    const verticalCenter = currentY + rowHeight / 2.5 - 3;
    // Calculate positions from right edge (same as headers)
    const rightMargin = LAYOUT.PAGE_WIDTH - 20;
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
    // HBL (monospace style)
    textStyle.style(FONTS.REGULAR, 8, COLORS.FOREGROUND).text(item.hbl, 20, verticalCenter, { width: 100 });
    // Description
    textStyle
        .style(FONTS.REGULAR, 8, COLORS.FOREGROUND)
        .text(item.description, descriptionX, verticalCenter, { width: descriptionWidth });
    // Seguro
    const insuranceColor = (item.insurance_fee_in_cents || 0) === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
    textStyle
        .style(FONTS.REGULAR, 7, insuranceColor)
        .text(`${(0, utils_1.formatCents)(item.insurance_fee_in_cents || 0)}`, seguroX, verticalCenter, {
        width: seguroWidth,
        align: "right",
    });
    // Cargo
    const chargeColor = (item.charge_fee_in_cents || 0) === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
    textStyle
        .style(FONTS.REGULAR, 7, chargeColor)
        .text(`${(0, utils_1.formatCents)(item.charge_fee_in_cents || 0)}`, cargoX, verticalCenter, {
        width: cargoWidth,
        align: "right",
    });
    // Arancel
    const customsColor = (item.customs_fee_in_cents || 0) === 0 ? COLORS.MUTED_FOREGROUND : COLORS.FOREGROUND;
    textStyle
        .style(FONTS.REGULAR, 7, customsColor)
        .text(`${(0, utils_1.formatCents)(item.customs_fee_in_cents || 0)}`, arancelX, verticalCenter, {
        width: arancelWidth,
        align: "right",
    });
    // Precio
    textStyle
        .style(FONTS.REGULAR, 7, COLORS.FOREGROUND)
        .text(`${(0, utils_1.formatCents)(item.price_in_cents || 0)}`, precioX, verticalCenter, {
        width: precioWidth,
        align: "right",
    });
    // Peso
    textStyle.style(FONTS.REGULAR, 7, COLORS.FOREGROUND).text(`${item.weight.toFixed(2)}`, pesoX, verticalCenter, {
        width: pesoWidth,
        align: "right",
    });
    // Subtotal
    textStyle
        .style(FONTS.REGULAR, 7, COLORS.FOREGROUND)
        .text(`${(0, utils_1.formatCents)(item.subtotal_in_cents)}`, subtotalX, verticalCenter, {
        width: subtotalWidth,
        align: "right",
    });
    // Row border
    doc.strokeColor(COLORS.BORDER)
        .lineWidth(0.5)
        .moveTo(20, currentY + rowHeight)
        .lineTo(LAYOUT.PAGE_WIDTH - 20, currentY + rowHeight)
        .stroke();
}
function renderModernTotals(doc, calculations, startY, textStyle) {
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
        { label: "Descuento:", value: calculations.discount_amount, size: 9, color: COLORS.MUTED_FOREGROUND },
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
function addModernFooterToAllPages(doc, order, totalPages) {
    const range = doc.bufferedPageRange();
    const textStyle = new TextStyler(doc);
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Legal disclaimer
        textStyle
            .style(FONTS.REGULAR, 6, COLORS.MUTED_FOREGROUND)
            .text("Al realizar este envío, declaro que soy responsable de toda la información proporcionada y que el contenido enviado no infringe las leyes de los Estados Unidos ni las regulaciones aduanales de la República de Cuba. También declaro estar de acuerdo con los términos y condiciones de la empresa.", 20, LAYOUT.FOOTER_Y, { width: LAYOUT.PAGE_WIDTH - 40, align: "center", lineGap: 1 });
        // Terms and Tracking (centered)
        textStyle
            .style(FONTS.REGULAR, 7, "#0d4fa3")
            .text("Términos: https://ctenvios.com/terms  |  Tracking: https://ctenvios.com/tracking", 20, LAYOUT.FOOTER_Y + 20, {
            align: "center",
            width: LAYOUT.PAGE_WIDTH - 40,
            underline: true,
        });
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
    constructor(doc) {
        this.doc = doc;
    }
    style(font, size, color) {
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
    text(text, x, y, options) {
        this.doc.text(text, x, y, options);
        return this;
    }
}
// Utility function to clear caches periodically
function clearOrderPdfCaches() {
    logoCache.clear();
    barcodeCache.clear();
}
