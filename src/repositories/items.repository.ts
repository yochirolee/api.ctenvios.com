import prisma from "../lib/prisma.client";
import { Item, Prisma } from "@prisma/client";

const items = {
   get: async (page: number, limit: number) => {
      return await prisma.item.findMany({
         take: limit,
         skip: (page - 1) * limit,
         orderBy: {
            hbl: "asc",
         },
      });
   },
   findForDispatch: async (hbl: string) => {
      return await prisma.item.findUnique({
         where: { hbl },
         select: {
            hbl: true,
            description: true,
            weight: true,
            unit: true,
            delivery_fee_in_cents: true,
            rate_id: true,
            dispatch_id: true,
            rate: {
               select: {
                  pricing_agreement: {
                     select: {
                        price_in_cents: true,
                     },
                  },
               },
            },
         },
      });
   },
};

export default items;
