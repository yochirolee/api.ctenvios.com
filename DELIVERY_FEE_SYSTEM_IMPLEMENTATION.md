# Delivery Fee System Implementation Summary

## Overview

Implemented a hierarchical carrier-specific delivery fee system with automatic calculation based on destination city types and heavy item handling charges.

## Business Rules Implemented

### 1. Delivery Fees (Per Order)

-  **5 USD**: All cities in Havana, Artemisa, and Mayabeque provinces (SPECIAL tier)
-  **10 USD**: Provincial capitals (CAPITAL tier)
-  **15 USD**: All other cities (CITY tier)
-  Fee is divided equally among all items in the order
-  Only applied if `order.requires_home_delivery = true`

### 2. Heavy Item Handling Charge (Per Item)

-  **30 USD**: Items weighing > 100 lbs when home delivery is requested
-  **0 USD**: If customer chooses pickup or item ≤ 100 lbs
-  Added to `item.charge_fee_in_cents`

### 3. Hierarchical Rate System

Agencies can override forwarder's delivery rates:

-  **cost_in_cents**: What agency pays to forwarder (or forwarder pays to carrier)
-  **rate_in_cents**: What customer pays
-  Follows same pattern as ShippingRate model

## Database Changes

### Schema Updates

1. **City model**: Added `city_type` field (SPECIAL/CAPITAL/CITY)
2. **Order model**: Added `requires_home_delivery` boolean (default: true)
3. **Service model**: Added `carrier_id` nullable relation
4. **DeliveryRate model**: New hierarchical model for delivery pricing
5. **Carrier model**: Removed old CarrierRates relation, added delivery_rates

### Migration Required

```bash
npx prisma migrate dev --name add_delivery_rate_system
npx prisma generate
```

## Code Changes

### New Files

-  **src/utils/deliveryFeeCalculator.ts**: Core delivery fee calculation logic
   -  `calculateDeliveryFee()`: Resolves effective delivery rate
   -  `calculateHeavyItemCharge()`: Calculates 30 USD fee for heavy items
   -  `resolveEffectiveDeliveryRate()`: Hierarchical rate resolution

### Modified Files

1. **prisma/schema.prisma**: All model updates
2. **prisma/seed.data.ts**: Added city type classification logic
3. **prisma/seed.ts**: Updated to seed cities with types and delivery rates
4. **src/services/resolvers.service.ts**: Auto-calculates delivery fees per order
5. **src/services/orders.service.ts**: Passes receiver_id and requires_home_delivery
6. **src/controllers/orders.controller.ts**: Accepts requires_home_delivery from request
7. **src/utils/utils.ts**: Updated calculation functions to include delivery fees
8. **src/routes/invoices.routes.ts**: Updated to include delivery fees
9. **src/utils/generate-invoice-pdf.ts**: Updated PDF generation with delivery fees

## API Changes

### Order Creation Endpoint

**POST /api/orders**

New optional field:

```json
{
   "customer_id": 1,
   "receiver_id": 1,
   "service_id": 1,
   "requires_home_delivery": true, // NEW: defaults to true
   "items": [
      {
         "description": "Test Item",
         "weight": 105, // > 100 lbs will trigger 30 USD charge
         "rate_id": 1,
         "customs_fee_in_cents": 0
      }
   ]
}
```

### Automatic Calculations

The system now automatically:

1. Fetches receiver's city type
2. Looks up carrier delivery rate for that city type
3. Resolves effective rate for the agency (with hierarchy)
4. Divides total delivery fee among all items
5. Adds 30 USD handling charge for items > 100 lbs (if home delivery)
6. Includes all fees in total calculation

## Seed Data

### City Types

-  **Special Zone** (56 cities): All cities in Havana, Artemisa, Mayabeque
-  **Provincial Capitals** (15 cities): Pinar del Rio, Matanzas, Cienfuegos, etc.
-  **Other Cities** (158 cities): All remaining municipalities

