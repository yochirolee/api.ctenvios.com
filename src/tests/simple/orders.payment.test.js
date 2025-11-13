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
const client_1 = require("@prisma/client");
const prisma_db_1 = __importDefault(require("../../config/prisma_db"));
const orders_service_1 = require("../../services/orders.service");
describe("Orders Payment Service", () => {
    let testOrderId;
    let testUserId;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Setup: Create a test order for payment tests
        // You may need to adjust these IDs based on your test database
        const testOrder = yield prisma_db_1.default.order.create({
            data: {
                customer_id: 1, // Adjust to existing customer
                receiver_id: 1, // Adjust to existing receiver
                service_id: 1, // Adjust to existing service
                agency_id: 1, // Adjust to existing agency
                user_id: "test-user-id",
                total_in_cents: 100000, // $1,000.00
                paid_in_cents: 0,
                payment_status: client_1.PaymentStatus.PENDING,
                items: {
                    create: {
                        hbl: `TEST-${Date.now()}`,
                        description: "Test item",
                        weight: 10,
                        service_id: 1,
                        agency_id: 1,
                        rate_id: 1, // Adjust to existing rate
                        cost_in_cents: 50000,
                        rate_in_cents: 50000,
                    },
                },
            },
        });
        testOrderId = testOrder.id;
        testUserId = testOrder.user_id;
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Cleanup: Delete test data
        if (testOrderId) {
            yield prisma_db_1.default.payment.deleteMany({ where: { order_id: testOrderId } });
            yield prisma_db_1.default.item.deleteMany({ where: { order_id: testOrderId } });
            yield prisma_db_1.default.order.delete({ where: { id: testOrderId } });
        }
        yield prisma_db_1.default.$disconnect();
    }));
    describe("Full Payment", () => {
        it("should process full cash payment successfully", () => __awaiter(void 0, void 0, void 0, function* () {
            const paymentData = {
                amount_in_cents: 100000,
                method: client_1.PaymentMethod.CASH,
                reference: "CASH-TEST-001",
                notes: "Full payment test",
            };
            const result = yield orders_service_1.ordersService.payment(testOrderId, paymentData, testUserId);
            expect(result).toBeDefined();
            expect(result.order).toBeDefined();
            expect(result.payment).toBeDefined();
            expect(result.order.payment_status).toBe(client_1.PaymentStatus.PAID);
            expect(result.order.paid_in_cents).toBe(100000);
            expect(result.payment.amount_in_cents).toBe(100000);
            expect(result.payment.charge_in_cents).toBe(0);
        }));
    });
    describe("Partial Payments", () => {
        let partialOrderId;
        beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
            const order = yield prisma_db_1.default.order.create({
                data: {
                    customer_id: 1,
                    receiver_id: 1,
                    service_id: 1,
                    agency_id: 1,
                    user_id: testUserId,
                    total_in_cents: 100000,
                    paid_in_cents: 0,
                    payment_status: client_1.PaymentStatus.PENDING,
                    items: {
                        create: {
                            hbl: `PARTIAL-${Date.now()}`,
                            description: "Partial payment test",
                            weight: 10,
                            service_id: 1,
                            agency_id: 1,
                            rate_id: 1,
                            cost_in_cents: 50000,
                            rate_in_cents: 50000,
                        },
                    },
                },
            });
            partialOrderId = order.id;
        }));
        afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
            if (partialOrderId) {
                yield prisma_db_1.default.payment.deleteMany({ where: { order_id: partialOrderId } });
                yield prisma_db_1.default.item.deleteMany({ where: { order_id: partialOrderId } });
                yield prisma_db_1.default.order.delete({ where: { id: partialOrderId } });
            }
        }));
        it("should process first partial payment", () => __awaiter(void 0, void 0, void 0, function* () {
            const paymentData = {
                amount_in_cents: 60000, // $600
                method: client_1.PaymentMethod.BANK_TRANSFER,
                reference: "TRANSFER-001",
            };
            const result = yield orders_service_1.ordersService.payment(partialOrderId, paymentData, testUserId);
            expect(result.order.payment_status).toBe(client_1.PaymentStatus.PARTIALLY_PAID);
            expect(result.order.paid_in_cents).toBe(60000);
            expect(result.order.total_in_cents).toBe(100000);
        }));
        it("should process second partial payment and mark as paid", () => __awaiter(void 0, void 0, void 0, function* () {
            const paymentData = {
                amount_in_cents: 40000, // $400
                method: client_1.PaymentMethod.CASH,
            };
            const result = yield orders_service_1.ordersService.payment(partialOrderId, paymentData, testUserId);
            expect(result.order.payment_status).toBe(client_1.PaymentStatus.PAID);
            expect(result.order.paid_in_cents).toBe(100000);
            expect(result.order.total_in_cents).toBe(100000);
        }));
    });
    describe("Card Payments with Fees", () => {
        let cardOrderId;
        beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
            const order = yield prisma_db_1.default.order.create({
                data: {
                    customer_id: 1,
                    receiver_id: 1,
                    service_id: 1,
                    agency_id: 1,
                    user_id: testUserId,
                    total_in_cents: 100000,
                    paid_in_cents: 0,
                    payment_status: client_1.PaymentStatus.PENDING,
                    items: {
                        create: {
                            hbl: `CARD-${Date.now()}`,
                            description: "Card payment test",
                            weight: 10,
                            service_id: 1,
                            agency_id: 1,
                            rate_id: 1,
                            cost_in_cents: 50000,
                            rate_in_cents: 50000,
                        },
                    },
                },
            });
            cardOrderId = order.id;
        }));
        afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
            if (cardOrderId) {
                yield prisma_db_1.default.payment.deleteMany({ where: { order_id: cardOrderId } });
                yield prisma_db_1.default.item.deleteMany({ where: { order_id: cardOrderId } });
                yield prisma_db_1.default.order.delete({ where: { id: cardOrderId } });
            }
        }));
        it("should calculate and apply 3% fee for credit card payment", () => __awaiter(void 0, void 0, void 0, function* () {
            const paymentData = {
                amount_in_cents: 100000, // $1,000
                method: client_1.PaymentMethod.CREDIT_CARD,
                reference: "CARD-XXXX-1234",
            };
            const result = yield orders_service_1.ordersService.payment(cardOrderId, paymentData, testUserId);
            const expectedFee = Math.round(100000 * 0.03); // $30
            const expectedTotal = 100000 + expectedFee; // $1,030
            expect(result.payment.charge_in_cents).toBe(expectedFee);
            expect(result.order.total_in_cents).toBe(expectedTotal);
            expect(result.order.paid_in_cents).toBe(100000);
            expect(result.order.payment_status).toBe(client_1.PaymentStatus.PARTIALLY_PAID); // Not fully paid due to fee
            expect(result.payment.notes).toContain("Card processing fee");
        }));
        it("should calculate and apply 3% fee for debit card payment", () => __awaiter(void 0, void 0, void 0, function* () {
            // First, complete the previous payment to reset
            const completionPayment = {
                amount_in_cents: 3000, // Pay the fee
                method: client_1.PaymentMethod.CASH,
            };
            yield orders_service_1.ordersService.payment(cardOrderId, completionPayment, testUserId);
            // Create new order for debit card test
            const newOrder = yield prisma_db_1.default.order.create({
                data: {
                    customer_id: 1,
                    receiver_id: 1,
                    service_id: 1,
                    agency_id: 1,
                    user_id: testUserId,
                    total_in_cents: 50000,
                    paid_in_cents: 0,
                    payment_status: client_1.PaymentStatus.PENDING,
                    items: {
                        create: {
                            hbl: `DEBIT-${Date.now()}`,
                            description: "Debit card test",
                            weight: 5,
                            service_id: 1,
                            agency_id: 1,
                            rate_id: 1,
                            cost_in_cents: 25000,
                            rate_in_cents: 25000,
                        },
                    },
                },
            });
            const paymentData = {
                amount_in_cents: 50000, // $500
                method: client_1.PaymentMethod.DEBIT_CARD,
                reference: "DEBIT-XXXX-5678",
            };
            const result = yield orders_service_1.ordersService.payment(newOrder.id, paymentData, testUserId);
            const expectedFee = Math.round(50000 * 0.03); // $15
            const expectedTotal = 50000 + expectedFee; // $515
            expect(result.payment.charge_in_cents).toBe(expectedFee);
            expect(result.order.total_in_cents).toBe(expectedTotal);
            expect(result.payment.notes).toContain("3%");
            // Cleanup
            yield prisma_db_1.default.payment.deleteMany({ where: { order_id: newOrder.id } });
            yield prisma_db_1.default.item.deleteMany({ where: { order_id: newOrder.id } });
            yield prisma_db_1.default.order.delete({ where: { id: newOrder.id } });
        }));
    });
    describe("Validation and Error Handling", () => {
        it("should reject payment with zero amount", () => __awaiter(void 0, void 0, void 0, function* () {
            const paymentData = {
                amount_in_cents: 0,
                method: client_1.PaymentMethod.CASH,
            };
            yield expect(orders_service_1.ordersService.payment(testOrderId, paymentData, testUserId)).rejects.toThrow("Payment amount must be greater than 0");
        }));
        it("should reject payment with negative amount", () => __awaiter(void 0, void 0, void 0, function* () {
            const paymentData = {
                amount_in_cents: -1000,
                method: client_1.PaymentMethod.CASH,
            };
            yield expect(orders_service_1.ordersService.payment(testOrderId, paymentData, testUserId)).rejects.toThrow("Payment amount must be greater than 0");
        }));
        it("should reject payment for non-existent order", () => __awaiter(void 0, void 0, void 0, function* () {
            const paymentData = {
                amount_in_cents: 10000,
                method: client_1.PaymentMethod.CASH,
            };
            yield expect(orders_service_1.ordersService.payment(999999, paymentData, testUserId)).rejects.toThrow("Order not found");
        }));
        it("should reject payment exceeding remaining balance", () => __awaiter(void 0, void 0, void 0, function* () {
            const excessOrder = yield prisma_db_1.default.order.create({
                data: {
                    customer_id: 1,
                    receiver_id: 1,
                    service_id: 1,
                    agency_id: 1,
                    user_id: testUserId,
                    total_in_cents: 50000, // $500
                    paid_in_cents: 0,
                    payment_status: client_1.PaymentStatus.PENDING,
                    items: {
                        create: {
                            hbl: `EXCESS-${Date.now()}`,
                            description: "Excess payment test",
                            weight: 5,
                            service_id: 1,
                            agency_id: 1,
                            rate_id: 1,
                            cost_in_cents: 25000,
                            rate_in_cents: 25000,
                        },
                    },
                },
            });
            const paymentData = {
                amount_in_cents: 60000, // More than order total
                method: client_1.PaymentMethod.CASH,
            };
            yield expect(orders_service_1.ordersService.payment(excessOrder.id, paymentData, testUserId)).rejects.toThrow("exceeds remaining balance");
            // Cleanup
            yield prisma_db_1.default.item.deleteMany({ where: { order_id: excessOrder.id } });
            yield prisma_db_1.default.order.delete({ where: { id: excessOrder.id } });
        }));
        it("should reject payment for already paid order", () => __awaiter(void 0, void 0, void 0, function* () {
            const paidOrder = yield prisma_db_1.default.order.create({
                data: {
                    customer_id: 1,
                    receiver_id: 1,
                    service_id: 1,
                    agency_id: 1,
                    user_id: testUserId,
                    total_in_cents: 50000,
                    paid_in_cents: 50000,
                    payment_status: client_1.PaymentStatus.PAID,
                    items: {
                        create: {
                            hbl: `PAID-${Date.now()}`,
                            description: "Already paid test",
                            weight: 5,
                            service_id: 1,
                            agency_id: 1,
                            rate_id: 1,
                            cost_in_cents: 25000,
                            rate_in_cents: 25000,
                        },
                    },
                },
            });
            const paymentData = {
                amount_in_cents: 1000,
                method: client_1.PaymentMethod.CASH,
            };
            yield expect(orders_service_1.ordersService.payment(paidOrder.id, paymentData, testUserId)).rejects.toThrow("Order is already paid");
            // Cleanup
            yield prisma_db_1.default.item.deleteMany({ where: { order_id: paidOrder.id } });
            yield prisma_db_1.default.order.delete({ where: { id: paidOrder.id } });
        }));
    });
});
