# Delivery Fee API Documentation

## Overview

The Delivery Fee API allows you to retrieve the delivery rate for a specific city based on the agency and carrier. This endpoint uses a **hybrid hierarchical rate system** that supports both city-specific rates and city-type based rates.

## Endpoint

### Get Delivery Fee by City

Retrieves the delivery fee for a specific city.

**URL:** `/api/v1/provinces/delivery-fee`

**Method:** `GET`

**Authentication:** Required (JWT token)

**Query Parameters:**

| Parameter     | Type   | Required      | Description                                                   |
| ------------- | ------ | ------------- | ------------------------------------------------------------- |
| `city_id`     | number | Conditional\* | The ID of the city                                            |
| `city_name`   | string | Conditional\* | The name of the city (case-insensitive)                       |
| `province_id` | number | Optional      | Province ID to narrow down city search when using `city_name` |
| `agency_id`   | number | **Required**  | The ID of the agency                                          |
| `carrier_id`  | number | **Required**  | The ID of the carrier/shipping service                        |

\* Either `city_id` or `city_name` must be provided

## Rate Resolution Logic

The system uses a **hierarchical inheritance** model with the following priority:

1. **City-specific rate** for the agency
2. **City-type based rate** for the agency (SPECIAL, CAPITAL, CITY)
3. **Parent agency rates** (if agency has a parent)
4. **City-specific base rate** from forwarder
5. **City-type base rate** from forwarder

## Response Format

### Success Response (200 OK)

```json
{
   "city_id": 123,
   "city_name": "La Habana",
   "city_type": "CAPITAL",
   "province_name": "La Habana",
   "rate_in_cents": 1500,
   "rate_in_usd": 15.0,
   "cost_in_cents": 1200,
   "cost_in_usd": 12.0,
   "is_inherited": false,
   "source_agency_id": 5,
   "carrier_name": "DHL Express"
}
```

**Response Fields:**

| Field              | Type           | Description                                            |
| ------------------ | -------------- | ------------------------------------------------------ |
| `city_id`          | number         | The ID of the city                                     |
| `city_name`        | string         | The name of the city                                   |
| `city_type`        | string         | City classification (SPECIAL, CAPITAL, CITY)           |
| `province_name`    | string         | The name of the province                               |
| `rate_in_cents`    | number         | Customer-facing rate in cents                          |
| `rate_in_usd`      | number         | Customer-facing rate in USD                            |
| `cost_in_cents`    | number         | Agency cost in cents                                   |
| `cost_in_usd`      | number         | Agency cost in USD                                     |
| `is_inherited`     | boolean        | Whether the rate is inherited from parent or forwarder |
| `source_agency_id` | number \| null | The agency that owns this rate (null if base rate)     |
| `carrier_name`     | string         | The name of the carrier                                |

### Error Responses

#### 400 Bad Request

```json
{
   "message": "agency_id and carrier_id are required",
   "status": 400
}
```

```json
{
   "message": "Either city_id or city_name is required",
   "status": 400
}
```

#### 404 Not Found

```json
{
   "message": "City not found",
   "status": 404
}
```

```json
{
   "message": "Carrier not found",
   "status": 404
}
```

```json
{
   "message": "No base delivery rate found for carrier X, city Y or city type Z",
   "status": 404
}
```

## Usage Examples

### Example 1: Get delivery fee by city ID

```bash
GET /api/v1/provinces/delivery-fee?city_id=123&agency_id=5&carrier_id=2
Authorization: Bearer <your-jwt-token>
```

### Example 2: Get delivery fee by city name

```bash
GET /api/v1/provinces/delivery-fee?city_name=La%20Habana&agency_id=5&carrier_id=2
Authorization: Bearer <your-jwt-token>
```

### Example 3: Get delivery fee by city name with province

```bash
GET /api/v1/provinces/delivery-fee?city_name=Artemisa&province_id=2&agency_id=5&carrier_id=2
Authorization: Bearer <your-jwt-token>
```

### JavaScript/TypeScript Example

```typescript
interface DeliveryFeeResponse {
   city_id: number;
   city_name: string;
   city_type: "SPECIAL" | "CAPITAL" | "CITY";
   province_name: string;
   rate_in_cents: number;
   rate_in_usd: number;
   cost_in_cents: number;
   cost_in_usd: number;
   is_inherited: boolean;
   source_agency_id: number | null;
   carrier_name: string;
}

async function getDeliveryFee(
   cityId: number,
   agencyId: number,
   carrierId: number,
   authToken: string
): Promise<DeliveryFeeResponse> {
   const response = await fetch(
      `/api/v1/provinces/delivery-fee?city_id=${cityId}&agency_id=${agencyId}&carrier_id=${carrierId}`,
      {
         headers: {
            Authorization: `Bearer ${authToken}`,
         },
      }
   );

   if (!response.ok) {
      throw new Error(`Failed to get delivery fee: ${response.statusText}`);
   }

   return response.json();
}

// Usage
const deliveryFee = await getDeliveryFee(123, 5, 2, "your-jwt-token");
console.log(`Delivery fee for ${deliveryFee.city_name}: $${deliveryFee.rate_in_usd}`);
```

### cURL Example

```bash
curl -X GET \
  'http://localhost:3000/api/v1/provinces/delivery-fee?city_id=123&agency_id=5&carrier_id=2' \
  -H 'Authorization: Bearer your-jwt-token'
```

## Business Rules

1. **Hierarchical Rates**: Agencies inherit rates from parent agencies and forwarders
2. **Hybrid System**: City-specific rates always take precedence over city-type rates
3. **Active Rates Only**: Only active rates (`is_active: true`) are considered
4. **Customer vs Cost**: `rate_in_cents` is what customers pay, `cost_in_cents` is the agency's cost
5. **City Types**:
   -  `SPECIAL`: Special municipalities (e.g., Isla de la Juventud)
   -  `CAPITAL`: Provincial capitals
   -  `CITY`: Regular cities

## Integration Notes

-  This endpoint is used by the order creation process to calculate delivery fees
-  Rates can be customized at the agency level without affecting other agencies
-  The `is_inherited` flag indicates if an agency is using its own rate or inheriting
-  Use `source_agency_id` to identify which agency configured the rate

## Related Endpoints

-  `GET /api/v1/provinces` - List all provinces with their cities
-  `POST /api/v1/orders` - Create an order (uses delivery fee calculation internally)

## See Also

-  [Hybrid Delivery Rates System](../HYBRID_DELIVERY_RATES.md)
-  [Delivery Fee Implementation](../DELIVERY_FEE_SYSTEM_IMPLEMENTATION.md)
