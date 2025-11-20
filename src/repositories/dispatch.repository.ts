import prisma from "../lib/prisma.client";
import { Dispatch, Item, Prisma } from "@prisma/client";

const dispatch = {
   get: async (page: number, limit: number) => {
      const dispatches = await prisma.dispatch.findMany({
         skip: (page - 1) * limit,
         take: limit,
         select: {
            id: true,
            status: true,
            created_at: true,
            updated_at: true,
            total_in_cents: true,
            weight: true,
            sender_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            receiver_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            created_by: {
               select: {
                  id: true,
                  name: true,
               },
            },
            received_by: {
               select: {
                  id: true,
                  name: true,
               },
            },
            _count: {
               select: {
                  items: true,
               },
            },
         },
      });
      const total = await prisma.dispatch.count();
      return { dispatches, total };
   },
   getById: async (id: number): Promise<Dispatch> => {
      const dispatch = await prisma.dispatch.findUnique({
         where: { id: id },
         include: {
            created_by: true,
            received_by: true,
         },
      });
      if (!dispatch) {
         throw new Error("Dispatch not found");
      }
      return dispatch;
   },
   create: async (dispatch: Prisma.DispatchUncheckedCreateInput): Promise<Dispatch> => {
      const newDispatch = await prisma.dispatch.create({
         data: dispatch,
      });
      return newDispatch;
   },
   getItemByHbl: async (hbl: string, dispatchId: number): Promise<Item | null> => {
      const item = await prisma.item.findFirst({
         where: { hbl: hbl, dispatch_id: dispatchId },
      });
      return item;
   },
   update: async (id: number, dispatch: Prisma.DispatchUncheckedUpdateInput): Promise<Dispatch> => {
      const updatedDispatch = await prisma.dispatch.update({
         where: { id: id },
         data: dispatch,
      });
      return updatedDispatch;
   },
   delete: async (id: number): Promise<Dispatch> => {
      const deletedDispatch = await prisma.dispatch.delete({
         where: { id: id },
      });
      if (!deletedDispatch) {
         throw new Error("Dispatch not found");
      }
      return deletedDispatch;
   },
   addItem: async (item: any, dispatchId: number): Promise<Dispatch> => {
      const updatedDispatch = await prisma.dispatch.update({
         where: { id: dispatchId },
         data: {
            items: {
               connect: {
                  hbl: item.hbl,
               },
            },
            weight: {
               increment: item.weight,
            },
            total_in_cents: {
               increment: item.rate.pricing_agreement.price_in_cents * item.weight,
            },
         },
      });
      return updatedDispatch;
   },
};

export default dispatch;
