# Guía de Migración - Sistema de Tarifas Jerárquicas

## 📋 Índice

1. [Preparación](#preparación)
2. [Análisis del Sistema Actual](#análisis-del-sistema-actual)
3. [Plan de Migración](#plan-de-migración)
4. [Scripts de Migración](#scripts-de-migración)
5. [Validación Post-Migración](#validación-post-migración)
6. [Rollback](#rollback)

---

## Preparación

### 1. Backup de Base de Datos

```bash
# Crear backup completo antes de migrar
pg_dump -h your-host -U your-user -d your-database > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# O usando Prisma
npx prisma db pull --force
```

### 2. Análisis de Datos Actuales

```sql
-- Ver estructura actual de tarifas
SELECT
  COUNT(*) as total_rates,
  COUNT(DISTINCT agency_id) as agencies_with_rates,
  COUNT(DISTINCT service_id) as services_with_rates
FROM shipping_rate
WHERE is_active = true;

-- Ver distribución por tipo de agencia
SELECT
  a.agency_type,
  COUNT(sr.id) as rate_count
FROM shipping_rate sr
JOIN agency a ON sr.agency_id = a.id
WHERE sr.is_active = true
GROUP BY a.agency_type;
```

---

## Análisis del Sistema Actual

### Problemas Comunes en Sistema No-Jerárquico

```sql
-- 1. Tarifas duplicadas (misma tarifa para múltiples agencias)
SELECT
  sr.name,
  sr.service_id,
  sr.rate_in_cents,
  COUNT(*) as duplicate_count
FROM shipping_rate sr
WHERE sr.is_active = true
GROUP BY sr.name, sr.service_id, sr.rate_in_cents
HAVING COUNT(*) > 1;

-- 2. Inconsistencias de precio (hijas más baratas que padres)
WITH agency_rates AS (
  SELECT
    sr.id,
    sr.rate_in_cents,
    a.id as agency_id,
    a.parent_agency_id
  FROM shipping_rate sr
  JOIN agency a ON sr.agency_id = a.id
  WHERE sr.is_active = true
)
SELECT
  child.agency_id as child_agency,
  child.rate_in_cents as child_rate,
  parent.rate_in_cents as parent_rate
FROM agency_rates child
JOIN agency_rates parent
  ON child.parent_agency_id = parent.agency_id
WHERE child.rate_in_cents < parent.rate_in_cents;
```

---

## Plan de Migración

### Fase 1: Identificar Tarifas Base

**Objetivo:** Convertir tarifas del Forwarder en tarifas base (`is_base_rate = true`)

```javascript
// migration-phase1-identify-base-rates.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function phase1_identifyBaseRates() {
   console.log("📋 Phase 1: Identifying Base Rates\n");

   // 1. Encontrar agencias tipo FORWARDER
   const forwarderAgencies = await prisma.agency.findMany({
      where: { agency_type: "FORWARDER" },
   });

   console.log(`Found ${forwarderAgencies.length} forwarder agencies\n`);

   for (const forwarder of forwarderAgencies) {
      console.log(`Processing forwarder: ${forwarder.name} (ID: ${forwarder.id})`);

      // 2. Marcar sus tarifas como base rates
      const result = await prisma.shippingRate.updateMany({
         where: {
            agency_id: forwarder.id,
            is_active: true,
         },
         data: {
            is_base_rate: true,
            parent_rate_id: null,
         },
      });

      console.log(`  ✅ Marked ${result.count} rates as base rates`);
   }

   console.log("\n✅ Phase 1 completed");
}

phase1_identifyBaseRates()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

### Fase 2: Establecer Relaciones Parent-Child

**Objetivo:** Vincular tarifas de agencias hijas con tarifas base de su forwarder

```javascript
// migration-phase2-establish-hierarchy.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function phase2_establishHierarchy() {
   console.log("🔗 Phase 2: Establishing Rate Hierarchy\n");

   // 1. Obtener todas las agencias no-forwarder
   const agencies = await prisma.agency.findMany({
      where: {
         agency_type: { not: "FORWARDER" },
      },
      include: {
         forwarder: true,
      },
   });

   console.log(`Processing ${agencies.length} agencies\n`);

   for (const agency of agencies) {
      console.log(`Processing agency: ${agency.name} (ID: ${agency.id})`);

      // 2. Obtener tarifas de la agencia
      const agencyRates = await prisma.shippingRate.findMany({
         where: {
            agency_id: agency.id,
            is_active: true,
         },
      });

      let linkedCount = 0;

      for (const agencyRate of agencyRates) {
         // 3. Encontrar tarifa base correspondiente del forwarder
         const baseRate = await prisma.shippingRate.findFirst({
            where: {
               forwarder_id: agency.forwarder_id,
               service_id: agencyRate.service_id,
               is_base_rate: true,
               is_active: true,
               rate_type: agencyRate.rate_type,
               min_weight: agencyRate.min_weight,
               max_weight: agencyRate.max_weight,
            },
         });

         if (baseRate) {
            // 4. Establecer relación parent-child
            await prisma.shippingRate.update({
               where: { id: agencyRate.id },
               data: {
                  parent_rate_id: baseRate.id,
                  // Ajustar cost_in_cents si es necesario
                  cost_in_cents: baseRate.rate_in_cents,
               },
            });

            linkedCount++;
         } else {
            console.log(`  ⚠️  No base rate found for rate ${agencyRate.id}`);
         }
      }

      console.log(`  ✅ Linked ${linkedCount} rates to base rates`);
   }

   console.log("\n✅ Phase 2 completed");
}

phase2_establishHierarchy()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

### Fase 3: Validar Cascada de Precios

**Objetivo:** Asegurar que `rate_in_cents` del padre = `cost_in_cents` del hijo

```javascript
// migration-phase3-validate-cascade.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function phase3_validateCascade() {
   console.log("🔍 Phase 3: Validating Price Cascade\n");

   // 1. Obtener todas las tarifas con padre
   const ratesWithParent = await prisma.shippingRate.findMany({
      where: {
         parent_rate_id: { not: null },
         is_active: true,
      },
      include: {
         parent_rate: true,
      },
   });

   console.log(`Validating ${ratesWithParent.length} rates\n`);

   let errors = 0;
   let fixed = 0;

   for (const rate of ratesWithParent) {
      const expectedCost = rate.parent_rate.rate_in_cents;

      if (rate.cost_in_cents !== expectedCost) {
         console.log(`❌ Rate ${rate.id}: cost mismatch`);
         console.log(`   Expected: ${expectedCost}, Got: ${rate.cost_in_cents}`);

         // Opción 1: Auto-fix
         await prisma.shippingRate.update({
            where: { id: rate.id },
            data: { cost_in_cents: expectedCost },
         });

         console.log(`   ✅ Fixed: updated cost to ${expectedCost}`);
         fixed++;
      }

      // Validar que rate > cost
      if (rate.rate_in_cents <= rate.cost_in_cents) {
         console.log(`⚠️  Rate ${rate.id}: selling price <= cost`);
         console.log(`   Cost: ${rate.cost_in_cents}, Rate: ${rate.rate_in_cents}`);
         errors++;
      }
   }

   console.log(`\n📊 Validation Summary:`);
   console.log(`   Total rates: ${ratesWithParent.length}`);
   console.log(`   Fixed: ${fixed}`);
   console.log(`   Errors: ${errors}`);
   console.log(`\n${errors === 0 ? "✅" : "⚠️"} Phase 3 completed`);
}

phase3_validateCascade()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

### Fase 4: Eliminar Tarifas Redundantes

**Objetivo:** Eliminar tarifas idénticas a las del padre (dejar que se hereden)

```javascript
// migration-phase4-remove-redundant.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function phase4_removeRedundant() {
   console.log("🗑️  Phase 4: Removing Redundant Rates\n");

   // 1. Encontrar tarifas que son idénticas a las del padre
   const ratesWithParent = await prisma.shippingRate.findMany({
      where: {
         parent_rate_id: { not: null },
         is_active: true,
      },
      include: {
         parent_rate: true,
         items: true, // Verificar si está en uso
      },
   });

   let removed = 0;
   let kept = 0;

   for (const rate of ratesWithParent) {
      const parent = rate.parent_rate;

      // Verificar si es redundante (mismo precio que el padre)
      const isRedundant = rate.rate_in_cents === parent.rate_in_cents && rate.cost_in_cents === parent.cost_in_cents;

      if (isRedundant) {
         // Verificar si está en uso
         if (rate.items.length > 0) {
            console.log(`  ⚠️  Rate ${rate.id} is redundant but in use by ${rate.items.length} items`);
            console.log(`     Keeping to preserve historical data`);
            kept++;
         } else {
            // Seguro eliminar (no está en uso y es redundante)
            await prisma.shippingRate.update({
               where: { id: rate.id },
               data: { is_active: false },
            });

            console.log(`  ✅ Deactivated redundant rate ${rate.id}`);
            removed++;
         }
      }
   }

   console.log(`\n📊 Cleanup Summary:`);
   console.log(`   Removed: ${removed}`);
   console.log(`   Kept (in use): ${kept}`);
   console.log(`\n✅ Phase 4 completed`);
}

phase4_removeRedundant()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

---

## Scripts de Migración

### Script Completo de Migración

```javascript
// migrate-to-hierarchical-rates.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Import previous phase functions
const phase1_identifyBaseRates = require("./migration-phase1-identify-base-rates");
const phase2_establishHierarchy = require("./migration-phase2-establish-hierarchy");
const phase3_validateCascade = require("./migration-phase3-validate-cascade");
const phase4_removeRedundant = require("./migration-phase4-remove-redundant");

async function migrateToHierarchicalRates() {
   console.log("🚀 Starting Migration to Hierarchical Rates System\n");
   console.log("================================================\n");

   try {
      // Phase 1: Identify base rates
      await phase1_identifyBaseRates();
      console.log("\n---\n");

      // Phase 2: Establish hierarchy
      await phase2_establishHierarchy();
      console.log("\n---\n");

      // Phase 3: Validate cascade
      await phase3_validateCascade();
      console.log("\n---\n");

      // Phase 4: Remove redundant (optional)
      const readline = require("readline").createInterface({
         input: process.stdin,
         output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
         readline.question("\nRemove redundant rates? (y/n): ", resolve);
      });
      readline.close();

      if (answer.toLowerCase() === "y") {
         await phase4_removeRedundant();
      } else {
         console.log("Skipping redundant rate removal");
      }

      console.log("\n================================================");
      console.log("🎉 Migration completed successfully!\n");
   } catch (error) {
      console.error("\n❌ Migration failed:", error);
      throw error;
   }
}

migrateToHierarchicalRates()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

### Ejecutar Migración

```bash
# 1. Hacer backup
npm run backup-db

# 2. Ejecutar migración
node migrate-to-hierarchical-rates.js

# 3. Validar resultados
node validate-migration.js
```

---

## Validación Post-Migración

### Script de Validación Completa

```javascript
// validate-migration.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function validateMigration() {
   console.log("🔍 Validating Migration Results\n");

   const tests = [];

   // Test 1: Todas las tarifas base tienen is_base_rate = true
   const baseRatesCheck = await prisma.shippingRate.count({
      where: {
         agency_id: { not: null },
         is_base_rate: true,
         parent_rate_id: { not: null },
      },
   });

   tests.push({
      name: "No base rates should have parent_rate_id",
      passed: baseRatesCheck === 0,
      details: `Found ${baseRatesCheck} base rates with parent`,
   });

   // Test 2: Todas las tarifas no-base tienen parent_rate_id
   const orphanRates = await prisma.shippingRate.findMany({
      where: {
         is_base_rate: false,
         parent_rate_id: null,
         is_active: true,
      },
   });

   tests.push({
      name: "No orphan rates (non-base without parent)",
      passed: orphanRates.length === 0,
      details: `Found ${orphanRates.length} orphan rates`,
   });

   // Test 3: Cascada de precios correcta
   const cascadeErrors = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM shipping_rate child
    JOIN shipping_rate parent ON child.parent_rate_id = parent.id
    WHERE child.cost_in_cents != parent.rate_in_cents
      AND child.is_active = true
  `;

   tests.push({
      name: "Price cascade integrity",
      passed: cascadeErrors[0].count === 0,
      details: `Found ${cascadeErrors[0].count} cascade errors`,
   });

   // Test 4: Tarifas con margen positivo
   const negativeMargins = await prisma.shippingRate.count({
      where: {
         is_active: true,
         rate_in_cents: { lte: prisma.shippingRate.fields.cost_in_cents },
      },
   });

   tests.push({
      name: "All rates have positive margins",
      passed: negativeMargins === 0,
      details: `Found ${negativeMargins} rates with negative/zero margin`,
   });

   // Test 5: Resolver funciona correctamente
   let resolverWorks = true;
   try {
      const testAgencies = await prisma.agency.findMany({
         take: 5,
         where: { is_active: true },
      });

      for (const agency of testAgencies) {
         const services = await prisma.service.findMany({ take: 1 });
         if (services.length > 0) {
            // Importar servicio (ajustar path)
            const { shippingRatesService } = require("../src/services/shipping.rates.service");
            await shippingRatesService.resolveEffectiveRate(agency.id, services[0].id);
         }
      }
   } catch (error) {
      resolverWorks = false;
      console.error("Resolver error:", error.message);
   }

   tests.push({
      name: "Resolver service works",
      passed: resolverWorks,
      details: "Tested resolver on sample agencies",
   });

   // Imprimir resultados
   console.log("📊 Validation Results:\n");

   tests.forEach((test, i) => {
      const status = test.passed ? "✅" : "❌";
      console.log(`${status} Test ${i + 1}: ${test.name}`);
      console.log(`   ${test.details}\n`);
   });

   const allPassed = tests.every((t) => t.passed);

   if (allPassed) {
      console.log("🎉 All validation tests passed!");
   } else {
      console.log("⚠️  Some validation tests failed. Review above.");
   }

   return allPassed;
}

validateMigration()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

---

## Rollback

### Script de Rollback Completo

```javascript
// rollback-migration.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function rollbackMigration() {
   console.log("⏪ Rolling back hierarchical rates migration\n");

   const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
   });

   const confirm = await new Promise((resolve) => {
      readline.question("Are you sure you want to rollback? (yes/no): ", resolve);
   });
   readline.close();

   if (confirm !== "yes") {
      console.log("Rollback cancelled");
      return;
   }

   try {
      // 1. Remover parent_rate_id de todas las tarifas
      const result1 = await prisma.shippingRate.updateMany({
         where: { parent_rate_id: { not: null } },
         data: { parent_rate_id: null },
      });

      console.log(`✅ Removed parent_rate_id from ${result1.count} rates`);

      // 2. Desmarcar is_base_rate
      const result2 = await prisma.shippingRate.updateMany({
         where: { is_base_rate: true },
         data: { is_base_rate: false },
      });

      console.log(`✅ Unmarked ${result2.count} base rates`);

      // 3. Restaurar tarifas desactivadas en Phase 4
      const result3 = await prisma.shippingRate.updateMany({
         where: {
            is_active: false,
            updated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
         },
         data: { is_active: true },
      });

      console.log(`✅ Restored ${result3.count} deactivated rates`);

      console.log("\n✅ Rollback completed successfully");
   } catch (error) {
      console.error("❌ Rollback failed:", error);
      throw error;
   }
}

rollbackMigration()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

### Restaurar desde Backup

```bash
# Si el rollback no funciona, restaurar desde backup
psql -h your-host -U your-user -d your-database < backup_pre_migration_YYYYMMDD_HHMMSS.sql
```

---

## Checklist de Migración

### Pre-Migración

-  [ ] Backup de base de datos completo
-  [ ] Análisis de datos actuales ejecutado
-  [ ] Identificados problemas potenciales
-  [ ] Notificado a stakeholders
-  [ ] Planificada ventana de mantenimiento

### Durante Migración

-  [ ] Phase 1: Base rates identificadas
-  [ ] Phase 2: Jerarquía establecida
-  [ ] Phase 3: Cascada validada
-  [ ] Phase 4: Redundantes removidas (opcional)

### Post-Migración

-  [ ] Script de validación ejecutado exitosamente
-  [ ] Resolver funciona correctamente
-  [ ] Facturación usa nuevo sistema
-  [ ] Endpoints antiguos deprecados
-  [ ] Documentación actualizada
-  [ ] Equipo capacitado en nuevo sistema

---

## Troubleshooting

### Problema: Tarifas huérfanas después de migración

```sql
-- Encontrar tarifas huérfanas
SELECT * FROM shipping_rate
WHERE is_base_rate = false
  AND parent_rate_id IS NULL
  AND is_active = true;

-- Opción 1: Vincular manualmente a base rate
UPDATE shipping_rate
SET parent_rate_id = (
  SELECT id FROM shipping_rate
  WHERE is_base_rate = true
    AND service_id = shipping_rate.service_id
    AND forwarder_id = shipping_rate.forwarder_id
  LIMIT 1
)
WHERE is_base_rate = false
  AND parent_rate_id IS NULL;

-- Opción 2: Convertir en base rate
UPDATE shipping_rate
SET is_base_rate = true
WHERE parent_rate_id IS NULL
  AND agency_id IN (
    SELECT id FROM agency WHERE agency_type = 'FORWARDER'
  );
```

### Problema: Cascada rota

```javascript
// Reparar cascada rota
async function repairCascade() {
   const brokenRates = await prisma.$queryRaw`
    SELECT child.id, parent.rate_in_cents
    FROM shipping_rate child
    JOIN shipping_rate parent ON child.parent_rate_id = parent.id
    WHERE child.cost_in_cents != parent.rate_in_cents
  `;

   for (const rate of brokenRates) {
      await prisma.shippingRate.update({
         where: { id: rate.id },
         data: { cost_in_cents: rate.rate_in_cents },
      });
   }

   console.log(`Fixed ${brokenRates.length} rates`);
}
```

---

## Próximos Pasos Post-Migración

1. **Deprecar endpoints antiguos**

   -  Marcar como deprecated en documentación
   -  Agregar warnings en respuestas
   -  Planificar fecha de eliminación

2. **Actualizar integración de facturación**

   -  Usar `resolveEffectiveRate` en lugar de queries directas
   -  Actualizar `resolveItemsWithHbl` service

3. **Capacitación del equipo**

   -  Compartir documentación
   -  Demos en vivo
   -  Q&A sessions

4. **Monitoreo**
   -  Dashboard de tarifas activas
   -  Alertas de márgenes negativos
   -  Analytics de uso del resolver

---

## Soporte

Para asistencia con la migración:

-  Ver documentación completa: `docs/HIERARCHICAL_RATES_SYSTEM.md`
-  Ejemplos prácticos: `docs/HIERARCHICAL_RATES_EXAMPLES.md`
-  Código fuente: `src/services/shipping.rates.service.ts`
