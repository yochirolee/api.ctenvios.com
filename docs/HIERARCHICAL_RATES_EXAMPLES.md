# Ejemplos Prácticos - Sistema de Tarifas Jerárquicas

## 🚀 Quick Start - Prueba Rápida

### Script de Prueba (Node.js)

Crea un archivo `test-hierarchical-rates.js` en la raíz del proyecto:

```javascript
// test-hierarchical-rates.js
const API_URL = "http://localhost:3000/api"; // Ajusta según tu configuración
const FORWARDER_TOKEN = "your-forwarder-token-here";
const AGENCY_TOKEN = "your-agency-token-here";

async function testHierarchicalRates() {
   console.log("🧪 Testing Hierarchical Rates System\n");

   // 1. Crear tarifa base (Forwarder)
   console.log("1️⃣ Creating base rate as Forwarder...");
   const baseRate = await fetch(`${API_URL}/shipping-rates/base-rate`, {
      method: "POST",
      headers: {
         Authorization: `Bearer ${FORWARDER_TOKEN}`,
         "Content-Type": "application/json",
      },
      body: JSON.stringify({
         name: "Test Rate 0-5 lbs",
         description: "Test shipping rate for small packages",
         service_id: 1,
         cost_in_cents: 500,
         rate_in_cents: 800,
         rate_type: "WEIGHT",
         min_weight: 0,
         max_weight: 5,
      }),
   }).then((r) => r.json());

   console.log("✅ Base rate created:", baseRate.base_rate.id);
   console.log(`   Cost: $${baseRate.base_rate.cost_in_cents / 100}`);
   console.log(`   Rate: $${baseRate.base_rate.rate_in_cents / 100}\n`);

   // 2. Personalizar tarifa (Agencia)
   console.log("2️⃣ Customizing rates for agency with 25% margin...");
   const customRates = await fetch(`${API_URL}/shipping-rates/bulk-customize`, {
      method: "POST",
      headers: {
         Authorization: `Bearer ${AGENCY_TOKEN}`,
         "Content-Type": "application/json",
      },
      body: JSON.stringify({
         agency_id: 5, // Ajusta según tu agencia
         service_id: 1,
         margin_percentage: 25,
      }),
   }).then((r) => r.json());

   console.log(`✅ ${customRates.count} rates customized`);
   console.log(`   New rate: $${customRates.rates[0].rate_in_cents / 100}`);
   console.log(`   Margin: $${(customRates.rates[0].rate_in_cents - customRates.rates[0].cost_in_cents) / 100}\n`);

   // 3. Resolver tarifa efectiva
   console.log("3️⃣ Resolving effective rate for agency...");
   const resolved = await fetch(`${API_URL}/shipping-rates/resolve/5/1?weight=3`, {
      method: "GET",
      headers: {
         Authorization: `Bearer ${AGENCY_TOKEN}`,
      },
   }).then((r) => r.json());

   console.log("✅ Effective rate resolved:");
   console.log(`   Rate ID: ${resolved.rates[0].rate.id}`);
   console.log(`   Selling price: $${resolved.rates[0].rate.rate_in_cents / 100}`);
   console.log(`   Cost: $${resolved.rates[0].rate.cost_in_cents / 100}`);
   console.log(`   Margin: $${resolved.rates[0].margin_in_cents / 100}`);
   console.log(`   Is inherited: ${resolved.rates[0].is_inherited}\n`);

   // 4. Ver jerarquía
   console.log("4️⃣ Viewing rate hierarchy...");
   const hierarchy = await fetch(`${API_URL}/shipping-rates/hierarchy/${customRates.rates[0].id}`, {
      method: "GET",
      headers: {
         Authorization: `Bearer ${AGENCY_TOKEN}`,
      },
   }).then((r) => r.json());

   console.log("✅ Rate hierarchy:");
   console.log(`   Current: ${hierarchy.rate.name} - $${hierarchy.rate.rate_in_cents / 100}`);
   console.log(`   Parent: $${hierarchy.parent.rate_in_cents / 100}`);
   console.log(`   Children: ${hierarchy.children.length}\n`);

   console.log("🎉 All tests completed successfully!");
}

testHierarchicalRates().catch(console.error);
```

**Ejecutar:**

