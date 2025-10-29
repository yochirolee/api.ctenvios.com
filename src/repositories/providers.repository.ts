import prisma from "../config/prisma_db";
import { Provider } from "@prisma/client";

export const providers = {
   getAll: async () => {
      const providers = await prisma.provider.findMany({
         include: {
            forwarders: true,
            services: {
               include: {
                  agencies: true,
               },
            },
         },
      });
      return providers;
   },
   create: async (provider: Omit<Provider, "id">) => {
      return await prisma.provider.create({
         data: provider,
      });
   },

   getById: async (id: number) => {
      const provider = await prisma.provider.findUnique({
         where: { id },
         include: {
            services: {
               include: {
                  products: true,
               },
            },
         },
      });
      return provider;
   },
   update: async (id: number, provider: Omit<Provider, "id">) => {
      try {
         return await prisma.provider.update({
            where: { id },
            data: provider,
         });
         return updatedProvider;
      } catch (error) {
         console.error("Error updating provider:", error);
         throw error;
      }
   },
   delete: async (id: number) => {
      try {
         const deletedProvider = await prisma.provider.delete({
            where: { id },
         });
         return deletedProvider;
      } catch (error) {
         console.error("Error deleting provider:", error);
         throw error;
      }
   },
};

export default providers;
