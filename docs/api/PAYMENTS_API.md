# Orders Payment API Documentation

## Overview

This document describes the payment processing system for orders in the CTEnvios platform. The payment system supports multiple payment methods, automatic card processing fees, partial payments, and full transaction safety.

## Payment Endpoint

### Create Payment

**Endpoint:** `POST /orders/:id/payment`

**Authentication:** Required (JWT Bearer token)

**Description:** Process a payment for an order. Supports partial and full payments with automatic charge calculation for card payments.

---

## Request

### URL Parameters

| Parameter | Type   | Required | Description                         |
| --------- | ------ | -------- | ----------------------------------- |
| `id`      | number | Yes      | The order ID to process payment for |

### Request Body

```json
{
   "amount_in_cents": 50000,
   "method": "CASH",
   "reference": "INV-2024-001",
   "notes": "Payment received in full"
}
```

### Payment Schema

| Field             | Type          | Required | Validation       | Description               |
| ----------------- | ------------- | -------- | ---------------- | ------------------------- |
| `amount_in_cents` | number        | Yes      | Must be > 0      | Payment amount in cents   |
| `charge_in_cents` | number        | No       | Min: 0           | Auto-calculated for cards |
| `method`          | PaymentMethod | Yes      | Valid enum value | Payment method used       |
| `reference`       | string        | No       | -                | Payment reference number  |
| `notes`           | string        | No       | -                | Additional payment notes  |

### Payment Methods (PaymentMethod Enum)

```typescript
enum PaymentMethod {
   CASH = "CASH",
   CREDIT_CARD = "CREDIT_CARD",
   DEBIT_CARD = "DEBIT_CARD",
   BANK_TRANSFER = "BANK_TRANSFER",
   PAYPAL = "PAYPAL",
   ZELLE = "ZELLE",
   CHECK = "CHECK",
}
```

---

## Response

### Success Response (201 Created)

```json
{
   "success": true,
   "message": "Payment processed successfully",
   "data": {
      "order": {
         "id": 123,
         "customer_id": 45,
         "receiver_id": 67,
         "service_id": 2,
         "total_in_cents": 50000,
         "paid_in_cents": 50000,
         "payment_status": "PAID",
         "requires_home_delivery": true,
         "created_at": "2024-01-15T10:30:00Z",
         "updated_at": "2024-01-15T11:00:00Z",
         "customer": {
            /* Customer object */
         },
         "receiver": {
            /* Receiver object */
         },
         "service": {
            /* Service object */
         },
         "agency": {
            /* Agency object */
         },
         "user": {
            /* User object */
         },
         "payments": [
            {
               "id": 1,
               "order_id": 123,
               "amount_in_cents": 50000,
               "charge_in_cents": 0,
               "method": "CASH",
               "reference": "INV-2024-001",
               "notes": "Payment received in full",
               "date": "2024-01-15T11:00:00Z",
               "created_at": "2024-01-15T11:00:00Z",
               "user_id": "user-uuid"
            }
         ]
      },
      "payment": {
         "id": 1,
         "order_id": 123,
         "amount_in_cents": 50000,
         "charge_in_cents": 0,
         "method": "CASH",
         "reference": "INV-2024-001",
         "notes": "Payment received in full",
         "date": "2024-01-15T11:00:00Z",
         "created_at": "2024-01-15T11:00:00Z",
         "user_id": "user-uuid"
      }
   }
}
```

---

## Payment Status Flow

The order's `payment_status` is automatically updated based on the payment:

```
PENDING → PARTIALLY_PAID → PAID
```

| Status           | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `PENDING`        | No payment received (paid_in_cents = 0)                    |
| `PARTIALLY_PAID` | Some payment received (0 < paid_in_cents < total_in_cents) |
| `PAID`           | Fully paid (paid_in_cents >= total_in_cents)               |

---

## Card Processing Fees

**Automatic Charge Calculation:**

When payment method is `CREDIT_CARD` or `DEBIT_CARD`, a 3% processing fee is automatically:

1. Calculated based on the payment amount
2. Added to the order total
3. Recorded in the payment record
4. Added to payment notes

**Configuration:**

```typescript
// src/config/payment.config.ts
export const PAYMENT_CONFIG = {
   CARD_PROCESSING_FEE_RATE: 0.03, // 3%
   MIN_PAYMENT_AMOUNT: 0.01,
   CENTS_MULTIPLIER: 100,
};
```

**Example:**

```json
// Request
{
  "amount_in_cents": 100000,  // $1,000.00
  "method": "CREDIT_CARD"
}

// Result
{
  "payment": {
    "amount_in_cents": 100000,  // $1,000.00
    "charge_in_cents": 3000,    // $30.00 (3% fee)
    "notes": "Card processing fee (3%): $30.00"
  },
  "order": {
    "total_in_cents": 103000,   // Original + fee
    "paid_in_cents": 100000     // Payment amount only
  }
}
```

