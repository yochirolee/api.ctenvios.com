import { Product, Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

export const products = {
   getAll: async () => {
      return await prisma.product.findMany({
         include: {
            services: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });
   },
   create: async (product: Prisma.ProductCreateInput) => {
      console.log("create product", product);
      return await prisma.product.create({ data: product });
   },
   getById: async (id: number) => {
      return await prisma.product.findUnique({ where: { id } });
   },
   update: async (id: number, product: Prisma.ProductUpdateInput) => {
      return await prisma.product.update({ where: { id: Number(id) }, data: product });
   },
   connectServices: async (id: number, serviceId: number) => {
      return await prisma.product.update({
         where: { id },
         data: { services: { connect: { id: serviceId } } },
      });
   },
   disconnectServices: async (id: number, serviceId: number) => {
      return await prisma.product.update({
         where: { id },
         data: { services: { disconnect: { id: serviceId } } },
      });
   },
   delete: async (id: number) => {
      return await prisma.product.delete({ where: { id } });
   },
};

export default products;
