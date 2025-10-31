import { Service, Prisma } from "@prisma/client";
import prisma from "../config/prisma_db";

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
   getById: async (id: number): Promise<Service | null> => {
      try {
         return await prisma.service.findUnique({ where: { id } });
      } catch (error) {
         console.error("Error getting service by id:", error);
         throw error;
      }
   },
   getByAgencyId: async (agency_id: number): Promise<Service[]> => {
      try {
         const services = await prisma.service.findMany({
            select: {
               id: true,
               name: true,
               description: true,
               service_type: true,
               is_active: true,
               provider: {
                  select: {
                     id: true,
                     name: true,
                  },
               },
               forwarder: {
                  select: {
                     id: true,
                     name: true,
                  },
               },
            },
            where: {
               agencies: { some: { id: agency_id } },
               is_active: true,
            },
            orderBy: {
               name: "asc",
            },
         });
         return services;
      } catch (error) {
         console.error("Error getting services by agency ID:", error);
         throw error;
      }
   },
   getActivesByAgencyId: async (agency_id: number): Promise<ServiceWithRatesForAgency[]> => {
      try {
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
               forwarder: {
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
                     is_active: true,
                  },
                  orderBy: {
                     name: "asc",
                  },
               },
            },
            where: {
               agencies: { some: { id: agency_id } },
               is_active: true,
            },
            orderBy: {
               name: "asc",
            },
         });
         return services;
      } catch (error) {
         console.error("Error getting active services by agency ID:", error);
         throw error;
      }
   },

   // Optimized method that returns data in API-ready format (reduces controller transformation overhead)
   getServicesWithFlattenedRates: async (
      agency_id: number,
      activeOnly: boolean = false
   ): Promise<
      Array<{
         id: number;
         name: string;
         service_type: string;
         is_active: boolean;
         provider: { id: number; name: string };
         forwarder: { id: number; name: string };
         shipping_rates: Array<{
            id: number;
            name: string;
            description: string | null;
            unit: string;
            price_in_cents: number;
            cost_in_cents: number;
            is_active: boolean;
         }>;
      }>
   > => {
      try {
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
               forwarder: {
                  select: {
                     id: true,
                     name: true,
                  },
               },
               shipping_rates: {
                  select: {
                     id: true,
                     price_in_cents: true,
                     is_active: true,
                     pricing_agreement: {
                        select: {
                           price_in_cents: true,
                           product: {
                              select: {
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
                     ...(activeOnly && { is_active: true }),
                  },
                  orderBy: {
                     pricing_agreement: {
                        product: {
                           name: "asc",
                        },
                     },
                  },
               },
            },
            where: {
               agencies: { some: { id: agency_id } },
               ...(activeOnly && { is_active: true }),
            },
            orderBy: {
               name: "asc",
            },
         });

         // Transform at repository level (single pass, more efficient)
         return services.map((service) => ({
            id: service.id,
            name: service.name,
            service_type: service.service_type,
            is_active: service.is_active,
            provider: service.provider,
            forwarder: service.forwarder,
            shipping_rates: service.shipping_rates.map((rate) => ({
               id: rate.id,
               name: rate.pricing_agreement.product.name,
               description: rate.pricing_agreement.product.description,
               unit: rate.pricing_agreement.product.unit,
               price_in_cents: rate.price_in_cents,
               cost_in_cents: rate.pricing_agreement.price_in_cents,
               is_active: rate.is_active,
            })),
         }));
      } catch (error) {
         console.error("Error getting services with flattened rates:", error);
         throw error;
      }
   },

   getByProviderId: async (provider_id: number): Promise<Service[]> => {
      try {
         const services = await prisma.service.findMany({
            where: { provider_id },
            include: {
               provider: true,
               forwarder: true,
               products: true,
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
