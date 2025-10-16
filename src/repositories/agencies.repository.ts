import prisma from "../config/prisma_db";
import { Prisma } from "@prisma/client";

export const agencies = {
   getAll: async () => {
      const agencies = await prisma.agency.findMany({
         orderBy: {
            id: "asc",
         },
      });
      return agencies;
   },
   getById: async (id: number) => {
      const agency = await prisma.agency.findUnique({
         select: {
            id: true,
            name: true,
            address: true,
            contact: true,
            phone: true,
            email: true,
            agency_type: true,
         },
         where: { id },
      });
      return agency;
   },
   getUsers: async (id: number) => {
      const users = await prisma.user.findMany({
         where: { agency_id: id },
      });
      return users;
   },

   getActivesServicesRates: async (id: number) => {
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
                  description: true,
                  rate_in_cents: true,
                  cost_in_cents: true,
                  rate_type: true,
                  is_active: true,
                  min_weight: true,
                  max_weight: true,
               },
               where: { is_active: true, agency_id: id },
               orderBy: { id: "asc" },
            },
         },
         where: { agencies: { some: { id } } },
      });
      return services;
   },

   //por ahora no se usa pero se deja para futuras implementaciones
   getActivesShippingRates: async (id: number, service_id: number) => {
      const shipping_rates = await prisma.shippingRate.findMany({
         select: {
            id: true,
            name: true,
            description: true,
            rate_in_cents: true,
            cost_in_cents: true,
            rate_type: true,
            is_active: true,
         },
         orderBy: { id: "asc" },
         where: { agency_id: id, service_id: service_id, is_active: true },
      });
      return shipping_rates;
   },

   update: async (id: number, agency: Prisma.AgencyUpdateInput) => {
      const updatedAgency = await prisma.agency.update({
         where: { id },
         data: agency,
      });
      return updatedAgency;
   },
   delete: async (id: number) => {
      try {
         const deletedAgency = await prisma.agency.delete({
            where: { id },
         });
         return deletedAgency;
      } catch (error) {
         console.error("Error deleting agency:", error);
         throw error;
      }
   },
   getChildren: async (id: number) => {
      const children = await prisma.agency.findMany({
         where: { parent_agency_id: id },
      });
      return children;
   },
   getParent: async (id: number) => {
      const parent = await prisma.agency.findUnique({
         where: { id },
      });
      return parent;
   },
   getAllChildrenRecursively: async (parentId: number): Promise<number[]> => {
      const getAllChildren = async (agencyId: number): Promise<number[]> => {
         const directChildren = await prisma.agency.findMany({
            where: { parent_agency_id: agencyId },
            select: { id: true },
         });

         const childIds = directChildren.map((child) => child.id);
         const allChildIds = [...childIds];

         // Recursively get children of children
         for (const childId of childIds) {
            const grandChildren = await getAllChildren(childId);
            allChildIds.push(...grandChildren);
         }

         return allChildIds;
      };

      return getAllChildren(parentId);
   },
};

export default agencies;
