import { City, Prisma, Province, Receiver } from "@prisma/client";
import prisma from "../config/prisma_db";

const receivers = {
   get: async (
      page: number = 1,
      limit: number = 10
   ): Promise<{ rows: (Receiver & { province: Province; city: City })[]; total: number }> => {
      // Ensure valid numeric values
      const total = await prisma.receiver.count();
      const rows = await prisma.receiver.findMany({
         skip: (page - 1) * limit,
         take: limit,
         orderBy: {
            first_name: "asc",
         },
         include: {
            province: true,
            city: true,
         },
      });

      return { rows, total };
   },
   search: async (query: string, page: number = 1, limit: number = 10): Promise<Receiver[]> => {
      const terms = query.trim().split(/\s+/).filter(Boolean);

      const receivers = await prisma.receiver.findMany({
         where: {
            OR: [
               // Búsqueda por campos individuales
               { first_name: { contains: query, mode: "insensitive" } },
               { middle_name: { contains: query, mode: "insensitive" } },
               { last_name: { contains: query, mode: "insensitive" } },
               { second_last_name: { contains: query, mode: "insensitive" } },
               { email: { contains: query, mode: "insensitive" } },
               { mobile: { contains: query, mode: "insensitive" } },

               // Búsqueda combinada por nombre completo (en cualquier orden)
               {
                  AND: terms.map((term) => ({
                     OR: [
                        { first_name: { contains: term, mode: "insensitive" } },
                        { middle_name: { contains: term, mode: "insensitive" } },
                        { last_name: { contains: term, mode: "insensitive" } },
                        { second_last_name: { contains: term, mode: "insensitive" } },
                     ],
                  })),
               },
            ],
         },
         include: {
            province: true,
            city: true,
         },
         skip: (page - 1) * limit,
         take: limit,
         orderBy: {
            first_name: "asc",
         },
      });

      return receivers.map((receiver) => ({
         ...receiver,
         province: receiver.province.name,
         city: receiver.city.name,
      }));
   },

   create: async (receiver: Prisma.ReceiverUncheckedCreateInput ): Promise<Receiver> => {
      const newReceiver = await prisma.receiver.create({
         data: receiver,
         include: {
            province: true,
            city: true,
         },
      });
      return newReceiver;
   },
   getById: async (id: number): Promise<Receiver & { province: Province; city: City }> => {
      const receiver = await prisma.receiver.findUnique({
         where: { id: id },
         include: {
            province: true,
            city: true,
         },
      });
      return receiver as Receiver & { province: Province; city: City };
   },
   getByCi: async (ci: string): Promise<Receiver & { province: Province; city: City }> => {
      const receiver = await prisma.receiver.findUnique({
         where: { ci: ci },
         include: {
            province: true,
            city: true,
         },
      });
      return receiver as Receiver & { province: Province; city: City };
   },
   connect: async (receiverId: number, customerId: number): Promise<Receiver> => {
      // Ensure both IDs are valid
      if (!receiverId || !customerId) {
         throw new Error("Both receiverId and customerId are required");
      }

      const updatedReceiver = await prisma.receiver.update({
         where: {
            id: receiverId,
         },
         data: {
            customers: {
               connect: {
                  id: customerId,
               },
            },
         },
         include: {
            province: true,
            city: true,
            customers: true, // Include customer data in response
         },
      });
      const flat_receiver = {
         ...updatedReceiver,
         province: updatedReceiver.province.name,
         city: updatedReceiver.city.name,
      };

      return flat_receiver;
   },
   disconnect: async (receiverId: number, customerId: number): Promise<Receiver> => {
      const updatedReceiver = await prisma.receiver.update({
         where: { id: receiverId },
         data: {
            customers: {
               disconnect: { id: customerId },
            },
         },
      });
      return updatedReceiver;
   },
   edit: async (id: number, receiver: Prisma.ReceiverUpdateInput): Promise<Receiver> => {
      const updatedReceiver = await prisma.receiver.update({
         where: { id },
         data: receiver,
         include: {
            province: true,
            city: true,
         },
      });
      const flat_receiver = {
         ...updatedReceiver,
         province: updatedReceiver.province.name,
         city: updatedReceiver.city.name,
      };
      return flat_receiver;
   },
};

export default receivers;