```bash
node test-hierarchical-rates.js
```

---

## 📊 Ejemplos por Caso de Uso

### Caso 1: E-commerce Multi-tienda

**Escenario:** Tienes un e-commerce con múltiples tiendas que envían productos.

```javascript
// Estructura:
// Forwarder → Tienda Principal → [Tienda Miami, Tienda NY, Tienda LA]

// 1. Forwarder establece precios base
const baseRates = [
   { name: "0-2 lbs", cost: 300, rate: 500, min: 0, max: 2 },
   { name: "2-5 lbs", cost: 500, rate: 800, min: 2, max: 5 },
   { name: "5-10 lbs", cost: 800, rate: 1200, min: 5, max: 10 },
];

for (const rate of baseRates) {
   await createBaseRate(rate);
}

// 2. Tienda Principal aplica 30% de margen
await bulkCustomize({
   agency_id: TIENDA_PRINCIPAL_ID,
   service_id: SERVICIO_MARITIMO,
   margin_percentage: 30,
});

// 3. Tienda Miami hereda automáticamente (no hace nada)
// 4. Tienda NY aplica 10% adicional sobre precios de Tienda Principal
await bulkCustomize({
   agency_id: TIENDA_NY_ID,
   service_id: SERVICIO_MARITIMO,
   margin_percentage: 10,
});

// 5. Cálculo en checkout (Tienda Miami)
const effectiveRate = await resolveEffectiveRate(TIENDA_MIAMI_ID, SERVICIO_MARITIMO, cartWeight);
const shippingCost = effectiveRate.rates[0].rate.rate_in_cents;

// Resultado:
// - Tienda Miami: Cobra $6.50 por paquete de 2.5 lbs (heredado de Principal)
// - Tienda NY: Cobra $7.15 por paquete de 2.5 lbs (con 10% adicional)
```

---

### Caso 2: Red de Agencias de Envío

**Escenario:** Franquicia con agencias en diferentes ciudades.

```javascript
// Estructura:
// Forwarder CTEnvios
// ├── Agencia Florida
// │   ├── Miami Beach
// │   ├── Coral Gables
// │   └── Doral
// └── Agencia Texas
//     ├── Houston
//     └── Dallas

// Setup inicial
async function setupFranchiseRates() {
   // 1. Forwarder crea tarifas base
   const maritimeRates = [
      { weight: "0-10 lbs", cost: 800, rate: 1200 },
      { weight: "10-20 lbs", cost: 1200, rate: 1800 },
      { weight: "20-50 lbs", cost: 1800, rate: 2800 },
   ];

   // 2. Agencia Florida aplica 20% margen
   await fetch("/shipping-rates/bulk-customize", {
      method: "POST",
      body: JSON.stringify({
         agency_id: FLORIDA_ID,
         service_id: MARITIME_SERVICE,
         margin_percentage: 20,
      }),
   });

   // 3. Miami Beach NO personaliza → hereda 20% de Florida
   // 4. Coral Gables personaliza con 5% adicional
   await fetch("/shipping-rates/bulk-customize", {
      method: "POST",
      body: JSON.stringify({
         agency_id: CORAL_GABLES_ID,
         service_id: MARITIME_SERVICE,
         margin_percentage: 5,
      }),
   });

   // 5. Agencia Texas aplica 15% margen
   await fetch("/shipping-rates/bulk-customize", {
      method: "POST",
      body: JSON.stringify({
         agency_id: TEXAS_ID,
         service_id: MARITIME_SERVICE,
         margin_percentage: 15,
      }),
   });
}

// Uso en facturación
async function createInvoice(customerId, weight, agencyId) {
   // Resolver tarifa efectiva
   const rateResult = await fetch(`/shipping-rates/resolve/${agencyId}/${MARITIME_SERVICE}?weight=${weight}`).then(
      (r) => r.json()
   );

   const effectiveRate = rateResult.rates[0];

   console.log(`
    Agencia: ${agencyId}
    Peso: ${weight} lbs
    Precio: $${effectiveRate.rate.rate_in_cents / 100}
    Costo: $${effectiveRate.rate.cost_in_cents / 100}
    Margen: $${effectiveRate.margin_in_cents / 100}
    Heredado: ${effectiveRate.is_inherited ? "Sí" : "No"}
  `);

   return createInvoiceWithRate(customerId, effectiveRate.rate);
}

// Resultados por agencia (paquete 15 lbs):
// - Miami Beach: $21.60 (heredado de Florida: $18 + 20%)
// - Coral Gables: $22.68 (Florida + 5%: $21.60 + 5%)
// - Houston: $20.70 (heredado de Texas: $18 + 15%)
```

