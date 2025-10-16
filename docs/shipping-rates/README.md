# Sistema de Tarifas Jerárquicas - CTEnvios

## 🎯 Overview

Sistema completo de gestión de tarifas de envío con herencia jerárquica, que permite a los Forwarders establecer precios base y a cada agencia en la jerarquía definir sus propios márgenes de ganancia de forma clara y auditable.

### Filosofía Central

**"Plantillas Maestras" con Anulación Selectiva**

-  El Forwarder crea **tarifas maestras** que actúan como plantillas
-  Las agencias **heredan automáticamente** las tarifas de su padre
-  Las agencias **solo crean registros** cuando quieren personalizar/anular precios
-  Mantiene la base de datos **eficiente** y **auditable**

### Principio de Cascada de Precios

```
Forwarder:  cost=$8 → rate=$10    (vende a agencias por $10)
Agencia A:  cost=$10 → rate=$15   (margen de $5)
Agencia B:  cost=$15 → rate=$18   (margen de $3)
```

El `rate_in_cents` de un nivel se convierte en `cost_in_cents` del siguiente.

---

## 📚 Documentación

### 1. [Guía Completa del Sistema](../HIERARCHICAL_RATES_SYSTEM.md)

**Lectura recomendada primero** ⭐

Contenido:

-  Filosofía y arquitectura completa
-  Los 3 pilares del sistema (Modelo, Resolver, Flujo)
-  API endpoints detallados
-  Casos de uso reales
-  Mejores prácticas
-  Integración con facturación

### 2. [Ejemplos Prácticos](../HIERARCHICAL_RATES_EXAMPLES.md)

**Para desarrollo e implementación** 🛠️

Contenido:

-  Script de prueba rápida
-  Ejemplos por caso de uso (E-commerce, Franquicias, etc.)
-  Testing & debugging
-  Performance tips (caching, batch processing)
-  Troubleshooting común

### 3. [Guía de Migración](../MIGRATION_TO_HIERARCHICAL_RATES.md)

**Para migrar desde sistema existente** 🔄

Contenido:

-  Plan de migración paso a paso
-  Scripts de migración automatizados
-  Validación post-migración
-  Rollback procedures
-  Checklist completo

---

## 🚀 Quick Start

### 1. Instalación

El servicio ya está integrado en el proyecto. Solo necesitas:

```bash
# Asegurar que las migraciones de Prisma estén aplicadas
npx prisma migrate deploy

# Verificar que el modelo ShippingRate tiene los campos necesarios
npx prisma db pull
```

### 2. Crear Primera Tarifa Base (Forwarder)

```bash
curl -X POST http://localhost:3000/api/shipping-rates/base-rate \
  -H "Authorization: Bearer <FORWARDER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paquete Pequeño 0-5 lbs",
    "service_id": 1,
    "cost_in_cents": 500,
    "rate_in_cents": 800,
    "rate_type": "WEIGHT",
    "min_weight": 0,
    "max_weight": 5
  }'
```

### 3. Personalizar Tarifas (Agencia)

```bash
# Opción A: Personalización en lote con margen
curl -X POST http://localhost:3000/api/shipping-rates/bulk-customize \
  -H "Authorization: Bearer <AGENCY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "agency_id": 5,
    "service_id": 1,
    "margin_percentage": 25
  }'

# Opción B: Personalización individual
curl -X POST http://localhost:3000/api/shipping-rates/custom-rate \
  -H "Authorization: Bearer <AGENCY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_rate_id": 101,
    "agency_id": 5,
    "rate_in_cents": 1200
  }'
```

### 4. Resolver Tarifas en Facturación

```javascript
import services from "./services";

// En tu controlador de órdenes/facturas
const rateResults = await services.shippingRates.resolveEffectiveRate(agency_id, service_id, weight, "WEIGHT");

const effectiveRate = rateResults[0];
const shippingCost = effectiveRate.rate.rate_in_cents;
```

---

## 📋 Endpoints Principales

### Core - Resolver

-  `GET /shipping-rates/resolve/:agency_id/:service_id` - Resolver tarifa efectiva

