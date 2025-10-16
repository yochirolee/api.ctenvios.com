# API Documentation

Complete API reference for the CTEnvios package tracking system.

## 📚 Available Documentation

### [Partners API Documentation](./PARTNERS_API_DOCUMENTATION.md)

Comprehensive guide for third-party integrations and partner API usage.

**Contents:**

-  Authentication with API keys
-  Invoice management endpoints
-  Customer and receiver operations
-  Service and rate queries
-  Product catalog access
-  Webhooks and callbacks
-  Code examples (curl, JavaScript, Python)
-  Error codes and handling
-  Rate limiting
-  Best practices

**Audience:** Third-party developers, partners, integration teams

---

## 🚀 Quick Start

### 1. Get API Access

Contact your CTEnvios administrator to:

1. Create a partner account
2. Generate an API key
3. Receive your credentials

### 2. Authenticate

Include your API key in all requests:

```bash
curl -X GET https://api.ctenvios.com/api/v1/partners/invoices \
  -H "Authorization: Bearer ct_live_your_api_key_here"
```

### 3. Make Your First Request

Test the API with a simple request:

```bash
# Get your partner information
curl -X GET https://api.ctenvios.com/api/v1/partners/me \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 🔑 Authentication

### API Key Authentication

All partner API requests require authentication using an API key.

**Format:**

```
Authorization: Bearer ct_live_abc123...
```

**Key Types:**

-  `ct_live_*` - Production keys
-  `ct_test_*` - Testing/development keys

For detailed information on API keys, see the [API Key Documentation](../api-keys/).

---

## 📡 Base URLs

```
Production:  https://api.ctenvios.com/api/v1
Development: http://localhost:3000/api/v1
```

---

## 🔒 Security Best Practices

✅ **Always use HTTPS** in production  
✅ **Never commit API keys** to version control  
✅ **Store keys securely** in environment variables  
✅ **Rotate keys periodically** (every 90 days recommended)  
✅ **Use test keys** for development  
✅ **Implement retry logic** with exponential backoff  
✅ **Monitor rate limits** to avoid throttling

---

## 📊 Rate Limiting

Each partner account has a rate limit (default: 100 requests/hour).

**Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

**Exceeded Response:**

```json
{
   "status": "error",
   "message": "Rate limit exceeded. You are limited to 100 requests per hour."
}
```

**HTTP Status:** `429 Too Many Requests`

---

## ❌ Error Handling

### Standard Error Response

```json
{
   "status": "error",
   "message": "Description of the error",
   "errors": {
      "field": ["Error details"]
   }
}
```

### Common Error Codes

| Status | Meaning           | Action                                  |
| ------ | ----------------- | --------------------------------------- |
| 400    | Bad Request       | Check request format and parameters     |
| 401    | Unauthorized      | Verify API key is valid and not expired |
| 403    | Forbidden         | Check permissions and account status    |
| 404    | Not Found         | Verify resource ID exists               |
| 429    | Too Many Requests | Wait and implement rate limiting        |
| 500    | Server Error      | Contact support if persists             |

---

## 📖 API Sections

### Invoices

Create and manage shipping invoices:

```
GET    /partners/invoices           # List invoices
GET    /partners/invoices/:id       # Get invoice details
POST   /partners/invoices           # Create invoice
PUT    /partners/invoices/:id       # Update invoice
GET    /partners/invoices/:id/pdf   # Generate PDF
GET    /partners/invoices/:id/label # Generate shipping label
```

### Customers

Manage customer information:

```
GET    /partners/customers          # List customers
GET    /partners/customers/:id      # Get customer
POST   /partners/customers          # Create customer
PUT    /partners/customers/:id      # Update customer
GET    /partners/customers/search   # Search customers
```

### Receivers

Manage package receivers:

```
GET    /partners/receivers          # List receivers
GET    /partners/receivers/:id      # Get receiver
POST   /partners/receivers          # Create receiver
PUT    /partners/receivers/:id      # Update receiver
```

### Services & Rates

Query available services and rates:

```
GET    /partners/services           # List services
GET    /partners/services/:id       # Get service details
GET    /partners/shipping-rates     # Get shipping rates
GET    /partners/customs-rates      # Get customs rates
```

### Products

Access product catalog:

```
GET    /partners/products           # List products
GET    /partners/products/:id       # Get product details
GET    /partners/products/search    # Search products
```

For detailed endpoint documentation, see [PARTNERS_API_DOCUMENTATION.md](./PARTNERS_API_DOCUMENTATION.md).

---

## 💻 Code Examples

### Node.js / JavaScript

```javascript
const axios = require("axios");

const client = axios.create({
   baseURL: "https://api.ctenvios.com/api/v1",
   headers: {
      Authorization: `Bearer ${process.env.CTENVIOS_API_KEY}`,
      "Content-Type": "application/json",
   },
});

// Create an invoice
async function createInvoice(data) {
   try {
      const response = await client.post("/partners/invoices", data);
      return response.data;
   } catch (error) {
      console.error("Error:", error.response?.data);
      throw error;
   }
}
```

### Python

```python
import os
import requests

class CTEnviosClient:
    def __init__(self):
        self.api_key = os.environ.get('CTENVIOS_API_KEY')
        self.base_url = 'https://api.ctenvios.com/api/v1'
        self.headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

    def create_invoice(self, data):
        response = requests.post(
            f'{self.base_url}/partners/invoices',
            json=data,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
```

### cURL

```bash
# Create invoice
curl -X POST https://api.ctenvios.com/api/v1/partners/invoices \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 123,
    "receiver_id": 456,
    "service_id": 1,
    "items": [...]
  }'
```

---

## 🔄 Webhooks (Coming Soon)

Configure webhooks to receive real-time notifications:

-  Invoice status changes
-  Delivery confirmations
-  Payment updates
-  Error notifications

---

## 🧪 Testing

### Test Environment

Use test API keys for development:

```
Authorization: Bearer ct_test_your_test_key_here
```

### Test Data

The test environment includes sample data:

-  Test customers
-  Test services
-  Test rates

**Note:** Test invoices won't generate real shipments.

---

## 📞 Support

### Documentation

-  [Partners API Reference](./PARTNERS_API_DOCUMENTATION.md)
-  [API Key Management](../api-keys/)
-  [Main Documentation](../README.md)

### Contact

-  **API Support:** api-support@ctenvios.com
-  **Technical Issues:** dev-team@ctenvios.com
-  **Account Issues:** support@ctenvios.com

### Resources

-  API Status: https://status.ctenvios.com
-  Changelog: See main documentation
-  FAQ: Coming soon

---

## 🗺️ Roadmap

-  [ ] GraphQL API
-  [ ] Real-time tracking WebSocket API
-  [ ] Batch operations
-  [ ] Advanced filtering and search
-  [ ] Webhook notifications
-  [ ] SDK libraries (Node.js, Python, PHP)

---

**Last Updated:** January 2025  
**API Version:** 1.0  
**Documentation Version:** 1.0
