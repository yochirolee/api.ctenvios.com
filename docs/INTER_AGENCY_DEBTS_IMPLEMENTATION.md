# Implementación de Sistema de Deudas Inter-Agencia en Despachos

## Fecha de Implementación

Fecha: $(date)

## Resumen

Se ha implementado un sistema completo de registro de deudas inter-agencia que se genera automáticamente cuando se completa un despacho. El sistema considera la jerarquía de agencias y los pagos previos para calcular correctamente las deudas.

## Cambios Realizados

### 1. Base de Datos (Schema Prisma)

**Archivo**: `prisma/schema.prisma`

-  ✅ Agregado modelo `InterAgencyDebt` con todos los campos necesarios
-  ✅ Agregado enum `DebtStatus` (PENDING, PAID, CANCELLED)
-  ✅ Agregadas relaciones en modelos `Agency`, `Dispatch`, y `User`

### 2. Utilidades de Jerarquía

**Archivo**: `src/utils/agency-hierarchy.ts` (NUEVO)

-  ✅ Función `getAgencyHierarchy()`: Obtiene la jerarquía completa de agencias
-  ✅ Función `determineHierarchyDebts()`: Calcula deudas jerárquicas considerando pagos previos
-  ✅ Manejo de casos edge (paquetes sin agency_id, sin pricing, etc.)

### 3. Repository de Deudas

**Archivo**: `src/repositories/inter-agency-debts.repository.ts` (NUEVO)

-  ✅ CRUD completo para deudas inter-agencia
-  ✅ Métodos para consultar por deudor, acreedor, y despacho
-  ✅ Método para marcar deudas como pagadas
-  ✅ Método para cancelar deudas por despacho

### 4. Modificaciones en Dispatch Repository

**Archivo**: `src/repositories/dispatch.repository.ts`

-  ✅ Modificado `completeDispatch()` para crear deudas automáticamente
-  ✅ Modificado `delete()` para cancelar deudas cuando se cancela un despacho DISPATCHED

### 5. Controller

**Archivo**: `src/controllers/inter-agency-debts.controller.ts` (NUEVO)

-  ✅ `getDebtsByDebtor()`: Obtener mis deudas (donde soy deudor)
-  ✅ `getDebtsByCreditor()`: Obtener mis cuentas por cobrar (donde soy acreedor)
-  ✅ `getDebtsByDispatch()`: Obtener deudas de un despacho específico
-  ✅ `markDebtAsPaid()`: Marcar deuda como pagada

### 6. Routes

**Archivo**: `src/routes/inter-agency-debts.routes.ts` (NUEVO)

-  ✅ `GET /api/v1/inter-agency-debts/my-debts`
-  ✅ `GET /api/v1/inter-agency-debts/my-receivables`
-  ✅ `GET /api/v1/inter-agency-debts/dispatch/:id`
-  ✅ `POST /api/v1/inter-agency-debts/:id/mark-paid`

### 7. Registros

-  ✅ Agregado export en `src/repositories/index.ts`
-  ✅ Agregado route en `src/routes/router.ts`

## Funcionalidades Implementadas

### Escenario 1: Hija → Padre

-  Cuando una hija envía paquetes a su padre, se crea deuda: HIJA debe a PADRE

### Escenario 2: Nieta → Abuelo (saltándose al padre)

-  Cuando una nieta envía directamente a su abuelo:
   -  Se crea deuda: NIETA debe a PADRE (por saltarse el nivel)
   -  Se crea deuda: NIETA debe a ABUELO

### Escenario 3: Hija paga → Padre envía al Abuelo

-  Si la hija ya pagó al padre:
   -  NO se crea deuda HIJA → ABUELO
   -  Solo se crea deuda PADRE → ABUELO (el padre asume responsabilidad)

### Escenario 4: Despacho con múltiples agencias

-  Un despacho puede contener paquetes de múltiples agencias
-  Cada agencia genera sus propias deudas según su jerarquía

## Estado de Implementación

### ✅ Completado

-  ✅ Prisma Client generado
-  ✅ Migración creada y aplicada: `20251223154132_add_inter_agency_debts`
-  ✅ Enums locales removidos y reemplazados por imports de `@prisma/client`
-  ✅ Todos los archivos actualizados y sin errores de linting

### Próximos Pasos para Producción

### 1. Aplicar Migración en Producción

```bash
npx prisma migrate deploy
```

### 2. Verificar Funcionamiento

-  Probar creación de despachos y verificar que se crean las deudas
-  Probar pagos de deudas
-  Probar cancelación de despachos y verificar que se cancelan las deudas

## Rollback

Si necesitas hacer rollback de estos cambios:

### 1. Revertir Schema

```bash
git checkout HEAD~1 prisma/schema.prisma
```

### 2. Eliminar Archivos Nuevos

```bash
rm src/utils/agency-hierarchy.ts
rm src/repositories/inter-agency-debts.repository.ts
rm src/controllers/inter-agency-debts.controller.ts
rm src/routes/inter-agency-debts.routes.ts
```

### 3. Revertir Modificaciones

```bash
git checkout HEAD~1 src/repositories/dispatch.repository.ts
git checkout HEAD~1 src/repositories/index.ts
git checkout HEAD~1 src/routes/router.ts
```

### 4. Revertir Migración (si se aplicó)

```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

## Notas Importantes

1. **Pagos Previos**: El sistema verifica si un paquete ya tiene deudas PAGADAS hacia el sender antes de crear nuevas deudas. Esto permite que el sender asuma la responsabilidad.

2. **Cancelación de Despachos**: Si se cancela un despacho DISPATCHED, todas las deudas relacionadas se marcan como CANCELLED automáticamente.

3. **Validaciones**: El sistema valida que:

   -  Los paquetes tengan `agency_id`
   -  Los paquetes tengan `order_items` con `pricing_agreement`
   -  El receiver esté en la jerarquía de la agencia original

4. **Transacciones**: Todas las operaciones de creación de deudas están dentro de transacciones para garantizar consistencia.

## Testing Recomendado

1. ✅ Crear despacho Hija → Padre y verificar deuda creada
2. ✅ Crear despacho Nieta → Abuelo y verificar dos deudas creadas
3. ✅ Pagar deuda de Hija → Padre
4. ✅ Crear despacho Padre → Abuelo con paquetes de Hija y verificar que solo se crea deuda PADRE → ABUELO
5. ✅ Cancelar despacho DISPATCHED y verificar que las deudas se cancelan
6. ✅ Consultar deudas por deudor y acreedor