### Default Delivery Rates

Created for "Transcargo Carrier":

-  SPECIAL: $5.00 (cost and rate)
-  CAPITAL: $10.00 (cost and rate)
-  CITY: $15.00 (cost and rate)

## Testing Checklist

Before testing, run:

```bash
npx prisma migrate dev --name add_delivery_rate_system
npx prisma generate
npm run seed  # or npx ts-node prisma/seed.ts
```

### Test Scenarios

1. **Basic Order with Home Delivery (Havana)**

   -  Create order with receiver in Havana
   -  `requires_home_delivery: true`
   -  Verify delivery fee = $5 / number of items

2. **Order to Provincial Capital**

   -  Create order with receiver in Matanzas city
   -  Verify delivery fee = $10 / number of items

3. **Order to Remote City**

   -  Create order with receiver in Vinales (Pinar del Rio)
   -  Verify delivery fee = $15 / number of items

4. **Pickup Order (No Delivery Fee)**

   -  Create order with `requires_home_delivery: false`
   -  Verify delivery_fee_in_cents = 0 for all items

5. **Heavy Item with Home Delivery**

   -  Create order with item weight = 150 lbs
   -  `requires_home_delivery: true`
   -  Verify charge_fee_in_cents = 3000 (30 USD) + any other charges

6. **Heavy Item with Pickup**

   -  Create order with item weight = 150 lbs
   -  `requires_home_delivery: false`
   -  Verify charge_fee_in_cents = 0 (no handling charge)

7. **Multiple Items Order**
   -  Create order with 5 items to Havana
   -  Verify each item has delivery_fee_in_cents = 100 cents (5 USD / 5 items)

## Next Steps

1. **Run Migration**: Execute Prisma migration to apply schema changes
2. **Regenerate Client**: Run `npx prisma generate` to update Prisma client types
3. **Run Seed**: Populate database with city types and delivery rates
4. **Test**: Verify all calculation scenarios work correctly
5. **Agency Overrides**: Create UI/API for agencies to set custom delivery rates

## Technical Notes

-  **Following Conventions**: Repository pattern, TypeScript strict typing, Functional programming
-  **No try/catch**: Errors bubble up to global error handler
-  **Performance**: Delivery fee calculated once per order, parallelized with other operations
-  **Hierarchical Rates**: Same pattern as ShippingRate for consistency
-  **Linter Errors**: Will resolve after running `npx prisma generate`

## Example Calculation

### Order Details:

-  Receiver: Havana (SPECIAL tier)
-  3 items: 50 lbs, 120 lbs, 80 lbs
-  Home delivery: YES
-  Base delivery rate: $5.00

### Automatic Calculations:

```
Item 1 (50 lbs):
  - delivery_fee_in_cents: 167 cents ($5 / 3 items, rounded up)
  - charge_fee_in_cents: 0 (under 100 lbs)

Item 2 (120 lbs):
  - delivery_fee_in_cents: 167 cents
  - charge_fee_in_cents: 3000 cents (heavy item charge)

Item 3 (80 lbs):
  - delivery_fee_in_cents: 166 cents ($5 / 3 items, last item gets remainder)
  - charge_fee_in_cents: 0 (under 100 lbs)

Total delivery fee: $5.00
Total handling charges: $30.00
```

## Files Modified Summary

### Schema & Database

-  `prisma/schema.prisma` ✅
-  `prisma/seed.data.ts` ✅
-  `prisma/seed.ts` ✅

### Business Logic

-  `src/utils/deliveryFeeCalculator.ts` ✅ (NEW)
-  `src/services/resolvers.service.ts` ✅
-  `src/services/orders.service.ts` ✅
-  `src/controllers/orders.controller.ts` ✅

### Calculations

-  `src/utils/utils.ts` ✅
-  `src/routes/invoices.routes.ts` ✅
-  `src/utils/generate-invoice-pdf.ts` ✅
