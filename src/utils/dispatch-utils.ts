import { Dispatch, Parcel, Unit } from "@prisma/client";
import { Prisma } from "@prisma/client";

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
 * Calculates the total cost of a dispatch based on pricing agreements and product units
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
            // For PER_LB: multiply order_item weight by price per pound
            const orderItemWeight = Number(orderItem.weight);
            totalCost += Math.round(orderItemWeight * priceInCents);
         } else if (unit === Unit.FIXED) {
            // For FIXED: use the price directly
            totalCost += priceInCents;
         }
      }
   }

   return totalCost;
};
