import prisma from "../lib/prisma.client";
import { DebtStatus, Unit } from "@prisma/client";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

/**
 * Cache for pricing agreements to avoid repeated DB queries
 */
const pricingCache = new Map<string, number>();

/**
 * Gets the pricing agreement price between sender and receiver agencies for a specific product/service
 * Uses cache to avoid repeated queries within the same request
 */
export const getPricingBetweenAgencies = async (
   seller_agency_id: number,
   buyer_agency_id: number,
   product_id: number,
   service_id: number
): Promise<number | null> => {
   const cacheKey = `${seller_agency_id}-${buyer_agency_id}-${product_id}-${service_id}`;
   
   if (pricingCache.has(cacheKey)) {
      return pricingCache.get(cacheKey) || null;
   }
   
   const agreement = await prisma.pricingAgreement.findUnique({
      where: {
         seller_agency_id_buyer_agency_id_product_id_service_id: {
            seller_agency_id,
            buyer_agency_id,
            product_id,
            service_id,
         },
      },
      select: { price_in_cents: true },
   });
   
   if (agreement) {
      pricingCache.set(cacheKey, agreement.price_in_cents);
      return agreement.price_in_cents;
   }
   
   return null;
};

/**
 * Clears the pricing cache (call at end of transaction/request)
 */
export const clearPricingCache = (): void => {
   pricingCache.clear();
};

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

   // Si hay errores críticos y no hay paquetes válidos, log warning pero no fallar
   // Esto permite despachos sin pricing configurado
   if (errors.length > 0) {
      console.warn(`[determineHierarchyDebts] Warnings for dispatch ${dispatch_id}:`, errors);
   }
   
   if (parcelsByAgency.size === 0) {
      console.warn(`[determineHierarchyDebts] No valid parcels with pricing for dispatch ${dispatch_id}`);
      return []; // Retornar vacío en lugar de fallar
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

/**
 * Simple debt info for dispatch reception
 */
export interface DispatchDebtInfo {
   debtor_agency_id: number;
   creditor_agency_id: number;
   amount_in_cents: number;
   weight_in_lbs: number;
   parcels_count: number;
   relationship: string;
}

/**
 * Generates debts for dispatch reception based on current holder → receiver
 * 
 * Simple logic:
 * - Groups parcels by current_agency_id (who currently holds the parcel)
 * - For each group, calculates debt: holder owes receiver
 * - Uses pricing agreement between receiver (seller) and holder (buyer)
 * 
 * Example: A receives from B (which includes parcels originally from C)
 * - Parcels with current_agency = B → B owes A (pricing A→B)
 * - If there are parcels with current_agency = C → C owes A (pricing A→C) 
 *   Note: This shouldn't happen if parcels properly went through B first
 * 
 * @param receiver_agency_id - Agency receiving the parcels
 * @param parcels - Parcels being received with current_agency_id and order_items
 * @param dispatch_id - Dispatch ID for reference
 */
export const generateDispatchDebts = async (
   receiver_agency_id: number,
   parcels: Array<{
      id: number;
      current_agency_id: number | null;
      agency_id: number | null; // Original creator agency (fallback)
      weight: any;
      order_items: Array<{
         weight: any;
         rate: {
            product_id: number;
            product: { unit: string };
            service_id: number;
         } | null;
      }>;
   }>,
   dispatch_id: number
): Promise<DispatchDebtInfo[]> => {
   const debts: DispatchDebtInfo[] = [];
   
   // Group parcels by holder agency (current_agency_id, fallback to agency_id)
   const parcelsByHolder = new Map<number, {
      weight: number;
      parcels_count: number;
      product_id: number | null;
      service_id: number | null;
   }>();
   
   for (const parcel of parcels) {
      // Determine holder: use current_agency_id if set, otherwise fallback to agency_id
      const holder_agency_id = parcel.current_agency_id ?? parcel.agency_id;
      
      if (!holder_agency_id) {
         console.warn(`[generateDispatchDebts] Parcel ${parcel.id} has no current_agency_id or agency_id`);
         continue;
      }
      
      // Skip if holder is the same as receiver (shouldn't happen)
      if (holder_agency_id === receiver_agency_id) {
         continue;
      }
      
      const parcelWeight = Number(parcel.weight);
      
      // Get product_id and service_id from first order_item with rate
      let product_id: number | null = null;
      let service_id: number | null = null;
      for (const item of parcel.order_items) {
         if (item.rate) {
            product_id = item.rate.product_id;
            service_id = item.rate.service_id;
            break;
         }
      }
      
      const current = parcelsByHolder.get(holder_agency_id) || {
         weight: 0,
         parcels_count: 0,
         product_id: null,
         service_id: null,
      };
      
      parcelsByHolder.set(holder_agency_id, {
         weight: current.weight + parcelWeight,
         parcels_count: current.parcels_count + 1,
         product_id: product_id || current.product_id,
         service_id: service_id || current.service_id,
      });
   }
   
   // Calculate debt for each holder
   for (const [holder_agency_id, data] of parcelsByHolder.entries()) {
      let pricePerLb = 0;
      
      // Try to get pricing agreement between receiver (seller) and holder (buyer)
      if (data.product_id && data.service_id) {
         const pricing = await getPricingBetweenAgencies(
            receiver_agency_id,  // Seller (receives = sells transport service)
            holder_agency_id,    // Buyer (holder = buys transport service)
            data.product_id,
            data.service_id
         );
         
         if (pricing) {
            pricePerLb = pricing;
         }
      }
      
      // If no specific pricing found, try to get any pricing between these agencies
      if (pricePerLb === 0) {
         const anyPricing = await prisma.pricingAgreement.findFirst({
            where: {
               seller_agency_id: receiver_agency_id,
               buyer_agency_id: holder_agency_id,
               is_active: true,
            },
            select: { price_in_cents: true },
         });
         
         if (anyPricing) {
            pricePerLb = anyPricing.price_in_cents;
         }
      }
      
      // Calculate amount (weight × price per lb)
      const amount_in_cents = Math.round(data.weight * pricePerLb);
      
      if (amount_in_cents > 0) {
         debts.push({
            debtor_agency_id: holder_agency_id,
            creditor_agency_id: receiver_agency_id,
            amount_in_cents,
            weight_in_lbs: data.weight,
            parcels_count: data.parcels_count,
            relationship: "dispatch_reception",
         });
      } else {
         console.warn(
            `[generateDispatchDebts] No pricing found between receiver ${receiver_agency_id} and holder ${holder_agency_id}. ` +
            `Weight: ${data.weight}lbs, Parcels: ${data.parcels_count}`
         );
      }
   }
   
   return debts;
};
