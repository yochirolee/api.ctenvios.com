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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHblPdf = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const capitalize_1 = require("../capitalize");
const pdf_fonts_1 = require("./pdf-fonts");
const utils_1 = require("../utils");
const LOGO_PATH = path.join(process.cwd(), "assets", "ctelogo.png");
const COLUMN_GAP = 8;
const PAGE_MARGIN = 12;
const LINE_WIDTH = 0.1;
const CUSTOMS_SECTION_HEIGHT = 60;
const poundsToKilograms = (weight) => {
    if (!weight) {
        return "0.00";
    }
    const kilograms = weight / 2.20462;
    return kilograms.toFixed(2);
};
const formatDate = (value) => {
    const safeDate = value instanceof Date ? value : new Date(value);
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};
const uppercase = (value) => (value ? value.toUpperCase() : "");
const drawImageIfExists = (doc, imagePath, x, y, options = {}) => {
    if (fs.existsSync(imagePath)) {
        doc.image(imagePath, x, y, options);
    }
};
const generateHblPdf = (order) => {
    const doc = new pdfkit_1.default({
        size: "LETTER",
        layout: "landscape",
        margin: PAGE_MARGIN,
    });
    (0, pdf_fonts_1.registerPdfFonts)(doc);
    return new Promise((resolve, reject) => {
        try {
            order.order_items.forEach((item, index) => {
                if (index > 0) {
                    doc.addPage();
                }
                drawHblPage(doc, order, item);
            });
            resolve(doc);
        }
        catch (error) {
            reject(error);
        }
    });
};
exports.generateHblPdf = generateHblPdf;
const drawHblPage = (doc, order, item) => {
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
const drawHblSection = (doc, order, item, x, y, width, height) => {
    var _a, _b, _c, _d;
    const contentPadding = 8;
    const contentX = x + contentPadding;
    const contentWidth = width - contentPadding * 2;
    doc.lineWidth(LINE_WIDTH);
    const shipperName = uppercase((0, capitalize_1.formatName)(order.customer.first_name, order.customer.middle_name, order.customer.last_name, order.customer.second_last_name));
    const consigneeName = uppercase((0, capitalize_1.formatName)(order.receiver.first_name, order.receiver.middle_name, order.receiver.last_name, order.receiver.second_last_name));
    const issueDate = formatDate(order.created_at);
    const hblNumber = uppercase(item.hbl);
    const mblNumber = uppercase("");
    const exportReference = `ORDER #${order.id}`;
    const forwardingAgent = uppercase(order.service.forwarder.name);
    const notifyParty = uppercase(order.service.provider.name);
    const weight = (0, utils_1.toNumber)(item.weight); // weight is Decimal, needs conversion
    const weightKg = poundsToKilograms(weight);
    const volume = (_a = item.volume) !== null && _a !== void 0 ? _a : 0; // volume is Float?, already a number
    const packageCount = (_b = item.quantity) !== null && _b !== void 0 ? _b : 1;
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
        `${uppercase((_c = order.receiver.province) === null || _c === void 0 ? void 0 : _c.name)} / ${uppercase((_d = order.receiver.city) === null || _d === void 0 ? void 0 : _d.name)}`,
    ]
        .filter(Boolean)
        .join("\n");
    doc.rect(x, y, width, height).stroke();
    const logoWidth = 50;
    const logoHeight = 32;
    const logoY = y + 6;
    drawImageIfExists(doc, LOGO_PATH, x + 8, logoY, { width: logoWidth, height: logoHeight });
    let cursorY = y + 8;
    doc.font(pdf_fonts_1.FONTS.BOLD)
        .fontSize(11)
        .text("CARIBE TRAVEL EXPRESS", contentX + logoWidth / 2, cursorY, {
        width: contentWidth - logoWidth / 2,
        align: "center",
    });
    cursorY += 14;
    doc.font(pdf_fonts_1.FONTS.SEMIBOLD)
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
        { label: "FORWARDING AGENT", value: forwardingAgent, fontSize: 7, font: pdf_fonts_1.FONTS.MEDIUM },
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
        { label: "PORT OF LOADING", value: "", fontSize: 7, font: pdf_fonts_1.FONTS.MEDIUM },
        { label: "PORT OF DISCHARGE", value: "", fontSize: 7, font: pdf_fonts_1.FONTS.MEDIUM },
    ]);
    cursorY = drawCargoTable(doc, x, cursorY, width, {
        marksAndNumbers: hblNumber,
        packageCount: packageCount.toString(),
        commodities: uppercase(item.description),
        grossWeight: `${weightKg} KG`,
        volume: `${(volume === null || volume === void 0 ? void 0 : volume.toFixed) ? volume.toFixed(2) : Number(volume).toFixed(2)} M3`,
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
const drawTableRow = (doc, x, y, width, height, columns) => {
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
        var _a, _b, _c, _d;
        const columnX = x + columnWidth * index;
        doc.font(pdf_fonts_1.FONTS.MEDIUM)
            .fontSize(6)
            .text(column.label, columnX + 4, y + 2, { width: columnWidth - 8, align: (_a = column.align) !== null && _a !== void 0 ? _a : "left" });
        doc.font((_b = column.font) !== null && _b !== void 0 ? _b : pdf_fonts_1.FONTS.BOLD)
            .fontSize((_c = column.fontSize) !== null && _c !== void 0 ? _c : 8)
            .text(column.value, columnX + 4, y + 10, { width: columnWidth - 8, align: (_d = column.align) !== null && _d !== void 0 ? _d : "left" });
    });
    return y + height;
};
const drawLabeledBox = (doc, x, y, width, options) => {
    doc.lineWidth(LINE_WIDTH);
    doc.rect(x, y, width, options.height).stroke();
    doc.font(pdf_fonts_1.FONTS.MEDIUM)
        .fontSize(6)
        .text(options.label, x + 4, y + 2, { width: width - 8 });
    if (options.value) {
        doc.font(pdf_fonts_1.FONTS.REGULAR)
            .fontSize(8)
            .text(options.value, x + 4, y + 10, { width: width - 8, height: options.height - 12, ellipsis: true });
    }
    return y + options.height;
};
const drawCargoTable = (doc, x, y, width, data) => {
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
        doc.font(pdf_fonts_1.FONTS.MEDIUM)
            .fontSize(7)
            .text(header, currentX + 4, y + 4, { width: columnWidths[index] - 8, align: "left" });
        currentX += columnWidths[index];
    });
    currentX = x;
    const bodyValues = [data.marksAndNumbers, data.packageCount, data.commodities, data.grossWeight, data.volume];
    const bodyStyles = [
        { font: pdf_fonts_1.FONTS.MEDIUM, fontSize: 7, align: "left" },
        { font: pdf_fonts_1.FONTS.MEDIUM, fontSize: 7, align: "center" },
        { font: pdf_fonts_1.FONTS.MEDIUM, fontSize: 7, align: "left" },
        { font: pdf_fonts_1.FONTS.MEDIUM, fontSize: 7, align: "center" },
        { font: pdf_fonts_1.FONTS.MEDIUM, fontSize: 7, align: "center" },
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
const drawInformationRow = (doc, x, y, width, columns) => {
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
        var _a, _b, _c;
        const columnX = x + columnWidth * index;
        doc.font(pdf_fonts_1.FONTS.NORMAL)
            .fontSize(6)
            .text(column.label, columnX + 4, y + 4, { width: columnWidth - 8, align: "left" });
        doc.font((_a = column.font) !== null && _a !== void 0 ? _a : pdf_fonts_1.FONTS.NORMAL)
            .fontSize((_b = column.fontSize) !== null && _b !== void 0 ? _b : 6)
            .text(column.value, columnX + 4, y + 20, {
            width: columnWidth - 8,
            align: (_c = column.align) !== null && _c !== void 0 ? _c : "left",
        });
    });
    return y + height;
};
const drawCustomsSection = (doc, x, y, width, notifyParty) => {
    doc.font(pdf_fonts_1.FONTS.MEDIUM)
        .fontSize(7)
        .text("SOLO PARA USO DE LA ADUANA", x + 4, y + 50);
    doc.font(pdf_fonts_1.FONTS.MEDIUM)
        .fontSize(6)
        .text(`${uppercase(notifyParty)}`, x + 4, y + 40);
    doc.font(pdf_fonts_1.FONTS.REGULAR)
        .fontSize(6)
        .text("NOMBRE", x + 120, y + 40);
    doc.font(pdf_fonts_1.FONTS.REGULAR)
        .fontSize(6)
        .text("BUQUE:", x + width / 2, y + 40);
    doc.font(pdf_fonts_1.FONTS.REGULAR)
        .fontSize(6)
        .text("MANIFIESTO:", x + width / 2 + 120, y + 40);
};
