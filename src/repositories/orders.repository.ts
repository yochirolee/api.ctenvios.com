import { Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";
import { orderWithRelationsInclude } from "../types/order-with-relations";

export type OrderPdfDetails = Prisma.OrderGetPayload<{ include: typeof orderWithRelationsInclude }>;

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
      return await prisma.order.findUnique({ where: { id }, include: { items: true } });
   },
   getByIdWithDetails: async (id: number): Promise<OrderPdfDetails | null> => {
      console.log("getByIdWithDetails", id);
      return await prisma.order.findUnique({
         where: { id },
         include: orderWithRelationsInclude,
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
