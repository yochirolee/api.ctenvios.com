import prisma from "../lib/prisma.client";
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
            forwarder_id: true,
            logo: true,
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
      // First get the agency to find its parent_agency_id
      const agency = await prisma.agency.findUnique({
         where: { id },
         select: { parent_agency_id: true },
      });

      if (!agency || !agency.parent_agency_id) {
         return null;
      }

      // Then fetch the parent agency
      const parent = await prisma.agency.findUnique({
         where: { id: agency.parent_agency_id },
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
   addCustomerToAgency: async (agency_id: number, customer_id: number) => {
      //connect customer to agency
      await prisma.agency.update({
         where: { id: agency_id },
         data: {
            customers: {
               connect: { id: customer_id },
            },
         },
      });
   },
   addReceiverToAgency: async (agency_id: number, receiver_id: number) => {
      //connect receiver to agency
      await prisma.agency.update({
         where: { id: agency_id },
         data: {
            receivers: {
               connect: { id: receiver_id },
            },
         },
      });
   },
};

export default agencies;
