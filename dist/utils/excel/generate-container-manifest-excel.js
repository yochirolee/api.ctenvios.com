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
exports.generateContainerManifestExcel = exports.getContainerManifestData = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const prisma_client_1 = __importDefault(require("../../lib/prisma.client"));
const app_errors_1 = require("../../common/app-errors");
const https_status_codes_1 = __importDefault(require("../../common/https-status-codes"));
// Conversion factor: 1 lb = 0.453592 kg
const LBS_TO_KG = 0.453592;
const convertLbsToKg = (lbs) => {
    return Math.round(lbs * LBS_TO_KG * 100) / 100; // Round to 2 decimal places
};
const buildFullName = (...parts) => {
    const fullName = parts
        .map((part) => part === null || part === void 0 ? void 0 : part.trim())
        .filter((part) => Boolean(part))
        .join(" ");
    return fullName || "N/A";
};
/**
 * Get container manifest data for Excel export
 * - HBLs count = Total OrderItems
 * - Total Packages = Total Parcels (bultos/cajas)
 * - One row per OrderItem
 */
const getContainerManifestData = (containerId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const container = yield prisma_client_1.default.container.findUnique({
        where: { id: containerId },
        include: {
            forwarder: { select: { name: true } },
            provider: { select: { name: true } },
            parcels: {
                include: {
                    order: {
                        include: {
                            customer: {
                                select: {
                                    first_name: true,
                                    middle_name: true,
                                    last_name: true,
                                    second_last_name: true,
                                    mobile: true,
                                    email: true,
                                },
                            },
                            receiver: {
                                select: {
                                    first_name: true,
                                    middle_name: true,
                                    last_name: true,
                                    second_last_name: true,
                                    address: true,
                                    phone: true,
                                    mobile: true,
                                    ci: true,
                                    email: true,
                                    city: { select: { name: true } },
                                    province: { select: { name: true } },
                                },
                            },
                            agency: { select: { name: true } },
                        },
                    },
                    service: { select: { name: true, service_type: true } },
                    // Include OrderItems for each parcel
                    order_items: {
                        select: {
                            hbl: true,
                            description: true,
                            weight: true,
                            volume: true,
                            quantity: true,
                        },
                        orderBy: { hbl: "asc" },
                    },
                },
                orderBy: { tracking_number: "asc" },
            },
        },
    });
    if (!container) {
        throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Container not found");
    }
    // Calculate totals
    const totalParcels = container.parcels.length;
    const totalItems = container.parcels.reduce((sum, p) => sum + p.order_items.length, 0);
    const totalWeightLbs = Number(container.current_weight_kg) || 0;
    // Build header
    const header = {
        origin_agency: ((_c = (_b = (_a = container.parcels[0]) === null || _a === void 0 ? void 0 : _a.order) === null || _b === void 0 ? void 0 : _b.agency) === null || _c === void 0 ? void 0 : _c.name) || "N/A",
        country: "USA",
        consignee: ((_d = container.provider) === null || _d === void 0 ? void 0 : _d.name) || "N/A",
        container_number: container.container_name,
        date: container.created_at.toISOString().split("T")[0],
        hbls_count: totalItems, // Total OrderItems (HBLs)
        total_packages: totalParcels, // Total Parcels (bultos/cajas)
        bl_number: container.container_number || "",
        manifest_number: `${container.container_number}`,
        total_weight_kg: convertLbsToKg(totalWeightLbs),
    };
    // Build items data - one row per OrderItem
    const travelDate = container.estimated_departure
        ? container.estimated_departure.toISOString().split("T")[0]
        : container.actual_departure
            ? container.actual_departure.toISOString().split("T")[0]
            : "";
    const items = container.parcels.flatMap((parcel) => {
        var _a, _b, _c;
        const order = parcel.order;
        const customer = order === null || order === void 0 ? void 0 : order.customer;
        const receiver = order === null || order === void 0 ? void 0 : order.receiver;
        // Combine phone and mobile if both exist
        const phoneNumbers = [receiver === null || receiver === void 0 ? void 0 : receiver.phone, receiver === null || receiver === void 0 ? void 0 : receiver.mobile].filter(Boolean).join(" / ") || "N/A";
        // If parcel has order_items, create one row per item
        if (parcel.order_items.length > 0) {
            return parcel.order_items.map((item) => {
                var _a, _b, _c;
                return ({
                    hbl_number: item.hbl,
                    packages: item.quantity || 1,
                    weight_kg: convertLbsToKg(Number(item.weight) || 0),
                    volume_m3: Number(item.volume) || 0.3,
                    sender_name: buildFullName(customer === null || customer === void 0 ? void 0 : customer.first_name, customer === null || customer === void 0 ? void 0 : customer.middle_name, customer === null || customer === void 0 ? void 0 : customer.last_name, customer === null || customer === void 0 ? void 0 : customer.second_last_name),
                    receiver_name: buildFullName(receiver === null || receiver === void 0 ? void 0 : receiver.first_name, receiver === null || receiver === void 0 ? void 0 : receiver.middle_name, receiver === null || receiver === void 0 ? void 0 : receiver.last_name, receiver === null || receiver === void 0 ? void 0 : receiver.second_last_name),
                    address: (receiver === null || receiver === void 0 ? void 0 : receiver.address) || "N/A",
                    municipality: ((_a = receiver === null || receiver === void 0 ? void 0 : receiver.city) === null || _a === void 0 ? void 0 : _a.name) || "N/A",
                    province: ((_b = receiver === null || receiver === void 0 ? void 0 : receiver.province) === null || _b === void 0 ? void 0 : _b.name) || "N/A",
                    phone: phoneNumbers,
                    ci: (receiver === null || receiver === void 0 ? void 0 : receiver.ci) || "N/A",
                    email: (receiver === null || receiver === void 0 ? void 0 : receiver.email) || (customer === null || customer === void 0 ? void 0 : customer.email) || "",
                    content: item.description || "N/A",
                    service_type: ((_c = parcel.service) === null || _c === void 0 ? void 0 : _c.service_type) || "ENVIO",
                    pickup_date: parcel.created_at.toISOString().split("T")[0],
                    travel_date: travelDate,
                });
            });
        }
        // Fallback: if no order_items, use parcel data (backward compatibility)
        return [
            {
                hbl_number: parcel.tracking_number,
                packages: 1,
                weight_kg: convertLbsToKg(Number(parcel.weight) || 0),
                volume_m3: 0.3,
                sender_name: buildFullName(customer === null || customer === void 0 ? void 0 : customer.first_name, customer === null || customer === void 0 ? void 0 : customer.middle_name, customer === null || customer === void 0 ? void 0 : customer.last_name, customer === null || customer === void 0 ? void 0 : customer.second_last_name),
                receiver_name: buildFullName(receiver === null || receiver === void 0 ? void 0 : receiver.first_name, receiver === null || receiver === void 0 ? void 0 : receiver.middle_name, receiver === null || receiver === void 0 ? void 0 : receiver.last_name, receiver === null || receiver === void 0 ? void 0 : receiver.second_last_name),
                address: (receiver === null || receiver === void 0 ? void 0 : receiver.address) || "N/A",
                municipality: ((_a = receiver === null || receiver === void 0 ? void 0 : receiver.city) === null || _a === void 0 ? void 0 : _a.name) || "N/A",
                province: ((_b = receiver === null || receiver === void 0 ? void 0 : receiver.province) === null || _b === void 0 ? void 0 : _b.name) || "N/A",
                phone: phoneNumbers,
                ci: (receiver === null || receiver === void 0 ? void 0 : receiver.ci) || "N/A",
                email: (receiver === null || receiver === void 0 ? void 0 : receiver.email) || (customer === null || customer === void 0 ? void 0 : customer.email) || "",
                content: parcel.description || "N/A",
                service_type: ((_c = parcel.service) === null || _c === void 0 ? void 0 : _c.service_type) || "ENVIO",
                pickup_date: parcel.created_at.toISOString().split("T")[0],
                travel_date: travelDate,
            },
        ];
    });
    return { header, items };
});
exports.getContainerManifestData = getContainerManifestData;
/**
 * Generate Excel buffer for container manifest
 */
