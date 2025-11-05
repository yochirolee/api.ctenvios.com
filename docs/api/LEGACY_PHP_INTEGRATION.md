# Legacy PHP System Integration Guide

## Overview

This guide explains how to integrate your legacy PHP system (SolvedCargo) with the new CTEnvios Partner API to create orders programmatically.

## Prerequisites

1. **Partner Account**: You need a Partner account created in the CTEnvios system
2. **API Key**: Generate an API key for your partner account
3. **Agency ID**: Know your agency ID
4. **Service IDs**: Map your old service types to new service IDs
5. **Rate IDs**: Map your product types to shipping rate IDs

## Authentication

The Partner API uses API Key authentication. Include the key in the `X-API-Key` header:

```php
$headers = [
    'Content-Type: application/json',
    'X-API-Key: ctenv_live_your_api_key_here'
];
```

## API Endpoint

```
POST https://api.ctenvios.com/api/v1/partners/orders
```

## Data Mapping

### Old System → New System

| Old Field                                    | New Field                              | Notes |
| -------------------------------------------- | -------------------------------------- | ----- |
| `cliente` → `customer_id` or `customer`      | Use existing customer ID or create new |
| `destinatario` → `receiver_id` or `receiver` | Use existing receiver ID or create new |
| `servicio` → `service_id`                    | Must map service codes to IDs          |
| `orden_envio_emp_det` → `items[]`            | Package items with weights and rates   |

### Customer Mapping

```php
// Old structure from 'clientes' table
$customer = [
    'nombre', 'nombre2', 'apellido', 'apellido2',  // Names
    'documento',    // Identity document
    'email',        // Email
    'cel',          // Mobile
    'dir'           // Address
];

// New API structure
$customer = [
    'first_name' => $nombre,              // Required
    'middle_name' => $nombre2,            // Optional
    'last_name' => $apellido,             // Required
    'second_last_name' => $apellido2,     // Optional
    'identity_document' => $documento,     // Optional
    'email' => $email,                     // Optional
    'mobile' => $cel,                      // Required
    'address' => $dir                      // Optional
];
```

### Receiver (Destinatario) Mapping

```php
// Old structure from 'destinatarios' table
$receiver = [
    'nombre', 'nombre2', 'apellido', 'apellido2',
    'documento',  // CI (Carnet de Identidad)
    'tel', 'cel', 'email',
    'cll', 'no', 'apto', 'entre_cll',  // Address components
    'pais', 'estado', 'ciudad'          // Location IDs
];

// New API structure
$receiver = [
    'first_name' => $nombre,              // Required
    'middle_name' => $nombre2,            // Optional
    'last_name' => $apellido,             // Required
    'second_last_name' => $apellido2,     // Optional
    'ci' => $documento,                   // Required, must be 11 chars
    'email' => $email,                    // Optional
    'mobile' => $cel,                     // Optional
    'phone' => $tel,                      // Optional
    'address' => $cll . ' ' . $no . $apto . ' ' . $entre_cll, // Required
    'province_id' => $estado,             // Required (or province name)
    'city_id' => $ciudad                  // Required (or city name)
];
```

### Items Mapping

```php
// Old structure from 'orden_envio_emp_det'
$item_old = [
    'codigo_paquete',    // Package code/barcode
    'descripcion',       // Description
    'peso',              // Weight
    'cantidad_pro',      // Quantity
    'valor_aduanal',     // Customs value
    'precio',            // Price
    'tarifa'             // Rate/fee
];

// New API structure
$item = [
    'description' => $descripcion,              // Required
    'weight' => (float) $peso,                  // Required, in pounds
    'rate_id' => $rate_id,                      // Required (map from product type)
    'price_in_cents' => (int) ($precio * 100),  // Required, price in cents
    'unit' => 'PER_LB'                          // Optional, default PER_LB
];
```

## Service ID Mapping

You need to create a mapping table between your old service codes and new service IDs:

