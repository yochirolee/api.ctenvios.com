import { Dispatch, Parcel, Unit } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getPricingBetweenAgencies, clearPricingCache } from "./agency-hierarchy";
import { calculate_row_subtotal, toNumber } from "./utils";

// Type for dispatch with all necessary relations for cost calculation
type DispatchWithPricingRelations = Prisma.DispatchGetPayload<{
   include: {
      parcels: {
         include: {
            order_items: {
               include: {
                  rate: {
                     include: {
                        product: true;
                        pricing_agreement: true;
                     };
                  };
               };
            };
         };
      };
   };
}>;

/**
 * Parcel shape required for PDF-style cost calculation (inter-agency rate + fees + delivery).
 * order_items must include rate.product (id, unit), rate.service or service_id, rate.pricing_agreement (price_in_cents).
 * Optional order.order_items for delivery (summed once per order).
 */
export interface ParcelForPdfCost {
   id: number;
   order_id?: number | null;
   order_items: Array<{
      weight?: unknown;
      customs_fee_in_cents?: number | null;
      charge_fee_in_cents?: number | null;
      insurance_fee_in_cents?: number | null;
      unit?: string | null;
      service_id?: number | null;
      rate?: {
         product?: { id: number; unit: string } | null;
         service?: { id: number } | null;
         pricing_agreement?: { price_in_cents: number } | null;
      } | null;
   }>;
   order?: {
      id?: number;
      order_items?: Array<{ delivery_fee_in_cents?: number | null }>;
   } | null;
}

/**
 * Calculates dispatch cost using the same logic as the dispatch PDF:
 * - Inter-agency unit rate via getPricingBetweenAgencies(receiver, sender, product_id, service_id) or fallback to pricing_agreement
 * - Per item: calculate_row_subtotal(unitRate, weight, customs, charge, insurance, unit)
 * - Plus delivery once per order (sum of order_items.delivery_fee_in_cents per order)
 * Clears pricing cache after calculation.
 */
export async function calculateDispatchCostFromPdfLogic(
   parcels: ParcelForPdfCost[],
   sender_agency_id: number,
   receiver_agency_id: number,
): Promise<number> {
   let grandSubtotalInCents = 0;

   for (const parcel of parcels) {
      const items = parcel.order_items ?? [];
      for (const item of items) {
         const product_id = item.rate?.product?.id;
         const service_id = item.rate?.service?.id ?? item.service_id ?? undefined;
         const unit = (item.unit ?? item.rate?.product?.unit ?? "PER_LB") as string;
         const itemWeight = toNumber(item.weight);

         let unitRateInCents = 0;
         if (receiver_agency_id && product_id && service_id) {
            const agreementRate = await getPricingBetweenAgencies(
               receiver_agency_id,
               sender_agency_id,
               product_id,
               service_id,
            );
            if (agreementRate !== null) {
               unitRateInCents = agreementRate;
            }
         }
         if (unitRateInCents === 0 && item.rate?.pricing_agreement?.price_in_cents) {
            unitRateInCents = item.rate.pricing_agreement.price_in_cents;
         }

         const itemCustoms = item.customs_fee_in_cents ?? 0;
         const itemCharge = item.charge_fee_in_cents ?? 0;
         const itemInsurance = item.insurance_fee_in_cents ?? 0;
         const itemSubtotal = calculate_row_subtotal(
            unitRateInCents,
            itemWeight,
            itemCustoms,
            itemCharge,
            itemInsurance,
            unit,
         );
         grandSubtotalInCents += itemSubtotal;
      }
   }

   const deliverySummedForOrderId = new Set<number>();
   let grandDeliveryInCents = 0;
   for (const parcel of parcels) {
      const orderId = parcel.order_id ?? parcel.order?.id ?? null;
      if (orderId == null || deliverySummedForOrderId.has(orderId)) continue;
      deliverySummedForOrderId.add(orderId);
      const orderItems = parcel.order?.order_items ?? [];
      for (const item of orderItems) {
         grandDeliveryInCents += item.delivery_fee_in_cents ?? 0;
      }
   }

   clearPricingCache();
   return grandSubtotalInCents + grandDeliveryInCents;
}

/**
 * Calculates the total cost of a dispatch based on pricing agreements and product units (weight × rate only).
 * Prefer calculateDispatchCostFromPdfLogic for full PDF-aligned cost (rate + fees + delivery).
 * - For PER_LB units: weight * pricing_agreement.price_in_cents
 * - For FIXED units: pricing_agreement.price_in_cents
 */
export const calculateDispatchCost = (dispatch: DispatchWithPricingRelations): number => {
   let totalCost = 0;

   for (const parcel of dispatch.parcels) {
      for (const orderItem of parcel.order_items) {
         const rate = orderItem.rate;
         if (!rate || !rate.product || !rate.pricing_agreement) {
            continue;
         }

         const unit = rate.product.unit;
         const priceInCents = rate.pricing_agreement.price_in_cents;

         if (unit === Unit.PER_LB) {
            const orderItemWeight = Number(orderItem.weight);
            totalCost += Math.round(orderItemWeight * priceInCents);
         } else if (unit === Unit.FIXED) {
            totalCost += priceInCents;
         }
      }
   }

   return totalCost;
};
