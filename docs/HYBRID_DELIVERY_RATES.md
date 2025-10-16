# Sistema Híbrido de Tarifas de Entrega

## Problema Resuelto

¿Qué pasa si mañana el carrier sube el precio solo para "Los Palacios" y "Viñales" en Pinar del Río? Con el sistema anterior basado solo en `city_type`, no podías hacerlo sin afectar todas las ciudades del mismo tier.

## Solución: Sistema Híbrido

El nuevo sistema permite **dos tipos de tarifas**:

### 1. Tarifas por Tier (City Type) - Por Defecto

Para la mayoría de las ciudades:

-  **SPECIAL** (Havana, Artemisa, Mayabeque): $5.00
-  **CAPITAL** (Capitales provinciales): $10.00
-  **CITY** (Demás ciudades): $15.00

### 2. Tarifas Específicas por Ciudad - Excepciones

Para casos especiales donde el carrier cobra diferente:

-  **Los Palacios**: $12.00 (sobrescribe el tier CITY de $15)
-  **Viñales**: $18.00 (sobrescribe el tier CITY de $15)
-  **Resto de ciudades CITY**: $15.00 (usan el tier por defecto)

## Esquema de Base de Datos

```prisma
model DeliveryRate {
  id             Int            @id @default(autoincrement())
  name           String         @default("Delivery Rate")
  description    String?
  forwarder_id   Int
  forwarder      Forwarder      @relation(...)
  agency_id      Int?
  agency         Agency?        @relation(...)
  parent_rate_id Int?
  parent_rate    DeliveryRate?  @relation(...)
  child_rates    DeliveryRate[] @relation(...)
  carrier_id     Int
  carrier        Carrier        @relation(...)

  // Sistema híbrido: ambos campos opcionales
  city_type      CityType?      // Para tarifas generales por tier
  city_id        Int?           // Para tarifas específicas por ciudad
  city           City?          @relation(...)

  cost_in_cents  Int            @default(0)
  rate_in_cents  Int            @default(0)
  is_base_rate   Boolean        @default(false)
  is_active      Boolean        @default(true)
  created_at     DateTime       @default(now())
  updated_at     DateTime       @updatedAt

  @@unique([parent_rate_id, agency_id, carrier_id, city_type, city_id])
  @@index([forwarder_id, carrier_id, city_type, is_active])
  @@index([carrier_id, city_id, is_active])
}
```

## Lógica de Resolución

El sistema busca la tarifa en el siguiente orden de prioridad:

### Para una Agencia Específica:

1. **Tarifa específica de ciudad** para esta agencia
   -  Ejemplo: Agencia A tiene tarifa custom para "Los Palacios" = $11
2. **Tarifa por tier (city_type)** para esta agencia
   -  Ejemplo: Agencia A tiene tarifa custom para todas las ciudades CITY = $16
3. **Heredar del padre** (si la agencia tiene parent_agency)
4. **Tarifa base específica de ciudad** del forwarder
   -  Ejemplo: Forwarder tiene tarifa base para "Los Palacios" = $12
5. **Tarifa base por tier** del forwarder
   -  Ejemplo: Forwarder tiene tarifa base para CITY = $15

## Ejemplos de Uso

### Ejemplo 1: Solo Tarifas por Tier (Simple)

```sql
-- Carrier 1: Tarifas estándar
INSERT INTO "DeliveryRate" (carrier_id, city_type, cost_in_cents, rate_in_cents, is_base_rate, forwarder_id)
VALUES
  (1, 'SPECIAL', 500, 500, true, 1),
  (1, 'CAPITAL', 1000, 1000, true, 1),
  (1, 'CITY', 1500, 1500, true, 1);
```

Resultado:

-  Todas las ciudades SPECIAL: $5
-  Todas las capitales: $10
-  Todas las demás ciudades: $15

### Ejemplo 2: Tarifas Mixtas (Tier + Excepciones)

```sql
-- Carrier 1: Tarifas estándar por tier
INSERT INTO "DeliveryRate" (carrier_id, city_type, cost_in_cents, rate_in_cents, is_base_rate, forwarder_id)
VALUES
  (1, 'SPECIAL', 500, 500, true, 1),
  (1, 'CAPITAL', 1000, 1000, true, 1),
  (1, 'CITY', 1500, 1500, true, 1);

-- Carrier 1: Excepciones específicas para ciudades
INSERT INTO "DeliveryRate" (carrier_id, city_id, cost_in_cents, rate_in_cents, is_base_rate, forwarder_id)
VALUES
  (1, 234, 1200, 1200, true, 1),  -- Los Palacios: $12
  (1, 241, 1800, 1800, true, 1);  -- Viñales: $18
```

Resultado:

-  Pinar del Rio (capital): $10
-  Los Palacios: $12 (excepción)
-  Viñales: $18 (excepción)
-  Resto de ciudades CITY en Pinar del Rio: $15

### Ejemplo 3: Agencia con Markup

