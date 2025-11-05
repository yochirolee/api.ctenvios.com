<?php
/**
 * CTEnvios Partner API - Test & Configuration Helper
 * 
 * This script helps you:
 * 1. Test your API key
 * 2. Get available rates for your service
 * 3. Verify service IDs
 * 4. Test order creation with sample data
 * 
 * Usage: php test-partner-api.php
 */

// Configuration
define('API_BASE_URL', 'https://api.ctenvios.com/api/v1/partners');
define('API_KEY', 'ctenv_live_your_api_key_here'); // Replace with your actual API key

// Color output for terminal
function colorOutput($text, $color = 'green') {
    $colors = [
        'green' => "\033[0;32m",
        'red' => "\033[0;31m",
        'yellow' => "\033[1;33m",
        'blue' => "\033[0;34m",
        'reset' => "\033[0m"
    ];
    return $colors[$color] . $text . $colors['reset'];
}

/**
 * Make API request
 */
function makeApiRequest($endpoint, $method = 'GET', $data = null) {
    $url = API_BASE_URL . $endpoint;
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . API_KEY,
            'Content-Type: application/json'
        ]
    ]);
    
    if ($method === 'POST' && $data) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . API_KEY,
            'Content-Type: application/json'
        ]);
    }
    
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
 * Test 1: Verify API Key
 */
function testApiKey() {
    echo "\n" . colorOutput("=== Test 1: Verify API Key ===", 'blue') . "\n";
    
    $result = makeApiRequest('/rates');
    
    if ($result['success']) {
        echo colorOutput("✓ API Key is valid!", 'green') . "\n";
        echo "  Partner authenticated successfully\n";
        return true;
    } else {
        echo colorOutput("✗ API Key is invalid or expired!", 'red') . "\n";
        echo "  HTTP Code: {$result['http_code']}\n";
        echo "  Error: " . ($result['data']['message'] ?? 'Unknown error') . "\n";
        return false;
    }
}

/**
 * Test 2: Get Available Rates
 */
function testGetRates($service_id = 11) {
    echo "\n" . colorOutput("=== Test 2: Get Available Rates ===", 'blue') . "\n";
    echo "Fetching rates for Service ID: $service_id\n\n";
    
    $result = makeApiRequest("/rates?service_id=$service_id");
    
    if ($result['success']) {
        $rates = $result['data']['data'] ?? [];
        $count = count($rates);
        
        echo colorOutput("✓ Found $count rates", 'green') . "\n\n";
        
        if ($count > 0) {
            echo "Available Rates:\n";
            echo str_repeat("-", 100) . "\n";
            printf("%-5s | %-30s | %-15s | %-12s | %-10s | %s\n", 
                "ID", "Name", "Price", "Weight Range", "Unit", "Active");
            echo str_repeat("-", 100) . "\n";
            
            foreach ($rates as $rate) {
                $price = '$' . number_format($rate['price_in_cents'] / 100, 2);
                $weight_range = $rate['min_weight'] . ' - ' . $rate['max_weight'];
                $active = $rate['is_active'] ? 'Yes' : 'No';
                
                printf("%-5s | %-30s | %-15s | %-12s | %-10s | %s\n",
                    $rate['id'],
                    substr($rate['name'], 0, 30),
                    $price,
                    $weight_range,
                    $rate['unit'],
                    $active
                );
            }
            echo str_repeat("-", 100) . "\n";
            
            return $rates;
        } else {
            echo colorOutput("⚠ No rates found for this service", 'yellow') . "\n";
            echo "  Make sure service ID $service_id is correct\n";
            return [];
        }
    } else {
        echo colorOutput("✗ Failed to get rates", 'red') . "\n";
        echo "  HTTP Code: {$result['http_code']}\n";
        echo "  Error: " . ($result['data']['message'] ?? 'Unknown error') . "\n";
        return [];
    }
}

/**
 * Test 3: Create Sample Order
 */
