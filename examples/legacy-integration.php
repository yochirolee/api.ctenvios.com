<?php
/**
 * CTEnvios Partner API - Legacy System Integration
 * 
 * This script demonstrates how to migrate from your old PHP system
 * (SolvedCargo) to the new CTEnvios Partner API.
 * 
 * Usage:
 * php legacy-integration.php
 */

// Configuration
define('API_BASE_URL', 'https://api.ctenvios.com/api/v1/partners');
define('API_KEY', 'ct_test_XLMfw9ZoI2xVE1x7kMVtvymPSE4pC0zrGf1QmiN0S3M'); // Replace with your actual API key

// Database connection (your existing connection)
// $conn = mysqli_connect(...);

/**
 * Service mapping: Old service codes → New service IDs
 * IMPORTANT: Update these mappings based on your actual CTEnvios service IDs
 */
$SERVICE_MAPPING = [
    1 => 11,  // REGULAR → CTEnvios Service ID 11
    2 => 11,  // ENA → CTEnvios Service ID 11 (adjust if different)
    3 => 11   // MENAJE → CTEnvios Service ID 11 (adjust if different)
];

/**
 * Get available rates from CTEnvios API
 * Cache this for performance
 */
function getRatesFromAPI($service_id = null) {
    $url = API_BASE_URL . '/rates';
    if ($service_id) {
        $url .= '?service_id=' . $service_id;
    }
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . API_KEY,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code === 200) {
        $data = json_decode($response, true);
        return $data['data'] ?? [];
    }
    
    return [];
}

/**
 * Calculate price in cents based on rate and weight
 */
function calculatePriceInCents($rate_id, $weight, $rates_cache) {
    // Find the rate
    foreach ($rates_cache as $rate) {
        if ($rate['id'] == $rate_id) {
            // Calculate based on unit type
            if ($rate['unit'] === 'PER_LB') {
                // Price per pound
                return (int) round($rate['price_in_cents'] * $weight);
            } elseif ($rate['unit'] === 'FIXED') {
                // Flat rate
                return (int) $rate['price_in_cents'];
            } else {
                // Default to per pound
                return (int) round($rate['price_in_cents'] * $weight);
            }
        }
    }
    
    // If rate not found, use a default calculation
    // You should adjust this default based on your business logic
    return (int) round(500 * $weight); // Default: $5 per pound
}

/**
 * Find appropriate rate ID based on product description or type
 * You should create a mapping table in your database
 */
function findRateId($product_description, $service_id, $rates_cache) {
    // Simple example: match by description keywords
    $description_lower = strtolower($product_description);
    
    foreach ($rates_cache as $rate) {
        $rate_name_lower = strtolower($rate['name']);
        if (strpos($description_lower, $rate_name_lower) !== false) {
            return $rate['id'];
        }
    }
    
    // Default to first rate if no match found
    return $rates_cache[0]['id'] ?? 1;
}

/**
 * Format names properly for API
 */
function formatName($name) {
    return trim(utf8_encode($name));
}

/**
 * Create order in CTEnvios via Partner API
 * This replaces your 'enviar_factura_api_solvedcargo' process
 */