```php
// Example mapping - Update these with your actual CTEnvios service IDs
$service_mapping = [
    1 => 11,  // REGULAR → CTEnvios Service ID 11
    2 => 11,  // ENA → CTEnvios Service ID 11 (adjust if different)
    3 => 11   // MENAJE → CTEnvios Service ID 11 (adjust if different)
];
```

**Important**: To find your exact service IDs in CTEnvios, use the rates endpoint or check with your administrator.

To get available services and their IDs, use:

```
GET /api/v1/partners/rates?service_id={id}
```

## Rate ID Mapping

Map your product types to shipping rate IDs. You can fetch available rates:

```php
// Get all rates for your agency
GET /api/v1/partners/rates

// Get rates for specific service
GET /api/v1/partners/rates?service_id=1
```

Response includes rate details:

```json
{
   "status": "success",
   "count": 10,
   "data": [
      {
         "id": 1,
         "name": "Electronics",
         "price_in_cents": 500,
         "min_weight": 0,
         "max_weight": 100,
         "unit": "PER_LB"
      }
   ]
}
```

## Invoice-Based Integration (Recommended for Parcels Table)

If your system stores parcels in a table grouped by `invoiceId`, we provide a dedicated integration script that simplifies the process.

### When to Use This Approach

Use `invoice-integration.php` if:

-  Your data is stored in a `parcels` table
-  Parcels are grouped by `invoiceId`
-  Customer/receiver names are stored as full names (single field)
-  You want automatic name parsing
-  You have a fixed rate per pound

### Database Structure Example

```sql
CREATE TABLE parcels (
    id INT PRIMARY KEY,
    invoiceId VARCHAR(50),
    agencyId INT,

    -- Sender/Customer
    sender VARCHAR(255),        -- Full name
    senderMobile VARCHAR(20),
    senderEmail VARCHAR(100),

    -- Receiver
    receiver VARCHAR(255),      -- Full name
    receiverMobile VARCHAR(20),
    receiverCi VARCHAR(11),     -- CI must be 11 chars

    -- Address components
    cll VARCHAR(255),           -- Street
    entre_cll VARCHAR(255),     -- Between streets
    no VARCHAR(50),             -- Number
    reparto VARCHAR(100),       -- Neighborhood
    city VARCHAR(100),          -- City name
    province VARCHAR(100),      -- Province name

    -- Item details
    description TEXT,
    weight DECIMAL(10,2),
    parcelType INT,             -- Maps to rate_id

    -- Sync tracking
    synced_to_ctenvios BOOLEAN DEFAULT FALSE,
    ctenvios_order_id INT,
    created_at TIMESTAMP
);
```

### Configuration

In `examples/invoice-integration.php`, set these constants:

```php
define('API_KEY', 'ct_test_your_key_here');
define('AGENCY_ID', 2);
define('RATE_PER_LB_CENTS', 199); // $1.99 per pound
```

### Usage

#### Command Line

```bash
php examples/invoice-integration.php INV-12345
```

#### From Your PHP Code

```php
include 'examples/invoice-integration.php';

// After invoice is created
$result = syncInvoiceToAPI($conn, $invoiceId);

if ($result['success']) {
    // Store CTEnvios order IDs
    foreach ($result['results'] as $order) {
        if ($order['success']) {
            $orderId = $order['order_id'];
            $trackingNumbers = implode(',', $order['hbls']);

            // Update your database
            $sql = "UPDATE parcels SET
                    synced_to_ctenvios = 1,
                    ctenvios_order_id = '$orderId'
                    WHERE invoiceId = '$invoiceId'";
            $conn->query($sql);
        }
    }
}
```

### Automatic Features

The invoice integration script automatically handles:

