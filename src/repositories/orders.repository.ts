import { Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

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
         select: {
            id: true,
            created_at: true,
            total_in_cents: true,
            paid_in_cents: true,
            payment_status: true,
            requires_home_delivery: true,
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
                  address: true,
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
               select: { id: true, name: true, service_type: true, provider: { select: { id: true, name: true } } },
            },
            agency: { select: { id: true, name: true, address: true, phone: true } },
            user: { select: { id: true, name: true } },
            _count: { select: { items: true } },
         },
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
               },
            },
         },
      });
   },
};

export default orders;
