# Payment Integration Examples

Practical examples for integrating the payment API into your application.

## Table of Contents

-  [Frontend Integration](#frontend-integration)
-  [API Client Examples](#api-client-examples)
-  [Common Workflows](#common-workflows)
-  [Error Handling](#error-handling)
-  [Best Practices](#best-practices)

---

## Frontend Integration

### React/TypeScript Example

```typescript
// types/payment.types.ts
export enum PaymentMethod {
   CASH = "CASH",
   CREDIT_CARD = "CREDIT_CARD",
   DEBIT_CARD = "DEBIT_CARD",
   BANK_TRANSFER = "BANK_TRANSFER",
   PAYPAL = "PAYPAL",
   ZELLE = "ZELLE",
   CHECK = "CHECK",
}

export enum PaymentStatus {
   PENDING = "PENDING",
   PARTIALLY_PAID = "PARTIALLY_PAID",
   PAID = "PAID",
   REFUNDED = "REFUNDED",
   CANCELLED = "CANCELLED",
}

export interface PaymentRequest {
   amount_in_cents: number;
   method: PaymentMethod;
   reference?: string;
   notes?: string;
}

export interface PaymentResponse {
   success: boolean;
   message: string;
   data: {
      order: Order;
      payment: Payment;
   };
}
```

### Payment Component

```typescript
// components/PaymentForm.tsx
import { useState } from "react";
import { PaymentMethod, PaymentRequest } from "@/types/payment.types";
import { formatCurrency, centsToDollars } from "@/utils/currency";

interface PaymentFormProps {
   orderId: number;
   totalAmount: number;
   paidAmount: number;
   onSuccess: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ orderId, totalAmount, paidAmount, onSuccess }) => {
   const [amount, setAmount] = useState("");
   const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
   const [reference, setReference] = useState("");
   const [notes, setNotes] = useState("");
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const remainingBalance = totalAmount - paidAmount;
   const cardMethods = [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD];
   const isCardPayment = cardMethods.includes(method);

   // Calculate fee for card payments
   const calculateFee = (amountInCents: number): number => {
      if (!isCardPayment) return 0;
      return Math.round(amountInCents * 0.03);
   };

   const amountInCents = Math.round(parseFloat(amount || "0") * 100);
   const feeInCents = calculateFee(amountInCents);
   const totalWithFee = amountInCents + feeInCents;

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
         const paymentData: PaymentRequest = {
            amount_in_cents: amountInCents,
            method,
            reference: reference || undefined,
            notes: notes || undefined,
         };

         const response = await fetch(`/api/orders/${orderId}/payment`, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify(paymentData),
         });

         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Payment failed");
         }

         const result = await response.json();
         onSuccess();

         // Reset form
         setAmount("");
         setReference("");
         setNotes("");
      } catch (err) {
         setError(err instanceof Error ? err.message : "Payment failed");
      } finally {
         setLoading(false);
      }
   };

   return (
      <form onSubmit={handleSubmit} className="space-y-4">
         <div>
            <label className="block text-sm font-medium mb-1">Payment Amount</label>
            <input
               type="number"
               step="0.01"
               min="0.01"
               max={centsToDollars(remainingBalance)}
               value={amount}
               onChange={(e) => setAmount(e.target.value)}
               className="w-full px-3 py-2 border rounded"
               required
            />
            <p className="text-sm text-gray-600 mt-1">Remaining balance: {formatCurrency(remainingBalance)}</p>
         </div>

         <div>
            <label className="block text-sm font-medium mb-1">Payment Method</label>
            <select
               value={method}
               onChange={(e) => setMethod(e.target.value as PaymentMethod)}
               className="w-full px-3 py-2 border rounded"
            >
               <option value={PaymentMethod.CASH}>Cash</option>
               <option value={PaymentMethod.CREDIT_CARD}>Credit Card</option>
               <option value={PaymentMethod.DEBIT_CARD}>Debit Card</option>
               <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
               <option value={PaymentMethod.ZELLE}>Zelle</option>
               <option value={PaymentMethod.PAYPAL}>PayPal</option>
               <option value={PaymentMethod.CHECK}>Check</option>
            </select>
         </div>

         {isCardPayment && amountInCents > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
               <p className="text-sm font-medium text-yellow-800">
                  Card Processing Fee: {formatCurrency(feeInCents)} (3%)
               </p>
               <p className="text-sm text-yellow-700">Total with fee: {formatCurrency(totalWithFee)}</p>
            </div>
         )}

         <div>
            <label className="block text-sm font-medium mb-1">Reference Number (Optional)</label>
            <input
               type="text"
               value={reference}
               onChange={(e) => setReference(e.target.value)}
               className="w-full px-3 py-2 border rounded"
               placeholder="Transaction reference"
            />
         </div>

         <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               className="w-full px-3 py-2 border rounded"
               rows={3}
               placeholder="Additional notes"
            />
         </div>

         {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
               <p className="text-sm text-red-800">{error}</p>
            </div>
         )}

         <button
            type="submit"
            disabled={loading || !amount}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
         >
            {loading ? "Processing..." : "Process Payment"}
         </button>
      </form>
   );
};
```

### Currency Utilities

```typescript
// utils/currency.ts
export const formatCents = (cents: number): string => {
   return (cents / 100).toFixed(2);
};

export const centsToDollars = (cents: number): number => {
   return cents / 100;
};

export const dollarsToCents = (dollars: number): number => {
   return Math.round(dollars * 100);
};

export const formatCurrency = (cents: number, currency: string = "USD"): string => {
   return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
   }).format(centsToDollars(cents));
};
```

---

## API Client Examples

### JavaScript/Fetch

```javascript
// api/payments.js
const API_BASE_URL = "https://api.ctenvios.com";

export async function processPayment(orderId, paymentData, token) {
   const response = await fetch(`${API_BASE_URL}/orders/${orderId}/payment`, {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(paymentData),
   });

   if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Payment failed");
   }

   return response.json();
}

// Usage
try {
   const result = await processPayment(
      123,
      {
         amount_in_cents: 50000,
         method: "CASH",
         reference: "INV-001",
      },
      authToken
   );

   console.log("Payment successful:", result);
} catch (error) {
   console.error("Payment error:", error.message);
}
```

### Axios

```javascript
// api/paymentService.js
import axios from "axios";

const api = axios.create({
   baseURL: "https://api.ctenvios.com",
   headers: {
      "Content-Type": "application/json",
   },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
   const token = localStorage.getItem("token");
   if (token) {
      config.headers.Authorization = `Bearer ${token}`;
   }
   return config;
});

export const paymentService = {
   async processPayment(orderId, paymentData) {
      const { data } = await api.post(`/orders/${orderId}/payment`, paymentData);
      return data;
   },

   async getOrderPayments(orderId) {
      const { data } = await api.get(`/orders/${orderId}`);
      return data.payments;
   },
};

// Usage
try {
   const result = await paymentService.processPayment(123, {
      amount_in_cents: 50000,
      method: "CREDIT_CARD",
      reference: "CARD-1234",
   });

   alert("Payment successful!");
} catch (error) {
   if (error.response) {
      alert(error.response.data.message);
   } else {
      alert("Network error");
   }
}
```

---

## Common Workflows

### Workflow 1: Full Payment

```javascript
// Full payment for an order
async function payOrderInFull(orderId, method = "CASH") {
   // 1. Get order details
   const order = await fetchOrder(orderId);

   // 2. Calculate remaining amount
   const remainingAmount = order.total_in_cents - order.paid_in_cents;

   // 3. Process payment
   const result = await processPayment(orderId, {
      amount_in_cents: remainingAmount,
      method: method,
      notes: "Full payment",
   });

   // 4. Verify payment status
   if (result.data.order.payment_status === "PAID") {
      console.log("Order fully paid!");
      return result;
   }

   throw new Error("Payment processed but order not fully paid");
}
```

### Workflow 2: Installment Payments

```javascript
// Setup installment plan
async function setupInstallmentPayments(orderId, numberOfInstallments) {
   const order = await fetchOrder(orderId);
   const totalAmount = order.total_in_cents;
   const installmentAmount = Math.floor(totalAmount / numberOfInstallments);
   const lastInstallmentAmount = totalAmount - installmentAmount * (numberOfInstallments - 1);

   return {
      totalAmount,
      numberOfInstallments,
      installmentAmount,
      lastInstallmentAmount,
      schedule: Array.from({ length: numberOfInstallments }, (_, i) => ({
         installment: i + 1,
         amount: i === numberOfInstallments - 1 ? lastInstallmentAmount : installmentAmount,
         dueDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000), // Weekly
      })),
   };
}

// Process installment
async function processInstallment(orderId, installmentNumber, plan) {
   const installment = plan.schedule[installmentNumber - 1];

   return await processPayment(orderId, {
      amount_in_cents: installment.amount,
      method: "BANK_TRANSFER",
      notes: `Installment ${installmentNumber} of ${plan.numberOfInstallments}`,
   });
}
```

### Workflow 3: Card Payment with Fee Calculation

```javascript
// Calculate total cost with card fee
function calculateCardPaymentTotal(amountInCents) {
   const FEE_RATE = 0.03; // 3%
   const fee = Math.round(amountInCents * FEE_RATE);

   return {
      baseAmount: amountInCents,
      fee: fee,
      total: amountInCents + fee,
      feePercentage: FEE_RATE * 100,
   };
}

// Process card payment with user confirmation
async function processCardPayment(orderId, amountInCents) {
   // Calculate and show fee
   const calculation = calculateCardPaymentTotal(amountInCents);

   const confirmed = confirm(
      `Card processing fee: $${calculation.fee / 100}\n` +
         `Total amount: $${calculation.total / 100}\n` +
         `Do you want to proceed?`
   );

   if (!confirmed) {
      return null;
   }

   // Process payment
   return await processPayment(orderId, {
      amount_in_cents: amountInCents,
      method: "CREDIT_CARD",
      notes: "Card payment with 3% fee",
   });
}
```

---

## Error Handling

### Comprehensive Error Handler

```typescript
// utils/paymentErrors.ts
export class PaymentError extends Error {
   constructor(message: string, public code: string, public statusCode: number, public details?: any) {
      super(message);
      this.name = "PaymentError";
   }
}

export async function processPaymentWithErrorHandling(orderId: number, paymentData: PaymentRequest) {
   try {
      const response = await fetch(`/api/orders/${orderId}/payment`, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
         },
         body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!response.ok) {
         switch (response.status) {
            case 400:
               throw new PaymentError(data.message || "Invalid payment data", "VALIDATION_ERROR", 400, data.errors);
            case 404:
               throw new PaymentError("Order not found", "ORDER_NOT_FOUND", 404);
            case 409:
               throw new PaymentError(data.message || "Payment conflict", "PAYMENT_CONFLICT", 409);
            case 401:
               throw new PaymentError("Unauthorized", "UNAUTHORIZED", 401);
            default:
               throw new PaymentError("Payment processing failed", "UNKNOWN_ERROR", response.status);
         }
      }

      return data;
   } catch (error) {
      if (error instanceof PaymentError) {
         throw error;
      }

      throw new PaymentError("Network error", "NETWORK_ERROR", 0, error);
   }
}

// Usage with user-friendly messages
async function handlePayment(orderId: number, paymentData: PaymentRequest) {
   try {
      const result = await processPaymentWithErrorHandling(orderId, paymentData);
      showSuccessMessage("Payment processed successfully!");
      return result;
   } catch (error) {
      if (error instanceof PaymentError) {
         switch (error.code) {
            case "VALIDATION_ERROR":
               showErrorMessage("Please check your payment details");
               break;
            case "ORDER_NOT_FOUND":
               showErrorMessage("Order not found. Please refresh and try again.");
               break;
            case "PAYMENT_CONFLICT":
               showErrorMessage(error.message);
               break;
            case "UNAUTHORIZED":
               showErrorMessage("Session expired. Please log in again.");
               redirectToLogin();
               break;
            case "NETWORK_ERROR":
               showErrorMessage("Network error. Please check your connection.");
               break;
            default:
               showErrorMessage("An unexpected error occurred");
         }
      }
      throw error;
   }
}
```

---

## Best Practices

### 1. Always Validate Before Sending

```typescript
function validatePayment(
   amountInCents: number,
   totalInCents: number,
   paidInCents: number
): { valid: boolean; error?: string } {
   if (amountInCents <= 0) {
      return { valid: false, error: "Amount must be greater than 0" };
   }

   const remaining = totalInCents - paidInCents;
   if (amountInCents > remaining) {
      return {
         valid: false,
         error: `Amount exceeds remaining balance ($${remaining / 100})`,
      };
   }

   return { valid: true };
}
```

### 2. Show Real-time Feedback

```typescript
function PaymentSummary({ order, paymentAmount }) {
   const cardMethods = ["CREDIT_CARD", "DEBIT_CARD"];
   const isCardPayment = cardMethods.includes(selectedMethod);
   const fee = isCardPayment ? Math.round(paymentAmount * 0.03) : 0;

   const newPaidAmount = order.paid_in_cents + paymentAmount;
   const newTotalAmount = order.total_in_cents + fee;
   const remainingAfterPayment = newTotalAmount - newPaidAmount;

   return (
      <div className="payment-summary">
         <div>Current Total: {formatCurrency(order.total_in_cents)}</div>
         <div>Already Paid: {formatCurrency(order.paid_in_cents)}</div>
         <div>Payment Amount: {formatCurrency(paymentAmount)}</div>
         {isCardPayment && <div className="text-warning">Card Fee (3%): {formatCurrency(fee)}</div>}
         <div className="divider" />
         <div>New Total: {formatCurrency(newTotalAmount)}</div>
         <div>Total Paid: {formatCurrency(newPaidAmount)}</div>
         <div className="font-bold">Remaining: {formatCurrency(remainingAfterPayment)}</div>
         <div>Status: {remainingAfterPayment === 0 ? "PAID" : "PARTIALLY_PAID"}</div>
      </div>
   );
}
```

### 3. Handle Concurrent Payments

```typescript
// Prevent double submissions
let processingPayment = false;

async function safeProcessPayment(orderId: number, paymentData: PaymentRequest) {
   if (processingPayment) {
      throw new Error("A payment is already being processed");
   }

   processingPayment = true;
   try {
      return await processPayment(orderId, paymentData);
   } finally {
      processingPayment = false;
   }
}
```

### 4. Implement Payment Confirmation

```typescript
async function confirmAndProcessPayment(orderId: number, paymentData: PaymentRequest) {
   const amount = formatCurrency(paymentData.amount_in_cents);
   const method = paymentData.method.replace("_", " ");

   const confirmed = await showConfirmDialog({
      title: "Confirm Payment",
      message: `Process payment of ${amount} via ${method}?`,
      confirmText: "Process Payment",
      cancelText: "Cancel",
   });

   if (!confirmed) {
      return null;
   }

   return await processPayment(orderId, paymentData);
}
```

### 5. Log Payment Activities

```typescript
async function processPaymentWithLogging(orderId: number, paymentData: PaymentRequest) {
   const startTime = Date.now();

   try {
      console.log("Payment initiated:", {
         orderId,
         amount: paymentData.amount_in_cents,
         method: paymentData.method,
      });

      const result = await processPayment(orderId, paymentData);

      console.log("Payment successful:", {
         orderId,
         paymentId: result.data.payment.id,
         duration: Date.now() - startTime,
      });

      return result;
   } catch (error) {
      console.error("Payment failed:", {
         orderId,
         error: error.message,
         duration: Date.now() - startTime,
      });
      throw error;
   }
}
```

---

## Testing

### Mock Payment Service (for testing)

```typescript
// __mocks__/paymentService.ts
export const mockPaymentService = {
   processPayment: jest.fn((orderId, paymentData) => {
      return Promise.resolve({
         success: true,
         message: "Payment processed successfully",
         data: {
            order: {
               id: orderId,
               payment_status: "PAID",
               paid_in_cents: paymentData.amount_in_cents,
            },
            payment: {
               id: 1,
               order_id: orderId,
               amount_in_cents: paymentData.amount_in_cents,
               method: paymentData.method,
            },
         },
      });
   }),
};
```

### Unit Test Example

```typescript
// __tests__/payment.test.ts
import { processPaymentWithErrorHandling } from "@/utils/paymentErrors";
import { mockPaymentService } from "@/__mocks__/paymentService";

describe("Payment Processing", () => {
   it("should process payment successfully", async () => {
      const result = await mockPaymentService.processPayment(123, {
         amount_in_cents: 50000,
         method: "CASH",
      });

      expect(result.success).toBe(true);
      expect(result.data.payment.amount_in_cents).toBe(50000);
   });
});
```

---

## Summary

-  Always validate payment data before submission
-  Show card processing fees upfront
-  Implement proper error handling
-  Provide real-time payment summaries
-  Prevent double submissions
-  Log payment activities for auditing
-  Test payment flows thoroughly

For more information, see the [Payments API Documentation](./PAYMENTS_API.md).
