import prisma from "../lib/prisma.client";
import { Prisma } from "@prisma/client";

export const customsRates = {
   get: async (page: number, limit: number) => {
      // Parallelize count and findMany queries for better performance
      const [total, rows] = await Promise.all([
         prisma.customsRates.count(),
         prisma.customsRates.findMany({
            take: limit,
            skip: (page - 1) * limit,
            orderBy: {
               id: "asc",
            },
         }),
      ]);
      return { rows, total };
   },
   getById: async (id: number) => {
      const rate = await prisma.customsRates.findUnique({ where: { id } });
      return rate;
   },
   search: async (query: string, page: number, limit: number) => {
      const rows = await prisma.customsRates.findMany({
         where: { name: { contains: query, mode: "insensitive" } },
         take: limit,
         skip: (page - 1) * limit,
         orderBy: { id: "asc" },
      });
      const total = await prisma.customsRates.count({ where: { name: { contains: query, mode: "insensitive" } } });
      return { rows, total };
   },

   create: async (rate: Prisma.CustomsRatesCreateInput) => {
      const newRate = await prisma.customsRates.create({ data: rate });
      return newRate;
   },
   update: async (id: number, rate: Prisma.CustomsRatesUpdateInput | Prisma.CustomsRatesUncheckedUpdateInput) => {
      // Transformar country_id a relación country si está presente
      // Prisma requiere usar la relación incluso en UncheckedUpdateInput
      const updateData: any = { ...rate };

      // Si rate tiene country_id como campo directo, convertirlo a relación
      if ("country_id" in updateData && typeof updateData.country_id === "number") {
         updateData.country = {
            connect: { id: updateData.country_id },
         };
         delete updateData.country_id;
      }

      const updatedRate = await prisma.customsRates.update({
         where: { id },
         data: updateData as Prisma.CustomsRatesUpdateInput,
      });
      return updatedRate;
   },
   delete: async (id: number) => {
      const deletedRate = await prisma.customsRates.delete({ where: { id } });
      return deletedRate;
   },
};

export default customsRates;
