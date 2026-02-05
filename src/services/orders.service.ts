import { Customer, Prisma, PaymentMethod, PaymentStatus, Status, Unit, DiscountType } from "@prisma/client";
import { services } from ".";
import repository from "../repositories";
import { calculateOrderTotal, formatCents, toNumber, distributeCents } from "../utils/utils";
import { PAYMENT_CONFIG } from "../config/payment.config";
import prisma from "../lib/prisma.client";
import StatusCodes from "../common/https-status-codes";
import { AppError } from "../common/app-errors";
import { buildHBL, todayYYMM } from "../utils/generate-hbl";

interface OrderCreateInput {
   partner_id?: number;
   partner_order_id?: string;
   customer_id?: number;
   receiver_id?: number;
   customer?: Partial<Customer>;
   receiver?: any; // ReceiverWithLocationNames from receivers.service
   order_items: any[]; // Using any[] to support rate_type and other extended fields
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
      partner_id,
      partner_order_id,
      customer_id,
      receiver_id,
      customer,
      receiver,
      order_items,
      service_id,
      user_id,
      agency_id,
      total_delivery_fee_in_cents,
      requires_home_delivery = true,
   }: OrderCreateInput): Promise<any> => {
      // 1) Resolver customer/receiver igual que antes (fast/slow path)
      let finalCustomerId = customer_id;
      let finalReceiverId = receiver_id;

      if (!customer_id || !receiver_id) {
         const [resolvedReceiver, resolvedCustomer] = await Promise.all([
            services.resolvers.resolveReceiver({ receiver_id, receiver }),
            services.resolvers.resolveCustomer({ customer_id, customer }),
         ]);
         finalCustomerId = resolvedCustomer.id;
         finalReceiverId = resolvedReceiver.id;
      }

      // 2) Resolver items SIN HBL (nuevo)
      //    Debe devolverte: description, price_in_cents, rate_id, insurance_fee_in_cents, customs_fee_in_cents,
      //    quantity, weight, agency_id, unit, etc.
      const items = await services.resolvers.resolveItems({
         order_items,
         service_id,
         agency_id,
      });

      // 3) Fees / totals (igual que tú)
      const finalTotal = calculateOrderTotal(items);

      const totalDeliveryFeeCents = Math.round(total_delivery_fee_in_cents ?? 0);
      const perItemDeliveryFees = distributeCents(totalDeliveryFeeCents, items.length);
      for (let i = 0; i < items.length; i++) {
         items[i].delivery_fee_in_cents = perItemDeliveryFees[i] ?? 0;
      }

      const total_in_cents = finalTotal + (total_delivery_fee_in_cents || 0);

      // 4) Transacción única (ultra consistente)
      const order = await prisma.$transaction(async (tx) => {
         // A) Crear Order primero (para obtener orderId)
         const createdOrder = await tx.order.create({
            data: {
               partner_order_id,
               customer_id: finalCustomerId!,
               receiver_id: finalReceiverId!,
               service_id,
               user_id,
               agency_id,
               status: Status.IN_AGENCY,
               requires_home_delivery,
               partner_id,
               total_in_cents,
            },
            select: { id: true },
         });

         const orderId = createdOrder.id;

         // B) Generar HBLs terminando en 001.. (por orden)
         const forwarder = await prisma.forwarder.findUnique({
            where: {
               id: agency_id,
            },
         });
         const provider = (forwarder?.code ?? "CTE").toUpperCase(); // fallback si quieres

         const yymm = todayYYMM("America/New_York");

         // C) items <= 99
         if (items.length > 99) throw new Error("Max 99 items per order");

         const hbls = items.map((_, i) => buildHBL(provider, yymm, orderId, i + 1));

         // C) Crear Parcels (HOY: 1 parcel por item)
         await tx.parcel.createMany({
            data: items.map((item, i) => ({
               tracking_number: hbls[i], // interno por ahora
               description: item.description,
               external_reference: item.external_reference || null,
               weight: item.weight,
               status: Status.IN_AGENCY,
               user_id,
               agency_id,
               current_agency_id: agency_id,
               service_id,
               order_id: orderId,
            })),
         });

         // D) Leer parcels para mapear parcel_id por tracking_number (HBL)
         const parcels = await tx.parcel.findMany({
            where: { tracking_number: { in: hbls } },
            select: { id: true, tracking_number: true },
         });

         const parcelIdByTracking = new Map(parcels.map((p) => [p.tracking_number, p.id]));

         // E) Crear OrderItems con parcel_id directo (sin connect por tracking)
         await tx.orderItem.createMany({
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
               status: Status.IN_AGENCY,
               rate_id: item.rate_id,
               customs_rates_id: item.customs_rates_id || null,
               order_id: orderId,
               parcel_id: parcelIdByTracking.get(hbls[i])!, // ✅ FK directo
            })),
         });

         // F) Crear eventos iniciales en batch (más rápido que nested)
         await tx.parcelEvent.createMany({
            data: parcels.map((p) => ({
               parcel_id: p.id,
               event_type: "BILLED",
               user_id,
               status: Status.IN_AGENCY,
            })),
         });

         // G) Retornar la orden completa (ajusta include a tu gusto)
         return tx.order.findUnique({
            where: { id: orderId },
            include: { parcels: true, order_items: true },
         });
      });

      // Post tareas no críticas (igual que tu lógica)
      repository.receivers
         .connect(finalReceiverId!, finalCustomerId!)
         .catch((err) => console.error("Receiver connection failed (non-critical):", err));

      repository.agencies.addCustomerToAgency(agency_id, finalCustomerId!);
      repository.agencies.addReceiverToAgency(agency_id, finalReceiverId!);

      return order;
   },

   payOrder: async (order_id: number, paymentData: Prisma.PaymentCreateInput, user_id: string): Promise<any> => {
      // Validate amount
      if (!paymentData.amount_in_cents || paymentData.amount_in_cents <= 0) {
         throw new AppError(StatusCodes.BAD_REQUEST, "Payment amount must be greater than 0");
      }

      // Get order with full details
      const order_to_pay = await repository.orders.getById(order_id);
      if (!order_to_pay) {
         throw new AppError(StatusCodes.NOT_FOUND, "Order not found");
      }

      // Check if order is already paid
      if (order_to_pay.payment_status === PaymentStatus.PAID) {
         throw new AppError(StatusCodes.BAD_REQUEST, "Order is already paid");
      }

      // Calculate charge for card payments
      let charge = 0;
      if (paymentData.method === PaymentMethod.CREDIT_CARD || paymentData.method === PaymentMethod.DEBIT_CARD) {
         charge = Math.round(paymentData.amount_in_cents * PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE);
         paymentData.charge_in_cents = charge;
         paymentData.notes = `Card processing fee (${PAYMENT_CONFIG.CARD_PROCESSING_FEE_RATE * 100}%): ${formatCents(
            charge,
         )}`;
      }

      // Calculate new totals
      const totalPaidAfterPayment = order_to_pay.paid_in_cents + paymentData.amount_in_cents + charge;
      const newTotalWithCharge = order_to_pay.total_in_cents + charge;

      // Validate payment doesn't exceed total
      if (totalPaidAfterPayment > newTotalWithCharge) {
         throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Payment amount (${formatCents(paymentData.amount_in_cents)}) exceeds remaining balance (${formatCents(
               newTotalWithCharge - order_to_pay.paid_in_cents,
            )})`,
         );
      }

      // Determine new payment status
      let newPaymentStatus: PaymentStatus;
      if (totalPaidAfterPayment >= newTotalWithCharge) {
         newPaymentStatus = PaymentStatus.PAID;
      } else if (totalPaidAfterPayment > 0) {
         newPaymentStatus = PaymentStatus.PARTIALLY_PAID;
      } else {
         newPaymentStatus = PaymentStatus.PENDING;
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
         throw new AppError(StatusCodes.NOT_FOUND, "Payment not found");
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
   addDiscount: async (order_id: number, discountData: Prisma.DiscountCreateInput, user_id: string): Promise<any> => {
      const order = await prisma.order.findUnique({
         where: { id: order_id },
         include: { order_items: true, discounts: true },
      });
      if (!order) {
         throw new AppError(StatusCodes.NOT_FOUND, "Order not found");
      }
      // Prevent adding discount to already paid orders
      if (order.payment_status === PaymentStatus.PAID) {
         throw new AppError(StatusCodes.BAD_REQUEST, "Cannot add discount to an already paid order");
      }
      let total_discount_in_cents = 0;

      switch (discountData.type) {
         case DiscountType.RATE:
            total_discount_in_cents = order.order_items.reduce((acc, item) => {
               if (item.unit === Unit.PER_LB) {
                  const weight = toNumber(item.weight); // weight is Decimal, needs conversion
                  return (
                     acc + Math.ceil(item.price_in_cents * weight - weight * (discountData?.discount_in_cents || 1))
                  );
               }
               return acc;
            }, 0);
            break;
         case DiscountType.CASH:
            if ((discountData?.discount_in_cents ?? 0) > order.total_in_cents) {
               throw new AppError(StatusCodes.BAD_REQUEST, "Discount amount cannot be greater than order total");
            }
            total_discount_in_cents = discountData.discount_in_cents ?? 0;
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
      let newPaymentStatus: PaymentStatus | undefined;
      if (total_discount_in_cents === order.total_in_cents) {
         // Discount equals the full order total
         newPaymentStatus = PaymentStatus.FULL_DISCOUNT;
      } else if (total_discount_in_cents > 0 && !isFullyPaid) {
         // Order has discount but is not fully paid
         newPaymentStatus = PaymentStatus.PENDING;
      }
      // If discount doesn't equal total and order is fully paid, status remains unchanged

      const result = await prisma.$transaction(async (tx) => {
         // Create discount
         await tx.discount.create({
            data: {
               type: discountData.type,
               description: discountData.description,
               rate: discountData.discount_in_cents,
               discount_in_cents: total_discount_in_cents,
               order_id: order_id,
               user_id: user_id,
            },
         });
         const updateData: Prisma.OrderUncheckedUpdateInput = {
            total_in_cents: newTotalInCents,
         };
         if (newPaymentStatus) {
            updateData.payment_status = newPaymentStatus;
         }
         const updatedOrder = await tx.order.update({
            where: { id: order_id },
            data: updateData,
         });
         return updatedOrder;
      });

      return result;
   },
   removeDiscount: async (discount_id: number): Promise<any> => {
      const discount_to_remove = await prisma.discount.findUnique({
         where: { id: discount_id },
         include: {
            order: true,
         },
      });
      if (!discount_to_remove) {
         throw new AppError(StatusCodes.NOT_FOUND, "Discount not found");
      }

      const order = discount_to_remove.order;
      const newTotalInCents = order.total_in_cents + discount_to_remove.discount_in_cents;

      // Recalculate payment status based on paid amount vs new total
      let newPaymentStatus: PaymentStatus;
      if (order.paid_in_cents >= newTotalInCents) {
         newPaymentStatus = PaymentStatus.PAID;
      } else if (order.paid_in_cents > 0) {
         newPaymentStatus = PaymentStatus.PARTIALLY_PAID;
      } else {
         newPaymentStatus = PaymentStatus.PENDING;
      }

      const result = await prisma.$transaction(async (tx) => {
         await tx.discount.delete({
            where: { id: discount_id },
         });
         const updatedOrder = await tx.order.update({
            where: { id: discount_to_remove.order_id },
            data: {
               total_in_cents: newTotalInCents,
               payment_status: newPaymentStatus,
            },
         });
         return updatedOrder;
      });
      return result;
   },
};
