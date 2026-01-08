import prisma from "../lib/prisma.client";
import { Prisma, DebtStatus } from "@prisma/client";

interface CreateDebtData {
   debtor_agency_id: number;
   creditor_agency_id: number;
   dispatch_id: number;
   amount_in_cents: number;
   original_sender_agency_id: number;
   relationship: string;
   notes?: string;
}

export const interAgencyDebts = {
   create: async (data: CreateDebtData) => {
      return await prisma.interAgencyDebt.create({
         data,
         include: {
            debtor_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            creditor_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            original_sender_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            dispatch: {
               select: {
                  id: true,
                  status: true,
                  created_at: true,
               },
            },
         },
      });
   },

   createMany: async (debts: CreateDebtData[]) => {
      return await prisma.interAgencyDebt.createMany({
         data: debts,
      });
   },

   getByAgencies: async (
      debtor_agency_id: number,
      creditor_agency_id: number,
      status?: DebtStatus
   ) => {
      return await prisma.interAgencyDebt.findMany({
         where: {
            debtor_agency_id,
            creditor_agency_id,
            ...(status && { status }),
         },
         include: {
            dispatch: {
               select: {
                  id: true,
                  created_at: true,
               },
            },
         },
         orderBy: {
            created_at: "desc",
         },
      });
   },

   getTotalDebt: async (debtor_agency_id: number, creditor_agency_id: number): Promise<number> => {
      const debts = await prisma.interAgencyDebt.aggregate({
         where: {
            debtor_agency_id,
            creditor_agency_id,
            status: DebtStatus.PENDING,
         },
         _sum: {
            amount_in_cents: true,
         },
      });

      return debts._sum.amount_in_cents || 0;
   },

   getDebtsByDebtor: async (debtor_agency_id: number, status?: DebtStatus) => {
      return await prisma.interAgencyDebt.findMany({
         where: {
            debtor_agency_id,
            ...(status && { status }),
         },
         include: {
            creditor_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            dispatch: {
               select: {
                  id: true,
                  created_at: true,
               },
            },
         },
         orderBy: {
            created_at: "desc",
         },
      });
   },

   getDebtsByCreditor: async (creditor_agency_id: number, status?: DebtStatus) => {
      return await prisma.interAgencyDebt.findMany({
         where: {
            creditor_agency_id,
            ...(status && { status }),
         },
         include: {
            debtor_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            dispatch: {
               select: {
                  id: true,
                  created_at: true,
               },
            },
         },
         orderBy: {
            created_at: "desc",
         },
      });
   },

   markAsPaid: async (id: number, paid_by_id: string, notes?: string) => {
      return await prisma.interAgencyDebt.update({
         where: { id },
         data: {
            status: DebtStatus.PAID,
            paid_at: new Date(),
            paid_by_id,
            notes,
         },
      });
   },

   getByDispatch: async (dispatch_id: number) => {
      return await prisma.interAgencyDebt.findMany({
         where: { dispatch_id },
         include: {
            debtor_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
            creditor_agency: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
         orderBy: {
            created_at: "asc",
         },
      });
   },

   cancelByDispatch: async (dispatch_id: number) => {
      return await prisma.interAgencyDebt.updateMany({
         where: {
            dispatch_id,
            status: DebtStatus.PENDING,
         },
         data: {
            status: DebtStatus.CANCELLED,
         },
      });
   },
};

export default interAgencyDebts;

