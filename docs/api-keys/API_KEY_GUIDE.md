# API Key Management Guide

## Overview

This guide explains how to create and manage API keys for partners in the CTEnvios system following security best practices.

## 🔐 Security Features

Our API key system implements industry-standard security practices:

1. **Cryptographic Hashing (SHA-256)** - Keys are never stored in plain text
2. **Secure Generation** - Using Node.js `crypto.randomBytes()` for cryptographically secure random keys
3. **Key Prefixes** - Easy identification (`ct_live_`, `ct_test_`)
4. **Expiration Support** - Keys can have expiration dates
5. **Multiple Keys per Partner** - Enable key rotation without downtime
6. **Activity Tracking** - Monitor last_used timestamp
7. **Soft Deletion** - Revoke keys without permanent deletion
8. **Rate Limiting** - Track requests per partner
9. **Audit Logging** - All API calls are logged with metadata

## 📋 Best Practices

### 1. **Key Generation**

-  Keys are 256-bit random values (43 characters base64url)
-  Format: `ct_{environment}_{random}`
-  Only shown ONCE upon creation

### 2. **Key Storage**

-  Store keys securely (environment variables, secrets managers)
-  Never commit keys to version control
-  Never log full API keys

### 3. **Key Rotation**

-  Rotate keys periodically (e.g., every 90 days)
-  Use expiration dates to enforce rotation
-  Create new key before revoking old one

### 4. **Environment Separation**

-  Use `ct_test_` keys for development/testing
-  Use `ct_live_` keys for production only
-  Never mix environments

## 🚀 API Endpoints

### Create API Key

**POST** `/partners/:id/api-keys`

Creates a new API key for a partner.

**Authorization:** Required (ROOT or ADMINISTRATOR roles)

**Request Body:**

```json
{
   "name": "Production Server Key",
   "environment": "live",
   "expires_in_days": 90
}
```

**Parameters:**

-  `name` (optional): Descriptive name for the key
-  `environment` (optional): `"live"` or `"test"` (default: `"live"`)
-  `expires_in_days` (optional): Number of days until expiration

**Response:**

```json
{
   "message": "API key created successfully. Save this key securely - it will not be shown again.",
   "api_key": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "key": "ct_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v",
      "prefix": "ct_live"
   },
   "warning": "⚠️ Store this API key securely. You will not be able to see it again."
}
```

⚠️ **IMPORTANT:** Save the `key` value immediately. It will never be displayed again!

---

### List API Keys

**GET** `/partners/:id/api-keys`

Get all API keys for a partner (metadata only, not the actual keys).

**Authorization:** Required (ROOT, ADMINISTRATOR, or FORWARDER_ADMIN roles)

**Response:**

```json
{
   "api_keys": [
      {
         "id": "550e8400-e29b-41d4-a716-446655440000",
         "prefix": "ct_live",
         "name": "Production Server Key",
         "is_active": true,
         "expires_at": "2025-04-08T00:00:00.000Z",
         "created_at": "2025-01-08T00:00:00.000Z",
         "last_used": "2025-01-07T14:30:00.000Z"
      }
   ],
   "note": "API key values are hashed and cannot be retrieved. Only metadata is shown."
}
```

---

### Revoke API Key

**POST** `/partners/:id/api-keys/:keyId/revoke`

Soft-delete an API key (mark as inactive).

**Authorization:** Required (ROOT or ADMINISTRATOR roles)

**Response:**

```json
{
   "message": "API key revoked successfully"
}
```

---

### Delete API Key

**DELETE** `/partners/:id/api-keys/:keyId`

Permanently delete an API key from the database.

**Authorization:** Required (ROOT role only)

**Response:**

```json
{
   "message": "API key permanently deleted"
}
```

## 💻 Using API Keys

### Authentication

Include the API key in the `Authorization` header:

```bash
curl -X POST https://api.ctenvios.com/partners/invoices \\
  -H "Authorization: Bearer ct_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v" \\
  -H "Content-Type: application/json" \\
  -d '{ "data": "..." }'
```

Or without the "Bearer" prefix:

```bash
curl -X POST https://api.ctenvios.com/partners/invoices \\
  -H "Authorization: ct_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v" \\
  -H "Content-Type: application/json" \\
  -d '{ "data": "..." }'
```

### Rate Limiting

Each partner has a rate limit (default: 100 requests per hour). When exceeded, you'll receive:

```json
{
   "status": "error",
   "message": "Rate limit exceeded. You are limited to 100 requests per hour."
}
```

**HTTP Status:** `429 Too Many Requests`

### Error Responses

#### Invalid or Expired Key

```json
{
   "status": "error",
   "message": "Invalid API key, expired, or partner not found"
}
```

