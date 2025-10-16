# Orders API Documentation

## Overview

The Orders API supports order creation from two different sources:

1. **Frontend Application**: Provides entity IDs for existing customers and receivers
2. **Partner API**: Provides complete entity data with location names instead of IDs

## Endpoint

```
POST /orders
```

## Authentication

-  Frontend: Requires user authentication token
-  Partners: Requires API key authentication

## Request Scenarios

### Scenario 1: Frontend (with IDs)

When creating an order from your frontend application, you should provide existing entity IDs:

```json
{
   "customer_id": 123,
   "receiver_id": 456,
   "service_id": 1,
   "items": [
      {
         "description": "Electronics",
         "weight": 2.5,
         "rate_id": 10
      }
   ]
}
```

### Scenario 2: Partner API (with data)

When partners create orders, they provide complete entity data with location names:

```json
{
   "customer": {
      "first_name": "John",
      "last_name": "Doe",
      "mobile": "+1234567890",
      "email": "john@example.com",
      "address": "123 Main St"
   },
   "receiver": {
      "first_name": "Jane",
      "last_name": "Smith",
      "ci": "12345678901",
      "mobile": "+0987654321",
      "address": "456 Oak Ave",
      "province": "Havana",
      "city": "Centro Habana"
   },
   "service_id": 1,
   "items": [
      {
         "description": "Electronics",
         "weight": 2.5,
         "rate_id": 10
      }
   ]
}
```

## Field Requirements

### Customer Object (when not using customer_id)

| Field             | Type   | Required | Description              |
| ----------------- | ------ | -------- | ------------------------ |
| first_name        | string | Yes      | First name               |
| middle_name       | string | No       | Middle name              |
| last_name         | string | Yes      | Last name                |
| second_last_name  | string | No       | Second last name         |
| mobile            | string | Yes      | Mobile phone number      |
| email             | string | No       | Email address            |
| address           | string | No       | Physical address         |
| identity_document | string | No       | Identity document number |

### Receiver Object (when not using receiver_id)

| Field            | Type   | Required | Description                    |
| ---------------- | ------ | -------- | ------------------------------ |
| first_name       | string | Yes      | First name                     |
| middle_name      | string | No       | Middle name                    |
| last_name        | string | Yes      | Last name                      |
| second_last_name | string | No       | Second last name               |
| ci               | string | Yes      | Carnet de Identidad (11 chars) |
| passport         | string | No       | Passport number                |
| mobile           | string | No       | Mobile phone number            |
| phone            | string | No       | Landline phone number          |
| email            | string | No       | Email address                  |
| address          | string | Yes      | Physical address               |
| province         | string | No\*     | Province name (for partners)   |
| province_id      | number | No\*     | Province ID (for frontend)     |
| city             | string | No\*     | City name (for partners)       |
| city_id          | number | No\*     | City ID (for frontend)         |

**Note**: Either `province`/`city` (names) OR `province_id`/`city_id` (IDs) must be provided.

### Items Array

| Field       | Type   | Required | Description                        |
| ----------- | ------ | -------- | ---------------------------------- |
| description | string | Yes      | Item description                   |
| weight      | number | Yes      | Weight in pounds (positive number) |
| rate_id     | number | Yes      | Shipping rate ID                   |

### Service ID

| Field      | Type   | Required | Description                 |
| ---------- | ------ | -------- | --------------------------- |
| service_id | number | Yes      | The shipping service to use |

## Business Logic

### Customer Resolution

1. **With customer_id**: System validates the customer exists
2. **With customer data**:
   -  System checks if customer exists by mobile + first_name + last_name
   -  If exists: Uses existing customer
   -  If not exists: Creates new customer

### Receiver Resolution

1. **With receiver_id**: System validates the receiver exists
2. **With receiver data**:
   -  System checks if receiver exists by CI (Carnet de Identidad)
   -  If exists: Uses existing receiver
   -  If not exists:
      -  Resolves province name to province_id (case-insensitive)
      -  Resolves city name to city_id within the province (case-insensitive)
      -  Creates new receiver with resolved location IDs

### Location Resolution

When partners provide location names:

-  Province lookup is case-insensitive
-  City lookup is case-insensitive and scoped to the specified province
-  If province or city is not found, a 404 error is returned with a descriptive message

## Response Format

### Success Response (201 Created)

```json
{
   "message": "Order created successfully",
   "data": {
      "order_id": 789,
      "customer_id": 123,
      "receiver": {
         "id": 456,
         "full_name": "Jane Smith",
         "ci": "12345678901",
         "address": "456 Oak Ave",
         "province": "Havana",
         "city": "Centro Habana"
      }
   }
}
```

### Error Responses

#### 400 Bad Request

```json
{
   "error": "Either receiver_id or receiver data with CI is required"
}
```

#### 404 Not Found

```json
{
   "error": "Province 'InvalidProvince' not found"
}
```

```json
{
   "error": "City 'InvalidCity' not found in the specified province"
}
```

#### 422 Validation Error

```json
{
   "errors": [
      {
         "path": ["receiver", "ci"],
         "message": "Receiver CI must be 11 characters long."
      }
   ]
}
```

## Examples

### Example 1: Frontend Creating Order with Existing Entities

```bash
curl -X POST https://api.ctenvios.com/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 123,
    "receiver_id": 456,
    "service_id": 1,
    "items": [
      {
        "description": "Electronics",
        "weight": 2.5,
        "rate_id": 10
      }
    ]
  }'
```

### Example 2: Partner Creating Order with New Entities

```bash
curl -X POST https://api.ctenvios.com/orders \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "first_name": "John",
      "last_name": "Doe",
      "mobile": "+1234567890",
      "email": "john@example.com"
    },
    "receiver": {
      "first_name": "Jane",
      "last_name": "Smith",
      "ci": "12345678901",
      "mobile": "+0987654321",
      "address": "456 Oak Ave",
      "province": "Havana",
      "city": "Centro Habana"
    },
    "service_id": 1,
    "items": [
      {
        "description": "Electronics",
        "weight": 2.5,
        "rate_id": 10
      }
    ]
  }'
```

## Validation Rules

1. **Customer XOR**: Must provide EITHER `customer_id` OR `customer` object, but not both
2. **Receiver XOR**: Must provide EITHER `receiver_id` OR `receiver` object, but not both
3. **Location XOR**: In receiver object, must provide EITHER (`province` AND `city` names) OR (`province_id` AND `city_id`), but not mix
4. **CI Format**: Receiver CI must be exactly 11 characters
5. **Items Array**: Must contain at least one item
6. **Weight**: Must be a positive number
7. **Email**: Must be valid email format (if provided)

## Notes

-  Receiver records are unique by CI (Carnet de Identidad)
-  Customer records are unique by combination of mobile + first_name + last_name
-  Location names are matched case-insensitively
-  Created entities are automatically linked to the appropriate agency context
-  The system prevents duplicate receivers and customers by checking existing records before creation

## Related Documentation

-  [Partners API Documentation](./PARTNERS_API_DOCUMENTATION.md)
-  [API Key Guide](../api-keys/API_KEY_GUIDE.md)