```sql
-- Forwarder: Tarifa base
INSERT INTO "DeliveryRate" (carrier_id, city_id, cost_in_cents, rate_in_cents, is_base_rate, forwarder_id, agency_id)
VALUES
  (1, 234, 1200, 1200, true, 1, NULL);  -- Los Palacios: $12 del forwarder

-- Agencia 5: Revende con markup
INSERT INTO "DeliveryRate" (carrier_id, city_id, cost_in_cents, rate_in_cents, parent_rate_id, forwarder_id, agency_id)
VALUES
  (1, 234, 1200, 1400, 123, 1, 5);  -- Los Palacios: paga $12, cobra $14
```

Resultado para Agencia 5:

-  Los Palacios: cost=$12 (paga al forwarder), rate=$14 (cobra al cliente)
-  Margen: $2

## Casos de Uso

### Caso 1: Carrier Sube Precio a Ciudad Específica

**Situación**: Transcargo sube precio de entrega a "Viñales" de $15 a $20

**Solución**:

```typescript
// Crear rate específico para Viñales
await prisma.deliveryRate.create({
   data: {
      name: "Delivery - Viñales (Precio especial)",
      carrier_id: 1,
      city_id: 241, // ID de Viñales
      cost_in_cents: 2000,
      rate_in_cents: 2000,
      is_base_rate: true,
      forwarder_id: 1,
   },
});
```

### Caso 2: Carrier Reduce Precio a Varias Ciudades

**Situación**: Transcargo reduce precio a todas las ciudades de Artemisa de $5 a $4

**Solución**:

```typescript
// Actualizar rate del tier SPECIAL (más eficiente que city por city)
await prisma.deliveryRate.updateMany({
   where: {
      carrier_id: 1,
      city_type: "SPECIAL",
      is_base_rate: true,
   },
   data: {
      cost_in_cents: 400,
      rate_in_cents: 400,
   },
});
```

### Caso 3: Agencia Necesita Markup Diferente por Ciudad

**Situación**: Agencia X quiere cobrar más por entregas a ciudades remotas

**Solución**:

```typescript
// Override para ciudad remota específica
await prisma.deliveryRate.create({
   data: {
      name: "Delivery - Moa (Custom)",
      carrier_id: 1,
      city_id: 421, // Moa
      cost_in_cents: 1500, // Paga al forwarder
      rate_in_cents: 2000, // Cobra al cliente
      parent_rate_id: baseRateId,
      forwarder_id: 1,
      agency_id: 5,
   },
});
```

## Ventajas del Sistema Híbrido

### ✅ Flexibilidad

-  Puedes tener tarifas generales por tier
-  Puedes sobrescribir tarifas para ciudades específicas
-  No necesitas crear 200+ registros si solo tienes excepciones

### ✅ Mantenimiento

-  La mayoría de las ciudades usan tarifas por tier (3 registros)
-  Solo creas registros específicos cuando lo necesitas
-  Fácil actualizar precios masivamente o individualmente

### ✅ Jerarquía

-  Las agencias pueden heredar tarifas del forwarder
-  Las agencias pueden sobrescribir con sus propias tarifas
-  Soporta markups diferentes por agencia

### ✅ Escalabilidad

-  Funciona con 10 ciudades o 1000 ciudades
-  No necesitas duplicar datos innecesariamente
-  Sistema de cache puede optimizar búsquedas

## Migración desde Sistema Anterior

Si tenías `CarrierRates` con city_id específicos:

```typescript
// Convertir de CarrierRates antiguo a DeliveryRate nuevo
const oldRates = await prisma.carrierRates.findMany();

for (const oldRate of oldRates) {
   await prisma.deliveryRate.create({
      data: {
         carrier_id: oldRate.carrier_id,
         city_id: oldRate.city_id,
         cost_in_cents: oldRate.carrier_rate_in_cents,
         rate_in_cents: oldRate.carrier_rate_in_cents,
         is_base_rate: true,
         forwarder_id: 1, // Tu forwarder ID
      },
   });
}
```

## API para Gestión de Tarifas

Podrías crear endpoints para que las agencias gestionen sus tarifas:

```typescript
// POST /api/delivery-rates/bulk-update
// Actualizar todas las ciudades de un tier
{
  "carrier_id": 1,
  "city_type": "CITY",
  "rate_in_cents": 1600
}

// POST /api/delivery-rates/city-specific
// Crear/actualizar tarifa específica para una ciudad
{
  "carrier_id": 1,
  "city_id": 234,
  "rate_in_cents": 1200,
  "description": "Precio especial para Los Palacios"
}

// GET /api/delivery-rates/preview?receiver_id=123&agency_id=5
// Ver qué tarifa se aplicaría para un receiver específico
{
  "city": "Los Palacios",
  "city_type": "CITY",
  "applicable_rate": {
    "type": "city_specific",
    "rate_in_cents": 1200,
    "source": "base_rate"
  }
}
```

## Resumen

El sistema híbrido te da **lo mejor de ambos mundos**:

1. **Simplicidad**: Usa tarifas por tier para la mayoría de casos
2. **Flexibilidad**: Sobrescribe con tarifas específicas cuando lo necesites
3. **Jerarquía**: Las agencias pueden heredar y customizar
4. **Escalabilidad**: Funciona con pocos o muchos datos

**Ejemplo real**:

-  Base: 3 registros (SPECIAL, CAPITAL, CITY)
-  Excepciones: 5 ciudades con precios especiales
-  Total: 8 registros para manejar 229 ciudades ✅