### Gestión de Tarifas Base (Forwarder)

-  `POST /shipping-rates/base-rate` - Crear tarifa base
-  `PUT /shipping-rates/update-base-rate/:id` - Actualizar con cascada

### Personalización (Agencias)

-  `POST /shipping-rates/custom-rate` - Crear tarifa personalizada
-  `POST /shipping-rates/bulk-customize` - Personalizar en lote con margen
-  `PUT /shipping-rates/update-custom/:id` - Actualizar personalizada

### Consulta y Auditoría

-  `GET /shipping-rates/available/:agency_id/:service_id` - Ver tarifas disponibles
-  `GET /shipping-rates/hierarchy/:rate_id` - Ver jerarquía completa

### Gestión

-  `PUT /shipping-rates/deactivate/:rate_id` - Desactivar tarifa y sus hijas

---

## 🏗️ Arquitectura

### Modelo de Datos

```typescript
ShippingRate {
  id: number
  parent_rate_id: number | null  // Apunta al padre (null para base rates)
  agency_id: number | null       // null para base rates
  forwarder_id: number           // Siempre presente

  cost_in_cents: number          // Costo (= rate_in_cents del padre)
  rate_in_cents: number          // Precio de venta

  is_base_rate: boolean          // true solo para tarifas maestras
  is_active: boolean             // Soft delete

  rate_type: RateType            // WEIGHT | FIXED
  min_weight: number | null
  max_weight: number | null
}
```

### Algoritmo Resolver

```typescript
function resolveEffectiveRate(agency_id, service_id, weight?) {
   // 1. ¿Tiene tarifa personalizada?
   const customRate = findCustomRate(agency_id, service_id, weight);
   if (customRate) return customRate;

   // 2. ¿Tiene padre? → Resolver desde padre
   const parent = getParentAgency(agency_id);
   if (parent) return resolveEffectiveRate(parent.id, service_id, weight);

   // 3. No tiene padre → Buscar tarifa base del Forwarder
   return findBaseRate(forwarder_id, service_id, weight);
}
```

---

## ✅ Convenciones Aplicadas

Este sistema sigue las convenciones del proyecto CTEnvios:

-  ✅ **TypeScript strict typing** - Interfaces explícitas
-  ✅ **Repository pattern** - Separación de capas
-  ✅ **Functional programming** - Sin clases
-  ✅ **RESTful API design** - Endpoints semánticos
-  ✅ **Transacciones** - Operaciones atómicas con Prisma
-  ✅ **Error handling** - AppError con mensajes claros
-  ✅ **Explicit return types** - Funciones tipadas

---

## 🔍 Casos de Uso

### Caso 1: Herencia Automática

```
Forwarder crea tarifa base → $10
  ↓ (heredado)
Agencia Miami → vende por $10 (sin crear registro)
  ↓ (heredado)
Sub-agencia Coral Gables → vende por $10 (sin crear registro)
```

### Caso 2: Personalización con Margen

```
Forwarder: base rate $10
  ↓ (personaliza +25%)
Agencia Miami: custom rate $12.50 (crea registro)
  ↓ (heredado)
Sub-agencia Coral Gables: $12.50 (sin crear registro)
```

### Caso 3: Cadena Completa de Personalización

```
Forwarder: $10
  ↓ (personaliza +25%)
Agencia Miami: $12.50
  ↓ (personaliza +10%)
Sub-agencia: $13.75
```

---

## 📊 Ventajas del Sistema

### 1. Eficiencia en Base de Datos

-  No es necesario crear tarifas para cada agencia
-  Solo se crean registros cuando hay personalización
-  Reduce significativamente el número de registros

### 2. Mantenimiento Simplificado

-  Actualizar precio base → Todas las agencias heredan automáticamente
-  Fácil aplicar cambios globales
-  Transparente para agencias que heredan

### 3. Auditabilidad

-  Cadena completa de precios visible
-  Márgenes de ganancia claros
-  Trazabilidad de decisiones de pricing

### 4. Flexibilidad

