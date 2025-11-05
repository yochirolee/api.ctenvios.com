# Quick Start Guide - Legacy to CTEnvios API Migration

## Key Changes Summary

### 1. **Service ID**

-  **Old System**: Service code `1` (REGULAR)
-  **CTEnvios API**: Service ID `11`

### 2. **Required Fields Per Item**

#### ❌ Your Original Postman Example (Missing field)

```json
{
   "description": "Comida Aseo Medicina",
   "weight": 30.3,
   "rate_id": 1
}
```

#### ✅ Correct Format (With price_in_cents)

```json
{
   "description": "Comida Aseo Medicina",
   "weight": 30.3,
   "rate_id": 1,
   "price_in_cents": 15150,
   "unit": "PER_LB"
}
```

### 3. **Province/City Fields**

You can use **either** IDs **or** names (not both):

#### Option A: Using IDs

```json
{
   "province_id": 1,
   "city_id": 1
}
```

#### Option B: Using Names (Like your Postman example)

```json
{
   "province": "La Habana",
   "city": "Playa"
}
```

## Complete Working Example

```json
{
   "customer": {
      "first_name": "Leidiana",
      "last_name": "Torres",
      "second_last_name": "Roca",
      "mobile": "7864500006"
   },
   "receiver": {
      "first_name": "Yochiro",
      "last_name": "Lee",
      "second_last_name": "Cruz",
      "ci": "84011112446",
      "mobile": "52678538",
      "address": "Avenida 31 entre 30 y 34 no 3008",
      "province": "La Habana",
      "city": "Playa"
   },
   "service_id": 11,
   "items": [
      {
         "description": "Comida Aseo Medicina",
         "weight": 30.3,
         "rate_id": 1,
         "price_in_cents": 15150,
         "unit": "PER_LB"
      },
      {
         "description": "Alimentos/Aseo-Food/Care",
         "weight": 23.22,
         "rate_id": 1,
         "price_in_cents": 11610,
         "unit": "PER_LB"
      }
   ]
}
```

## How to Calculate price_in_cents

### Method 1: From Your Database Price

If you have `precio` field in your database:

```php
$price_in_cents = (int) round($precio * 100);
```

### Method 2: Calculate from Rate × Weight

```php
// Example: Rate is $5.00 per pound (500 cents)
// Weight is 30.30 lbs
$price_in_cents = 500 * 30.30 = 15150 cents = $151.50
```

### Method 3: Use the Helper Function

The `calculatePriceInCents()` function in `legacy-integration.php` does this automatically:

```php
$price_in_cents = calculatePriceInCents($rate_id, $weight, $rates_cache);
```

## Testing Your Integration

### Step 1: Test API Key

```bash
php examples/test-partner-api.php
```

### Step 2: Get Your Rate IDs

```bash
curl -H "Authorization: Bearer your_key_here" \
  "https://api.ctenvios.com/api/v1/partners/rates?service_id=1"
```

### Step 3: Test with Postman

1. Set method to `POST`
2. URL: `https://api.ctenvios.com/api/v1/partners/orders`
3. Headers:
   -  `Content-Type: application/json`
   -  `Authorization: Bearer your_key_here`
4. Body: Use the corrected JSON from above

### Step 4: Integrate with Your PHP System

```php
// In your existing code, replace the SolvedCargo API call:
elseif ($proceso == 'enviar_factura_api_ctenvios') {
    $codigo = $_POST['codigo'] ?? $_GET['codigo'];
    $result = createOrderInCTEnvios($conn, $codigo);

    if ($result['success']) {
        echo json_encode([
            'status' => 'success',
            'order_id' => $result['order_id'],
            'tracking' => $result['hbls']
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => $result['error']
        ]);
    }
}
```

## Common Errors and Solutions

### ❌ Error: "price_in_cents is required"

**Solution**: Add `price_in_cents` to each item:

```json
{
   "description": "Product",
   "weight": 10.0,
   "rate_id": 1,
   "price_in_cents": 5000 // ← Add this
}
```

### ❌ Error: "CI must be 11 characters long"

**Solution**: Pad with zeros:

```php
$ci = str_pad($documento, 11, '0', STR_PAD_LEFT);
```

### ❌ Error: "Invalid API key"

**Solution**:

1. Check your API key is correct
2. Make sure it's not expired
3. Verify it's active in the admin panel

### ❌ Error: "Service not found"

**Solution**: Use service ID `11` (not `1`)

## Configuration Checklist

-  [ ] API Key obtained and set in script
-  [ ] Service ID mapped to `11`
-  [ ] Rate IDs fetched and mapped
-  [ ] `price_in_cents` calculation implemented
-  [ ] Province/City mapping configured
-  [ ] Test order created successfully
-  [ ] Error handling implemented

## Need Help?

1. **Check logs**: Partner logs available in admin panel
2. **Documentation**: See `docs/api/LEGACY_PHP_INTEGRATION.md`
3. **Test script**: Run `php examples/test-partner-api.php`
4. **Example files**:
   -  `examples/legacy-integration.php` - Full integration
   -  `examples/postman-example-corrected.json` - Working JSON
   -  `examples/legacy-migration-schema.sql` - Database mappings

## Rate Calculation Examples

