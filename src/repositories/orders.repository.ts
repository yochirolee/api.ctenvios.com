import { Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

const orderPdfSelect = Prisma.validator<Prisma.OrderSelect>()({
   id: true,
   partner_order_id: true,
   customer_id: true,
   receiver_id: true,
   service_id: true,
   agency_id: true,
   user_id: true,
   total_in_cents: true,
   paid_in_cents: true,
   payment_status: true,
   requires_home_delivery: true,
   created_at: true,
   updated_at: true,
   stage: true,
   
   status: true,
   customer: {
      select: {
         id: true,
         first_name: true,
         middle_name: true,
         last_name: true,
         second_last_name: true,
         mobile: true,
         address: true,
      },
   },
   receiver: {
      select: {
         id: true,
         first_name: true,
         middle_name: true,
         last_name: true,
         second_last_name: true,
         mobile: true,
         phone: true,
         address: true,
         ci: true,
         province: { select: { name: true } },
         city: { select: { name: true } },
      },
   },
   items: {
      select: {
         hbl: true,
         description: true,
         weight: true,
         price_in_cents: true,
         charge_fee_in_cents: true,
         delivery_fee_in_cents: true,
         insurance_fee_in_cents: true,
         customs_fee_in_cents: true,
         unit: true,
      },
   },
   payments: {
      select: {
         id: true,
         amount_in_cents: true,
         charge_in_cents: true,
         method: true,
         date: true,
      },
   },
   service: {
      select: {
         id: true,
         name: true,
         service_type: true,
         provider: { select: { id: true, name: true } },
      },
   },
   agency: { select: { id: true, name: true, address: true, phone: true, logo: true } },
   user: { select: { id: true, name: true, email: true } },
});

export type OrderPdfDetails = Prisma.OrderGetPayload<{ select: typeof orderPdfSelect }>;

const orders = {
   getAll: async ({ page, limit }: { page: number; limit: number }) => {
      const orders = await prisma.order.findMany({
         skip: (page - 1) * limit,
         take: limit,
      });
      const total = await prisma.order.count();
      return { orders, total };
   },
   getById: async (id: number) => {
      return await prisma.order.findUnique({ where: { id } });
   },
   getByIdWithDetails: async (id: number) => {
      return await prisma.order.findUnique({
         where: { id },
         select: orderPdfSelect,
      });
   },
   create: async (orderData: Prisma.OrderUncheckedCreateInput) => {
      return await prisma.order.create({
         data: orderData,
         include: {
            customer: true,
            receiver: {
               include: {
                  province: true,
                  city: true,
               },
            },
            items: {
               select: {
                  hbl: true,
                  description: true,
                  weight: true,
                  rate_id: true,
                  price_in_cents: true,
                  unit: true,
                  delivery_fee_in_cents: true,
               },
            },
         },
      });
   },

   delete: async (id: number) => {
      return await prisma.order.delete({ where: { id } });
   },
};

export default orders;
