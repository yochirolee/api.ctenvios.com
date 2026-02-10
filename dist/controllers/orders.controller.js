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
exports.ordersController = void 0;
const services_1 = require("../services");
const types_1 = require("../types/types");
const types_2 = require("../types/types");
const utils_1 = require("../utils/utils");
const client_1 = require("@prisma/client");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const repositories_1 = __importDefault(require("../repositories"));
const app_errors_1 = require("../common/app-errors");
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const generate_order_pdf_1 = require("../utils/pdf/generate-order-pdf");
const generate_labels_pdf_1 = require("../utils/pdf/generate-labels-pdf");
const order_with_relations_1 = require("../types/order-with-relations");
const generate_hbl_pdf_1 = require("../utils/pdf/generate-hbl-pdf");
const order_status_calculator_1 = require("../utils/order-status-calculator");
exports.ordersController = {
    /**
     * Creates an order from frontend or partner API
     * Frontend: sends customer_id and receiver_id
     * Partners: send customer and receiver objects with location names
     */
    create: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { customer_id, receiver_id, customer, receiver, service_id, order_items, total_delivery_fee_in_cents, requires_home_delivery, } = req.body;
        const user = req.user;
        const orderResult = yield services_1.services.orders.create({
            customer_id,
            receiver_id,
            customer,
            receiver,
            service_id,
            order_items,
            user_id: user.id,
            agency_id: user.agency_id,
            total_delivery_fee_in_cents,
            requires_home_delivery,
        });
        res.status(201).json(orderResult);
    }),
    search: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const user = req.user;
            const { page, limit, search, startDate, endDate, agency_id, payment_status } = req.query;
            const pageNum = parseInt(page) || 1;
            const limitNum = Math.min(parseInt(limit) || 25, 100); // Máximo 100
            const searchTerm = (search === null || search === void 0 ? void 0 : search.trim().toLowerCase()) || "";
            // Validate payment_status if provided
            const validPaymentStatuses = Object.values(client_1.PaymentStatus);
            if (payment_status && !validPaymentStatuses.includes(payment_status)) {
                return res.status(400).json({
                    message: `Invalid payment_status. Valid values: ${validPaymentStatuses.join(", ")}`,
                });
            }
            // Check if user is admin (can filter by agency_id)
            const isAdmin = [client_1.Roles.ROOT, client_1.Roles.ADMINISTRATOR].includes(user.role);
            // 🔥 OPTIMIZACIÓN: Path diferente para listado simple vs búsqueda
            const hasSearch = searchTerm.length > 0;
            const hasDateFilter = startDate || endDate;
            // =====================================
            // CASO 1: SIN BÚSQUEDA (Listado Simple)
            // =====================================
            if (!hasSearch) {
                // whereClause simplificado - solo fecha y RBAC
                const whereClause = {};
                // Filtro de fecha (timezone-aware: EST -> UTC)
                if (hasDateFilter) {
                    whereClause.created_at = {};
                    if (startDate) {
                        const start = (0, types_1.parseDateFlexible)(startDate);
                        if (!start)
                            return res.status(400).json({ message: "startDate invalida" });
                        const { start: utcStart } = (0, utils_1.getDayRangeUTC)(start);
                        whereClause.created_at.gte = utcStart;
                    }
                    if (endDate) {
                        const end = (0, types_1.parseDateFlexible)(endDate);
                        if (!end)
                            return res.status(400).json({ message: "endDate invalida" });
                        const { end: utcEnd } = (0, utils_1.getDayRangeUTC)(end);
                        whereClause.created_at.lte = utcEnd;
                    }
                }
                // Filtro payment_status
                if (payment_status) {
                    whereClause.payment_status = payment_status;
                }
                // Filtro RBAC y agency_id
                if (isAdmin) {
                    // Admin can filter by specific agency_id if provided
                    if (agency_id) {
                        whereClause.agency_id = parseInt(agency_id);
                    }
                }
                else {
                    // Non-admin can only see their agency's orders
                    whereClause.agency_id = user.agency_id;
                }
                // 🔥 Query optimizada sin JOINs innecesarios en WHERE
                // Promise.all en lugar de $transaction (más rápido para reads)
                const [count, rows] = yield Promise.all([
                    // Count simple - muy rápido con índice
                    prisma_client_1.default.order.count({ where: whereClause }),
                    // Select optimizado - JOINs solo en SELECT, no en WHERE
                    prisma_client_1.default.order.findMany({
                        where: whereClause,
                        select: {
                            id: true,
                            partner_order_id: true,
                            created_at: true,
                            total_in_cents: true,
                            paid_in_cents: true,
                            payment_status: true,
                            status: true,
                            customer: {
                                select: {
                                    id: true,
                                    first_name: true,
                                    last_name: true,
                                    second_last_name: true,
                                    mobile: true,
                                },
                            },
                            receiver: {
                                select: {
                                    id: true,
                                    first_name: true,
                                    last_name: true,
                                    second_last_name: true,
                                    mobile: true,
                                    province: { select: { name: true } },
                                    city: { select: { name: true } },
                                },
                            },
                            service: { select: { id: true, service_type: true } },
                            agency: { select: { id: true, name: true } },
                            user: { select: { id: true, name: true } },
                            _count: { select: { order_items: true } },
                        },
                        orderBy: { created_at: "desc" },
                        take: limitNum,
                        skip: (pageNum - 1) * limitNum,
                    }),
                ]);
                return res.status(200).json({ rows, total: count });
            }
            // =====================================
            // CASO 2: CON BÚSQUEDA (Query Compleja)
            // =====================================
            const cleanedSearch = searchTerm.replace(/[\s\-\(\)]/g, "");
            const isNumeric = /^\d+$/.test(cleanedSearch);
            const words = searchTerm.split(/\s+/).filter(Boolean);
            const filters = [{ deleted_at: null }];
            // Filtro de fecha (timezone-aware: EST -> UTC)
            if (hasDateFilter) {
                const dateFilter = { created_at: {} };
                if (startDate) {
                    const start = (0, types_1.parseDateFlexible)(startDate);
                    if (!start)
                        return res.status(400).json({ message: "startDate invalida" });
                    const { start: utcStart } = (0, utils_1.getDayRangeUTC)(start);
                    dateFilter.created_at.gte = utcStart;
                }
                if (endDate) {
                    const end = (0, types_1.parseDateFlexible)(endDate);
                    if (!end)
                        return res.status(400).json({ message: "endDate invalida" });
                    const { end: utcEnd } = (0, utils_1.getDayRangeUTC)(end);
                    dateFilter.created_at.lte = utcEnd;
                }
                filters.push(dateFilter);
            }
            // Filtro payment_status
            if (payment_status) {
                filters.push({ payment_status });
            }
            // Filtro de búsqueda
            if (isNumeric) {
                const numericConditions = [];
                const numLength = cleanedSearch.length;
                // ID (1-5 dígitos)
                if (numLength <= 5) {
                    numericConditions.push({ id: parseInt(cleanedSearch) });
                }
                // Móvil (10 dígitos)
                if (numLength === 10) {
                    numericConditions.push({
                        customer: { mobile: { contains: cleanedSearch } },
                    });
                    numericConditions.push({
                        receiver: { mobile: { contains: cleanedSearch } },
                    });
                }
                // CI (11 dígitos)
                if (numLength === 11) {
                    numericConditions.push({
                        receiver: { ci: { contains: cleanedSearch } },
                    });
                }
                if (numericConditions.length > 0) {
                    filters.push({ OR: numericConditions });
                }
                else {
                    filters.push({ id: -1 });
                }
            }
            else {
                // Búsqueda por nombre
                const nameFilters = (0, types_2.buildNameSearchFilter)(words);
                filters.push({ OR: [{ customer: nameFilters }, { receiver: nameFilters }] });
            }
            // Filtro RBAC y agency_id
            if (isAdmin) {
                // Admin can filter by specific agency_id if provided
                if (agency_id) {
                    filters.push({ agency_id: parseInt(agency_id) });
                }
            }
            else {
                // Non-admin can only see their agency's orders
                filters.push({ agency_id: user.agency_id });
            }
            const whereClause = filters.length > 0 ? { AND: filters } : {};
            // Query con búsqueda compleja
            const [count, rows] = yield Promise.all([
                prisma_client_1.default.order.count({ where: whereClause }),
                prisma_client_1.default.order.findMany({
                    where: whereClause,
                    select: {
                        id: true,
                        created_at: true,
                        total_in_cents: true,
                        paid_in_cents: true,
                        payment_status: true,
                        status: true,
                        customer: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                                second_last_name: true,
                                mobile: true,
                            },
                        },
                        receiver: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                                second_last_name: true,
                                mobile: true,
                                province: { select: { name: true } },
                                city: { select: { name: true } },
                            },
                        },
                        service: { select: { id: true, name: true } },
                        agency: { select: { id: true, name: true } },
                        user: { select: { id: true, name: true } },
                        _count: { select: { order_items: true } },
                    },
                    orderBy: { created_at: "desc" },
                    take: limitNum,
                    skip: (pageNum - 1) * limitNum,
                }),
            ]);
            res.status(200).json({ rows, total: count });
        }
        catch (error) {
            console.error("Search error:", error);
            throw new app_errors_1.AppError(https_status_codes_1.default.INTERNAL_SERVER_ERROR, "Error searching orders");
        }
    }),
    getById: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const orderId = parseInt(id);
            if (isNaN(orderId)) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid order ID");
            }
            const order = yield repositories_1.default.orders.getByIdWithDetails(orderId);
            if (!order) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
            }
            res.status(200).json(order);
        }
        catch (error) {
            next(error);
        }
    }),
    getParcelsByOrderId: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const orderId = parseInt(id);
            const parcels = yield repositories_1.default.orders.getParcelsByOrderId(orderId);
            res.status(200).json(parcels);
        }
        catch (error) {
            next(error);
        }
    }),
    /**
     * Get order status summary with parcel breakdown
     * Returns: order_status, parcels_count, status_breakdown
     */
    getStatusSummary: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const orderId = parseInt(id);
            // Verify order exists
            const order = yield prisma_client_1.default.order.findUnique({
                where: { id: orderId },
                select: { id: true },
            });
            if (!order) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
            }
            const summary = yield (0, order_status_calculator_1.getOrderStatusSummary)(orderId);
            res.status(200).json(summary);
        }
        catch (error) {
            next(error);
        }
    }),
    payOrder: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const paymentData = req.body;
            const order_id = parseInt(req.params.id);
            const user = req.user;
            const result = yield services_1.services.orders.payOrder(order_id, paymentData, user.id);
            res.status(201).json(result);
        }
        catch (error) {
            next(error);
        }
    }),
    removePayment: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const payment_id = parseInt(req.params.id);
            const result = yield services_1.services.orders.removePayment(payment_id);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    }),
    //DISCOUNTS
    addDiscount: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const user = req.user;
            if (!user) {
                throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "Unauthorized");
            }
            const { id } = req.params;
            const orderId = parseInt(id);
            const discountData = req.body;
            const result = yield services_1.services.orders.addDiscount(orderId, discountData, user.id);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    }),
    removeDiscount: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const user = req.user;
            if (!user) {
                throw new app_errors_1.AppError(https_status_codes_1.default.UNAUTHORIZED, "Unauthorized");
            }
            const { id } = req.params;
            const discountId = parseInt(id);
            const result = yield services_1.services.orders.removeDiscount(discountId);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    }),
    delete: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const orderId = parseInt(id);
            const user = req.user;
            const result = yield repositories_1.default.orders.softDelete(orderId, {
                userId: user.id,
                userRole: user.role,
                userAgencyId: user.agency_id,
            }, reason);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    }),
    restore: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const orderId = parseInt(id);
            const result = yield repositories_1.default.orders.restore(orderId);
            res.status(200).json({ success: true, order: result });
        }
        catch (error) {
            next(error);
        }
    }),
    getDeleted: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { page = 1, limit = 25 } = req.query;
            const user = req.user;
            const isAdmin = ["ROOT", "ADMINISTRATOR"].includes(user.role);
            const result = yield repositories_1.default.orders.getDeleted({
                page: parseInt(page),
                limit: parseInt(limit),
                agency_id: isAdmin ? undefined : user.agency_id,
            });
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    }),
    ///PDFS
    generateOrderPdf: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const orderId = parseInt(id);
            const order = yield repositories_1.default.orders.getByIdWithDetails(orderId);
            if (!order) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
            }
            const result = yield (0, generate_order_pdf_1.generateOrderPDF)(order);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="order-${order.id}.pdf"`);
            result.pipe(res);
            result.end();
        }
        catch (error) {
            console.error("Order PDF generation error:", error);
            if (error instanceof app_errors_1.AppError) {
                res.status(error.status).json({
                    status: "error",
                    message: error.message,
                });
            }
            else {
                res.status(500).json({
                    status: "error",
                    message: "Error generating order PDF",
                    error: process.env.NODE_ENV === "development" ? error : undefined,
                });
            }
            next(error);
        }
    }),
    generateOrderLabelsPdf: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (!id || isNaN(parseInt(id))) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid invoice ID");
            }
            // Fetch invoice with all required relations
            const invoice = yield prisma_client_1.default.order.findUnique({
                where: { id: parseInt(id) },
                include: order_with_relations_1.orderWithRelationsInclude,
            });
            if (!invoice) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Invoice not found");
            }
            if (!invoice.order_items || invoice.order_items.length === 0) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "No order items found for this invoice");
            }
            // Generate CTEnvios labels
            const doc = yield (0, generate_labels_pdf_1.generateCTEnviosLabels)(invoice);
            // Set response headers for PDF to open in browser (inline)
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="ctenvios-labels-${invoice.id}.pdf"`);
            // Pipe the PDF to response
            doc.pipe(res);
            doc.end();
        }
        catch (error) {
            console.error("label generation error:", error);
            if (error instanceof app_errors_1.AppError) {
                res.status(error.status).json({
                    status: "error",
                    message: error.message,
                });
            }
            else {
                res.status(500).json({
                    status: "error",
                    message: "Error generating labels",
                    error: process.env.NODE_ENV === "development" ? error : undefined,
                });
            }
            next(error);
        }
    }),
    generateOrderHblPdf: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (!id || isNaN(parseInt(id))) {
                throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Invalid invoice ID");
            }
            // Fetch invoice with all required relations
            const order = yield repositories_1.default.orders.getByIdWithDetails(parseInt(id));
            if (!order) {
                throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
            }
            // Generate HBL PDF
            const doc = yield (0, generate_hbl_pdf_1.generateHblPdf)(order);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="hbl-${order.id}.pdf"`);
            doc.pipe(res);
            doc.end();
        }
        catch (error) {
            console.error("HBL PDF generation error:", error);
            if (error instanceof app_errors_1.AppError) {
                res.status(error.status).json({
                    status: "error",
                    message: error.message,
                });
            }
            else {
                res.status(500).json({
                    status: "error",
                    message: "Error generating HBL PDF",
                    error: process.env.NODE_ENV === "development" ? error : undefined,
                });
            }
            next(error);
        }
    }),
};
exports.default = exports.ordersController;
