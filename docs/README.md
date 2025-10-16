# CTEnvios API Documentation

Complete documentation for the CTEnvios package tracking system API.

## 📚 Documentation Structure

```
docs/
├── README.md                          # This file - Documentation index
├── api/                               # API reference documentation
│   ├── PARTNERS_API_DOCUMENTATION.md # Partner/third-party API
│   └── README.md                     # API documentation index
├── api-keys/                          # API key system documentation
│   ├── README.md                     # API key documentation index
│   ├── API_KEY_GUIDE.md             # User guide for API keys
│   ├── IMPLEMENTATION_SUMMARY.md     # Technical implementation details
│   └── MIGRATION_GUIDE.md           # Database migration guide
└── testing/                          # Testing documentation
    ├── README-STRESS-TESTING.md     # Stress testing guide
    └── README.md                    # Testing documentation index
```

## 🎯 Quick Navigation

### For Developers

**Getting Started:**

1. Read the [Main README](../README.md) for project overview
2. Review [Architecture & Development Guide](#architecture--development)
3. Set up your development environment
4. Review [Code Conventions](#code-conventions)
5. Read [Testing Documentation](./testing/)

**Key Resources:**

-  [Project Structure](#project-structure)
-  [Database Schema](#database-schema)
-  [API Endpoints](#api-endpoints)
-  [Testing Guide](./testing/)

### For API Users (Partners)

**Integration Guide:**

1. [Partners API Documentation](./api/PARTNERS_API_DOCUMENTATION.md)
2. [API Key Guide](./api-keys/API_KEY_GUIDE.md)
3. Code examples and best practices
4. Troubleshooting and support

### For DevOps/SRE

**Deployment & Operations:**

1. [Deployment Guide](#deployment)
2. [API Key Migration](./api-keys/MIGRATION_GUIDE.md)
3. [Performance Testing](./testing/)
4. Monitoring and alerts

---

## 📖 Core Documentation

### 1. API Documentation

#### [Partners API Documentation](./api/PARTNERS_API_DOCUMENTATION.md)

Complete reference for the partner integration API:

-  Authentication and API keys
-  Invoice management endpoints
-  Customer and receiver management
-  Service rates and catalogs
-  Webhooks and callbacks
-  Code examples
-  Error handling

**Audience:** Third-party developers integrating with CTEnvios

---

### 2. API Key System

#### [API Key Documentation Index](./api-keys/README.md)

Comprehensive guide to the secure API key system:

-  **[API Key Guide](./api-keys/API_KEY_GUIDE.md)** - User guide for managing API keys
-  **[Implementation Summary](./api-keys/IMPLEMENTATION_SUMMARY.md)** - Technical details
-  **[Migration Guide](./api-keys/MIGRATION_GUIDE.md)** - Database migration steps

**Features:**

-  SHA-256 hashed key storage
-  Multiple keys per partner
-  Key expiration and rotation
-  Audit logging
-  Rate limiting

**Audience:** Developers, DevOps, Partners

---

### 3. Testing Documentation

#### [Testing Guide](./testing/)

Performance and stress testing documentation:

-  **[Stress Testing Guide](./testing/README-STRESS-TESTING.md)** - Load testing with Jest & Artillery
-  Test scenarios and benchmarks
-  Performance optimization tips
-  CI/CD integration

**Audience:** QA engineers, Developers, DevOps

---

## 🏗️ Architecture & Development

### Project Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client/Partner                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                 API Routes Layer                     │
│  (Express routes - HTTP endpoint definitions)       │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│               Middleware Layer                       │
│  (Auth, Validation, Logging, Error Handling)        │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              Controllers Layer                       │
│  (Business Logic, Validation with Zod)              │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              Repository Layer                        │
│  (Data Access, Prisma Queries)                      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              Database (PostgreSQL)                   │
│  (Data Storage with Prisma ORM)                     │
└─────────────────────────────────────────────────────┘
```

### Layered Architecture

**1. Routes Layer** (`src/routes/`)

-  HTTP endpoint definitions
-  Route parameter validation
-  Middleware attachment

**2. Middleware Layer** (`src/middlewares/`)

-  Authentication (JWT, API Keys)
-  Request validation
-  Error handling
-  Logging

**3. Controllers Layer** (`src/controllers/`)

-  Business logic implementation
-  Request/response handling
-  Data validation with Zod
-  Permission checks

**4. Repository Layer** (`src/repository/`)

-  Database operations
-  Prisma query abstraction
-  Data transformations
-  Transaction management

### Design Patterns

**Repository Pattern:**

```typescript
// Separation of data access from business logic
export const customers = {
   getAll: async () => {
      /* Prisma queries */
   },
   getById: async (id: number) => {
      /* ... */
   },
   create: async (data) => {
      /* ... */
   },
   update: async (id, data) => {
      /* ... */
   },
   delete: async (id) => {
      /* ... */
   },
};
```

**Middleware Pattern:**

```typescript
// Authentication middleware
export const authMiddleware = async (req, res, next) => {
   // Verify JWT token
   // Attach user to request
   // Call next() or throw error
};
```

**Factory Pattern:**

```typescript
// PDF generation
export const generateInvoicePdf = (invoice, options) => {
   // Create PDF document
   // Return buffer
};
```

---

## 💻 Project Structure

```
api.ctenvios.com/
│
├── docs/                           # 📚 Documentation
│   ├── api/                       # API references
│   ├── api-keys/                  # API key system docs
│   └── testing/                   # Testing guides
│
├── prisma/                        # 🗄️ Database
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # Migration files
│   └── *.seed.ts                # Seed scripts
│
├── src/                          # 💻 Source Code
│   │
│   ├── config/                   # ⚙️ Configuration
│   │   ├── prisma_db.ts         # Database connection
│   │   └── payment.config.ts    # Payment config
│   │
│   ├── controllers/              # 🎮 Business Logic
│   │   ├── agencies.controller.ts
│   │   ├── customers.controller.ts
│   │   ├── partners.controller.ts
│   │   └── ... (11 controllers)
│   │
│   ├── middlewares/              # 🛡️ Middleware
│   │   ├── auth-midleware.ts    # JWT authentication
│   │   ├── partner-auth-middleware.ts  # API key auth
│   │   ├── errorHandler.ts      # Error handling
│   │   └── invoice-middleware.ts
│   │
│   ├── repository/               # 🗃️ Data Access
│   │   ├── agencies.repository.ts
│   │   ├── customers.repository.ts
│   │   ├── partners.repository.ts
│   │   └── ... (11 repositories)
│   │
│   ├── routes/                   # 🛣️ API Routes
│   │   ├── router.ts            # Main router
│   │   ├── invoices.routes.ts
│   │   ├── partners.routes.ts
│   │   └── ... (14 route files)
│   │
│   ├── services/                 # 📧 External Services
│   │   ├── resend.ts            # Email service
│   │   └── twilio.ts            # SMS service
│   │
│   ├── utils/                    # 🔧 Utilities
│   │   ├── apiKeyUtils.ts       # API key generation
│   │   ├── generate-invoice-pdf.ts  # PDF generation
│   │   ├── app.error.ts         # Custom error class
│   │   └── ... (10 utility files)
│   │
│   ├── types/                    # 📝 Type Definitions
│   │   └── types.ts
│   │
│   ├── tests/                    # 🧪 Tests
│   │   ├── setup.ts
│   │   ├── helpers/
│   │   ├── simple/
│   │   ├── stress/
│   │   └── debug/
│   │
│   ├── app.ts                    # Express app setup
│   └── server.ts                 # Server entry point
│
├── assets/                       # 🖼️ Static Assets
│   └── company-logo.png
│
├── artillery*.yml                # 🎯 Load test configs
├── jest.config.js               # 🧪 Test configuration
├── tsconfig.json                # 📘 TypeScript config
├── vercel.json                  # 🚀 Deployment config
└── package.json                 # 📦 Dependencies
```

---

## 🗄️ Database Schema

### Core Entities

```prisma
model User {
  id         String    @id @default(uuid())
  name       String
  email      String    @unique
  role       Roles     @default(AGENCY_SALES)
  agency_id  Int?
  // ... relations
}

model Agency {
  id                Int       @id @default(autoincrement())
  name              String
  forwarder_id      Int
  parent_agency_id  Int?      // Hierarchical structure
  // ... relations
}

model Customer {
  id                Int       @id @default(autoincrement())
  first_name        String
  last_name         String
  email             String?   @unique
  mobile            String
  // ... relations
}

model Invoice {
  id          Int            @id @default(autoincrement())
  hbl         String         @unique
  customer_id Int
  status      InvoiceStatus
  // ... many more fields and relations
}
```

### Partner System

```prisma
model Partner {
  id          Int       @id @default(autoincrement())
  name        String
  email       String    @unique
  agency_id   Int
  rate_limit  Int?
  // ... relations to api_keys, invoices, logs
}

model ApiKey {
  id         String    @id @default(uuid())
  key_hash   String    @unique  // SHA-256 hash
  prefix     String    // ct_live or ct_test
  partner_id Int
  is_active  Boolean   @default(true)
  expires_at DateTime?
  // ... relations
}

model PartnerLog {
  id            Int      @id @default(autoincrement())
  partner_id    Int
  api_key_id    String
  endpoint      String
  method        String
  status_code   Int
  // ... audit fields
}
```

For complete schema, see `prisma/schema.prisma`

---

## 🔐 Authentication & Authorization

### User Authentication (JWT)

**Endpoints:**

```
POST /api/v1/auth/login
POST /api/v1/auth/register
GET  /api/v1/auth/me
```

**Flow:**

1. User provides credentials
2. Server validates and generates JWT
3. Client includes token in `Authorization: Bearer <token>`
4. Middleware validates token on protected routes

### Partner Authentication (API Keys)

**Endpoints:**

```
POST   /api/v1/partners/:id/api-keys         # Create key
GET    /api/v1/partners/:id/api-keys         # List keys
POST   /api/v1/partners/:id/api-keys/:keyId/revoke  # Revoke
```

**Flow:**

1. Admin creates API key for partner
2. Partner stores key securely
3. Partner includes key in `Authorization: Bearer <api-key>`
4. Middleware hashes and validates key

**See:** [API Key Documentation](./api-keys/)

### Role-Based Access Control

Roles (in order of privilege):

1. `ROOT` - Full system access
2. `ADMINISTRATOR` - Admin operations
3. `FORWARDER_ADMIN` - Forwarder management
4. `AGENCY_ADMIN` - Agency management
5. `AGENCY_SALES` - Sales operations
6. `PARTNER` - API-only access

---

## 📡 API Endpoints

### Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://api.ctenvios.com/api/v1
```

### Main Endpoints

#### Agencies

```
GET    /agencies
GET    /agencies/:id
POST   /agencies
PUT    /agencies/:id
DELETE /agencies/:id
```

#### Customers

```
GET    /customers
GET    /customers/:id
POST   /customers
PUT    /customers/:id
DELETE /customers/:id
```

#### Invoices

```
GET    /invoices
GET    /invoices/:id
POST   /invoices
PUT    /invoices/:id
DELETE /invoices/:id
GET    /invoices/:id/pdf
```

#### Partners

```
GET    /partners
POST   /partners
GET    /partners/:id
PUT    /partners/:id
DELETE /partners/:id
POST   /partners/:id/api-keys
GET    /partners/:id/api-keys
```

For complete API reference, see:

-  [Partners API Documentation](./api/PARTNERS_API_DOCUMENTATION.md)

---

## 🔧 Code Conventions

### TypeScript

```typescript
// ✅ Good: Explicit return types
export const getUser = async (id: string): Promise<User | null> => {
   return await prisma.user.findUnique({ where: { id } });
};

// ✅ Good: Interfaces over types
interface CreateUserInput {
   name: string;
   email: string;
   role?: Roles;
}

// ❌ Avoid: Classes (prefer functional)
// ❌ Avoid: Enums (use const objects with 'as const')
```

### Error Handling

```typescript
// ✅ Good: Use AppError
throw new AppError("User not found", 404);

// ✅ Good: Let errors bubble up
export const deleteUser = async (id: string) => {
   return await prisma.user.delete({ where: { id } });
   // No try/catch - let middleware handle it
};

// ❌ Avoid: Unnecessary try/catch
```

### Naming Conventions

```typescript
// Files
utils / apiKeyUtils.ts; // camelCase for utilities
controllers / User.controller.ts; // PascalCase for controllers
routes / users.routes.ts; // kebab-case for routes

// Functions & Variables
const getUserById = () => {}; // camelCase
const API_KEY_PREFIX = "ct_"; // UPPER_CASE for constants

// Types & Interfaces
interface User {} // PascalCase
type UserRole = string; // PascalCase
```

---

## 🧪 Testing

### Test Structure

```bash
src/tests/
├── setup.ts              # Jest configuration
├── helpers/              # Test utilities
│   └── testDataGenerator.ts
├── setup/                # Setup tests
│   ├── invoiceFormatTest.test.ts
│   └── routeTest.test.ts
├── simple/               # Unit tests
│   ├── basicStressTest.test.ts
│   └── simpleInvoiceTest.test.ts
└── stress/               # Load tests
    ├── invoiceCreation.stress.test.ts
    └── realisticInvoiceCreation.stress.test.ts
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Stress tests
npm run test:stress

# Artillery load tests
npm run artillery:test
npm run artillery:light
```

**See:** [Testing Documentation](./testing/)

---

## 🚀 Deployment

### Vercel Deployment

1. **Configure Environment Variables**

   -  Set all required env vars in Vercel dashboard
   -  Ensure DATABASE_URL points to production database

2. **Deploy**

   ```bash
   vercel --prod
   ```

3. **Run Migrations**
   ```bash
   npx prisma migrate deploy
   ```

### Environment Checklist

-  [ ] DATABASE_URL configured
-  [ ] JWT_SECRET set (use strong secret)
-  [ ] External service keys configured (Resend, Twilio)
-  [ ] CORS settings appropriate for production
-  [ ] Rate limiting configured
-  [ ] Monitoring and logging set up

---

## 📞 Support & Resources

### Documentation

-  [Main README](../README.md) - Project overview
-  [API Documentation](./api/) - API reference
-  [API Keys](./api-keys/) - API key system
-  [Testing](./testing/) - Testing guides

### Contact

-  **Technical Support:** dev-team@ctenvios.com
-  **Partner Support:** support@ctenvios.com
-  **Security Issues:** security@ctenvios.com

### External Resources

-  [Prisma Documentation](https://www.prisma.io/docs/)
-  [Express.js Guide](https://expressjs.com/)
-  [TypeScript Handbook](https://www.typescriptlang.org/docs/)
-  [Jest Testing](https://jestjs.io/docs/getting-started)

---

## 📝 Changelog

### Version 1.0.0 (January 2025)

**New Features:**

-  ✨ Secure API key system with SHA-256 hashing
-  ✨ Partner API for third-party integrations
-  ✨ Comprehensive audit logging
-  ✨ PDF invoice and label generation
-  ✨ Role-based access control

**Improvements:**

-  🚀 Performance optimizations
-  📚 Complete documentation
-  🧪 Comprehensive test suites
-  🔒 Enhanced security measures

---

**Documentation Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** CTEnvios Development Team
