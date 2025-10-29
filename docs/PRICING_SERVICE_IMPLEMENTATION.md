# Pricing Service Implementation

## Overview

A dedicated service to handle the atomic creation of `PricingAgreement` and `ShippingRate` entities together, ensuring data consistency through Prisma transactions. This service follows the unified pricing architecture where products can have different pricing agreements between agencies.

## Architecture

### Key Concepts

-  **PricingAgreement**: Defines the relationship between a seller agency, buyer agency, and product, with the cost price
-  **ShippingRate**: Defines the actual selling rate that the buyer agency will use, linked to a pricing agreement
-  **Internal Agreements**: When seller and buyer agencies are the same (internal pricing)
-  **Cost/Price Flow**:
   -  `cost_in_cents` → stored as `PricingAgreement.price_in_cents`
   -  `price_in_cents` → stored as `ShippingRate.price_in_cents`

## Implementation Details

### Files Created/Modified

1. **Created**: `src/services/pricing.service.ts`

   -  Main service with business logic
   -  Transaction handling for atomicity
   -  Validation of products, services, and agencies

2. **Modified**: `src/services/index.ts`

   -  Registered pricing service for export

3. **Modified**: `src/routes/products.routes.ts`

   -  Added POST `/products/:productId/pricing` endpoint
   -  Added GET `/products/:productId/pricing` endpoint

4. **Modified**: `src/types/types.ts`
   -  Added `CreatePricingInput` interface

## API Endpoints

### Create Pricing Agreement with Rate

**Endpoint**: `POST /products/:productId/pricing`

**Authentication**: Required (authMiddleware)

**Request Body**:

```json
{
   "service_id": 1,
   "seller_agency_id": 1,
   "buyer_agency_id": 1,
   "cost_in_cents": 22.5,
   "price_in_cents": 35,
   "name": "Box 12x12x12",
   "is_active": true
}
```

**Response** (201 Created):

```json
{
   "message": "Pricing created successfully",
   "data": {
      "agreement": {
         "id": 1,
         "name": "Box 12x12x12",
         "seller_agency_id": 1,
         "buyer_agency_id": 1,
         "product_id": 2,
         "service_id": 1,
         "price_in_cents": 22.5,
         "is_active": true,
         "effective_from": "2025-10-22T...",
         "effective_to": null,
         "created_at": "2025-10-22T...",
         "updated_at": "2025-10-22T..."
      },
      "rate": {
         "id": 1,
         "name": "Rate: Box 12x12x12",
         "service_id": 1,
         "agency_id": 1,
         "pricing_agreement_id": 1,
         "scope": "PUBLIC",
         "price_in_cents": 35,
         "effective_from": "2025-10-22T...",
         "effective_to": null,
         "is_active": true,
         "created_at": "2025-10-22T...",
         "updated_at": "2025-10-22T..."
      },
      "is_internal": true
   }
}
```

**Error Responses**:

-  `400 Bad Request`: Missing required fields or invalid data
-  `404 Not Found`: Product, service, or agency not found
-  `409 Conflict`: Pricing agreement already exists
-  `500 Internal Server Error`: Server error

### Get Product Pricing

**Endpoint**: `GET /products/:productId/pricing`

**Authentication**: Required (authMiddleware)

**Response** (200 OK):

```json
[
  {
    "id": 1,
    "name": "Box 12x12x12",
    "seller_agency_id": 1,
    "buyer_agency_id": 1,
    "product_id": 2,
    "service_id": 1,
    "price_in_cents": 22.5,
    "is_active": true,
    "effective_from": "2025-10-22T...",
    "effective_to": null,
    "product": { ... },
    "service": { ... },
    "shipping_rates": [
      {
        "id": 1,
        "name": "Rate: Box 12x12x12",
        "agency": { ... },
        "tiers": []
      }
    ]
  }
]
```

## Service Methods

### `createPricingWithRate(input: CreatePricingInput)`