function testCreateOrder($rate_id) {
    echo "\n" . colorOutput("=== Test 3: Create Sample Order ===", 'blue') . "\n";
    echo "Creating test order with Rate ID: $rate_id\n\n";
    
    // Sample data
    $orderData = [
        'customer' => [
            'first_name' => 'Juan',
            'last_name' => 'Pérez',
            'mobile' => '3051234567',
            'email' => 'juan.perez@example.com'
        ],
        'receiver' => [
            'first_name' => 'María',
            'last_name' => 'González',
            'ci' => '12345678901',  // Must be 11 characters
            'mobile' => '53012345',
            'address' => 'Calle 23 #456 e/ 10 y 12',
            'province_id' => 1,  // Adjust based on your province IDs
            'city_id' => 1       // Adjust based on your city IDs
        ],
        'service_id' => 11,
        'items' => [
            [
                'description' => 'Test Package - Electronics',
                'weight' => 5.0,
                'rate_id' => $rate_id,
                'price_in_cents' => 5000,  // $50.00
                'unit' => 'PER_LB'
            ]
        ]
    ];
    
    echo "Order payload:\n";
    echo json_encode($orderData, JSON_PRETTY_PRINT) . "\n\n";
    
    $confirm = readline(colorOutput("Do you want to create this test order? (yes/no): ", 'yellow'));
    
    if (strtolower(trim($confirm)) !== 'yes') {
        echo colorOutput("Test order creation skipped", 'yellow') . "\n";
        return false;
    }
    
    $result = makeApiRequest('/orders', 'POST', $orderData);
    
    if ($result['success']) {
        echo colorOutput("✓ Order created successfully!", 'green') . "\n\n";
        
        $order = $result['data']['data']['order'] ?? [];
        $items = $result['data']['data']['items'] ?? [];
        
        echo "Order Details:\n";
        echo "  Order ID: {$order['id']}\n";
        echo "  Customer ID: {$order['customer_id']}\n";
        echo "  Receiver ID: {$order['receiver_id']}\n";
        echo "  Total: $" . number_format($order['total_in_cents'] / 100, 2) . "\n";
        echo "  Status: {$order['status']}\n";
        echo "  Payment Status: {$order['payment_status']}\n\n";
        
        if (!empty($items)) {
            echo "Items (HBL Tracking Numbers):\n";
            foreach ($items as $item) {
                echo "  - {$item['hbl']}: {$item['description']} ({$item['weight']} lbs)\n";
            }
        }
        
        return true;
    } else {
        echo colorOutput("✗ Failed to create order", 'red') . "\n";
        echo "  HTTP Code: {$result['http_code']}\n";
        echo "  Error: " . ($result['data']['message'] ?? 'Unknown error') . "\n";
        
        if (isset($result['data']['errors'])) {
            echo "\n  Validation Errors:\n";
            foreach ($result['data']['errors'] as $field => $errors) {
                foreach ($errors as $error) {
                    echo "    - $field: $error\n";
                }
            }
        }
        
        return false;
    }
}

/**
 * Test 4: Get All Rates (No Service Filter)
 */
function testGetAllRates() {
    echo "\n" . colorOutput("=== Test 4: Get ALL Available Rates ===", 'blue') . "\n";
    
    $result = makeApiRequest('/rates');
    
    if ($result['success']) {
        $rates = $result['data']['data'] ?? [];
        $count = count($rates);
        
        echo colorOutput("✓ Found $count total rates across all services", 'green') . "\n\n";
        
        // Group by service
        $byService = [];
        foreach ($rates as $rate) {
            $service_id = $rate['service_id'] ?? 'unknown';
            if (!isset($byService[$service_id])) {
                $byService[$service_id] = [];
            }
            $byService[$service_id][] = $rate;
        }
        
        echo "Rates grouped by Service:\n";
        foreach ($byService as $service_id => $serviceRates) {
            echo "\n  Service ID: $service_id (" . count($serviceRates) . " rates)\n";
            foreach (array_slice($serviceRates, 0, 3) as $rate) {
                echo "    - ID {$rate['id']}: {$rate['name']}\n";
            }
            if (count($serviceRates) > 3) {
                echo "    ... and " . (count($serviceRates) - 3) . " more\n";
            }
        }
        
        return $byService;
    }
    
    return [];
}