-  Agencias pueden personalizar cuando lo necesiten
-  Soporte para múltiples niveles de jerarquía
-  Promociones regionales sin afectar global

---

## 🧪 Testing

### Test Rápido

```bash
# Crear archivo test.js con el contenido de HIERARCHICAL_RATES_EXAMPLES.md
node test.js
```

### Validación de Integridad

```javascript
// Verificar cascada de precios
const result = await services.shippingRates.getRateHierarchy(rate_id);
console.log(result);

// Resultado:
// {
//   rate: { cost: 1000, rate: 1500, margin: 500 },
//   parent: { rate: 1000 },  // ✅ parent.rate = rate.cost
//   children: [...]
// }
```

---

## 🔧 Troubleshooting

### Problema: Tarifa no se resuelve

```bash
# Debug resolver
GET /shipping-rates/resolve/:agency_id/:service_id?weight=7.5
```

Si retorna error:

1. Verificar que la agencia existe y está activa
2. Verificar que el servicio está asignado a la agencia
3. Verificar que existe tarifa base en el Forwarder
4. Ver jerarquía: `GET /shipping-rates/hierarchy/:rate_id`

### Problema: Precios inconsistentes

```javascript
// Validar cascada
const hierarchy = await services.shippingRates.getRateHierarchy(rate_id);

// Verificar:
// hierarchy.rate.cost_in_cents === hierarchy.parent.rate_in_cents
```

---

## 📈 Próximos Pasos

1. **Migrar sistema existente** (si aplica)

   -  Ver [Guía de Migración](../MIGRATION_TO_HIERARCHICAL_RATES.md)
   -  Ejecutar scripts de migración
   -  Validar resultados

2. **Integrar con facturación**

   -  Actualizar `resolveItemsWithHbl` para usar resolver
   -  Reemplazar queries directas de tarifas

3. **Crear dashboard**

   -  Vista de árbol de tarifas
   -  Simulador de márgenes
   -  Analytics de pricing

4. **Aplicar mismo patrón a CustomsRates**
   -  Reutilizar lógica del resolver
   -  Implementar herencia para tarifas aduanales

---

## 📁 Estructura de Archivos

```
src/
├── services/
│   ├── shipping.rates.service.ts   # ⭐ Servicio principal
│   └── index.ts
├── routes/
│   └── shipping-rates.routes.ts    # Endpoints HTTP
└── repositories/
    └── shipping.rates.repository.ts

docs/
├── shipping-rates/
│   └── README.md                    # 👈 Este archivo
├── HIERARCHICAL_RATES_SYSTEM.md     # Documentación completa
├── HIERARCHICAL_RATES_EXAMPLES.md   # Ejemplos prácticos
└── MIGRATION_TO_HIERARCHICAL_RATES.md # Guía de migración

prisma/
└── schema.prisma                     # Modelo ShippingRate
```

---

## 🤝 Contribuir

### Reportar Issues

-  Problemas con el resolver
-  Inconsistencias en cascada de precios
-  Bugs en endpoints

### Mejoras Propuestas

-  Nuevos tipos de tarifas
-  Optimizaciones de performance
-  Features adicionales

---

## 📞 Soporte

-  **Documentación Técnica**: Ver archivos en `/docs`
-  **Código Fuente**: `src/services/shipping.rates.service.ts`
-  **API Routes**: `src/routes/shipping-rates.routes.ts`
-  **Schema**: `prisma/schema.prisma` (modelo `ShippingRate`)

---

## 📝 Changelog

### v1.0.0 (2025-01-13)

-  ✅ Implementación inicial del sistema jerárquico
-  ✅ Algoritmo resolver completo
-  ✅ Endpoints REST completos
-  ✅ Documentación completa
-  ✅ Ejemplos prácticos
-  ✅ Guía de migración

---

**🎉 Sistema listo para producción**

El sistema de tarifas jerárquicas está completamente implementado, documentado y testeado. Sigue la guía de migración si necesitas migrar desde un sistema existente, o comienza con Quick Start para implementación nueva.
