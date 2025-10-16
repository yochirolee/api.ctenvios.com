# Prisma Error Handling Guide

## Overview

This guide explains how Prisma errors are handled in the CTEnvios backend API. The error middleware automatically catches and translates Prisma errors into user-friendly HTTP responses.

## Error Middleware Location

-  **File**: `src/middlewares/error.middleware.ts`
-  **Function**: `errorMiddleware`

## Error Types Handled

### 1. Custom AppError

Custom application errors with explicit status codes and messages.

```typescript
throw new AppError(HttpStatusCodes.NOT_FOUND, "Customer not found");
```

**Response:**

```json
{
   "error": "Customer not found"
}
```

### 2. Prisma Known Request Errors

Errors with specific error codes from Prisma operations. These are automatically translated into appropriate HTTP status codes.

#### Common Prisma Error Codes

| Code  | HTTP Status         | Description                    | Example Scenario                         |
| ----- | ------------------- | ------------------------------ | ---------------------------------------- |
| P2002 | 409 CONFLICT        | Unique constraint failed       | Duplicate email/tracking number          |
| P2025 | 404 NOT_FOUND       | Record not found               | Update/delete non-existent record        |
| P2003 | 400 BAD_REQUEST     | Foreign key constraint failed  | Reference to non-existent related record |
| P2001 | 404 NOT_FOUND       | Record searched does not exist | findUnique/findFirst returns null        |
| P2024 | 408 REQUEST_TIMEOUT | Database connection timeout    | Database overload                        |
| P2011 | 400 BAD_REQUEST     | Null constraint violation      | Required field is null                   |
| P2012 | 400 BAD_REQUEST     | Missing required value         | Required field not provided              |

**Example Response:**

```json
{
   "error": "Unique constraint failed on: email",
   "code": "P2002"
}
```

### 3. Prisma Validation Errors

Errors when the query structure is invalid (e.g., wrong field names, invalid data types).

**Response:**

```json
{
   "error": "Invalid data provided for database operation",
   "code": "VALIDATION_ERROR"
}
```

### 4. Prisma Initialization Errors

Database connection issues or configuration problems.

**Response:**

```json
{
   "error": "Database connection error",
   "code": "DB_CONNECTION_ERROR"
}
```

### 5. Prisma Rust Panic Errors

Critical database engine crashes (rare).

**Response:**

```json
{
   "error": "Critical database error occurred",
   "code": "DB_PANIC_ERROR"
}
```

## Usage in Controllers

The error middleware works automatically with async/await and Express error handling. No try/catch blocks needed in most cases.

### Pattern 1: Let Errors Bubble Up (Recommended)

```typescript
export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
   const customer = await customersRepository.getCustomerById(req.params.id);

   // If record doesn't exist, Prisma throws P2001/P2025
   // Error middleware will handle it automatically

   res.status(HttpStatusCodes.OK).json(customer);
};
```

### Pattern 2: Explicit Error Handling (When Needed)

Use try/catch only when you need to add custom business logic or translate errors:

```typescript
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
   try {
      const customer = await customersRepository.createCustomer(req.body);
      res.status(HttpStatusCodes.CREATED).json(customer);
   } catch (error) {
      // Custom handling for specific business logic
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === "P2002") {
            throw new AppError(HttpStatusCodes.CONFLICT, "A customer with this email already exists");
         }
      }
      throw error; // Let error middleware handle other errors
   }
};
```

### Pattern 3: Validation Before Database Operations

Prevent errors by validating data before database operations:

```typescript
export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
   const { id } = req.params;

   // Check if record exists first
   const exists = await ordersRepository.getInvoiceById(id);
   if (!exists) {
      throw new AppError(HttpStatusCodes.NOT_FOUND, "Invoice not found");
   }

   const updated = await ordersRepository.updateInvoice(id, req.body);
   res.status(HttpStatusCodes.OK).json(updated);
};
```

## Repository Pattern Best Practices

### Repository Layer

Keep database operations clean without error handling:

```typescript
// repositories/customers.repository.ts
export const getCustomerById = async (id: string) => {
   return await prisma.customer.findUniqueOrThrow({
      where: { id },
   });
};

export const createCustomer = async (data: CreateCustomerInput) => {
   return await prisma.customer.create({
      data,
   });
};
```

### Controller Layer

Handle business logic and custom error messages:

```typescript
// controllers/customers.controller.ts
export const getCustomer = async (req: Request, res: Response): Promise<void> => {
   const customer = await customersRepository.getCustomerById(req.params.id);
   // P2025 error will be automatically caught and returned as 404
   res.json(customer);
};
```

## Common Scenarios

### Scenario 1: Duplicate Entry (Unique Constraint)

**Code:**

```typescript
await prisma.customer.create({
   data: { email: "existing@email.com" },
});
```

**Error Response (409 Conflict):**

```json
{
   "error": "Unique constraint failed on: email",
   "code": "P2002"
}
```

### Scenario 2: Record Not Found

**Code:**

```typescript
await prisma.invoice.update({
   where: { id: "non-existent-id" },
   data: { status: "DELIVERED" },
});
```

**Error Response (404 Not Found):**

```json
{
   "error": "Record to update or delete not found",
   "code": "P2025"
}
```

### Scenario 3: Foreign Key Violation

**Code:**

```typescript
await prisma.invoice.create({
   data: {
      customerId: "invalid-customer-id", // Customer doesn't exist
      trackingNumber: "CT123456",
   },
});
```

**Error Response (400 Bad Request):**

```json
{
   "error": "Foreign key constraint failed",
   "code": "P2003"
}
```

### Scenario 4: Missing Required Field

**Code:**

```typescript
await prisma.customer.create({
   data: {
      email: "test@test.com",
      // Missing required 'name' field
   },
});
```

**Error Response (400 Bad Request):**

```json
{
   "error": "Missing a required value",
   "code": "P2012"
}
```

## Testing Error Handling

### Unit Test Example

```typescript
describe("Customer Controller", () => {
   it("should return 409 when creating customer with duplicate email", async () => {
      const req = mockRequest({
         body: { email: "duplicate@test.com", name: "Test" },
      });
      const res = mockResponse();

      jest.spyOn(customersRepository, "createCustomer").mockRejectedValue(
         new Prisma.PrismaClientKnownRequestError("Unique constraint", {
            code: "P2002",
            clientVersion: "5.0.0",
            meta: { target: ["email"] },
         })
      );

      await createCustomer(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
         error: "Unique constraint failed on: email",
         code: "P2002",
      });
   });
});
```

## Best Practices

1. **Don't Catch Errors Unless Necessary**: Let the error middleware handle most errors automatically.

2. **Use Explicit Error Messages**: When you do catch errors, provide clear, user-friendly messages.

3. **Log Errors Properly**: The error middleware logs all errors. Use proper logging levels in production.

4. **Use findUniqueOrThrow**: When you expect a record to exist, use `findUniqueOrThrow` instead of `findUnique` to automatically throw on not found.

5. **Validate Before Operations**: Check existence and permissions before update/delete operations.

6. **Use Transactions**: For multi-step operations, use Prisma transactions to maintain data integrity.

7. **Return Consistent Error Format**: All errors follow the same JSON structure with `error` and optional `code` fields.

## Production Considerations

1. **Error Logging**: Consider integrating with a logging service (e.g., Sentry, DataDog) for production error tracking.

2. **Sensitive Information**: Never expose database schema details or connection strings in error messages.

3. **Rate Limiting**: Implement rate limiting to prevent database overload from malicious requests.

4. **Monitoring**: Monitor error rates and specific Prisma error codes to identify issues early.

5. **Database Connection Pool**: Configure appropriate connection pool settings to handle load and prevent P2024 timeout errors.

## Related Files

-  `src/middlewares/error.middleware.ts` - Error handling middleware
-  `src/common/app-errors.ts` - Custom error classes
-  `src/common/https-status-codes.ts` - HTTP status code enum
-  `src/app.ts` - Error middleware registration

## References

-  [Prisma Error Reference](https://www.prisma.io/docs/reference/api-reference/error-reference)
-  [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
-  [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
