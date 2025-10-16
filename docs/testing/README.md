# Testing Documentation

Comprehensive testing guides for the CTEnvios API.

## 📚 Available Documentation

### [Stress Testing Guide](./README-STRESS-TESTING.md)

Complete guide for performance and load testing:

-  Jest stress testing
-  Artillery load testing
-  Concurrent testing strategies
-  Performance benchmarks
-  Optimization techniques

---

## 🧪 Testing Overview

The CTEnvios API includes comprehensive testing at multiple levels:

### Test Types

1. **Unit Tests** - Individual function testing
2. **Integration Tests** - API endpoint testing
3. **Stress Tests** - Load and performance testing
4. **Debug Tests** - Database validation and troubleshooting

### Test Structure

```
src/tests/
├── setup.ts                    # Jest configuration
├── helpers/
│   └── testDataGenerator.ts   # Test data utilities
├── setup/
│   ├── invoiceFormatTest.test.ts
│   └── routeTest.test.ts
├── simple/
│   ├── basicStressTest.test.ts
│   ├── lightStressTest.test.ts
│   ├── realDataStressTest.test.ts
│   └── simpleInvoiceTest.test.ts
├── stress/
│   ├── invoiceCreation.stress.test.ts
│   └── realisticInvoiceCreation.stress.test.ts
└── debug/
    ├── checkDatabaseData.test.ts
    └── verifyRealIds.test.ts
```

---

## 🚀 Quick Start

### Running Tests

```bash
# All tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Stress tests only
npm run test:stress

# Concurrent stress tests
npm run test:stress-concurrent
```

### Artillery Load Tests

```bash
# Standard load test
npm run artillery:test

# Light load test
npm run artillery:light

# Quick test
npm run artillery:quick
```

---

## 🔧 Test Configuration

### Jest Configuration

**File:** `jest.config.js`

```javascript
module.exports = {
   preset: "ts-jest",
   testEnvironment: "node",
   testTimeout: 30000,
   maxWorkers: 4,
   // ... more config
};
```

### Artillery Configuration

**Files:**

-  `artillery-test.yml` - Full load test
-  `artillery-light.yml` - Light load test

```yaml
config:
   target: "http://localhost:3000"
   phases:
      - duration: 60
        arrivalRate: 10
        name: "Warm up"
scenarios:
   - flow:
        - post:
             url: "/api/v1/invoices"
             json: { ... }
```

---

## 📊 Performance Benchmarks

### Target Metrics

| Metric              | Target           | Acceptable       |
| ------------------- | ---------------- | ---------------- |
| Response Time (p95) | < 200ms          | < 500ms          |
| Response Time (p99) | < 500ms          | < 1000ms         |
| Throughput          | > 100 rps        | > 50 rps         |
| Error Rate          | < 0.1%           | < 1%             |
| Database Queries    | < 10 per request | < 20 per request |

### Current Performance

**Invoice Creation:**

-  Average: ~150ms
-  P95: ~300ms
-  P99: ~600ms
-  Throughput: ~80 invoices/second

**Invoice Retrieval:**

-  Average: ~50ms
-  P95: ~100ms
-  P99: ~200ms
-  Throughput: ~200 requests/second

---

## 🧪 Writing Tests

### Unit Test Example

```typescript
// tests/simple/customer.test.ts
import request from "supertest";
import app from "../../app";

describe("Customer API", () => {
   it("should create a customer", async () => {
      const response = await request(app).post("/api/v1/customers").set("Authorization", `Bearer ${testToken}`).send({
         first_name: "John",
         last_name: "Doe",
         email: "john@example.com",
         mobile: "1234567890",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
   });
});
```

### Stress Test Example

```typescript
// tests/stress/invoice.stress.test.ts
describe("Invoice Creation Stress Test", () => {
   it("should handle 100 concurrent invoice creations", async () => {
      const promises = Array(100)
         .fill(null)
         .map(() =>
            request(app).post("/api/v1/invoices").set("Authorization", `Bearer ${testToken}`).send(invoiceData)
         );

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.status === 201);

      expect(successful.length).toBeGreaterThan(95);
   });
});
```

---

## 📈 Test Data Generation

### Using Test Data Generator