1. **Name Parsing**: Splits full names into first_name, middle_name, last_name, second_last_name
2. **Address Building**: Combines cll, entre_cll, no, reparto into single address
3. **CI Padding**: Ensures CI is exactly 11 characters
4. **Price Calculation**: Automatically calculates `weight × RATE_PER_LB_CENTS`
5. **Grouping**: Groups parcels by customer+receiver combination
6. **Error Handling**: Returns detailed success/failure for each order

### Name Parsing Logic

The script intelligently parses full names:

```php
// 2 words: "Juan Perez"
// → first: Juan, last: Perez

// 3 words: "Juan Perez Garcia"
// → first: Juan, last: Perez, second_last: Garcia

// 4+ words: "Juan Carlos Perez Garcia"
// → first: Juan, middle: Carlos, last: Perez, second_last: Garcia
```

### Response Format

```php
[
    'success' => true,
    'invoice_id' => 'INV-12345',
    'orders_created' => 1,
    'orders_failed' => 0,
    'results' => [
        [
            'success' => true,
            'order_id' => 123,
            'customer' => 'Leidiana Torres',
            'receiver' => 'Yochiro Lee',
            'item_count' => 4,
            'hbls' => [
                'CTENV-2025-000123-001',
                'CTENV-2025-000123-002',
                'CTENV-2025-000123-003',
                'CTENV-2025-000123-004'
            ],
            'total_in_cents' => 19404
        ]
    ]
]
```

### Integration Patterns

#### Pattern 1: Real-time Sync

Sync immediately after invoice creation:

```php
if ($proceso == 'crear_factura') {
    // Create invoice in old system
    $invoiceId = createInvoice($conn, $data);

    // Sync to CTEnvios immediately
    include 'invoice-integration.php';
    $result = syncInvoiceToAPI($conn, $invoiceId);

    if ($result['success']) {
        echo json_encode([
            'status' => 'success',
            'invoice_id' => $invoiceId,
            'ctenvios_orders' => $result['results']
        ]);
    }
}
```

#### Pattern 2: Manual Sync Button

Add a "Sync to CTEnvios" button in your UI:

```php
if ($proceso == 'sync_to_ctenvios') {
    $invoiceId = $_POST['invoice_id'];

    include 'invoice-integration.php';
    $result = syncInvoiceToAPI($conn, $invoiceId);

    echo json_encode($result);
}
```

#### Pattern 3: Batch Sync

Sync multiple pending invoices:

```php
// Get unsynced invoices
$sql = "SELECT DISTINCT invoiceId
        FROM parcels
        WHERE agencyId = 2
        AND synced_to_ctenvios IS NULL
        LIMIT 50";

$invoices = $conn->query($sql);

include 'invoice-integration.php';

while ($row = $invoices->fetch_assoc()) {
    $result = syncInvoiceToAPI($conn, $row['invoiceId']);

    if ($result['success']) {
        // Mark as synced
        $conn->query("UPDATE parcels
                      SET synced_to_ctenvios = 1
                      WHERE invoiceId = '{$row['invoiceId']}'");

        echo "✓ Synced: {$row['invoiceId']}\n";
    } else {
        echo "✗ Failed: {$row['invoiceId']}\n";
    }
}
```

### Error Handling

```php
$result = syncInvoiceToAPI($conn, $invoiceId);

if (!$result['success']) {
    // Log the error
    error_log("CTEnvios sync failed for invoice $invoiceId");
    error_log(json_encode($result));

    // Check individual order failures
    foreach ($result['results'] as $order) {
        if (!$order['success']) {
            echo "Failed for {$order['receiver']}: {$order['error']}\n";

            // Handle specific errors
            if (isset($order['details']['receiver.ci'])) {
                echo "CI validation error\n";
            }
        }
    }
}
```

### Advantages Over Generic Integration

1. **Simpler**: No need to manually parse names or build addresses
2. **Automatic**: Calculates prices based on weight and fixed rate
3. **Robust**: Handles multiple customer/receiver combinations per invoice
4. **Tested**: Pre-configured for your specific database structure
5. **Traceable**: Returns detailed results for each order

