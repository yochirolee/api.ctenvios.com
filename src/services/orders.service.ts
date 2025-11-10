import { Customer, Prisma, PaymentMethod, PaymentStatus, Status, Unit } from "@prisma/client";
import { services } from ".";
import repository from "../repositories";
import { calculateOrderTotal, formatCents } from "../utils/utils";
import { PAYMENT_CONFIG } from "../config/payment.config";
import prisma from "../config/prisma_db";

interface OrderCreateInput {
   partner_order_id?: string;
   customer_id?: number;
   receiver_id?: number;
   customer?: Partial<Customer>;
   receiver?: any; // ReceiverWithLocationNames from receivers.service
   items: any[]; // Using any[] to support rate_type and other extended fields
   service_id: number;
   user_id: string;
   agency_id: number;
   total_delivery_fee_in_cents?: number;
   requires_home_delivery?: boolean;
}

export const ordersService = {
   /**
    * Creates an order handling both frontend and partner scenarios
    * Frontend: provides customer_id and receiver_id
    * Partners: provides customer and receiver data (with location names)
    */
   create: async ({
      partner_order_id,
      customer_id,
      receiver_id,
      customer,
      receiver,
      items,
      service_id,
      user_id,
      agency_id,
      total_delivery_fee_in_cents,
      requires_home_delivery = true,
   }: OrderCreateInput): Promise<any> => {
      const items_hbl = await services.resolvers.resolveItemsWithHbl({
         items,
         service_id,
         agency_id,
      });
      //calculate delivery fee for each item temporarily
      const finalTotal = calculateOrderTotal(items_hbl);

      const item_delivery_fee = total_delivery_fee_in_cents ? total_delivery_fee_in_cents / items_hbl.length : 0;

      for (let i = 0; i < items_hbl.length; i++) {
         items_hbl[i].delivery_fee_in_cents = item_delivery_fee;
      }
      // 🚀 OPTIMIZATION: Fast path for frontend (IDs provided, no lookups needed)
      if (customer_id && receiver_id) {
         const orderData: Prisma.OrderUncheckedCreateInput = {
            partner_order_id,
            customer_id,
            receiver_id,
            service_id,
            user_id,
            agency_id,
            status: Status.CREATED,
            requires_home_delivery,
            items: {
               create: items_hbl,
            },
            total_in_cents: finalTotal + (total_delivery_fee_in_cents || 0),
         };

         const order = await repository.orders.create(orderData);

         // 🚀 Non-blocking receiver connection
         repository.receivers
            .connect(receiver_id, customer_id)
            .catch((err) => console.error("Receiver connection failed (non-critical):", err));

         return order;
      }

      // Slow path for partners (requires entity resolution/creation)
      const [resolvedReceiver, resolvedCustomer] = await Promise.all([
         services.resolvers.resolveReceiver({
            receiver_id,
            receiver,
         }),
         services.resolvers.resolveCustomer({
            customer_id,
            customer,
         }),
      ]);

      const orderData: Prisma.OrderUncheckedCreateInput = {
         partner_order_id,
         customer_id: resolvedCustomer.id,
         receiver_id: resolvedReceiver.id,
         service_id,
         user_id,
         agency_id,
         status: Status.CREATED,
         requires_home_delivery,
         items: {
            create: items_hbl,
         },
         total_in_cents: finalTotal + (total_delivery_fee_in_cents || 0),
      };

      const order = await repository.orders.create(orderData);

      // 🚀 Non-blocking receiver connection
      repository.receivers
         .connect(resolvedReceiver.id, resolvedCustomer.id)
         .catch((err) => console.error("Receiver connection failed (non-critical):", err));

      return order;
   },
   payOrder: async (order_id: number, paymentData: Prisma.PaymentCreateInput, user_id: string): Promise<any> => {
      // Validate amount
      if (!paymentData.amount_in_cents || paymentData.amount_in_cents <= 0) {
         throw new Error("Payment amount must be greater than 0");
      }

      // Get order with full details
      const order_to_pay = await repository.orders.getById(order_id);
      if (!order_to_pay) {
         throw new Error("Order not found");
      }

      // Check if order is already paid
      if (order_to_pay.payment_status === PaymentStatus.PAID) {
         throw new Error("Order is already paid");
      }

      // Calculate charge for card payments
      let charge = 0;
      if (paymentData.method === PaymentMethod.CREDIT_CARD || paymentData.method === PaymentMethod.DEBIT_CARD) {
         charge = Math.round(paymentData.amount_in_cents * PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE);
         paymentData.charge_in_cents = charge;
         paymentData.notes = `Card processing fee (${PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE * 100}%): ${formatCents(
            charge
         )}`;
      }

      // Calculate new totals
      const totalPaidAfterPayment = order_to_pay.paid_in_cents + paymentData.amount_in_cents + charge;
      const newTotalWithCharge = order_to_pay.total_in_cents + charge;

      // Validate payment doesn't exceed total
      if (totalPaidAfterPayment > newTotalWithCharge) {
         throw new Error(
            `Payment amount ($${formatCents(paymentData.amount_in_cents)}) exceeds remaining balance ($${formatCents(
               newTotalWithCharge - order_to_pay.paid_in_cents
            )})`
         );
      }

      // Determine new payment status
      let newPaymentStatus: PaymentStatus;
      if (totalPaidAfterPayment >= newTotalWithCharge) {
         newPaymentStatus = PaymentStatus.PAID;
         order_to_pay.status = Status.PAID;
      } else if (totalPaidAfterPayment > 0) {
         newPaymentStatus = PaymentStatus.PARTIALLY_PAID;
         order_to_pay.status = Status.PARTIALLY_PAID;
      } else {
         newPaymentStatus = PaymentStatus.PENDING;
         order_to_pay.status = Status.CREATED;
      }

      // Execute payment transaction
      const result = await prisma.$transaction(async (tx) => {
         // Update order
         const updatedOrder = await tx.order.update({
            where: { id: order_to_pay.id },
            data: {
               paid_in_cents: totalPaidAfterPayment,
               total_in_cents: newTotalWithCharge,
               payment_status: newPaymentStatus,
               status: order_to_pay.status,
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
         await tx.payment.create({
            data: {
               amount_in_cents: paymentData.amount_in_cents,
               charge_in_cents: charge,
               method: paymentData.method,
               reference: paymentData.reference,
               notes: paymentData.notes,
               order_id: order_to_pay.id,
               user_id: user_id,
            } as Prisma.PaymentUncheckedCreateInput,
         });

         return updatedOrder;
      });

      return result;
   },
   removePayment: async (payment_id: number): Promise<any> => {
      // Get the payment to be deleted (need amount and charge before deletion)
      const payment = await prisma.payment.findUnique({
         where: { id: payment_id },
         include: {
            order: true,
         },
      });

      if (!payment) {
         throw new Error("Payment not found");
      }

      // Calculate new totals after removing this payment
      const charge = payment.charge_in_cents || 0;
      const newPaidAmount = payment.order.paid_in_cents - payment.amount_in_cents - charge;
      const newTotalAmount = payment.order.total_in_cents - charge;

      // Determine new payment status
      let newPaymentStatus: PaymentStatus;
      if (newPaidAmount >= newTotalAmount) {
         newPaymentStatus = PaymentStatus.PAID;
      } else if (newPaidAmount > 0) {
         newPaymentStatus = PaymentStatus.PARTIALLY_PAID;
      } else {
         newPaymentStatus = PaymentStatus.PENDING;
      }

      // Execute removal in a transaction
      const result = await prisma.$transaction(async (tx) => {
         // Delete the payment
         await tx.payment.delete({
            where: { id: payment_id },
         });

         // Update order with recalculated amounts
         const updatedOrder = await tx.order.update({
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
      });

      return result;
   },
};
