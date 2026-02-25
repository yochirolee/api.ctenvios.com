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
exports.ordersService = void 0;
const client_1 = require("@prisma/client");
const _1 = require(".");
const repositories_1 = __importDefault(require("../repositories"));
const utils_1 = require("../utils/utils");
const payment_config_1 = require("../config/payment.config");
const prisma_client_1 = __importDefault(require("../lib/prisma.client"));
const https_status_codes_1 = __importDefault(require("../common/https-status-codes"));
const app_errors_1 = require("../common/app-errors");
const generate_hbl_1 = require("../utils/generate-hbl");
const parcel_status_details_1 = require("../utils/parcel-status-details");
exports.ordersService = {
    /**
     * Creates an order handling both frontend and partner scenarios
     * Frontend: provides customer_id and receiver_id
     * Partners: provides customer and receiver data (with location names)
     */
    create: (_a) => __awaiter(void 0, [_a], void 0, function* ({ partner_id, partner_order_id, customer_id, receiver_id, customer, receiver, order_items, service_id, user_id, agency_id, total_delivery_fee_in_cents, requires_home_delivery = true, }) {
        var _b;
        // 1) Resolver customer/receiver igual que antes (fast/slow path)
        let finalCustomerId = customer_id;
        let finalReceiverId = receiver_id;
        if (!customer_id || !receiver_id) {
            const [resolvedReceiver, resolvedCustomer] = yield Promise.all([
                _1.services.resolvers.resolveReceiver({ receiver_id, receiver }),
                _1.services.resolvers.resolveCustomer({ customer_id, customer }),
            ]);
            finalCustomerId = resolvedCustomer.id;
            finalReceiverId = resolvedReceiver.id;
        }
        // 2) Resolver items SIN HBL (nuevo)
        //    Debe devolverte: description, price_in_cents, rate_id, insurance_fee_in_cents, customs_fee_in_cents,
        //    quantity, weight, agency_id, unit, etc.
        const items = yield _1.services.resolvers.resolveItems({
            order_items,
            service_id,
            agency_id,
        });
        // 3) Fees / totals (igual que tú)
        const finalTotal = (0, utils_1.calculateOrderTotal)(items);
        const totalDeliveryFeeCents = Math.round(total_delivery_fee_in_cents !== null && total_delivery_fee_in_cents !== void 0 ? total_delivery_fee_in_cents : 0);
        const perItemDeliveryFees = (0, utils_1.distributeCents)(totalDeliveryFeeCents, items.length);
        for (let i = 0; i < items.length; i++) {
            items[i].delivery_fee_in_cents = (_b = perItemDeliveryFees[i]) !== null && _b !== void 0 ? _b : 0;
        }
        const total_in_cents = finalTotal + (total_delivery_fee_in_cents || 0);
        // 4) Transacción única (ultra consistente)
        const order = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // A) Crear Order primero (para obtener orderId)
            const createdOrder = yield tx.order.create({
                data: {
                    partner_order_id,
                    customer_id: finalCustomerId,
                    receiver_id: finalReceiverId,
                    service_id,
                    user_id,
                    agency_id,
                    status: client_1.Status.IN_AGENCY,
                    requires_home_delivery,
                    partner_id,
                    total_in_cents,
                },
                select: { id: true },
            });
            const orderId = createdOrder.id;
            // B) Generar HBLs terminando en 001.. (por orden)
            const forwarder = yield prisma_client_1.default.forwarder.findUnique({
                where: {
                    id: agency_id,
                },
            });
            const provider = ((_a = forwarder === null || forwarder === void 0 ? void 0 : forwarder.code) !== null && _a !== void 0 ? _a : "CTE").toUpperCase(); // fallback si quieres
            const yymm = (0, generate_hbl_1.todayYYMM)("America/New_York");
            // C) items <= 99
            if (items.length > 99)
                throw new Error("Max 99 items per order");
            const hbls = items.map((_, i) => (0, generate_hbl_1.buildHBL)(provider, yymm, orderId, i + 1));
            // C) Crear Parcels (HOY: 1 parcel por item)
            yield tx.parcel.createMany({
                data: items.map((item, i) => ({
                    tracking_number: hbls[i], // interno por ahora
                    description: item.description,
                    external_reference: item.external_reference || null,
                    weight: item.weight,
                    status: client_1.Status.IN_AGENCY,
                    user_id,
                    agency_id,
                    service_id,
                    order_id: orderId,
                })),
            });
            // D) Leer parcels para mapear parcel_id por tracking_number (HBL)
            const parcels = yield tx.parcel.findMany({
                where: { tracking_number: { in: hbls } },
                select: { id: true, tracking_number: true },
            });
            const parcelIdByTracking = new Map(parcels.map((p) => [p.tracking_number, p.id]));
            // E) Crear OrderItems con parcel_id directo (sin connect por tracking)
            yield tx.orderItem.createMany({
                data: items.map((item, i) => ({
                    hbl: hbls[i],
                    description: item.description,
                    price_in_cents: item.price_in_cents,
                    charge_fee_in_cents: item.charge_fee_in_cents,
                    delivery_fee_in_cents: item.delivery_fee_in_cents,
                    insurance_fee_in_cents: item.insurance_fee_in_cents,
                    customs_fee_in_cents: item.customs_fee_in_cents,
                    quantity: item.quantity,
                    weight: item.weight,
                    agency_id: item.agency_id,
                    service_id,
                    unit: item.unit,
                    status: client_1.Status.IN_AGENCY,
                    rate_id: item.rate_id,
                    customs_rates_id: item.customs_rates_id || null,
                    order_id: orderId,
                    parcel_id: parcelIdByTracking.get(hbls[i]), // ✅ FK directo
                })),
            });
            // F) Crear eventos iniciales en batch (más rápido que nested)
            const statusDetails = (0, parcel_status_details_1.buildParcelStatusDetails)({ status: client_1.Status.IN_AGENCY });
            yield tx.parcelEvent.createMany({
                data: parcels.map((p) => ({
                    parcel_id: p.id,
                    event_type: "BILLED",
                    user_id,
                    status: client_1.Status.IN_AGENCY,
                    status_details: statusDetails,
                })),
            });
            // G) Retornar la orden completa (ajusta include a tu gusto)
            return tx.order.findUnique({
                where: { id: orderId },
                include: { parcels: true, order_items: true },
            });
        }));
        // Post tareas no críticas (igual que tu lógica)
        repositories_1.default.receivers
            .connect(finalReceiverId, finalCustomerId)
            .catch((err) => console.error("Receiver connection failed (non-critical):", err));
        repositories_1.default.agencies.addCustomerToAgency(agency_id, finalCustomerId);
        repositories_1.default.agencies.addReceiverToAgency(agency_id, finalReceiverId);
        return order;
    }),
    payOrder: (order_id, paymentData, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Validate amount
        if (!paymentData.amount_in_cents || paymentData.amount_in_cents <= 0) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Payment amount must be greater than 0");
        }
        // Get order with full details
        const order_to_pay = yield repositories_1.default.orders.getById(order_id);
        if (!order_to_pay) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
        }
        // Check if order is already paid
        if (order_to_pay.payment_status === client_1.PaymentStatus.PAID) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Order is already paid");
        }
        // Calculate charge for card payments
        let charge = 0;
        if (paymentData.method === client_1.PaymentMethod.CREDIT_CARD || paymentData.method === client_1.PaymentMethod.DEBIT_CARD) {
            charge = Math.round(paymentData.amount_in_cents * payment_config_1.PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE);
            paymentData.charge_in_cents = charge;
            paymentData.notes = `Card processing fee (${payment_config_1.PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE * 100}%): ${(0, utils_1.formatCents)(charge)}`;
        }
        // Calculate new totals
        const totalPaidAfterPayment = order_to_pay.paid_in_cents + paymentData.amount_in_cents + charge;
        const newTotalWithCharge = order_to_pay.total_in_cents + charge;
        // Validate payment doesn't exceed total
        if (totalPaidAfterPayment > newTotalWithCharge) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, `Payment amount (${(0, utils_1.formatCents)(paymentData.amount_in_cents)}) exceeds remaining balance (${(0, utils_1.formatCents)(newTotalWithCharge - order_to_pay.paid_in_cents)})`);
        }
        // Determine new payment status
        let newPaymentStatus;
        if (totalPaidAfterPayment >= newTotalWithCharge) {
            newPaymentStatus = client_1.PaymentStatus.PAID;
        }
        else if (totalPaidAfterPayment > 0) {
            newPaymentStatus = client_1.PaymentStatus.PARTIALLY_PAID;
        }
        else {
            newPaymentStatus = client_1.PaymentStatus.PENDING;
        }
        // Execute payment transaction
        const result = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update order
            const updatedOrder = yield tx.order.update({
                where: { id: order_to_pay.id },
                data: {
                    paid_in_cents: totalPaidAfterPayment,
                    total_in_cents: newTotalWithCharge,
                    payment_status: newPaymentStatus,
                },
                include: {
                    customer: true,
                    receiver: true,
                    service: true,
                    agency: true,
                    user: true,
                    payments: true,
                },
            });
            // Create payment record
            yield tx.payment.create({
                data: {
                    amount_in_cents: paymentData.amount_in_cents,
                    charge_in_cents: charge,
                    method: paymentData.method,
                    reference: paymentData.reference,
                    notes: paymentData.notes,
                    order_id: order_to_pay.id,
                    user_id: user_id,
                },
            });
            return updatedOrder;
        }));
        return result;
    }),
    removePayment: (payment_id) => __awaiter(void 0, void 0, void 0, function* () {
        // Get the payment to be deleted (need amount and charge before deletion)
        const payment = yield prisma_client_1.default.payment.findUnique({
            where: { id: payment_id },
            include: {
                order: true,
            },
        });
        if (!payment) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Payment not found");
        }
        // Calculate new totals after removing this payment
        const charge = payment.charge_in_cents || 0;
        const newPaidAmount = payment.order.paid_in_cents - payment.amount_in_cents - charge;
        const newTotalAmount = payment.order.total_in_cents - charge;
        // Determine new payment status
        let newPaymentStatus;
        if (newPaidAmount >= newTotalAmount) {
            newPaymentStatus = client_1.PaymentStatus.PAID;
        }
        else if (newPaidAmount > 0) {
            newPaymentStatus = client_1.PaymentStatus.PARTIALLY_PAID;
        }
        else {
            newPaymentStatus = client_1.PaymentStatus.PENDING;
        }
        // Execute removal in a transaction
        const result = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Delete the payment
            yield tx.payment.delete({
                where: { id: payment_id },
            });
            // Update order with recalculated amounts
            const updatedOrder = yield tx.order.update({
                where: { id: payment.order_id },
                data: {
                    paid_in_cents: newPaidAmount,
                    total_in_cents: newTotalAmount,
                    payment_status: newPaymentStatus,
                },
                include: {
                    customer: true,
                    receiver: true,
                    service: true,
                    agency: true,
                    user: true,
                    payments: true,
                },
            });
            return updatedOrder;
        }));
        return result;
    }),
    addDiscount: (order_id, discountData, user_id) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const order = yield prisma_client_1.default.order.findUnique({
            where: { id: order_id },
            include: { order_items: true, discounts: true },
        });
        if (!order) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Order not found");
        }
        // Prevent adding discount to already paid orders
        if (order.payment_status === client_1.PaymentStatus.PAID) {
            throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Cannot add discount to an already paid order");
        }
        let total_discount_in_cents = 0;
        switch (discountData.type) {
            case client_1.DiscountType.RATE:
                total_discount_in_cents = order.order_items.reduce((acc, item) => {
                    if (item.unit === client_1.Unit.PER_LB) {
                        const weight = (0, utils_1.toNumber)(item.weight); // weight is Decimal, needs conversion
                        return (acc + Math.ceil(item.price_in_cents * weight - weight * ((discountData === null || discountData === void 0 ? void 0 : discountData.discount_in_cents) || 1)));
                    }
                    return acc;
                }, 0);
                break;
            case client_1.DiscountType.CASH:
                if (((_a = discountData === null || discountData === void 0 ? void 0 : discountData.discount_in_cents) !== null && _a !== void 0 ? _a : 0) > order.total_in_cents) {
                    throw new app_errors_1.AppError(https_status_codes_1.default.BAD_REQUEST, "Discount amount cannot be greater than order total");
                }
                total_discount_in_cents = (_b = discountData.discount_in_cents) !== null && _b !== void 0 ? _b : 0;
                break;
            default:
                // If discount type is not handled, discount remains 0
                break;
        }
        // Calculate new total after discount
        const newTotalInCents = order.total_in_cents - total_discount_in_cents;
        // Check if order is fully paid after discount
        const isFullyPaid = order.paid_in_cents >= newTotalInCents;
        // Determine payment status
        let newPaymentStatus;
        if (total_discount_in_cents === order.total_in_cents) {
            // Discount equals the full order total
            newPaymentStatus = client_1.PaymentStatus.FULL_DISCOUNT;
        }
        else if (total_discount_in_cents > 0 && !isFullyPaid) {
            // Order has discount but is not fully paid
            newPaymentStatus = client_1.PaymentStatus.PENDING;
        }
        // If discount doesn't equal total and order is fully paid, status remains unchanged
        const result = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Create discount
            yield tx.discount.create({
                data: {
                    type: discountData.type,
                    description: discountData.description,
                    rate: discountData.discount_in_cents,
                    discount_in_cents: total_discount_in_cents,
                    order_id: order_id,
                    user_id: user_id,
                },
            });
            const updateData = {
                total_in_cents: newTotalInCents,
            };
            if (newPaymentStatus) {
                updateData.payment_status = newPaymentStatus;
            }
            const updatedOrder = yield tx.order.update({
                where: { id: order_id },
                data: updateData,
            });
            return updatedOrder;
        }));
        return result;
    }),
    removeDiscount: (discount_id) => __awaiter(void 0, void 0, void 0, function* () {
        const discount_to_remove = yield prisma_client_1.default.discount.findUnique({
            where: { id: discount_id },
            include: {
                order: true,
            },
        });
        if (!discount_to_remove) {
            throw new app_errors_1.AppError(https_status_codes_1.default.NOT_FOUND, "Discount not found");
        }
        const order = discount_to_remove.order;
        const newTotalInCents = order.total_in_cents + discount_to_remove.discount_in_cents;
        // Recalculate payment status based on paid amount vs new total
        let newPaymentStatus;
        if (order.paid_in_cents >= newTotalInCents) {
            newPaymentStatus = client_1.PaymentStatus.PAID;
        }
        else if (order.paid_in_cents > 0) {
            newPaymentStatus = client_1.PaymentStatus.PARTIALLY_PAID;
        }
        else {
            newPaymentStatus = client_1.PaymentStatus.PENDING;
        }
        const result = yield prisma_client_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.discount.delete({
                where: { id: discount_id },
            });
            const updatedOrder = yield tx.order.update({
                where: { id: discount_to_remove.order_id },
                data: {
                    total_in_cents: newTotalInCents,
                    payment_status: newPaymentStatus,
                },
            });
            return updatedOrder;
        }));
        return result;
    }),
};