| Weight | Rate ($/lb) | Calculation | price_in_cents |
| ------ | ----------- | ----------- | -------------- |
| 30.30  | $5.00       | 30.30 × 500 | 15150          |
| 23.22  | $5.00       | 23.22 × 500 | 11610          |
| 21.22  | $5.00       | 21.22 × 500 | 10610          |
| 10.00  | $3.50       | 10.00 × 350 | 3500           |

**Note**: Rate price is in cents, so $5.00/lb = 500 cents/lb

## Invoice-Based Integration (Recommended for Parcels Table)

If your system stores parcels in a table grouped by `invoiceId`, use the dedicated invoice integration script.

### Your Database Structure

```sql
SELECT description, sender, senderMobile, senderEmail, receiver, receiverMobile,
       cll, entre_cll, no, reparto, receiverCi, city, province,
       parcelType, weight, invoiceId
FROM parcels
WHERE agencyId=2 AND invoiceId=?
```

### Configuration for Your System

-  **Service ID**: 1 (fixed for all orders)
-  **Rate ID**: 1 (all parcelType 1-9 use rate_id 1)
-  **Unit**: PER_LB (for all items)
-  **Price**: $1.99/lb (199 cents) - automatically calculated as `weight × 199`

### Quick Setup

1. **Configure the script**:

```php
// In examples/invoice-integration.php
define('API_KEY', 'ct_test_your_key_here');
define('AGENCY_ID', 2);
define('RATE_PER_LB_CENTS', 199); // $1.99 per pound
```

2. **Test from command line**:

```bash
php examples/invoice-integration.php INV-12345
```

3. **Integrate with your system**:

```php
// After invoice is created in your old system
include 'invoice-integration.php';
$result = syncInvoiceToAPI($conn, $invoiceId);

if ($result['success']) {
    // All orders synced successfully
    foreach ($result['results'] as $order) {
        echo "Order {$order['order_id']} created with tracking: ";
        echo implode(', ', $order['hbls']);
    }
} else {
    // Some orders failed
    echo "Sync failed: " . json_encode($result);
}
```

### What the Script Does Automatically

1. ✅ Fetches all parcels for the invoice
2. ✅ Parses full names into first/middle/last/second_last
3. ✅ Groups parcels by customer+receiver combination
4. ✅ Builds complete address from cll, entre_cll, no, reparto
5. ✅ Calculates price as `weight × 199 cents`
6. ✅ Ensures CI is 11 characters (pads with zeros)
7. ✅ Creates orders via Partner API
8. ✅ Returns tracking numbers (HBLs) for each item

### Name Parsing Examples

The script automatically handles various name formats:

| Full Name Input            | Parsed Result                                                 |
| -------------------------- | ------------------------------------------------------------- |
| "Juan Perez"               | first: Juan, last: Perez                                      |
| "Juan Perez Garcia"        | first: Juan, last: Perez, second_last: Garcia                 |
| "Juan Carlos Perez"        | first: Juan, middle: Carlos, last: Perez                      |
| "Juan Carlos Perez Garcia" | first: Juan, middle: Carlos, last: Perez, second_last: Garcia |

### Price Calculation Examples

For your rate of $1.99/lb (199 cents):

| Weight | Calculation | price_in_cents | Total  |
| ------ | ----------- | -------------- | ------ |
| 10.00  | 10.00 × 199 | 1990           | $19.90 |
| 25.50  | 25.50 × 199 | 5075           | $50.75 |
| 30.30  | 30.30 × 199 | 6030           | $60.30 |
| 50.00  | 50.00 × 199 | 9950           | $99.50 |

### Success Response Example

```json
{
   "success": true,
   "invoice_id": "INV-12345",
   "orders_created": 1,
   "orders_failed": 0,
   "results": [
      {
         "success": true,
         "order_id": 123,
         "customer": "Leidiana Torres",
         "receiver": "Yochiro Lee",
         "item_count": 4,
         "hbls": ["CTENV-2025-000123-001", "CTENV-2025-000123-002", "CTENV-2025-000123-003", "CTENV-2025-000123-004"],
         "total_in_cents": 19404
      }
   ]
}
```

### Integration Points

**Option 1: Real-time sync after invoice creation**

```php
if ($proceso == 'crear_factura') {
    // Your existing invoice creation code
    // ...

    // Sync immediately to CTEnvios
    include 'invoice-integration.php';
    $result = syncInvoiceToAPI($conn, $invoiceId);
}
```

**Option 2: Manual sync button**

```php
if ($proceso == 'sync_to_ctenvios') {
    $invoiceId = $_POST['invoice_id'];
    include 'invoice-integration.php';
    $result = syncInvoiceToAPI($conn, $invoiceId);
    echo json_encode($result);
}
```

**Option 3: Batch sync pending invoices**

```php
// Get all unsynced invoices
$sql = "SELECT DISTINCT invoiceId FROM parcels
        WHERE agencyId=2 AND synced_to_ctenvios IS NULL";
$result = $conn->query($sql);

while ($row = $result->fetch_assoc()) {
    $syncResult = syncInvoiceToAPI($conn, $row['invoiceId']);
    if ($syncResult['success']) {
        // Mark as synced
        $conn->query("UPDATE parcels SET synced_to_ctenvios=1
                      WHERE invoiceId='{$row['invoiceId']}'");
    }
}
```

## Next Steps

1. ✅ Update service mapping to use ID `11`
2. ✅ Add `price_in_cents` calculation to your integration
3. ⏳ Test with sample orders from your database
4. ⏳ Deploy to production
5. ⏳ Monitor partner logs for any issues
