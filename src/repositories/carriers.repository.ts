import prisma from "../lib/prisma.client";
import { Prisma } from "@prisma/client";

export const carriers = {
   getAll: async () => {
      const carriers = await prisma.carrier.findMany({
         include: {
            forwarder: {
               select: {
                  id: true,
                  name: true,
               },
            },
            services: {
               select: {
                  id: true,
                  name: true,
                  is_active: true,
               },
            },
            _count: {
               select: {
                  users: true,
                  services: true,
               },
            },
         },
         orderBy: {
            id: "asc",
         },
      });
      return carriers;
   },

   getById: async (id: number) => {
      const carrier = await prisma.carrier.findUnique({
         where: { id },
         include: {
            forwarder: {
               select: {
                  id: true,
                  name: true,
               },
            },
            services: {
               select: {
                  id: true,
                  name: true,
                  is_active: true,
               },
            },
            _count: {
               select: {
                  users: true,
                  services: true,
               },
            },
         },
      });
      return carrier;
   },

   getUsers: async (id: number) => {
      const users = await prisma.user.findMany({
         select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
         },
         where: { carrier_id: id },
         orderBy: {
            name: "asc",
         },
      });
      return users;
   },

   create: async (data: Prisma.CarrierCreateInput) => {
      const carrier = await prisma.carrier.create({
         data,
         include: {
            forwarder: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });
      return carrier;
   },

   update: async (id: number, data: Prisma.CarrierUpdateInput) => {
      const updatedCarrier = await prisma.carrier.update({
         where: { id },
         data,
         include: {
            forwarder: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
      });
      return updatedCarrier;
   },

   delete: async (id: number): Promise<void> => {
      await prisma.carrier.delete({
         where: { id },
      });
   },

   getByForwarderId: async (forwarderId: number) => {
      const carriers = await prisma.carrier.findMany({
         where: { forwarder_id: forwarderId },
         include: {
            _count: {
               select: {
                  users: true,
                  services: true,
               },
            },
         },
         orderBy: {
            name: "asc",
         },
      });
      return carriers;
   },
};

export default carriers;