function createOrderInCTEnvios($conn, $codigo) {
    global $SERVICE_MAPPING;
    
    // ========================================
    // 1. FETCH ORDER DATA
    // ========================================
    $sql = "SELECT servicio, agencia, cod_factura, fecha, cliente, destinatario, 
                   tipo_orden, subtotal, seguro, cargo_extra, descuento, 
                   tarjeta_credito, total, pagado, saldo, usuario 
            FROM orden_envio 
            WHERE cod_envio='$codigo'";
    
    $res = $conn->query($sql);
    if (!$res || $res->num_rows === 0) {
        return ['success' => false, 'error' => 'Order not found'];
    }
    
    $order = $res->fetch_array(MYSQLI_ASSOC);
    
    $cliente_id = $order['cliente'];
    $destinatario_id = $order['destinatario'];
    $servicio_old = $order['servicio'];
    
    // Map service ID
    $service_id = 1;
    
    // ========================================
    // 2. FETCH CUSTOMER DATA
    // ========================================
    $sql = "SELECT * FROM clientes WHERE codigo='$cliente_id'";
    $res = $conn->query($sql);
    $cliente_data = $res->fetch_array(MYSQLI_ASSOC);
    
    $customer = [
        'first_name' => formatName($cliente_data['nombre']),
        'middle_name' => formatName($cliente_data['nombre2'] ?? ''),
        'last_name' => formatName($cliente_data['apellido']),
        'second_last_name' => formatName($cliente_data['apellido2'] ?? ''),
        'identity_document' => $cliente_data['documento'] ?? '',
        'email' => utf8_encode($cliente_data['email'] ?? ''),
        'mobile' => $cliente_data['cel'],
        'address' => utf8_encode($cliente_data['dir'] ?? '')
    ];
    
    // Remove empty optional fields
    $customer = array_filter($customer, function($value) {
        return $value !== '' && $value !== null;
    });
    
    // ========================================
    // 3. FETCH RECEIVER DATA
    // ========================================
    $sql = "SELECT * FROM destinatarios WHERE codigo='$destinatario_id'";
    $res = $conn->query($sql);
    $destinatario_data = $res->fetch_array(MYSQLI_ASSOC);
    
    // Build address
    $address_parts = [
        $destinatario_data['cll'],
        '#' . $destinatario_data['no'],
        $destinatario_data['apto'] ? 'Apto. ' . $destinatario_data['apto'] : '',
        $destinatario_data['entre_cll'] ? 'Entre ' . $destinatario_data['entre_cll'] : ''
    ];
    $address = trim(implode(' ', array_filter($address_parts)));
    
    // Ensure CI is 11 characters (pad with zeros if needed)
    $ci = str_pad($destinatario_data['documento'], 11, '0', STR_PAD_LEFT);
    
    // Build receiver data
    // Option 1: Use province/city IDs (recommended if you have mapping)
    // Option 2: Use province/city names (the API will resolve them)
    
    $use_province_names = false; // Set to true to use names instead of IDs
    
    if ($use_province_names) {
        // Get province and city names from your database
        $sql = "SELECT ciudad FROM ciudades WHERE id='" . $destinatario_data['estado'] . "'";
        $res = $conn->query($sql);
        $row = $res->fetch_array(MYSQLI_ASSOC);
        $province_name = utf8_encode($row['ciudad'] ?? '');
        
        $sql = "SELECT ciudad FROM ciudades_cuba WHERE codigo='" . $destinatario_data['ciudad'] . "'";
        $res = $conn->query($sql);
        $row = $res->fetch_array(MYSQLI_ASSOC);
        $city_name = utf8_encode($row['ciudad'] ?? '');
        
        $receiver = [
            'first_name' => formatName($destinatario_data['nombre']),
            'middle_name' => formatName($destinatario_data['nombre2'] ?? ''),
            'last_name' => formatName($destinatario_data['apellido']),
            'second_last_name' => formatName($destinatario_data['apellido2'] ?? ''),
            'ci' => $ci,  // Must be exactly 11 characters
            'mobile' => $destinatario_data['cel'] ?? '',
            'phone' => $destinatario_data['tel'] ?? '',
            'email' => utf8_encode($destinatario_data['email'] ?? ''),
            'address' => utf8_encode($address),
            'province' => $province_name,  // Using province name
            'city' => $city_name           // Using city name
        ];
    } else {
        // Use IDs (requires proper mapping)
        $receiver = [
            'first_name' => formatName($destinatario_data['nombre']),
            'middle_name' => formatName($destinatario_data['nombre2'] ?? ''),
            'last_name' => formatName($destinatario_data['apellido']),
            'second_last_name' => formatName($destinatario_data['apellido2'] ?? ''),
            'ci' => $ci,  // Must be exactly 11 characters
            'mobile' => $destinatario_data['cel'] ?? '',
            'phone' => $destinatario_data['tel'] ?? '',
            'email' => utf8_encode($destinatario_data['email'] ?? ''),
            'address' => utf8_encode($address),
            'province_id' => (int) $destinatario_data['estado'],
            'city_id' => (int) $destinatario_data['ciudad']
        ];
    }
    
    // Remove empty optional fields
    $receiver = array_filter($receiver, function($value, $key) {
        // Keep required fields even if empty (for better error messages)
        $required = ['first_name', 'last_name', 'ci', 'address', 'province_id', 'city_id', 'province', 'city'];
        if (in_array($key, $required)) return true;
        return $value !== '' && $value !== null;
    }, ARRAY_FILTER_USE_BOTH);
    
    // ========================================
    // 4. FETCH ITEMS (PACKAGES)
    // ========================================
    
    // Get available rates for caching
    $rates_cache = getRatesFromAPI($service_id);
    
    $items = [];
    $sql = "SELECT codigo FROM orden_envio_det WHERE cod_envio='$codigo' ORDER BY codigo";
    $res = $conn->query($sql);
    
    while ($row = $res->fetch_assoc()) {
        $envio = $row['codigo'];
        
        // Get package details
        $sql2 = "SELECT codigo_paquete, tipo_producto, peso, descripcion, 
                        cantidad_pro, valor_aduanal, alto, ancho, profundidad, 
                        precio, tarifa 
                 FROM orden_envio_emp_det 
                 WHERE envio='$envio'";
        
        $res2 = $conn->query($sql2);
        
        while ($row2 = $res2->fetch_assoc()) {
            $descripcion = utf8_encode($row2['descripcion']);
            $peso = (float) $row2['peso'];
            $precio = (float) $row2['precio'];
            
            // Find appropriate rate ID
            $rate_id = findRateId($descripcion, $service_id, $rates_cache);
            
            // Calculate price in cents
            // Option 1: Use price from your database
            $price_in_cents = (int) round($precio * 100);
            
            // Option 2: Calculate based on rate and weight (uncomment if needed)
            // $price_in_cents = calculatePriceInCents($rate_id, $peso, $rates_cache);
            
            // If no price in database, calculate it
            if ($price_in_cents <= 0) {
                $price_in_cents = calculatePriceInCents($rate_id, $peso, $rates_cache);
            }
            
            $items[] = [
                'description' => $descripcion,
                'weight' => $peso,
                'rate_id' => $rate_id,
                'price_in_cents' => $price_in_cents,
                'unit' => 'PER_LB'
            ];
        }
    }
    
    if (empty($items)) {
        return ['success' => false, 'error' => 'No items found for order'];
    }
    
    // ========================================
    // 5. BUILD API PAYLOAD
    // ========================================
    $payload = [
        'customer' => $customer,      // Create new customer
        'receiver' => $receiver,      // Create new receiver
        'service_id' => $service_id,
        'items' => $items
    ];
    
    // Alternative: If you already have customer/receiver IDs in CTEnvios:
    // $payload = [
    //     'customer_id' => 123,
    //     'receiver_id' => 456,
    //     'service_id' => $service_id,
    //     'items' => $items
    // ];
    
    // ========================================
    // 6. SEND REQUEST TO CTENVIOS API
    // ========================================
    $url = API_BASE_URL . '/orders';
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . API_KEY,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    // ========================================
    // 7. HANDLE RESPONSE
    // ========================================
    if ($curl_error) {
        return [
            'success' => false,
            'error' => 'Connection error: ' . $curl_error
        ];
    }
    
    $response_data = json_decode($response, true);
    
    if ($http_code === 200) {
        return [
            'success' => true,
            'data' => $response_data,
            'order_id' => $response_data['data']['order']['id'] ?? null,
            'hbls' => array_column($response_data['data']['items'] ?? [], 'hbl')
        ];
    } else {
        return [
            'success' => false,
            'error' => $response_data['message'] ?? 'Unknown error',
            'details' => $response_data['errors'] ?? null,
            'http_code' => $http_code
        ];
    }
}

