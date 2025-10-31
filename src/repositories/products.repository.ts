import { Product } from "@prisma/client";
import prisma from "../config/prisma_db";

export const products = {
   getAll: async () => {
      return await prisma.product.findMany();
   },
   create: async (product: Product) => {
      return await prisma.product.create({ data: product });
   },
   getById: async (id: number) => {
      return await prisma.product.findUnique({ where: { id } });
   },
   update: async (id: number, product: Product) => {
      return await prisma.product.update({ where: { id: Number(id) }, data: product });
   },
   delete: async (id: number) => {
      return await prisma.product.delete({ where: { id } });
   },
};

export default products;
