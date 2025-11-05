<?php
/**
 * CTEnvios Partner API - Invoice-Based Integration
 * 
 * This script integrates your old system's parcels/invoice data
 * with the new CTEnvios Partner API.
 * 
 * Usage:
 * php invoice-integration.php <invoiceId>
 * 
 * Or from your old system:
 * include 'invoice-integration.php';
 * $result = syncInvoiceToAPI($conn, $invoiceId);
 */

// Configuration
define('API_BASE_URL', 'https://api.ctenvios.com/api/v1/partners');
define('API_KEY', 'ct_test_XLMfw9ZoI2xVE1x7kMVtvymPSE4pC0zrGf1QmiN0S3M'); // Replace with your actual API key
define('AGENCY_ID', 2); // Your agency ID
define('RATE_PER_LB_CENTS', 199); // $1.99 per pound = 199 cents

// Database connection (configure as needed)
// $conn = mysqli_connect("localhost", "user", "password", "database");

/**
 * Parse full name into components
 * Examples:
 *   "Juan Perez" -> first: Juan, last: Perez
 *   "Juan Perez Garcia" -> first: Juan, last: Perez, second_last: Garcia
 *   "Juan Carlos Perez Garcia" -> first: Juan, middle: Carlos, last: Perez, second_last: Garcia
 */
function parseFullName($fullName) {
    $fullName = trim($fullName);
    $parts = preg_split('/\s+/', $fullName);
    $count = count($parts);
    
    if ($count === 0) {
        return [
            'first_name' => '',
            'middle_name' => '',
            'last_name' => '',
            'second_last_name' => ''
        ];
    }
    
    if ($count === 1) {
        return [
            'first_name' => $parts[0],
            'middle_name' => '',
            'last_name' => $parts[0], // Use same as first if only one name
            'second_last_name' => ''
        ];
    }
    
    if ($count === 2) {
        return [
            'first_name' => $parts[0],
            'middle_name' => '',
            'last_name' => $parts[1],
            'second_last_name' => ''
        ];
    }
    
    if ($count === 3) {
        return [
            'first_name' => $parts[0],
            'middle_name' => '',
            'last_name' => $parts[1],
            'second_last_name' => $parts[2]
        ];
    }
    
    // 4 or more words
    return [
        'first_name' => $parts[0],
        'middle_name' => $parts[1],
        'last_name' => $parts[2],
        'second_last_name' => $parts[3]
    ];
}

/**
 * Build address from components
 */
function buildAddress($cll, $entre_cll, $no, $reparto) {
    $parts = [];
    
    if (!empty($cll)) {
        $parts[] = $cll;
    }
    
    if (!empty($no)) {
        $parts[] = '#' . $no;
    }
    
    if (!empty($entre_cll)) {
        $parts[] = 'entre ' . $entre_cll;
    }
    
    if (!empty($reparto)) {
        $parts[] = $reparto;
    }
    
    return implode(' ', $parts);
}

/**
 * Make API request to CTEnvios
 */
function makeApiRequest($endpoint, $data) {
    $url = API_BASE_URL . $endpoint;
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'X-API-Key: ' . API_KEY,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    return [
        'success' => $http_code >= 200 && $http_code < 300,
        'http_code' => $http_code,
        'data' => json_decode($response, true),
        'error' => $error,
        'raw' => $response
    ];
}

/**
 * Sync invoice to CTEnvios API
 * Main integration function
 */
