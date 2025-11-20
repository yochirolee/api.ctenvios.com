import { Service, Prisma } from "@prisma/client";
import prisma from "../lib/prisma.client";

// Type for the complex getByAgencyId return structure
type ServiceWithRatesForAgency = Prisma.ServiceGetPayload<{
   select: {
      id: true;
      name: true;
      service_type: true;
      is_active: true;
      provider: {
         select: {
            id: true;
            name: true;
         };
      };
      forwarder: {
         select: {
            id: true;
            name: true;
         };
      };
      shipping_rates: {
         select: {
            id: true;
            name: true;
            price_in_cents: true;
            is_active: true;
            pricing_agreement: {
               select: {
                  id: true;
                  name: true;
                  price_in_cents: true;
                  product: {
                     select: {
                        id: true;
                        name: true;
                        description: true;
                        unit: true;
                     };
                  };
               };
            };
         };
      };
   };
}>;

const services = {
   create: async (service: Prisma.ServiceCreateInput): Promise<Service> => {
      return await prisma.service.create({ data: service });
   },
   getAll: async () => {
      const services = await prisma.service.findMany({
         include: {
            provider: true,
            forwarder: true,
            products: true,
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
   },
   getByAgencyId: async (agency_id: number) => {
      const services = await prisma.service.findMany({
         where: { agencies: { some: { id: agency_id } } },
      });
      return services;
   },
   getById: async (id: number): Promise<Service | null> => {
      try {
         return await prisma.service.findUnique({ where: { id } });
      } catch (error) {
         console.error("Error getting service by id:", error);
         throw error;
      }
   },
   getServicesWithRates: async (agency_id: number) => {
      const services = await prisma.service.findMany({
         where: { agencies: { some: { id: agency_id } } },
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
               where: { agency_id: agency_id },
               orderBy: { id: "desc" },
               select: {
                  id: true,
                  price_in_cents: true,
                  is_active: true,
                  pricing_agreement: {
                     select: {
                        id: true,
                        price_in_cents: true,
                     },
                  },

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
      });
      return services;
   },
   getActiveServicesWithRates: async (agency_id: number) => {
      const services = await prisma.service.findMany({
         where: { agencies: { some: { id: agency_id } }, is_active: true },
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
               where: { agency_id: agency_id, is_active: true },
               select: {
                  id: true,
                  price_in_cents: true,
                  is_active: true,
                  pricing_agreement: {
                     select: {
                        id: true,
                        price_in_cents: true,
                     },
                  },

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
      });
      return services;
   },

   getByProviderId: async (provider_id: number): Promise<Service[]> => {
      try {
         const services = await prisma.service.findMany({
            where: { provider_id },
            include: {
               provider: true,
               forwarder: true,
            },
            orderBy: {
               name: "asc",
            },
         });
         return services;
      } catch (error) {
         console.error("Error getting services by provider ID:", error);
         throw error;
      }
   },
   update: async (id: number, service: Prisma.ServiceUpdateInput): Promise<Service> => {
      try {
         return await prisma.service.update({ where: { id }, data: service });
      } catch (error) {
         console.error("Error updating service:", error);
         throw error;
      }
   },
   delete: async (id: number): Promise<Service> => {
      try {
         return await prisma.service.delete({ where: { id } });
      } catch (error) {
         console.error("Error deleting service:", error);
         throw error;
      }
   },
};

export default services;