Creates both PricingAgreement and ShippingRate in a single transaction.

**Validations**:

1. Required fields present and valid
2. Product exists and is active
3. Service exists and is active
4. Seller agency exists
5. Buyer agency exists
6. No existing agreement for the same seller/buyer/product combination

**Transaction Steps**:

1. Validate all entities exist
2. Check for existing agreement (prevent duplicates)
3. Create PricingAgreement with cost_in_cents as price
4. Create ShippingRate with price_in_cents linked to agreement
5. Return both entities with is_internal flag

### `getProductPricing(product_id: number)`

Retrieves all pricing agreements for a specific product with their associated rates.

### `getAgencyPricing(agency_id: number, role: "buyer" | "seller")`

Retrieves pricing agreements where the agency is either the buyer or seller.

## Data Flow Example

Given the input data:

```javascript
{
  buyer_agency_id: 1,
  cost_in_cents: 22.5,
  description: "Alimentos/Aseo-Food/Care",
  is_active: true,
  max_weight: 60,
  min_weight: 1,
  name: "Box 12x12x12",
  price_in_cents: 35,
  product_id: 2,
  seller_agency_id: 1,
  service_id: 1,
  unit: "FIXED"
}
```

**Result**:

1. **PricingAgreement** created:

   -  Links seller agency (1) to buyer agency (1)
   -  Stores `cost_in_cents` (22.5) as `price_in_cents`
   -  Product reference (2), Service reference (1)

2. **ShippingRate** created:

   -  Belongs to buyer agency (1) - they use this rate
   -  Stores `price_in_cents` (35) as the selling price
   -  Links to the pricing agreement
   -  Scope: PUBLIC (available to all customers)
   -  No tiers initially

3. **Internal Agreement**: Flagged as internal since seller_agency_id == buyer_agency_id

## Design Principles Applied

✅ **TypeScript strict typing**: All functions have explicit return types  
✅ **Functional programming**: Service exported as object with functions, no classes  
✅ **Repository pattern**: Uses Prisma directly (following orders.service.ts pattern)  
✅ **RESTful API design**: POST to `/products/:productId/pricing`  
✅ **Transaction handling**: Ensures atomicity with Prisma transactions  
✅ **Error handling**: Custom AppError with proper HTTP status codes  
✅ **Validation**: Comprehensive validation before database operations

## Usage Example

```typescript
import { services } from "../services";

// Create pricing with rate
const result = await services.pricing.createPricingWithRate({
   product_id: 2,
   service_id: 1,
   seller_agency_id: 1,
   buyer_agency_id: 1,
   cost_in_cents: 22.5,
   price_in_cents: 35,
   name: "Box 12x12x12",
   is_active: true,
});

console.log(result.agreement); // PricingAgreement entity
console.log(result.rate); // ShippingRate entity
console.log(result.is_internal); // true (same agency)
```

## Future Enhancements

1. **Rate Tiers**: Support for weight-based pricing tiers
2. **Bulk Creation**: Create multiple pricing agreements at once
3. **Update Operations**: Modify existing agreements and rates
4. **Deactivation**: Soft delete with effective_to date
5. **Rate History**: Track pricing changes over time
6. **Validation Rules**: Business rules for markup validation

## Testing

### Manual Testing

```bash
# Create pricing
curl -X POST http://localhost:3000/api/products/2/pricing \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": 1,
    "seller_agency_id": 1,
    "buyer_agency_id": 1,
    "cost_in_cents": 22.5,
    "price_in_cents": 35,
    "name": "Box 12x12x12",
    "is_active": true
  }'

# Get product pricing
curl -X GET http://localhost:3000/api/products/2/pricing \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## References

-  Unified Pricing Architecture: `/prisma/schema.prisma` (lines 192-256)
-  Service Pattern: `/src/services/orders.service.ts`
-  API Routes Pattern: `/src/routes/*.routes.ts`