/**
 * Generate SQL mapping statements
 */
function generateSqlMappings($rates) {
    echo "\n" . colorOutput("=== Generate SQL Mapping Statements ===", 'blue') . "\n";
    
    if (empty($rates)) {
        echo colorOutput("No rates to generate mappings for", 'yellow') . "\n";
        return;
    }
    
    echo "\nCopy these SQL statements to populate your ctenvios_rate_mapping table:\n\n";
    echo "-- Generated " . date('Y-m-d H:i:s') . "\n";
    echo "INSERT INTO ctenvios_rate_mapping (old_product_type, old_product_name, product_keywords, ctenvios_rate_id, ctenvios_rate_name, ctenvios_service_id) VALUES\n";
    
    $values = [];
    $counter = 1;
    foreach ($rates as $rate) {
        $name = addslashes($rate['name']);
        $keywords = strtolower(str_replace(' ', ',', $name));
        $service_id = $rate['service_id'] ?? 11;
        
        $values[] = sprintf(
            "(%d, '%s', '%s', %d, '%s', %d)",
            $counter++,
            $name,
            $keywords,
            $rate['id'],
            $name,
            $service_id
        );
    }
    
    echo implode(",\n", $values) . ";\n";
}

// ============================================
// MAIN EXECUTION
// ============================================

if (php_sapi_name() === 'cli') {
    echo "\n";
    echo colorOutput("╔═══════════════════════════════════════════════════════════╗", 'blue') . "\n";
    echo colorOutput("║     CTEnvios Partner API - Test & Configuration Tool     ║", 'blue') . "\n";
    echo colorOutput("╚═══════════════════════════════════════════════════════════╝", 'blue') . "\n";
    
    // Check API key is set
    if (API_KEY === 'ctenv_live_your_api_key_here') {
        echo colorOutput("\n⚠ WARNING: Please set your API key in the script!", 'red') . "\n";
        echo "Edit this file and replace 'ctenv_live_your_api_key_here' with your actual API key.\n";
        exit(1);
    }
    
    // Run tests
    if (!testApiKey()) {
        echo colorOutput("\n✗ Cannot proceed without valid API key", 'red') . "\n";
        exit(1);
    }
    
    $rates = testGetRates(11);
    
    if (empty($rates)) {
        echo colorOutput("\n⚠ No rates found. Trying to get all rates...", 'yellow') . "\n";
        $allRates = testGetAllRates();
        
        if (!empty($allRates)) {
            $rates = reset($allRates); // Get first service's rates
        }
    }
    
    if (!empty($rates)) {
        // Use first rate for testing
        $firstRateId = $rates[0]['id'];
        
        echo "\n" . colorOutput("Would you like to:", 'yellow') . "\n";
        echo "  1. Test order creation with sample data\n";
        echo "  2. Generate SQL mapping statements\n";
        echo "  3. Skip tests\n";
        
        $choice = readline("Enter choice (1-3): ");
        
        if ($choice == '1') {
            testCreateOrder($firstRateId);
        } elseif ($choice == '2') {
            generateSqlMappings($rates);
        }
    }
    
    echo "\n" . colorOutput("=== Test Complete ===", 'green') . "\n";
    echo "\nNext steps:\n";
    echo "  1. Save the rate IDs you need for your mapping tables\n";
    echo "  2. Update the legacy-integration.php script with your mappings\n";
    echo "  3. Test with your actual database data\n";
    echo "\nFor help, see: docs/api/LEGACY_PHP_INTEGRATION.md\n\n";
}