---

### Caso 3: Ajustes Dinámicos de Precios

**Escenario:** Ajustar precios por temporada o promociones.

```javascript
// 1. Temporada Alta - Forwarder aumenta precios base
async function applyHighSeasonPricing() {
   const baseRateIds = await getBaseRates(MARITIME_SERVICE);

   for (const rateId of baseRateIds) {
      await fetch(`/shipping-rates/update-base-rate/${rateId}`, {
         method: "PUT",
         headers: {
            Authorization: `Bearer ${FORWARDER_TOKEN}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify({
            rate_in_cents: newRateInCents, // +20% sobre precio actual
            cascade_to_children: true, // Actualiza costos de todas las agencias
         }),
      });
   }

   console.log("✅ Precios de temporada alta aplicados");
   console.log("   Todas las agencias ahora tienen costos actualizados");
   console.log("   Cada agencia mantiene su margen configurado");
}

// 2. Promoción Regional - Agencia Miami reduce margen temporalmente
async function applyMiamiPromotion() {
   const customRates = await getAgencyRates(MIAMI_ID, MARITIME_SERVICE);

   for (const rate of customRates) {
      // Reducir margen al 10% para promoción
      const newRate = Math.round(rate.cost_in_cents * 1.1);

      await fetch(`/shipping-rates/update-custom/${rate.id}`, {
         method: "PUT",
         headers: {
            Authorization: `Bearer ${AGENCY_TOKEN}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify({
            rate_in_cents: newRate,
            description: "Promoción Navideña - Margen reducido",
         }),
      });
   }

   console.log("✅ Promoción aplicada en Miami");
   console.log("   Sub-agencias heredan automáticamente los nuevos precios");
}

// 3. Fin de promoción - Restaurar márgenes originales
async function endMiamiPromotion() {
   // Simplemente aplicar el margen original (25%) en lote
   await fetch("/shipping-rates/bulk-customize", {
      method: "POST",
      headers: {
         Authorization: `Bearer ${AGENCY_TOKEN}`,
         "Content-Type": "application/json",
      },
      body: JSON.stringify({
         agency_id: MIAMI_ID,
         service_id: MARITIME_SERVICE,
         margin_percentage: 25,
      }),
   });

   console.log("✅ Margen normal restaurado");
}
```

---

### Caso 4: API Partner Integration

**Escenario:** Partner externo necesita obtener precios dinámicamente.

```javascript
// API Partner crea una orden
app.post("/api/partners/create-order", async (req, res) => {
   const { customer, receiver, items, agency_id } = req.body;

   // 1. Resolver tarifas para cada item basado en peso
   const itemsWithPricing = await Promise.all(
      items.map(async (item) => {
         const rateResult = await services.shippingRates.resolveEffectiveRate(agency_id, item.service_id, item.weight);

         const effectiveRate = rateResult[0];

         return {
            ...item,
            rate_id: effectiveRate.rate.id,
            rate_in_cents: effectiveRate.rate.rate_in_cents,
            cost_in_cents: effectiveRate.rate.cost_in_cents,
            margin_in_cents: effectiveRate.margin_in_cents,
         };
      })
   );

   // 2. Crear orden con precios correctos
   const order = await services.orders.create({
      customer,
      receiver,
      items: itemsWithPricing,
      service_id: items[0].service_id,
      agency_id,
      user_id: req.partner.user_id,
   });

   // 3. Responder con breakdown de precios
   res.json({
      order_id: order.id,
      items: itemsWithPricing.map((item) => ({
         description: item.description,
         weight: item.weight,
         price: item.rate_in_cents / 100,
         margin: item.margin_in_cents / 100,
      })),
      total: order.total_in_cents / 100,
   });
});
```

---

### Caso 5: Dashboard de Gestión

**Escenario:** Interface administrativa para ver y gestionar tarifas.

```javascript
// React Component Example
function RatesManagement({ agencyId, serviceId }) {
   const [rates, setRates] = useState([]);
   const [hierarchy, setHierarchy] = useState(null);

   // Cargar tarifas disponibles
   useEffect(() => {
      fetch(`/api/shipping-rates/available/${agencyId}/${serviceId}`)
         .then((r) => r.json())
         .then((data) => setRates(data.rates));
   }, [agencyId, serviceId]);

   // Personalizar en lote
   const handleBulkCustomize = async (marginPercentage) => {
      const response = await fetch("/api/shipping-rates/bulk-customize", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            agency_id: agencyId,
            service_id: serviceId,
            margin_percentage: marginPercentage,
         }),
      });

      const result = await response.json();
      alert(`${result.count} tarifas actualizadas`);
      // Recargar tarifas
      window.location.reload();
   };

   // Ver jerarquía de una tarifa
   const viewHierarchy = async (rateId) => {
      const response = await fetch(`/api/shipping-rates/hierarchy/${rateId}`);
      const data = await response.json();
      setHierarchy(data);
   };

   return (
      <div>
         <h2>Gestión de Tarifas</h2>

         {/* Personalización rápida */}
         <div>
            <button onClick={() => handleBulkCustomize(10)}>Aplicar 10% margen</button>
            <button onClick={() => handleBulkCustomize(25)}>Aplicar 25% margen</button>
         </div>

         {/* Lista de tarifas */}
         <table>
            <thead>
               <tr>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Costo</th>
                  <th>Margen</th>
                  <th>Heredado</th>
                  <th>Acciones</th>
               </tr>
            </thead>
            <tbody>
               {rates.map(({ rate, is_inherited, margin_in_cents }) => (
                  <tr key={rate.id}>
                     <td>{rate.name}</td>
                     <td>${rate.rate_in_cents / 100}</td>
                     <td>${rate.cost_in_cents / 100}</td>
                     <td>${margin_in_cents / 100}</td>
                     <td>{is_inherited ? "✅" : "❌"}</td>
                     <td>
                        <button onClick={() => viewHierarchy(rate.id)}>Ver jerarquía</button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>

         {/* Vista de jerarquía */}
         {hierarchy && (
            <div className="hierarchy-view">
               <h3>Jerarquía de Tarifa</h3>
               <div>
                  <strong>Padre:</strong> ${hierarchy.parent.rate_in_cents / 100}
               </div>
               <div>
                  <strong>Actual:</strong> ${hierarchy.rate.rate_in_cents / 100}
                  <span>Margen: ${hierarchy.rate.margin_in_cents / 100}</span>
               </div>
               <div>
                  <strong>Hijos ({hierarchy.children.length}):</strong>
                  <ul>
                     {hierarchy.children.map((child) => (
                        <li key={child.id}>
                           {child.agency.name}: ${child.rate_in_cents / 100}
                           (Margen: ${child.margin_in_cents / 100})
                        </li>
                     ))}
                  </ul>
               </div>
            </div>
         )}
      </div>
   );
}
```

---

## 🧪 Testing & Debugging

### Verificar Herencia Correcta

```javascript
async function verifyInheritance(agencyId, serviceId) {
   // 1. Obtener tarifa efectiva
   const resolved = await fetch(`/api/shipping-rates/resolve/${agencyId}/${serviceId}`).then((r) => r.json());

   console.log("Tarifa efectiva:", resolved.rates[0]);

   // 2. Verificar si debe heredar
   const customRates = await prisma.shippingRate.findMany({
      where: { agency_id: agencyId, service_id: serviceId },
   });

   if (customRates.length === 0) {
      console.log("✅ Agencia hereda correctamente (no tiene tarifas custom)");
   } else {
      console.log("✅ Agencia tiene tarifas personalizadas:", customRates.length);
   }

   // 3. Verificar cadena de herencia
   const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: { parent_agency: true },
   });

   if (agency.parent_agency) {
      console.log(`Padre: ${agency.parent_agency.name}`);
      await verifyInheritance(agency.parent_agency.id, serviceId);
   }
}
```

### Test de Cascada de Precios

```javascript
async function testPriceCascade() {
   // 1. Crear tarifa base
   const baseRate = await createBaseRate({
      cost_in_cents: 500,
      rate_in_cents: 1000,
   });

   // 2. Crear tarifa hija
   const childRate = await createCustomRate({
      parent_rate_id: baseRate.id,
      agency_id: 5,
      rate_in_cents: 1500,
   });

   // Verificar cascada
   console.assert(childRate.cost_in_cents === baseRate.rate_in_cents, "Cost should equal parent rate");

   // 3. Actualizar base rate con cascada
   await updateBaseRate(baseRate.id, {
      rate_in_cents: 1200,
      cascade_to_children: true,
   });

   // 4. Verificar que hijo se actualizó
   const updatedChild = await prisma.shippingRate.findUnique({
      where: { id: childRate.id },
   });

   console.assert(updatedChild.cost_in_cents === 1200, "Child cost should be updated to new parent rate");

   console.log("✅ Price cascade working correctly");
}
```

---

## 📈 Monitoreo y Analytics

### Query de Márgenes por Agencia

```sql
-- Ver márgenes de todas las agencias
SELECT
  a.id AS agency_id,
  a.name AS agency_name,
  sr.name AS rate_name,
  sr.cost_in_cents / 100.0 AS cost,
  sr.rate_in_cents / 100.0 AS rate,
  (sr.rate_in_cents - sr.cost_in_cents) / 100.0 AS margin,
  ROUND(((sr.rate_in_cents - sr.cost_in_cents)::float / sr.cost_in_cents * 100), 2) AS margin_percentage,
  sr.is_base_rate,
  CASE
    WHEN sr.parent_rate_id IS NULL THEN 'Base'
    ELSE 'Custom'
  END AS rate_type
FROM shipping_rate sr
LEFT JOIN agency a ON sr.agency_id = a.id
WHERE sr.is_active = true
ORDER BY a.id, sr.service_id, sr.min_weight;
```

### Dashboard Query: Comparación de Precios

```javascript
// API endpoint para comparar precios entre agencias
app.get("/api/analytics/rate-comparison", async (req, res) => {
   const { service_id, weight } = req.query;

   const agencies = await prisma.agency.findMany({
      where: { is_active: true },
   });

   const comparison = await Promise.all(
      agencies.map(async (agency) => {
         const rateResult = await services.shippingRates.resolveEffectiveRate(
            agency.id,
            parseInt(service_id),
            parseFloat(weight)
         );

         const rate = rateResult[0];

         return {
            agency_id: agency.id,
            agency_name: agency.name,
            rate: rate.rate.rate_in_cents / 100,
            cost: rate.rate.cost_in_cents / 100,
            margin: rate.margin_in_cents / 100,
            is_inherited: rate.is_inherited,
         };
      })
   );

   res.json(comparison);
});

// Respuesta:
// [
//   { agency_name: 'Miami', rate: 15.00, margin: 5.00, is_inherited: false },
//   { agency_name: 'NY', rate: 12.00, margin: 4.00, is_inherited: true },
//   ...
// ]
```

---

## 🔧 Troubleshooting

### Problema: Tarifa no se resuelve correctamente

```javascript
// Debug resolver
async function debugResolver(agencyId, serviceId) {
   console.log(`\n🔍 Debugging resolver for agency ${agencyId}, service ${serviceId}\n`);

   // 1. Verificar si agencia existe
   const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: { parent_agency: true },
   });

   if (!agency) {
      console.error("❌ Agency not found");
      return;
   }

   console.log(`✅ Agency: ${agency.name}`);
   console.log(`   Parent: ${agency.parent_agency?.name || "None (is forwarder)"}`);

   // 2. Buscar tarifas personalizadas
   const customRates = await prisma.shippingRate.findMany({
      where: { agency_id: agencyId, service_id: serviceId, is_active: true },
   });

   console.log(`\n📦 Custom rates: ${customRates.length}`);
   customRates.forEach((r) => {
      console.log(`   - ${r.name}: $${r.rate_in_cents / 100}`);
   });

   // 3. Si no hay custom, verificar padre
   if (customRates.length === 0 && agency.parent_agency_id) {
      console.log(`\n⬆️  No custom rates, checking parent...`);
      await debugResolver(agency.parent_agency_id, serviceId);
   }

   // 4. Si no hay padre, verificar base rates
   if (!agency.parent_agency_id) {
      const baseRates = await prisma.shippingRate.findMany({
         where: {
            forwarder_id: agency.forwarder_id,
            service_id: serviceId,
            is_base_rate: true,
            is_active: true,
         },
      });

      console.log(`\n📋 Base rates: ${baseRates.length}`);
      baseRates.forEach((r) => {
         console.log(`   - ${r.name}: $${r.rate_in_cents / 100}`);
      });
   }
}
```

### Problema: Cascada no funciona

```javascript
// Verificar integridad de cascada
async function verifyCascadeIntegrity(baseRateId) {
   const baseRate = await prisma.shippingRate.findUnique({
      where: { id: baseRateId },
      include: { child_rates: true },
   });

   if (!baseRate.is_base_rate) {
      console.error("❌ Not a base rate");
      return;
   }

   console.log(`\n🔗 Cascade integrity check for rate ${baseRateId}\n`);
   console.log(`Base rate: $${baseRate.rate_in_cents / 100}`);

   let errors = 0;

   for (const child of baseRate.child_rates) {
      if (child.cost_in_cents !== baseRate.rate_in_cents) {
         console.error(
            `❌ Child ${child.id} cost mismatch: ` +
               `expected $${baseRate.rate_in_cents / 100}, ` +
               `got $${child.cost_in_cents / 100}`
         );
         errors++;
      } else {
         console.log(`✅ Child ${child.id}: cost correctly set to $${child.cost_in_cents / 100}`);
      }
   }

   console.log(`\n${errors === 0 ? "✅" : "❌"} Integrity check ${errors === 0 ? "passed" : "failed"}`);
}
```

---

## 🎯 Performance Tips

### 1. Cache de Tarifas Resueltas

```javascript
// Implementar cache para resolver
import NodeCache from "node-cache";
const rateCache = new NodeCache({ stdTTL: 600 }); // 10 min

async function resolveEffectiveRateWithCache(agencyId, serviceId, weight) {
   const cacheKey = `rate_${agencyId}_${serviceId}_${weight || "any"}`;

   // Check cache
   const cached = rateCache.get(cacheKey);
   if (cached) {
      return cached;
   }

   // Resolve
   const result = await services.shippingRates.resolveEffectiveRate(agencyId, serviceId, weight);

   // Cache result
   rateCache.set(cacheKey, result);

   return result;
}

// Invalidar cache cuando se actualiza una tarifa
async function updateRateAndInvalidateCache(rateId, updates) {
   await services.shippingRates.updateCustomRate(rateId, updates);

   // Invalidar todo el cache (o ser más selectivo)
   rateCache.flushAll();
}
```

### 2. Batch Resolution para Múltiples Items

```javascript
// Resolver múltiples tarifas en paralelo
async function resolveItemRatesBatch(items, agencyId) {
   const uniqueCombinations = new Map();

   // Agrupar items por service_id + weight
   items.forEach((item) => {
      const key = `${item.service_id}_${item.weight}`;
      if (!uniqueCombinations.has(key)) {
         uniqueCombinations.set(key, {
            service_id: item.service_id,
            weight: item.weight,
         });
      }
   });

   // Resolver en paralelo
   const resolutions = await Promise.all(
      Array.from(uniqueCombinations.values()).map(({ service_id, weight }) =>
         services.shippingRates.resolveEffectiveRate(agencyId, service_id, weight)
      )
   );

   // Mapear resultados
   const rateMap = new Map();
   let i = 0;
   for (const [key] of uniqueCombinations) {
      rateMap.set(key, resolutions[i][0]);
      i++;
   }

   // Aplicar a items
   return items.map((item) => ({
      ...item,
      resolved_rate: rateMap.get(`${item.service_id}_${item.weight}`),
   }));
}
```

---

## 📚 Referencias

-  Servicio principal: `src/services/shipping.rates.service.ts`
-  Rutas API: `src/routes/shipping-rates.routes.ts`
-  Schema: `prisma/schema.prisma` (modelo `ShippingRate`)
-  Documentación completa: `docs/HIERARCHICAL_RATES_SYSTEM.md`