---

## Error Responses

### 400 Bad Request - Validation Error

```json
{
   "errors": [
      {
         "field": "amount_in_cents",
         "message": "Amount must be greater than 0"
      }
   ]
}
```

### 400 Bad Request - Business Logic Error

```json
{
   "message": "Payment amount ($600.00) exceeds remaining balance ($500.00)"
}
```

### 404 Not Found

```json
{
   "message": "Order not found"
}
```

### 409 Conflict

```json
{
   "message": "Order is already paid"
}
```

---

## Use Cases

### 1. Full Payment with Cash

```bash
curl -X POST https://api.ctenvios.com/orders/123/payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_in_cents": 50000,
    "method": "CASH",
    "notes": "Payment received at agency"
  }'
```

### 2. Partial Payment

```bash
curl -X POST https://api.ctenvios.com/orders/123/payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_in_cents": 25000,
    "method": "BANK_TRANSFER",
    "reference": "TRANSFER-12345",
    "notes": "First installment"
  }'
```

### 3. Card Payment (with automatic fee)

```bash
curl -X POST https://api.ctenvios.com/orders/123/payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_in_cents": 100000,
    "method": "CREDIT_CARD",
    "reference": "CARD-XXXX-1234"
  }'
```

---

## Business Rules

### ✅ Validations

1. **Amount Validation:**

   -  Must be greater than 0
   -  Cannot exceed remaining balance

2. **Order Status:**

   -  Order must exist
   -  Order cannot already be fully paid

3. **Payment Integrity:**
   -  All operations are atomic (transaction-safe)
   -  Payment and order update happen together or not at all

### 💡 Features

1. **Automatic Fee Calculation:**

   -  Card payments automatically include 3% processing fee
   -  Fee is added to order total
   -  Fee is tracked separately in payment record

2. **Partial Payments:**

   -  Multiple payments can be made on the same order
   -  Payment status updates automatically
   -  Tracks total paid vs total amount

3. **Transaction Safety:**
   -  Uses database transactions
   -  Ensures data consistency
   -  Automatic rollback on errors

---

## Testing Examples

### Test Case 1: Successful Full Payment

```typescript
// Order total: $500.00
const paymentData = {
   amount_in_cents: 50000,
   method: "CASH",
};

// Expected Result:
// - payment_status: PAID
// - paid_in_cents: 50000
// - total_in_cents: 50000
```

### Test Case 2: Partial Payment

```typescript
// Order total: $500.00
const payment1 = {
   amount_in_cents: 30000, // $300
   method: "CASH",
};

// After first payment:
// - payment_status: PARTIALLY_PAID
// - paid_in_cents: 30000
// - total_in_cents: 50000

const payment2 = {
   amount_in_cents: 20000, // $200
   method: "CASH",
};

// After second payment:
// - payment_status: PAID
// - paid_in_cents: 50000
// - total_in_cents: 50000
```

### Test Case 3: Card Payment with Fee

```typescript
// Order total: $500.00
const paymentData = {
   amount_in_cents: 50000,
   method: "CREDIT_CARD",
};

// Expected Result:
// - payment_status: PARTIALLY_PAID (because of fee!)
// - paid_in_cents: 50000
// - total_in_cents: 51500 (50000 + 1500 fee)
// - charge_in_cents: 1500
```

---

## Integration Notes

### For Frontend Developers

1. **Display Amounts:**

   -  Use `formatCents()` utility to display amounts
   -  Show remaining balance: `total_in_cents - paid_in_cents`

2. **Payment Method Selection:**

   -  Warn users about card processing fees
   -  Calculate and show total with fee before confirmation

3. **Status Updates:**
   -  Update order list after successful payment
   -  Show payment history on order details

### For Backend Developers

1. **Service Layer:**

   -  `ordersService.payment()` handles all payment logic
   -  Returns updated order with payment record
   -  Throws descriptive errors for validation failures

2. **Repository Pattern:**

   -  Uses Prisma transactions for data integrity
   -  Includes related entities in response

3. **Error Handling:**
   -  Custom error messages for business logic
   -  Validation errors from Zod schema
   -  Global error middleware for consistent responses

---

## Changelog

### Version 1.0.0 (Current)

-  ✅ Initial payment implementation
-  ✅ Support for all payment methods
-  ✅ Automatic card processing fee (3%)
-  ✅ Partial payment support
-  ✅ Transaction-safe operations
-  ✅ Comprehensive validation
-  ✅ Payment status automation

---

## Related Documentation

-  [Orders API Documentation](./ORDERS_API_DOCUMENTATION.md)
-  [Payment Configuration](../../src/config/payment.config.ts)
-  [Database Schema](../../prisma/schema.prisma)
-  [Error Handling](../PRISMA_ERROR_HANDLING.md)
