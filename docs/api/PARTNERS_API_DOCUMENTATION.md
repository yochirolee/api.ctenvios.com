# Partners API - Sistema de Integración Externa

## Descripción General

El sistema de **Partners** permite que otras agencias integren su propia interfaz con la API de CTEnvios. Los partners pueden gestionar sus propios clientes y crear envíos a través de nuestra plataforma mientras mantienen su propio sistema de control.

## Características Principales

-  ✅ Autenticación mediante API Key
-  ✅ Creación de invoices/envíos vía API
-  ✅ Tracking de paquetes
-  ✅ Rate limiting configurable
-  ✅ Logging de requests
-  ✅ Estadísticas de uso
-  ✅ Webhooks (opcional)

## Modelos de Base de Datos

### Partner

```typescript
{
  id: number
  name: string
  email: string
  contact_name: string
  phone: string
  is_active: boolean
  api_key: string (UUID generado automáticamente)
  webhook_url?: string
  agency_id: number
  forwarder_id: number
  rate_limit: number (requests por hora, default: 1000)
  created_at: DateTime
  updated_at: DateTime
}
```

### PartnerLog

```typescript
{
  id: number
  partner_id: number
  endpoint: string
  method: string
  status_code: number
  request_body?: JSON
  response_body?: JSON
  ip_address?: string
  user_agent?: string
  created_at: DateTime
}
```

## Endpoints Administrativos

Estos endpoints requieren autenticación estándar (Bearer token de usuario).

### 1. Listar Partners

```http
GET /api/v1/partners
Authorization: Bearer {USER_TOKEN}
```

**Respuesta:**

```json
[
   {
      "id": 1,
      "name": "Partner Agency",
      "email": "contact@partner.com",
      "contact_name": "John Doe",
      "phone": "+1234567890",
      "is_active": true,
      "rate_limit": 1000,
      "agency_id": 5,
      "agency": {
         "id": 5,
         "name": "Agency Name"
      },
      "forwarder": {
         "id": 1,
         "name": "Forwarder Name"
      },
      "_count": {
         "invoices": 150,
         "partner_logs": 2500
      }
   }
]
```

### 2. Obtener Partner por ID

```http
GET /api/v1/partners/:id
Authorization: Bearer {USER_TOKEN}
```

### 3. Crear Partner

```http
POST /api/v1/partners
Authorization: Bearer {USER_TOKEN}
Content-Type: application/json

{
  "name": "Partner Agency",
  "email": "contact@partner.com",
  "contact_name": "John Doe",
  "phone": "+1234567890",
  "agency_id": 5,
  "webhook_url": "https://partner.com/webhook",
  "rate_limit": 1000
}
```

**Respuesta:**

```json
{
   "message": "Partner created successfully",
   "partner": {
      "id": 1,
      "name": "Partner Agency",
      "email": "contact@partner.com",
      "api_key": "550e8400-e29b-41d4-a716-446655440000"
   }
}
```

⚠️ **Importante**: El `api_key` solo se muestra en la creación. Guárdalo de forma segura.

### 4. Actualizar Partner

```http
PUT /api/v1/partners/:id
Authorization: Bearer {USER_TOKEN}
Content-Type: application/json

{
  "name": "Updated Name",
  "is_active": true,
  "rate_limit": 2000
}
```

### 5. Eliminar Partner

```http
DELETE /api/v1/partners/:id
Authorization: Bearer {USER_TOKEN}
```

### 6. Regenerar API Key

```http
POST /api/v1/partners/:id/regenerate-key
Authorization: Bearer {USER_TOKEN}
```

**Respuesta:**

```json
{
   "message": "API key regenerated successfully",
   "api_key": "new-uuid-api-key"
}
```

### 7. Obtener Logs

```http
GET /api/v1/partners/:id/logs?limit=100&offset=0
Authorization: Bearer {USER_TOKEN}
```

### 8. Obtener Estadísticas

```http
GET /api/v1/partners/:id/stats
Authorization: Bearer {USER_TOKEN}
```

**Respuesta:**

```json
{
   "requests_last_hour": 45,
   "requests_last_day": 856,
   "total_invoices": 150,
   "total_requests": 2500
}
```

## Endpoints de API para Partners

Estos endpoints utilizan autenticación con API Key.

### Autenticación

Incluye el API Key en el header `Authorization`:

```http
Authorization: Bearer {API_KEY}
```

o directamente:

```http
Authorization: {API_KEY}
```

### 1. Crear Invoice

```http
POST /api/v1/partners/api/invoices
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "customer_id": 123,
  "receiver_id": 456,
  "service_id": 1,
  "items": [
    {
      "description": "Electronics",
      "rate_id": 10,
      "weight": 5.5,
      "rate_in_cents": 1500,
      "customs_fee_in_cents": 200,
      "insurance_fee_in_cents": 100,
      "charge_fee_in_cents": 50,
      "rate_type": "WEIGHT"
    }
  ]
}
```

**Respuesta exitosa:**

```json
{
   "status": "success",
   "message": "Invoice created successfully",
   "data": {
      "invoice_id": 789,
      "tracking_numbers": ["CTE2510080110001"],
      "total_in_cents": 10100,
      "status": "CREATED",
      "payment_status": "PENDING",
      "created_at": "2025-10-08T10:30:00Z",
      "customer": {
         "first_name": "John",
         "last_name": "Doe",
         "mobile": "1234567890",
         "email": "john@example.com"
      },
      "receiver": {
         "first_name": "Jane",
         "last_name": "Smith",
         "mobile": "0987654321",
         "province": { "name": "Havana" },
         "city": { "name": "Habana Vieja" }
      },
      "service": {
         "name": "Marítimo Estándar",
         "service_type": "MARITIME"
      }
   }
}
```

