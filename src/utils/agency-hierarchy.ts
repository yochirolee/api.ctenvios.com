import prisma from "../lib/prisma.client";
import { DebtStatus } from "@prisma/client";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

/**
 * Obtiene la jerarquía completa de agencias (padre, abuelo, etc.)
 * Retorna array de IDs desde el padre directo hasta el ancestro más lejano
 */
export const getAgencyHierarchy = async (agencyId: number): Promise<number[]> => {
   const hierarchy: number[] = [];
   let currentAgencyId: number | null = agencyId;

   while (currentAgencyId) {
      const agency: { parent_agency_id: number | null } | null = await prisma.agency.findUnique({
         where: { id: currentAgencyId },
         select: { parent_agency_id: true },
      });

      if (agency && agency.parent_agency_id) {
         hierarchy.push(agency.parent_agency_id);
         currentAgencyId = agency.parent_agency_id;
      } else {
         break;
      }
   }

   return hierarchy;
};

/**
 * Información de deuda jerárquica
 */
export interface HierarchyDebtInfo {
   original_sender_agency_id: number;
   debtor_agency_id: number;
   creditor_agency_id: number;
   relationship: "parent" | "grandparent" | "skipped_parent" | string;
   amount_in_cents: number;
}

/**
 * Verifica si un paquete tiene deudas PAGADAS hacia una agencia específica
 * Busca en todos los despachos anteriores del paquete
 */
const checkIfPaidToAgency = async (parcel_id: number, agency_id: number): Promise<boolean> => {
   // Buscar deudas pagadas donde:
   // 1. El paquete está en el despacho
   // 2. La deuda es hacia la agencia especificada
   // 3. La deuda está PAGADA
   const paidDebt = await prisma.interAgencyDebt.findFirst({
      where: {
         dispatch: {
            parcels: {
               some: { id: parcel_id },
            },
         },
         creditor_agency_id: agency_id,
         status: DebtStatus.PAID,
      },
   });

   return !!paidDebt;
};

/**
 * Determina las deudas jerárquicas considerando pagos previos
 * Si un paquete ya fue pagado al sender, el sender asume la responsabilidad
 */
