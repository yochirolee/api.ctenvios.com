import { ShippingRate } from "@prisma/client";
import prisma from "../config/prisma_db";
import { Prisma } from "@prisma/client";

export const shippingRates = {
 
   update: async (id: number, shippingRate: Prisma.ShippingRateUpdateInput) => {
      return await prisma.shippingRate.update({ where: { id }, data: shippingRate });
   },
   delete: async (id: number) => {
      return await prisma.shippingRate.delete({ where: { id } });
   },
};
export default shippingRates;
