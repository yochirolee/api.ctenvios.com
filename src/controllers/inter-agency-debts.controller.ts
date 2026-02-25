import { Response } from "express";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";
import interAgencyDebtsRepository from "../repositories/inter-agency-debts.repository";
import { DebtStatus, Roles } from "@prisma/client";



export const interAgencyDebtsController = {
   // Obtener deudas donde mi agencia es deudora
   getDebtsByDebtor: async (req: any, res: Response): Promise<void> => {
      const user = req.user;
      if (!user || !user.agency_id) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated or no agency");
      }

      const status = req.query.status as DebtStatus | undefined;
      const debts = await interAgencyDebtsRepository.getDebtsByDebtor(user.agency_id, status);

      // Agrupar por creditor y calcular totales
      const debtsByCreditor = new Map<
         number,
         { creditor: any; total: number; debts: any[] }
      >();

      for (const debt of debts) {
         const creditorId = debt.creditor_agency_id;
         if (!debtsByCreditor.has(creditorId)) {
            debtsByCreditor.set(creditorId, {
               creditor: debt.creditor_agency,
               total: 0,
               debts: [],
            });
         }

         const creditorDebts = debtsByCreditor.get(creditorId)!;
         creditorDebts.total += debt.amount_in_cents;
         creditorDebts.debts.push(debt);
      }

      res.status(200).json({
         total_debt: Array.from(debtsByCreditor.values()).reduce((sum, d) => sum + d.total, 0),
         debts_by_creditor: Array.from(debtsByCreditor.values()),
      });
   },

   // Obtener deudas donde mi agencia es acreedora
   getDebtsByCreditor: async (req: any, res: Response): Promise<void> => {
      const user = req.user;
      if (!user || !user.agency_id) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated or no agency");
      }

      const status = req.query.status as DebtStatus | undefined;
      const debts = await interAgencyDebtsRepository.getDebtsByCreditor(user.agency_id, status);

      // Agrupar por debtor y calcular totales
      const debtsByDebtor = new Map<number, { debtor: any; total: number; debts: any[] }>();

      for (const debt of debts) {
         const debtorId = debt.debtor_agency_id;
         if (!debtsByDebtor.has(debtorId)) {
            debtsByDebtor.set(debtorId, {
               debtor: debt.debtor_agency,
               total: 0,
               debts: [],
            });
         }

         const debtorDebts = debtsByDebtor.get(debtorId)!;
         debtorDebts.total += debt.amount_in_cents;
         debtorDebts.debts.push(debt);
      }

      res.status(200).json({
         total_receivable: Array.from(debtsByDebtor.values()).reduce(
            (sum, d) => sum + d.total,
            0
         ),
         debts_by_debtor: Array.from(debtsByDebtor.values()),
      });
   },

   // Obtener deudas de un despacho específico
   getDebtsByDispatch: async (
      req: any,
      res: Response
   ): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }
      const dispatchId = parseInt(req.params.id);
      if (isNaN(dispatchId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid dispatch ID");
      }

      const debts = await interAgencyDebtsRepository.getByDispatch(dispatchId);
      const isAdmin = user.role === Roles.ROOT;
      const visibleDebts = isAdmin
         ? debts
         : debts.filter(
              (d) => d.debtor_agency_id === user.agency_id || d.creditor_agency_id === user.agency_id
           );

      res.status(200).json({
         dispatch_id: dispatchId,
         total_debts: visibleDebts.reduce((sum, d) => sum + d.amount_in_cents, 0),
         debts: visibleDebts,
      });
   },

   // Marcar deuda como pagada
   markDebtAsPaid: async (
      req: any,
      res: Response
   ): Promise<void> => {
      const user = req.user;
      if (!user) {
         throw new AppError(HttpStatusCodes.UNAUTHORIZED, "User not authenticated");
      }

      const debtId = parseInt(req.params.id);
      if (isNaN(debtId)) {
         throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid debt ID");
      }

      const { notes } = req.body;

      const updatedDebt = await interAgencyDebtsRepository.markAsPaid(debtId, user.id, notes);

      res.status(200).json({
         status: "success",
         data: updatedDebt,
      });
   },
};

export default interAgencyDebtsController;

