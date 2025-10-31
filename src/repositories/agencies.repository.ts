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
         select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
         },
         where: { agency_id: id },
         orderBy: {
            name: "asc",
         },
      });
      return users;
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