## Complete PHP Integration Example (Generic)

See `examples/legacy-integration.php` for a complete working example.

## Response Format

### Success Response

```json
{
   "message": "Order created successfully",
   "data": {
      "order": {
         "id": 123,
         "customer_id": 456,
         "receiver_id": 789,
         "service_id": 1,
         "total_in_cents": 50000,
         "paid_in_cents": 0,
         "payment_status": "PENDING",
         "status": "DRAFT"
      },
      "items": [
         {
            "hbl": "CTENV-2025-000123-001",
            "description": "Electronics",
            "weight": 10.5,
            "price_in_cents": 50000
         }
      ]
   }
}
```

### Error Response

```json
{
   "status": "error",
   "message": "Validation failed",
   "errors": {
      "receiver.ci": ["CI must be 11 characters long"],
      "items": ["At least one item is required"]
   }
}
```

## Error Handling

Common errors:

| Status | Error                       | Solution                                   |
| ------ | --------------------------- | ------------------------------------------ |
| 401    | Invalid API key             | Check your API key is correct and active   |
| 400    | Validation error            | Check required fields and data formats     |
| 404    | Customer/Receiver not found | Use customer/receiver object instead of ID |
| 500    | Server error                | Contact support with request details       |

## Testing

1. **Test Mode**: Use a test API key (prefix: `ctenv_test_`)
2. **Validate Data**: Ensure all required fields are present
3. **Check Mappings**: Verify service and rate IDs are correct
4. **Monitor Logs**: Check partner logs in admin panel

## Rate Limits

Default rate limit: 1000 requests per hour per partner.

To increase limits, contact your administrator.

## Which Integration Approach Should I Use?

### Use `invoice-integration.php` if:

-  ✅ Your data is in a `parcels` table grouped by `invoiceId`
-  ✅ Names are stored as full names (single field)
-  ✅ You have a fixed rate per pound ($1.99/lb)
-  ✅ Service ID is always 1
-  ✅ Rate ID is always 1
-  ✅ You want automatic name parsing and address building

### Use `legacy-integration.php` if:

-  ✅ Your data structure matches the SolvedCargo example
-  ✅ You have multiple tables (orden_envio, clientes, destinatarios, etc.)
-  ✅ Names are split into separate fields
-  ✅ You need dynamic service/rate mapping
-  ✅ Prices are stored in database

### Start from Scratch if:

-  You have a completely different database structure
-  Follow the patterns in both scripts as examples
-  Use the Partner API documentation

## Migration Checklist

### For Invoice-Based Integration

-  [ ] Create Partner account in CTEnvios
-  [ ] Generate API key and add to `invoice-integration.php`
-  [ ] Set AGENCY_ID (2) and RATE_PER_LB_CENTS (199)
-  [ ] Test with one invoice: `php invoice-integration.php TEST-001`
-  [ ] Verify tracking numbers are returned
-  [ ] Add sync tracking to your database (optional)
-  [ ] Integrate with your invoice creation process
-  [ ] Monitor for errors
-  [ ] Go live

### For Generic Integration

-  [ ] Create Partner account in CTEnvios
-  [ ] Generate API key
-  [ ] Map service codes to service IDs
-  [ ] Map product types to rate IDs
-  [ ] Map province/city codes to IDs
-  [ ] Test with sample orders
-  [ ] Implement error handling
-  [ ] Set up logging
-  [ ] Go live

## Support

For integration support:

-  Check Partner API documentation: `/docs/api/PARTNERS_API_DOCUMENTATION.md`
-  Review partner logs in admin panel
-  Contact technical support

## Security Best Practices

1. **Never expose API keys** in client-side code
2. **Store keys securely** in environment variables
3. **Use HTTPS** for all API calls
4. **Rotate keys** periodically
5. **Monitor usage** for suspicious activity
6. **Validate input** before sending to API