function syncInvoiceToAPI($conn, $invoiceId) {
    // ========================================
    // 1. FETCH ALL PARCELS FOR THIS INVOICE
    // ========================================
    $sql = "SELECT description, sender, senderMobile, senderEmail, 
                   receiver, receiverMobile, cll, entre_cll, no, reparto,
                   receiverCi, city, province, parcelType, weight, invoiceId
            FROM parcels 
            WHERE agencyId = " . AGENCY_ID . " 
            AND invoiceId = '" . mysqli_real_escape_string($conn, $invoiceId) . "'
            ORDER BY id";
    
    $result = $conn->query($sql);
    
    if (!$result) {
        return [
            'success' => false,
            'error' => 'Database query failed: ' . $conn->error
        ];
    }
    
    if ($result->num_rows === 0) {
        return [
            'success' => false,
            'error' => 'No parcels found for invoice: ' . $invoiceId
        ];
    }
    
    // ========================================
    // 2. GROUP PARCELS BY CUSTOMER+RECEIVER
    // ========================================
    // In case one invoice has multiple customer/receiver combinations
    $orders = [];
    
    while ($row = $result->fetch_assoc()) {
        // Create unique key for customer+receiver combination
        $key = $row['sender'] . '|' . $row['receiver'] . '|' . $row['receiverCi'];
        
        if (!isset($orders[$key])) {
            // Parse customer name
            $senderParsed = parseFullName($row['sender']);
            
            // Parse receiver name
            $receiverParsed = parseFullName($row['receiver']);
            
            // Build address
            $address = buildAddress(
                $row['cll'],
                $row['entre_cll'],
                $row['no'],
                $row['reparto']
            );
            
            // Ensure CI is 11 characters
            $ci = str_pad($row['receiverCi'], 11, '0', STR_PAD_LEFT);
            
            // Initialize order structure
            $orders[$key] = [
                'customer' => [
                    'first_name' => $senderParsed['first_name'],
                    'middle_name' => $senderParsed['middle_name'],
                    'last_name' => $senderParsed['last_name'],
                    'second_last_name' => $senderParsed['second_last_name'],
                    'mobile' => $row['senderMobile'],
                    'email' => $row['senderEmail'] ?? ''
                ],
                'receiver' => [
                    'first_name' => $receiverParsed['first_name'],
                    'middle_name' => $receiverParsed['middle_name'],
                    'last_name' => $receiverParsed['last_name'],
                    'second_last_name' => $receiverParsed['second_last_name'],
                    'ci' => $ci,
                    'mobile' => $row['receiverMobile'] ?? '',
                    'address' => $address,
                    'province' => $row['province'],
                    'city' => $row['city']
                ],
                'service_id' => 1,
                'items' => []
            ];
            
            // Remove empty optional fields from customer
            $orders[$key]['customer'] = array_filter($orders[$key]['customer'], function($value) {
                return $value !== '' && $value !== null;
            });
            
            // Remove empty optional fields from receiver (but keep required ones)
            $orders[$key]['receiver'] = array_filter($orders[$key]['receiver'], function($value, $key) {
                $required = ['first_name', 'last_name', 'ci', 'address', 'province', 'city'];
                if (in_array($key, $required)) return true;
                return $value !== '' && $value !== null;
            }, ARRAY_FILTER_USE_BOTH);
        }
        
        // ========================================
        // 3. ADD ITEM TO ORDER
        // ========================================
        $weight = (float) $row['weight'];
        $priceInCents = (int) round($weight * RATE_PER_LB_CENTS);
        
        $orders[$key]['items'][] = [
            'description' => $row['description'],
            'weight' => $weight,
            'rate_id' => 1, // All parcelType 1-9 use rate_id 1
            'price_in_cents' => $priceInCents,
            'unit' => 'PER_LB'
        ];
    }
    
    // ========================================
    // 4. SEND EACH ORDER TO API
    // ========================================
    $results = [];
    $allSuccess = true;
    
    foreach ($orders as $key => $orderData) {
        $apiResult = makeApiRequest('/orders', $orderData);
        
        if ($apiResult['success']) {
            $orderInfo = $apiResult['data']['data']['order'] ?? [];
            $items = $apiResult['data']['data']['items'] ?? [];
            
            $results[] = [
                'success' => true,
                'order_id' => $orderInfo['id'] ?? null,
                'customer' => $orderData['customer']['first_name'] . ' ' . $orderData['customer']['last_name'],
                'receiver' => $orderData['receiver']['first_name'] . ' ' . $orderData['receiver']['last_name'],
                'item_count' => count($items),
                'hbls' => array_column($items, 'hbl'),
                'total_in_cents' => $orderInfo['total_in_cents'] ?? 0
            ];
        } else {
            $allSuccess = false;
            $results[] = [
                'success' => false,
                'customer' => $orderData['customer']['first_name'] . ' ' . $orderData['customer']['last_name'],
                'receiver' => $orderData['receiver']['first_name'] . ' ' . $orderData['receiver']['last_name'],
                'error' => $apiResult['data']['message'] ?? 'Unknown error',
                'details' => $apiResult['data']['errors'] ?? null,
                'http_code' => $apiResult['http_code']
            ];
        }
    }
    
    return [
        'success' => $allSuccess,
        'invoice_id' => $invoiceId,
        'orders_created' => count(array_filter($results, fn($r) => $r['success'])),
        'orders_failed' => count(array_filter($results, fn($r) => !$r['success'])),
        'results' => $results
    ];
}