**HTTP Status:** `401 Unauthorized`

#### Inactive Partner

```json
{
   "status": "error",
   "message": "Partner account is inactive. Please contact support."
}
```

**HTTP Status:** `403 Forbidden`

## 🔧 Implementation Details

### Database Schema

```prisma
model ApiKey {
  id         String    @id @default(uuid())
  key_hash   String    @unique  // SHA-256 hash
  prefix     String    // "ct_live" or "ct_test"
  name       String?   // Optional descriptive name
  partner_id Int
  partner    Partner   @relation(...)
  is_active  Boolean   @default(true)
  expires_at DateTime?
  created_at DateTime  @default(now())
  last_used  DateTime?
  logs       PartnerLog[]
}
```

### Security Flow

1. **Key Generation:**

   -  Generate 32 random bytes (256 bits)
   -  Convert to base64url (43 characters)
   -  Add prefix: `ct_{environment}_`
   -  Hash with SHA-256 for storage

2. **Authentication:**

   -  Extract key from Authorization header
   -  Hash the provided key
   -  Compare hash with database
   -  Check active status and expiration
   -  Update `last_used` timestamp
   -  Validate rate limits

3. **Logging:**
   -  Every API call is logged
   -  Includes: endpoint, method, status, IP, user agent
   -  Linked to specific API key for audit trail

## 📊 Monitoring & Analytics

### Check API Key Usage

**GET** `/partners/:id/stats`

```json
{
   "requests_last_hour": 45,
   "requests_last_day": 823,
   "total_invoices": 1250,
   "total_requests": 15000
}
```

### View Request Logs

**GET** `/partners/:id/logs?limit=100&offset=0`

```json
[
   {
      "id": 1,
      "endpoint": "/partners/invoices",
      "method": "POST",
      "status_code": 201,
      "ip_address": "192.168.1.1",
      "created_at": "2025-01-07T14:30:00.000Z"
   }
]
```

## 🔄 Key Rotation Example

Here's a safe key rotation workflow:

```bash
# Step 1: Create new API key
NEW_KEY=$(curl -X POST https://api.ctenvios.com/partners/1/api-keys \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "New Production Key", "environment": "live"}' | jq -r '.api_key.key')

# Step 2: Update your application with new key
# (Deploy with new key)

# Step 3: Verify new key works
curl -X GET https://api.ctenvios.com/partners/test \\
  -H "Authorization: Bearer $NEW_KEY"

# Step 4: Revoke old key
curl -X POST https://api.ctenvios.com/partners/1/api-keys/OLD_KEY_ID/revoke \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🛡️ Security Checklist

-  [ ] Store API keys in secure environment variables
-  [ ] Never commit keys to version control
-  [ ] Use HTTPS only for API calls
-  [ ] Rotate keys every 90 days
-  [ ] Monitor rate limits and usage patterns
-  [ ] Revoke unused or compromised keys immediately
-  [ ] Use test keys for development
-  [ ] Keep audit logs for compliance
-  [ ] Implement IP whitelisting (if needed)
-  [ ] Set up alerts for unusual activity

## 📝 Code Examples

### Node.js Example

```javascript
const axios = require("axios");

const API_KEY = process.env.CTENVIOS_API_KEY; // Never hardcode!

const client = axios.create({
   baseURL: "https://api.ctenvios.com",
   headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
   },
});

async function createInvoice(data) {
   try {
      const response = await client.post("/partners/invoices", data);
      return response.data;
   } catch (error) {
      if (error.response?.status === 429) {
         console.error("Rate limit exceeded. Waiting...");
         // Implement retry with exponential backoff
      }
      throw error;
   }
}
```

### Python Example

```python
import os
import requests

API_KEY = os.environ.get('CTENVIOS_API_KEY')  # Never hardcode!

class CTEnviosClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.ctenvios.com'
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        })

    def create_invoice(self, data):
        response = self.session.post(
            f'{self.base_url}/partners/invoices',
            json=data
        )
        response.raise_for_status()
        return response.json()

client = CTEnviosClient(API_KEY)
```

## 🆘 Troubleshooting

### "Invalid API key" error

-  Verify you're using the correct key
-  Check if key has expired
-  Ensure partner account is active

### "Rate limit exceeded" error

-  Wait for the rate limit window to reset
-  Request a higher rate limit
-  Implement request queuing

### Key not working immediately

-  Allow a few seconds for propagation
-  Verify network connectivity
-  Check authorization header format

## 📞 Support

For issues or questions:

-  Check the logs: `GET /partners/:id/logs`
-  View key status: `GET /partners/:id/api-keys`
-  Contact: support@ctenvios.com

---

**Last Updated:** January 2025  
**Version:** 1.0
