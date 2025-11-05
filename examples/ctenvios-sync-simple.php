<?php
/**
 * CTEnvios Simple Sync - For orden_envio database structure
 * Compatible with your existing system
 */

// Configuration: Map old agency IDs to CTEnvios API keys
// Each agency (partner) has its own API key
$AGENCY_CONFIG = [
    2 => [
        'api_key' => 'ct_test_XLMfw9ZoI2xVE1x7kMVtvymPSE4pC0zrGf1QmiN0S3M',
        'ctenvios_agency_id' => 2,  // Agency ID in CTEnvios system
        'rate_per_lb' => 199,        // Default rate if not in database
        'name' => 'Agency 2'
    ],
    208 => [
        'api_key' => 'ct_test_iDxFQrs3xmzYjpbgASG0Y7ghZrh7zeQjie__rBa9Gas',  // Replace with actual key
        'ctenvios_agency_id' => 208, // Agency ID in CTEnvios system
        'rate_per_lb' => 199,
        'name' => 'Agency 208'
    ]
    // Add more agencies as needed
];

function syncOrderToCTEnvios($conn, $cod_envio, $agency_id = null) {
    global $AGENCY_CONFIG;
    
    $api_url = 'https://api.ctenvios.com/api/v1/partners/orders';
    
    // Get agency ID if not provided
    if ($agency_id === null) {
        $sql = "SELECT agencia FROM orden_envio WHERE cod_envio = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('s', $cod_envio);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        $agency_id = $result['agencia'] ?? null;
        
        if (!$agency_id) {
            return ['success' => false, 'error' => 'Agency not found for order'];
        }
    }
    
    // Check if agency is configured for CTEnvios sync
    if (!isset($AGENCY_CONFIG[$agency_id])) {
        return ['success' => false, 'error' => "Agency $agency_id not configured for CTEnvios sync"];
    }
    
    $config = $AGENCY_CONFIG[$agency_id];
    $api_key = $config['api_key'];
    $rate_per_lb = $config['rate_per_lb'];
    
    // Helper: Convert to Title Case (LEIDIANA → Leidiana)
    $toTitleCase = function($text) {
        if (empty($text)) return '';
        // Convert to lowercase first, then capitalize first letter of each word
        return mb_convert_case(mb_strtolower(trim($text), 'UTF-8'), MB_CASE_TITLE, 'UTF-8');
    };
    
    // Helper: Parse full name
    $parseName = function($fullName) use ($toTitleCase) {
        $parts = array_filter(preg_split('/\s+/', trim($fullName)));
        $count = count($parts);
        
        // Convert each part to title case
        $parts = array_map(function($part) use ($toTitleCase) {
            return $toTitleCase($part);
        }, $parts);
        
        if ($count == 0) return ['first_name' => '', 'middle_name' => '', 'last_name' => '', 'second_last_name' => ''];
        if ($count == 1) return ['first_name' => $parts[0], 'middle_name' => '', 'last_name' => $parts[0], 'second_last_name' => ''];
        if ($count == 2) return ['first_name' => $parts[0], 'middle_name' => '', 'last_name' => $parts[1], 'second_last_name' => ''];
        if ($count == 3) return ['first_name' => $parts[0], 'middle_name' => '', 'last_name' => $parts[1], 'second_last_name' => $parts[2]];
        
        return ['first_name' => $parts[0], 'middle_name' => $parts[1], 'last_name' => $parts[2], 'second_last_name' => $parts[3] ?? ''];
    };
    
    // 1. Get customer data
    $sql = "SELECT c.nombre, c.nombre2, c.apellido, c.apellido2, c.cel, c.email
            FROM orden_envio oe
            INNER JOIN clientes c ON oe.cliente = c.codigo
            WHERE oe.cod_envio = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $cod_envio);
    $stmt->execute();
    $customer_data = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$customer_data) {
        return ['success' => false, 'error' => 'Customer not found'];
    }
    
    // 2. Get receiver data
    $sql = "SELECT d.nombre, d.nombre2, d.apellido, d.apellido2, d.documento, d.cel, d.tel, d.email,
                   d.cll, d.no, d.apto, d.entre_cll, d.reparto,
                   p.ciudad as provincia, c.ciudad as ciudad
            FROM orden_envio oe
            INNER JOIN destinatarios d ON oe.destinatario = d.codigo
            LEFT JOIN ciudades p ON d.estado = p.id
            LEFT JOIN ciudades_cuba c ON d.ciudad = c.codigo
            WHERE oe.cod_envio = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $cod_envio);
    $stmt->execute();
    $receiver_data = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$receiver_data) {
        return ['success' => false, 'error' => 'Receiver not found'];
    }
    
    // 2b. Get fees from orden_envio (delivery, seguro, cargo)
    // Note: orden_envio stores totals, not per-envio
    $sql = "SELECT delivery, seguro, cargo_extra as cargo
            FROM orden_envio
            WHERE cod_envio = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $cod_envio);
    $stmt->execute();
    $fees_data = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $delivery_fee = (float) ($fees_data['delivery'] ?? 0);
    $seguro_fee = (float) ($fees_data['seguro'] ?? 0);
    $cargo_fee = (float) ($fees_data['cargo'] ?? 0);
    
   
    $delivery_fee_cents = (int) round($delivery_fee * 100);
    $seguro_fee_cents = (int) round($seguro_fee * 100);
    $cargo_fee_cents = (int) round($cargo_fee * 100);
    
 
    // 3. Get items with their rates
    $sql = "SELECT descripcion, peso, tarifa, medida_tarifa, precio, empaquetado
            FROM orden_envio_emp_det
            WHERE cod_envio = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $cod_envio);
    $stmt->execute();
    $items_result = $stmt->get_result();
    
    if ($items_result->num_rows == 0) {
        return ['success' => false, 'error' => 'No items found'];
    }
    
    $items = [];
    $total_items = $items_result->num_rows;
    $item_index = 0;
    
    while ($row = $items_result->fetch_assoc()) {
        $weight = (float) $row['peso'];
        $tarifa = (float) $row['tarifa'];
        $medida_tarifa = $row['medida_tarifa'];
        $precio = (float) $row['precio'];
        $empaquetado = (float) ($row['empaquetado'] ?? 0);
        
        // In your system: tarifa is the RATE per unit (e.g., $5.00/lb)
        // In CTEnvios API: price_in_cents is also the RATE per unit (e.g., 500 cents/lb)
        // So we just convert tarifa to cents
        $price_in_cents = (int) round($tarifa * 100);
        
        // Distribute insurance and extra charges across items
        $insurance_cents = 0;
        $charge_cents = 0;
        
        if ($item_index == 0) {
            // Add all fees to first item
            $insurance_cents = $seguro_fee_cents;
            
            // Cargo + precio + empaquetado go into charge_fee
            $total_charges = $cargo_fee + $precio + $empaquetado;
            $charge_cents = (int) round($total_charges * 100);
        } else {
            // For other items, only add precio + empaquetado
            $charge_cents = (int) round(($precio + $empaquetado) * 100);
        }
        
        $items[] = [
            'description' => $row['descripcion'],
            'weight' => $weight,
            'rate_id' => 1,
            'price_in_cents' => $price_in_cents,
            'unit' => 'PER_LB',
            'insurance_fee_in_cents' => $insurance_cents,
            'charge_fee_in_cents' => $charge_cents
            
        ];
        
        $item_index++;
    }
    $stmt->close();
    
    // 4. Parse customer name
    $customer_name = trim(
        $customer_data['nombre'] . ' ' . 
        ($customer_data['nombre2'] ?? '') . ' ' . 
        $customer_data['apellido'] . ' ' . 
        ($customer_data['apellido2'] ?? '')
    );
    $customer_parsed = $parseName($customer_name);
    
    // 5. Parse receiver name
    $receiver_name = trim(
        $receiver_data['nombre'] . ' ' . 
        ($receiver_data['nombre2'] ?? '') . ' ' . 
        $receiver_data['apellido'] . ' ' . 
        ($receiver_data['apellido2'] ?? '')
    );
    $receiver_parsed = $parseName($receiver_name);
    
    // 6. Build address
    $address_parts = array_filter([
        $receiver_data['cll'],
        $receiver_data['no'] ? '#' . $receiver_data['no'] : '',
        $receiver_data['apto'] ? 'Apto ' . $receiver_data['apto'] : '',
        $receiver_data['entre_cll'] ? 'entre ' . $receiver_data['entre_cll'] : '',
        $receiver_data['reparto'] ?? ''
    ]);
    $address = implode(' ', $address_parts);
    
    // 7. Ensure CI is 11 characters
    $ci = str_pad($receiver_data['documento'], 11, '0', STR_PAD_LEFT);
    
    // 8. Build API payload
    $payload = [
        'customer' => array_filter([
            'first_name' => $customer_parsed['first_name'],
            'middle_name' => $customer_parsed['middle_name'],
            'last_name' => $customer_parsed['last_name'],
            'second_last_name' => $customer_parsed['second_last_name'],
            'mobile' => $customer_data['cel'],
            'email' => $customer_data['email'] ?? ''
        ]),
        'receiver' => array_filter([
            'first_name' => $receiver_parsed['first_name'],
            'middle_name' => $receiver_parsed['middle_name'],
            'last_name' => $receiver_parsed['last_name'],
            'second_last_name' => $receiver_parsed['second_last_name'],
            'ci' => $ci,
            'mobile' => $receiver_data['cel'] ?? '',
            'phone' => $receiver_data['tel'] ?? '',
            'email' => $receiver_data['email'] ?? '',
            'address' => $address,
            'province' => $receiver_data['provincia'] ?? 'La Habana',
            'city' => $receiver_data['ciudad'] ?? 'Habana'
        ], function($v, $k) {
            $required = ['first_name', 'last_name', 'ci', 'address', 'province', 'city'];
            return in_array($k, $required) || ($v !== '' && $v !== null);
        }, ARRAY_FILTER_USE_BOTH),
        'service_id' => 1,
        'items' => $items,
        'total_delivery_fee_in_cents' => $delivery_fee_cents,
        'requires_home_delivery' => $delivery_fee > 0 ? true : false
    ];
    
    // 9. Make API request
    $ch = curl_init($api_url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $api_key,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 30
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    if ($curl_error) {
        return ['success' => false, 'error' => 'Connection error: ' . $curl_error];
    }
    
    $response_data = json_decode($response, true);
    
    if ($http_code >= 200 && $http_code < 300) {
        return [
            'success' => true,
            'order_id' => $response_data['data']['order']['id'] ?? null,
            'hbls' => array_column($response_data['data']['items'] ?? [], 'hbl'),
            'total_in_cents' => $response_data['data']['order']['total_in_cents'] ?? 0
        ];
    }
    
    return [
        'success' => false,
        'error' => $response_data['message'] ?? 'API error',
        'details' => $response_data['errors'] ?? null,
        'http_code' => $http_code
    ];
}
?>