```typescript
import { generateTestCustomer, generateTestInvoice } from "./helpers/testDataGenerator";

// Generate test customer
const customer = generateTestCustomer({
   email: "test@example.com",
});

// Generate test invoice with all required relationships
const invoice = await generateTestInvoice({
   customer_id: customer.id,
   status: "PENDING",
});
```

### Faker Integration

```typescript
import { faker } from "@faker-js/faker";

const testCustomer = {
   first_name: faker.person.firstName(),
   last_name: faker.person.lastName(),
   email: faker.internet.email(),
   mobile: faker.phone.number(),
};
```

---

## 🔍 Debug Tests

### Database Validation

```bash
# Check database data integrity
npm test -- checkDatabaseData.test.ts

# Verify real IDs exist
npm test -- verifyRealIds.test.ts
```

### Debugging Failed Tests

```bash
# Run specific test file
npm test -- path/to/test.test.ts

# Run with verbose output
npm test -- --verbose

# Run with debug info
DEBUG=* npm test
```

---

## 🎯 Test Coverage

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# View in browser
open coverage/lcov-report/index.html
```

### Coverage Targets

| Component   | Target | Current |
| ----------- | ------ | ------- |
| Controllers | > 80%  | ~75%    |
| Repository  | > 90%  | ~85%    |
| Utils       | > 85%  | ~80%    |
| Overall     | > 80%  | ~78%    |

---

## ⚡ Performance Optimization

### Best Practices

1. **Database Queries**

   -  Use proper indexes
   -  Select only needed fields
   -  Use `include` wisely
   -  Implement pagination

2. **API Endpoints**

   -  Minimize database round trips
   -  Use transactions appropriately
   -  Implement caching where possible
   -  Optimize PDF generation

3. **Testing**
   -  Use test database
   -  Clean up test data
   -  Mock external services
   -  Run tests in parallel

### Monitoring Performance

```typescript
// Add timing to tests
const start = Date.now();
await request(app).post("/api/v1/invoices").send(data);
const duration = Date.now() - start;

expect(duration).toBeLessThan(500); // Assert performance
```

---

## 🔄 Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
   test:
      runs-on: ubuntu-latest

      services:
         postgres:
            image: postgres:14
            env:
               POSTGRES_PASSWORD: postgres
            options: >-
               --health-cmd pg_isready
               --health-interval 10s
               --health-timeout 5s
               --health-retries 5

      steps:
         - uses: actions/checkout@v2
         - uses: actions/setup-node@v2
           with:
              node-version: "18"

         - run: npm install
         - run: npx prisma generate
         - run: npx prisma migrate dev
         - run: npm test
         - run: npm run test:coverage
```

---

## 🐛 Troubleshooting

### Common Issues

**Tests timeout:**

```bash
# Increase timeout in jest.config.js
testTimeout: 60000
```

**Database connection issues:**

```bash
# Check database is running
psql -h localhost -U your_user -d ctenvios

# Verify DATABASE_URL in .env
```

**Port already in use:**

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill
```

**Random test failures:**

-  Ensure test isolation
-  Clean up test data between tests
-  Check for race conditions

---

## 📞 Support

### Documentation

-  [Stress Testing Guide](./README-STRESS-TESTING.md)
-  [Main Documentation](../README.md)
-  [API Documentation](../api/)

### Resources

-  [Jest Documentation](https://jestjs.io/)
-  [Supertest Guide](https://github.com/visionmedia/supertest)
-  [Artillery Docs](https://www.artillery.io/docs)

### Contact

-  **Technical Issues:** dev-team@ctenvios.com
-  **CI/CD Help:** devops@ctenvios.com

---

## ✅ Testing Checklist

Before deploying:

-  [ ] All unit tests passing
-  [ ] Integration tests passing
-  [ ] Stress tests meeting performance targets
-  [ ] Coverage > 80%
-  [ ] No console errors or warnings
-  [ ] Database migrations tested
-  [ ] Environment variables validated
-  [ ] Load testing completed
-  [ ] Security tests passed

---

**Last Updated:** January 2025  
**Testing Framework:** Jest 30.x + Artillery 2.x  
**Documentation Version:** 1.0