const generateContainerManifestExcel = (containerId) => __awaiter(void 0, void 0, void 0, function* () {
    const { header, items } = yield (0, exports.getContainerManifestData)(containerId);
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = "CTEnvios";
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet("Manifiesto", {
        pageSetup: {
            paperSize: 9, // A4
            orientation: "landscape",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
        },
    });
    // Define column widths
    worksheet.columns = [
        { key: "hbl", width: 18 },
        { key: "bultos", width: 8 },
        { key: "peso", width: 10 },
        { key: "m3", width: 6 },
        { key: "remitente", width: 18 },
        { key: "destinatario", width: 18 },
        { key: "direccion", width: 25 },
        { key: "municipio", width: 14 },
        { key: "provincia", width: 12 },
        { key: "telefono", width: 12 },
        { key: "ci", width: 14 },
        { key: "email", width: 18 },
        { key: "contenido", width: 18 },
        { key: "tipo", width: 8 },
        { key: "fecha_recogida", width: 12 },
        { key: "fecha_viaje", width: 12 },
    ];
    // Style definitions
    const headerStyle = {
        font: { bold: true, size: 10 },
        fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
        },
        border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
        },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    };
    const dataStyle = {
        font: { size: 9 },
        border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
        },
        alignment: { vertical: "middle", wrapText: true },
    };
    // ========== HEADER SECTION ==========
    // Row 1: Agency info
    worksheet.mergeCells("A1:B1");
    worksheet.getCell("A1").value = "Agencia origen:";
    worksheet.getCell("A1").font = { bold: true, size: 10 };
    worksheet.mergeCells("C1:E1");
    worksheet.getCell("C1").value = header.origin_agency;
    // Row 2: Country
    worksheet.mergeCells("A2:B2");
    worksheet.getCell("A2").value = "País:";
    worksheet.getCell("A2").font = { bold: true, size: 10 };
    worksheet.mergeCells("C2:E2");
    worksheet.getCell("C2").value = header.country;
    // Row 3: Consignee
    worksheet.mergeCells("A3:B3");
    worksheet.getCell("A3").value = "Consignatario:";
    worksheet.getCell("A3").font = { bold: true, size: 10 };
    worksheet.mergeCells("C3:E3");
    worksheet.getCell("C3").value = header.consignee;
    // Row 4: Container
    worksheet.mergeCells("A4:B4");
    worksheet.getCell("A4").value = "Contenedor:";
    worksheet.getCell("A4").font = { bold: true, size: 10 };
    worksheet.mergeCells("C4:E4");
    worksheet.getCell("C4").value = header.container_number;
    // Row 5: Date
    worksheet.mergeCells("A5:B5");
    worksheet.getCell("A5").value = "Fecha:";
    worksheet.getCell("A5").font = { bold: true, size: 10 };
    worksheet.mergeCells("C5:E5");
    worksheet.getCell("C5").value = header.date;
    // Right side header info
    worksheet.getCell("G1").value = "BL";
    worksheet.getCell("G1").font = { bold: true, size: 10 };
    worksheet.mergeCells("H1:I1");
    worksheet.getCell("H1").value = header.bl_number;
    worksheet.getCell("L1").value = "MANIFIESTO";
    worksheet.getCell("L1").font = { bold: true, size: 10 };
    worksheet.mergeCells("M1:N1");
    worksheet.getCell("M1").value = header.manifest_number;
    worksheet.getCell("G3").value = "HBLs";
    worksheet.getCell("G3").font = { bold: true, size: 10 };
    worksheet.getCell("H3").value = header.hbls_count;
    worksheet.getCell("J3").value = "TOTAL BULTOS";
    worksheet.getCell("J3").font = { bold: true, size: 10 };
    worksheet.getCell("K3").value = header.total_packages;
    worksheet.getCell("L3").value = "KGs";
    worksheet.getCell("L3").font = { bold: true, size: 10 };
    worksheet.getCell("M3").value = header.total_weight_kg;
    // ========== TABLE HEADER ==========
    const tableHeaderRow = 7;
    const tableHeaders = [
        "HBL Número",
        "Bultos",
        "Peso (Kg)",
        "M3",
        "REMITENTE",
        "DESTINATARIO",
        "Dirección",
        "Municipio",
        "Provincia",
        "Teléfono",
        "No. de Carnet de Identidad",
        "Correo electrónico",
        "Contenido del paquete (Descripción)",
        "Tipo",
        "Fecha recogida",
        "Fecha de Viaje",
    ];
    tableHeaders.forEach((headerText, index) => {
        const cell = worksheet.getCell(tableHeaderRow, index + 1);
        cell.value = headerText;
        cell.style = headerStyle;
    });
    // Set row height for header
    worksheet.getRow(tableHeaderRow).height = 35;
    // ========== DATA ROWS ==========
    const dataRowStart = tableHeaderRow + 1;
    items.forEach((item, index) => {
        const rowNum = dataRowStart + index;
        const row = worksheet.getRow(rowNum);
        row.values = [
            item.hbl_number,
            item.packages,
            item.weight_kg,
            item.volume_m3,
            item.sender_name,
            item.receiver_name,
            item.address,
            item.municipality,
            item.province,
            item.phone,
            item.ci,
            "", // Email column left empty
            item.content,
            item.service_type,
            item.pickup_date,
            item.travel_date,
        ];
        // Apply style to each cell
        for (let col = 1; col <= 16; col++) {
            const cell = row.getCell(col);
            cell.style = dataStyle;
        }
        row.height = 25;
    });
    // Generate buffer
    const buffer = yield workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
});
exports.generateContainerManifestExcel = generateContainerManifestExcel;
exports.default = exports.generateContainerManifestExcel;