**Errores comunes:**

```json
// 401 - API Key inválida
{
  "status": "error",
  "message": "Invalid API key or partner not found"
}

// 403 - Partner inactivo
{
  "status": "error",
  "message": "Partner account is inactive. Please contact support."
}

// 429 - Rate limit excedido
{
  "status": "error",
  "message": "Rate limit exceeded. You are limited to 1000 requests per hour."
}

// 400 - Validación fallida
{
  "status": "error",
  "message": "Invalid invoice data",
  "errors": [...]
}
```

### 2. Obtener Invoice

```http
GET /api/v1/partners/api/invoices/:id
Authorization: Bearer {API_KEY}
```

**Respuesta:**

```json
{
  "status": "success",
  "data": {
    "id": 789,
    "total_in_cents": 10100,
    "status": "CREATED",
    "payment_status": "PENDING",
    "customer": {...},
    "receiver": {...},
    "service": {...},
    "items": [...]
  }
}
```

### 3. Tracking de Paquete

```http
GET /api/v1/partners/api/tracking/{HBL}
Authorization: Bearer {API_KEY}
```

**Ejemplo:**

```http
GET /api/v1/partners/api/tracking/CTE2510080110001
Authorization: Bearer {API_KEY}
```

**Respuesta:**

```json
{
   "status": "success",
   "data": {
      "hbl": "CTE2510080110001",
      "description": "Electronics",
      "weight": 5.5,
      "status": "IN_TRANSIT",
      "created_at": "2025-10-08T10:30:00Z",
      "updated_at": "2025-10-09T14:20:00Z",
      "invoice": {
         "id": 789,
         "status": "IN_TRANSIT",
         "payment_status": "PAID",
         "created_at": "2025-10-08T10:30:00Z",
         "receiver": {
            "first_name": "Jane",
            "last_name": "Smith",
            "city": { "name": "Habana Vieja" },
            "province": { "name": "Havana" }
         }
      }
   }
}
```

## Rate Limiting

Cada partner tiene un límite de requests por hora configurable (default: 1000).

-  El rate limit se verifica por partner
-  Se cuenta por hora deslizante (últimos 60 minutos)
-  Al exceder el límite, se retorna HTTP 429

## Logging

Todos los requests de partners se registran automáticamente:

-  Endpoint y método
-  Status code
-  Request/Response body (opcional)
-  IP y User Agent
-  Timestamp

Los logs son útiles para:

-  Debugging
-  Auditoría
-  Análisis de uso
-  Detección de problemas

## Seguridad

### Mejores Prácticas

1. **Protege tu API Key**: Nunca la compartas ni la incluyas en repositorios
2. **Usa HTTPS**: Todas las comunicaciones deben ser sobre HTTPS
3. **Regenera keys**: Si sospechas que tu key fue comprometida, regénérala inmediatamente
4. **Monitorea uso**: Revisa regularmente los logs y estadísticas
5. **Rate limiting**: Respeta los límites establecidos

### Permisos

Los partners solo pueden:

-  Crear invoices para su propia agencia
-  Acceder a customers y receivers de su agencia
-  Ver invoices creados por ellos
-  Hacer tracking de sus propios paquetes

## Webhooks (Próximamente)

Los partners podrán configurar un `webhook_url` para recibir notificaciones automáticas sobre:

-  Cambios de estado en invoices
-  Actualizaciones de tracking
-  Confirmaciones de pago
-  Entregas completadas

## Ejemplos de Integración

### Node.js / TypeScript

```typescript
import axios from "axios";

const API_BASE_URL = "https://api.ctenvios.com/api/v1";
const API_KEY = "your-api-key";

const client = axios.create({
   baseURL: API_BASE_URL,
   headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
   },
});

// Crear invoice
async function createInvoice(data: any) {
   try {
      const response = await client.post("/partners/api/invoices", data);
      return response.data;
   } catch (error) {
      console.error("Error creating invoice:", error.response?.data);
      throw error;
   }
}

// Tracking
async function trackPackage(hbl: string) {
   try {
      const response = await client.get(`/partners/api/tracking/${hbl}`);
      return response.data;
   } catch (error) {
      console.error("Error tracking package:", error.response?.data);
      throw error;
   }
}
```

### Python

```python
import requests

API_BASE_URL = 'https://api.ctenvios.com/api/v1'
API_KEY = 'your-api-key'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# Crear invoice
def create_invoice(data):
    response = requests.post(
        f'{API_BASE_URL}/partners/api/invoices',
        json=data,
        headers=headers
    )
    return response.json()

# Tracking
def track_package(hbl):
    response = requests.get(
        f'{API_BASE_URL}/partners/api/tracking/{hbl}',
        headers=headers
    )
    return response.json()
```

### cURL

```bash
# Crear invoice
curl -X POST https://api.ctenvios.com/api/v1/partners/api/invoices \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 123,
    "receiver_id": 456,
    "service_id": 1,
    "items": [...]
  }'

# Tracking
curl https://api.ctenvios.com/api/v1/partners/api/tracking/CTE2510080110001 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Soporte

Para preguntas o problemas:

-  Email: soporte@ctenvios.com
-  Documentación: https://docs.ctenvios.com
-  Dashboard: https://app.ctenvios.com

## Changelog

### v1.0.0 (2025-10-08)

-  ✨ Sistema de Partners inicial
-  ✨ Autenticación con API Key
-  ✨ CRUD de partners
-  ✨ Creación de invoices vía API
-  ✨ Tracking de paquetes
-  ✨ Rate limiting
-  ✨ Logging automático
-  ✨ Estadísticas de uso
