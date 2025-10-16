import { PaymentMethod, PaymentStatus } from "@prisma/client";
import prisma from "../../config/prisma_db";
import { ordersService } from "../../services/orders.service";

describe("Orders Payment Service", () => {
   let testOrderId: number;
   let testUserId: string;

   beforeAll(async () => {
      // Setup: Create a test order for payment tests
      // You may need to adjust these IDs based on your test database
      const testOrder = await prisma.order.create({
         data: {
            customer_id: 1, // Adjust to existing customer
            receiver_id: 1, // Adjust to existing receiver
            service_id: 1, // Adjust to existing service
            agency_id: 1, // Adjust to existing agency
            user_id: "test-user-id",
            total_in_cents: 100000, // $1,000.00
            paid_in_cents: 0,
            payment_status: PaymentStatus.PENDING,
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
   });

   afterAll(async () => {
      // Cleanup: Delete test data
      if (testOrderId) {
         await prisma.payment.deleteMany({ where: { order_id: testOrderId } });
         await prisma.item.deleteMany({ where: { order_id: testOrderId } });
         await prisma.order.delete({ where: { id: testOrderId } });
      }
      await prisma.$disconnect();
   });

   describe("Full Payment", () => {
      it("should process full cash payment successfully", async () => {
         const paymentData = {
            amount_in_cents: 100000,
            method: PaymentMethod.CASH,
            reference: "CASH-TEST-001",
            notes: "Full payment test",
         };

         const result = await ordersService.payment(testOrderId, paymentData, testUserId);

         expect(result).toBeDefined();
         expect(result.order).toBeDefined();
         expect(result.payment).toBeDefined();
         expect(result.order.payment_status).toBe(PaymentStatus.PAID);
         expect(result.order.paid_in_cents).toBe(100000);
         expect(result.payment.amount_in_cents).toBe(100000);
         expect(result.payment.charge_in_cents).toBe(0);
      });
   });

   describe("Partial Payments", () => {
      let partialOrderId: number;

      beforeAll(async () => {
         const order = await prisma.order.create({
            data: {
               customer_id: 1,
               receiver_id: 1,
               service_id: 1,
               agency_id: 1,
               user_id: testUserId,
               total_in_cents: 100000,
               paid_in_cents: 0,
               payment_status: PaymentStatus.PENDING,
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
      });

      afterAll(async () => {
         if (partialOrderId) {
            await prisma.payment.deleteMany({ where: { order_id: partialOrderId } });
            await prisma.item.deleteMany({ where: { order_id: partialOrderId } });
            await prisma.order.delete({ where: { id: partialOrderId } });
         }
      });

      it("should process first partial payment", async () => {
         const paymentData = {
            amount_in_cents: 60000, // $600
            method: PaymentMethod.BANK_TRANSFER,
            reference: "TRANSFER-001",
         };

         const result = await ordersService.payment(partialOrderId, paymentData, testUserId);

         expect(result.order.payment_status).toBe(PaymentStatus.PARTIALLY_PAID);
         expect(result.order.paid_in_cents).toBe(60000);
         expect(result.order.total_in_cents).toBe(100000);
      });

      it("should process second partial payment and mark as paid", async () => {
         const paymentData = {
            amount_in_cents: 40000, // $400
            method: PaymentMethod.CASH,
         };

         const result = await ordersService.payment(partialOrderId, paymentData, testUserId);

         expect(result.order.payment_status).toBe(PaymentStatus.PAID);
         expect(result.order.paid_in_cents).toBe(100000);
         expect(result.order.total_in_cents).toBe(100000);
      });
   });

   describe("Card Payments with Fees", () => {
      let cardOrderId: number;

      beforeAll(async () => {
         const order = await prisma.order.create({
            data: {
               customer_id: 1,
               receiver_id: 1,
               service_id: 1,
               agency_id: 1,
               user_id: testUserId,
               total_in_cents: 100000,
               paid_in_cents: 0,
               payment_status: PaymentStatus.PENDING,
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
      });

      afterAll(async () => {
         if (cardOrderId) {
            await prisma.payment.deleteMany({ where: { order_id: cardOrderId } });
            await prisma.item.deleteMany({ where: { order_id: cardOrderId } });
            await prisma.order.delete({ where: { id: cardOrderId } });
         }
      });

      it("should calculate and apply 3% fee for credit card payment", async () => {
         const paymentData = {
            amount_in_cents: 100000, // $1,000
            method: PaymentMethod.CREDIT_CARD,
            reference: "CARD-XXXX-1234",
         };

         const result = await ordersService.payment(cardOrderId, paymentData, testUserId);

         const expectedFee = Math.round(100000 * 0.03); // $30
         const expectedTotal = 100000 + expectedFee; // $1,030

         expect(result.payment.charge_in_cents).toBe(expectedFee);
         expect(result.order.total_in_cents).toBe(expectedTotal);
         expect(result.order.paid_in_cents).toBe(100000);
         expect(result.order.payment_status).toBe(PaymentStatus.PARTIALLY_PAID); // Not fully paid due to fee
         expect(result.payment.notes).toContain("Card processing fee");
      });

      it("should calculate and apply 3% fee for debit card payment", async () => {
         // First, complete the previous payment to reset
         const completionPayment = {
            amount_in_cents: 3000, // Pay the fee
            method: PaymentMethod.CASH,
         };
         await ordersService.payment(cardOrderId, completionPayment, testUserId);

         // Create new order for debit card test
         const newOrder = await prisma.order.create({
            data: {
               customer_id: 1,
               receiver_id: 1,
               service_id: 1,
               agency_id: 1,
               user_id: testUserId,
               total_in_cents: 50000,
               paid_in_cents: 0,
               payment_status: PaymentStatus.PENDING,
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
            method: PaymentMethod.DEBIT_CARD,
            reference: "DEBIT-XXXX-5678",
         };

         const result = await ordersService.payment(newOrder.id, paymentData, testUserId);

         const expectedFee = Math.round(50000 * 0.03); // $15
         const expectedTotal = 50000 + expectedFee; // $515

         expect(result.payment.charge_in_cents).toBe(expectedFee);
         expect(result.order.total_in_cents).toBe(expectedTotal);
         expect(result.payment.notes).toContain("3%");

         // Cleanup
         await prisma.payment.deleteMany({ where: { order_id: newOrder.id } });
         await prisma.item.deleteMany({ where: { order_id: newOrder.id } });
         await prisma.order.delete({ where: { id: newOrder.id } });
      });
   });

   describe("Validation and Error Handling", () => {
      it("should reject payment with zero amount", async () => {
         const paymentData = {
            amount_in_cents: 0,
            method: PaymentMethod.CASH,
         };

         await expect(ordersService.payment(testOrderId, paymentData, testUserId)).rejects.toThrow(
            "Payment amount must be greater than 0"
         );
      });

      it("should reject payment with negative amount", async () => {
         const paymentData = {
            amount_in_cents: -1000,
            method: PaymentMethod.CASH,
         };

         await expect(ordersService.payment(testOrderId, paymentData, testUserId)).rejects.toThrow(
            "Payment amount must be greater than 0"
         );
      });

      it("should reject payment for non-existent order", async () => {
         const paymentData = {
            amount_in_cents: 10000,
            method: PaymentMethod.CASH,
         };

         await expect(ordersService.payment(999999, paymentData, testUserId)).rejects.toThrow("Order not found");
      });

      it("should reject payment exceeding remaining balance", async () => {
         const excessOrder = await prisma.order.create({
            data: {
               customer_id: 1,
               receiver_id: 1,
               service_id: 1,
               agency_id: 1,
               user_id: testUserId,
               total_in_cents: 50000, // $500
               paid_in_cents: 0,
               payment_status: PaymentStatus.PENDING,
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
            method: PaymentMethod.CASH,
         };

         await expect(ordersService.payment(excessOrder.id, paymentData, testUserId)).rejects.toThrow(
            "exceeds remaining balance"
         );

         // Cleanup
         await prisma.item.deleteMany({ where: { order_id: excessOrder.id } });
         await prisma.order.delete({ where: { id: excessOrder.id } });
      });

      it("should reject payment for already paid order", async () => {
         const paidOrder = await prisma.order.create({
            data: {
               customer_id: 1,
               receiver_id: 1,
               service_id: 1,
               agency_id: 1,
               user_id: testUserId,
               total_in_cents: 50000,
               paid_in_cents: 50000,
               payment_status: PaymentStatus.PAID,
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
            method: PaymentMethod.CASH,
         };

         await expect(ordersService.payment(paidOrder.id, paymentData, testUserId)).rejects.toThrow(
            "Order is already paid"
         );

         // Cleanup
         await prisma.item.deleteMany({ where: { order_id: paidOrder.id } });
         await prisma.order.delete({ where: { id: paidOrder.id } });
      });
   });
});
