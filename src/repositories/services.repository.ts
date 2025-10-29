import { Service, Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

const services = {
   create: async (service: Prisma.ServiceCreateInput) => {
      return await prisma.service.create({ data: service });
   },
   getAll: async () => {
      try {
         const services = await prisma.service.findMany({
            include: {
               provider: true,
               forwarder: true,
            },
            where: {
               is_active: true,
            },
         });
         return services.map((service) => {
            return {
               id: service.id,
               name: service.name,
               provider: service.provider.name,
               service_type: service.service_type,
               is_active: service.is_active,
            };
         });
      } catch (error) {
         console.error("Error getting all services:", error);
         throw error;
      }
   },
   getById: async (id: number) => {
      try {
         return await prisma.service.findUnique({ where: { id } });
      } catch (error) {
         console.error("Error getting service by id:", error);
         throw error;
      }
   },
   getByAgencyId: async (agency_id: number,getActives: boolean = false) => {
      
      const services = await prisma.service.findMany({
         select: {
            id: true,
            name: true,
            service_type: true,
            is_active: true,
            provider: {
               select: {
                  id: true,
                  name: true,
               },
            },
            shipping_rates: {
               select: {
                  id: true,
                  name: true,
                  price_in_cents: true,
                  is_active: true,
                  pricing_agreement: {
                     select: {
                        id: true,
                        name: true,
                        price_in_cents: true,
                        product: {
                           select: {
                              id: true,
                              name: true,
                              description: true,
                              unit: true,
                           },
                        },
                     },
                  },
               },
               where: {
                  agency_id: agency_id,
               },
            },
         },

         //if getActives is true, return only active services if false return all services
         where: { is_active: getActives ? true : undefined },
      });
      return services;
   },
   getByProviderId: async (provider_id: number) => {
      const services = await prisma.service.findMany({
         where: { provider_id },
         include: {
            provider: true,
            forwarder: true,
            products: true,
         },
      });
      return services;
   },
   update: async (id: number, service: Service) => {
      try {
         return await prisma.service.update({ where: { id }, data: service });
      } catch (error) {
         console.error("Error updating service:", error);
         throw error;
      }
   },
   delete: async (id: number) => {
      try {
         return await prisma.service.delete({ where: { id } });
      } catch (error) {
         console.error("Error deleting service:", error);
         throw error;
      }
   },
};

export default services;