/**
 * Get order details from CTEnvios API
 */
function getOrderDetails($order_id) {
    $url = API_BASE_URL . '/orders/' . $order_id;
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . API_KEY,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code === 200) {
        return json_decode($response, true);
    }
    
    return null;
}

/**
 * Track package by HBL
 */
function trackPackage($hbl) {
    $url = API_BASE_URL . '/tracking/' . urlencode($hbl);
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . API_KEY,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code === 200) {
        return json_decode($response, true);
    }
    
    return null;
}

// ========================================
// EXAMPLE USAGE
// ========================================

if (php_sapi_name() === 'cli') {
    echo "CTEnvios Partner API - Legacy Integration Example\n";
    echo "================================================\n\n";
    
    // Example: Replace with your database connection
    // $conn = mysqli_connect("localhost", "user", "password", "database");
    
    // Example: Create order
    // $codigo = 'ORD123456'; // Your old system order code
    // $result = createOrderInCTEnvios($conn, $codigo);
    
    // if ($result['success']) {
    //     echo "✓ Order created successfully!\n";
    //     echo "  Order ID: " . $result['order_id'] . "\n";
    //     echo "  HBL Numbers: " . implode(', ', $result['hbls']) . "\n";
    // } else {
    //     echo "✗ Error creating order: " . $result['error'] . "\n";
    //     if (isset($result['details'])) {
    //         echo "  Details: " . json_encode($result['details'], JSON_PRETTY_PRINT) . "\n";
    //     }
    // }
    
    // Example: Get available rates
    echo "Fetching available rates...\n";
    $rates = getRatesFromAPI();
    echo "Available rates: " . count($rates) . "\n";
    foreach ($rates as $rate) {
        echo "  - {$rate['name']}: \${$rate['price_in_cents']}/100 ({$rate['unit']})\n";
    }
}

/**
 * Integration into your existing process
 * 
 * Replace your old 'enviar_factura_api_solvedcargo' code with:
 */
/*
elseif ($proceso == 'enviar_factura_api_ctenvios') {
    $codigo = $_POST['codigo'] ?? $_GET['codigo'];
    
    // Call the integration function
    $result = createOrderInCTEnvios($conn, $codigo);
    
    if ($result['success']) {
        // Success - update your database
        $order_id = $result['order_id'];
        $hbls = implode(',', $result['hbls']);
        
        $sql = "UPDATE orden_envio SET 
                ctenvios_order_id = '$order_id',
                ctenvios_hbls = '$hbls',
                api_sync = 1,
                api_sync_date = NOW()
                WHERE cod_envio = '$codigo'";
        
        $conn->query($sql);
        
        // Return success response
        echo json_encode([
            'status' => 'success',
            'message' => 'Order synced with CTEnvios',
            'order_id' => $order_id,
            'tracking_numbers' => $result['hbls']
        ]);
    } else {
        // Error - log and return error
        error_log("CTEnvios API Error for order $codigo: " . $result['error']);
        
        echo json_encode([
            'status' => 'error',
            'message' => $result['error'],
            'details' => $result['details'] ?? null
        ]);
    }
}
*/