export const determineHierarchyDebts = async (
   sender_agency_id: number,
   receiver_agency_id: number,
   parcels: Array<{
      id: number;
      agency_id: number | null;
      weight: any;
      order_items: Array<{
         weight: any;
         rate: {
            product: { unit: string };
            pricing_agreement: { price_in_cents: number } | null;
         } | null;
      }>;
   }>,
   dispatch_id: number
): Promise<HierarchyDebtInfo[]> => {
   const debts: HierarchyDebtInfo[] = [];
   const errors: string[] = [];

   // Agrupar paquetes por agencia original y verificar pagos
   const parcelsByAgency = new Map<
      number,
      {
         cost: number;
         parcel_ids: number[];
         has_paid_to_sender: boolean;
      }
   >();

   for (const parcel of parcels) {
      // Validación: skip paquetes sin agency_id
      if (!parcel.agency_id) {
         errors.push(`Parcel ${parcel.id} has no agency_id`);
         continue;
      }

      // Validación: skip paquetes sin order_items
      if (!parcel.order_items || parcel.order_items.length === 0) {
         errors.push(`Parcel ${parcel.id} has no order_items`);
         continue;
      }

      // Calcular costo del paquete
      let parcelCost = 0;
      let hasValidPricing = false;

      for (const orderItem of parcel.order_items) {
         if (!orderItem.rate?.pricing_agreement) {
            continue;
         }

         hasValidPricing = true;
         const unit = orderItem.rate.product.unit;
         const priceInCents = orderItem.rate.pricing_agreement.price_in_cents;
         const itemWeight = Number(orderItem.weight);

         if (unit === "PER_LB") {
            parcelCost += Math.round(itemWeight * priceInCents);
         } else if (unit === "FIXED") {
            parcelCost += priceInCents;
         }
      }

      if (!hasValidPricing) {
         errors.push(`Parcel ${parcel.id} has no valid pricing agreement`);
         continue;
      }

      // Verificar si la agencia original ya pagó al sender
      const hasPaidToSender = await checkIfPaidToAgency(parcel.id, sender_agency_id);

      const current = parcelsByAgency.get(parcel.agency_id) || {
         cost: 0,
         parcel_ids: [],
         has_paid_to_sender: false,
      };

      parcelsByAgency.set(parcel.agency_id, {
         cost: current.cost + parcelCost,
         parcel_ids: [...current.parcel_ids, parcel.id],
         has_paid_to_sender: hasPaidToSender || current.has_paid_to_sender,
      });
   }

   // Si hay errores críticos y no hay paquetes válidos, lanzar excepción
   if (errors.length > 0 && parcelsByAgency.size === 0) {
      throw new AppError(
         HttpStatusCodes.BAD_REQUEST,
         `Cannot calculate debts: ${errors.join("; ")}`
      );
   }

   // Calcular deudas
   for (const [original_agency_id, { cost, has_paid_to_sender }] of parcelsByAgency.entries()) {
      // Caso 1: Si la agencia original ya pagó al sender
      // El sender asume la responsabilidad → solo crear deuda sender → receiver
      if (has_paid_to_sender && original_agency_id !== sender_agency_id) {
         const senderHierarchy = await getAgencyHierarchy(sender_agency_id);

         if (senderHierarchy.includes(receiver_agency_id)) {
            const level = senderHierarchy.indexOf(receiver_agency_id) + 1;

            if (level === 1) {
               debts.push({
                  original_sender_agency_id: sender_agency_id,
                  debtor_agency_id: sender_agency_id,
                  creditor_agency_id: receiver_agency_id,
                  relationship: "parent",
                  amount_in_cents: cost,
               });
            } else if (level === 2) {
               const parent_id = senderHierarchy[0];

               debts.push({
                  original_sender_agency_id: sender_agency_id,
                  debtor_agency_id: sender_agency_id,
                  creditor_agency_id: parent_id,
                  relationship: "skipped_parent",
                  amount_in_cents: cost,
               });

               debts.push({
                  original_sender_agency_id: sender_agency_id,
                  debtor_agency_id: sender_agency_id,
                  creditor_agency_id: receiver_agency_id,
                  relationship: "grandparent",
                  amount_in_cents: cost,
               });
            } else {
               // Nivel 3+: solo deuda al receiver final
               debts.push({
                  original_sender_agency_id: sender_agency_id,
                  debtor_agency_id: sender_agency_id,
                  creditor_agency_id: receiver_agency_id,
                  relationship: `ancestor_level_${level}`,
                  amount_in_cents: cost,
               });
            }
         }
         continue; // No crear deuda de la agencia original
      }

      // Caso 2: La agencia original NO ha pagado al sender
      // Crear deuda normal de la agencia original al receiver
      if (original_agency_id === sender_agency_id && original_agency_id === receiver_agency_id) {
         continue; // Misma agencia enviando a sí misma
      }

      const originalHierarchy = await getAgencyHierarchy(original_agency_id);

      if (!originalHierarchy.includes(receiver_agency_id)) {
         // El receiver no está en la jerarquía de la agencia original
         errors.push(
            `Receiver agency ${receiver_agency_id} is not in hierarchy of original agency ${original_agency_id}`
         );
         continue;
      }

      const level = originalHierarchy.indexOf(receiver_agency_id) + 1;

      // Si el receiver es el padre directo
      if (level === 1) {
         debts.push({
            original_sender_agency_id: original_agency_id,
            debtor_agency_id: original_agency_id,
            creditor_agency_id: receiver_agency_id,
            relationship: "parent",
            amount_in_cents: cost,
         });
      }
      // Si el receiver es el abuelo (saltándose al padre)
      else if (level === 2) {
         const parent_id = originalHierarchy[0];

         // Deuda de la nieta al padre (por saltarse el nivel)
         debts.push({
            original_sender_agency_id: original_agency_id,
            debtor_agency_id: original_agency_id,
            creditor_agency_id: parent_id,
            relationship: "skipped_parent",
            amount_in_cents: cost,
         });

         // Deuda de la nieta a la abuela
         debts.push({
            original_sender_agency_id: original_agency_id,
            debtor_agency_id: original_agency_id,
            creditor_agency_id: receiver_agency_id,
            relationship: "grandparent",
            amount_in_cents: cost,
         });
      }
      // Si el receiver está más arriba (nivel 3+)
      else {
         // Solo crear deuda al receiver final
         debts.push({
            original_sender_agency_id: original_agency_id,
            debtor_agency_id: original_agency_id,
            creditor_agency_id: receiver_agency_id,
            relationship: `ancestor_level_${level}`,
            amount_in_cents: cost,
         });
      }
   }

   // Log warnings si hay errores no críticos
   if (errors.length > 0) {
      console.warn("Warnings while calculating hierarchy debts:", errors);
   }

   return debts;
};