/**
 * Display result in a nice format
 */
function displayResult($result) {
    echo "\n";
    echo "╔═══════════════════════════════════════════════════════════╗\n";
    echo "║          CTEnvios Invoice Sync Result                     ║\n";
    echo "╚═══════════════════════════════════════════════════════════╝\n\n";
    
    if ($result['success']) {
        echo "✓ Invoice synced successfully!\n\n";
    } else {
        echo "✗ Some orders failed to sync\n\n";
    }
    
    echo "Invoice ID: {$result['invoice_id']}\n";
    echo "Orders Created: {$result['orders_created']}\n";
    echo "Orders Failed: {$result['orders_failed']}\n\n";
    
    foreach ($result['results'] as $i => $order) {
        echo "Order " . ($i + 1) . ":\n";
        echo "  Customer: {$order['customer']}\n";
        echo "  Receiver: {$order['receiver']}\n";
        
        if ($order['success']) {
            echo "  Status: ✓ Success\n";
            echo "  Order ID: {$order['order_id']}\n";
            echo "  Items: {$order['item_count']}\n";
            echo "  Total: $" . number_format($order['total_in_cents'] / 100, 2) . "\n";
            echo "  Tracking Numbers:\n";
            foreach ($order['hbls'] as $hbl) {
                echo "    - $hbl\n";
            }
        } else {
            echo "  Status: ✗ Failed\n";
            echo "  Error: {$order['error']}\n";
            if (isset($order['details'])) {
                echo "  Details:\n";
                foreach ($order['details'] as $field => $errors) {
                    foreach ($errors as $error) {
                        echo "    - $field: $error\n";
                    }
                }
            }
        }
        echo "\n";
    }
}

// ========================================
// COMMAND LINE USAGE
// ========================================
if (php_sapi_name() === 'cli') {
    echo "\nCTEnvios Invoice Integration\n";
    echo "============================\n\n";
    
    if ($argc < 2) {
        echo "Usage: php invoice-integration.php <invoiceId>\n";
        echo "Example: php invoice-integration.php INV-12345\n\n";
        exit(1);
    }
    
    $invoiceId = $argv[1];
    
    // Example database connection - update with your credentials
    // $conn = mysqli_connect("localhost", "user", "password", "database");
    // if (!$conn) {
    //     echo "Error: Could not connect to database\n";
    //     exit(1);
    // }
    
    // $result = syncInvoiceToAPI($conn, $invoiceId);
    // displayResult($result);
    
    // mysqli_close($conn);
    
    echo "Please configure your database connection in this script.\n";
    echo "Uncomment the database connection lines above.\n\n";
}

// ========================================
// INTEGRATION WITH YOUR OLD SYSTEM
// ========================================
/**
 * Example integration in your existing PHP code:
 * 
 * // After invoice is created
 * if ($proceso == 'crear_factura') {
 *     // ... your existing code to create invoice ...
 *     
 *     // Sync to CTEnvios
 *     include 'invoice-integration.php';
 *     $result = syncInvoiceToAPI($conn, $invoiceId);
 *     
 *     if ($result['success']) {
 *         // Store CTEnvios order IDs in your database
 *         foreach ($result['results'] as $order) {
 *             if ($order['success']) {
 *                 $ctenvios_order_id = $order['order_id'];
 *                 $tracking_numbers = implode(',', $order['hbls']);
 *                 
 *                 // Update your database
 *                 $sql = "UPDATE invoices SET 
 *                         ctenvios_order_id = '$ctenvios_order_id',
 *                         tracking_numbers = '$tracking_numbers',
 *                         synced_at = NOW()
 *                         WHERE id = '$invoiceId'";
 *                 $conn->query($sql);
 *             }
 *         }
 *         
 *         echo json_encode([
 *             'status' => 'success',
 *             'message' => 'Invoice synced to CTEnvios',
 *             'data' => $result
 *         ]);
 *     } else {
 *         echo json_encode([
 *             'status' => 'error',
 *             'message' => 'Failed to sync invoice',
 *             'data' => $result
 *         ]);
 *     }
 * }
 */

