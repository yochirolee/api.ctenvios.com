import { Prisma } from "@prisma/client";

export const orderWithRelationsInclude = Prisma.validator<Prisma.OrderInclude>()({
   customer: true,
   receiver: {
      include: {
         province: true,
         city: true,
      },
   },
   agency: true,
   service: {
      include: {
         provider: true,
         forwarder: true,
      },
   },
   order_items: {
      orderBy: { hbl: "asc" },
   },
   payments: true,
   discounts: true,
   user: true,
});

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderWithRelationsInclude }>;
