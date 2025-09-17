# CTEnvios Invoice Creation - Stress Testing Guide

## Overview

Esta guía describe cómo ejecutar tests de stress para la creación de invoices en el sistema
CTEnvios. Los tests están diseñados para evaluar el rendimiento del endpoint `/api/invoices` bajo
diferentes cargas de trabajo.

## Configuración de Tests

### Prerequisitos

1. **Base de datos con datos de prueba**:

   ```bash
   yarn seed
   yarn seed-provinces
   yarn seed-custom-tariffs
   yarn seed-receipts
   yarn seed-customs-rates
   ```

2. **Servidor ejecutándose**:
   ```bash
   yarn dev
   ```

## Tipos de Tests de Stress

### 1. Tests con Jest (Recomendado para desarrollo)

#### Test Secuencial (Baseline)

```bash
# Ejecutar solo tests de stress de forma secuencial
yarn test:stress
```

#### Test Concurrente

```bash
# Ejecutar tests con múltiples workers
yarn test:stress-concurrent
```

#### Tests Específicos

```bash
# Ejecutar test específico
npx jest src/tests/stress/invoiceCreation.stress.test.ts --verbose
```

### 2. Tests con Artillery (Recomendado para producción)

#### Test Completo de Carga

```bash
# Ejecutar configuración completa de Artillery
yarn artillery:test
```

#### Test Rápido

```bash
# Test rápido: 50 requests con 5 usuarios concurrentes
yarn artillery:quick
```

#### Test Personalizado

```bash
# Test con configuración personalizada
artillery run artillery-test.yml --target http://localhost:3000
```

## Configuración de Tests

### Escenarios de Test Jest

1. **Sequential Creation** (50 invoices)

   - Creación secuencial para establecer baseline
   - Métricas: tiempo de respuesta promedio, min/max

2. **Concurrent Creation** (100 invoices, 10 concurrent)

   - Test de concurrencia moderada
   - Expectativa: >90% de éxito

3. **High-Load Concurrent** (200 invoices, 20 concurrent)

   - Test de carga máxima
   - Expectativa: >80% de éxito

4. **Complex Invoice Creation** (60 invoices mixtos)

   - Invoices simples (1 item), medianos (2-5 items), complejos (6-15 items)
   - Expectativa: >85% de éxito

5. **Agency-Specific Load** (75 invoices distribuidos)
   - Test de distribución por agencias
   - Expectativa: >90% de éxito

### Configuración Artillery

- **Warm up**: 30s @ 5 users/sec
- **Sustained load**: 60s @ 15 users/sec
- **Peak load**: 30s @ 25 users/sec
- **Maximum stress**: 60s @ 40 users/sec

## Métricas Monitoreadas

### Jest Tests

- **Total Requests**: Número total de requests enviados
- **Success Rate**: Porcentaje de requests exitosos
- **Average Response Time**: Tiempo de respuesta promedio
- **Min/Max Response Time**: Tiempos mínimo y máximo
- **Requests per Second**: Throughput del sistema
- **Concurrent Users**: Usuarios concurrentes simulados

### Artillery Tests

- **HTTP response time**: Tiempo de respuesta HTTP
- **Request rate**: Tasa de requests por segundo
- **Response codes**: Distribución de códigos de respuesta
- **Errors**: Tipos y cantidad de errores

## Interpretación de Resultados

### Benchmarks Esperados

#### Performance Aceptable

- **Response Time**: < 2000ms promedio
- **Success Rate**: > 90% para concurrencia moderada
- **Success Rate**: > 80% para alta concurrencia
- **Throughput**: > 10 requests/sec

#### Performance Óptima

- **Response Time**: < 1000ms promedio
- **Success Rate**: > 95% para concurrencia moderada
- **Success Rate**: > 90% para alta concurrencia
- **Throughput**: > 20 requests/sec

### Indicadores de Problemas

1. **Alta tasa de errores** (>20%)

   - Posible sobrecarga de base de datos
   - Problemas de conexión
   - Timeouts en transacciones

2. **Tiempos de respuesta altos** (>5000ms)

   - Contención de recursos
   - Queries lentas
   - Problemas de concurrencia en HBL generation

3. **Errores de duplicación de HBL**
   - Race conditions en generación de tracking codes
   - Problemas de atomicidad en transacciones

## Optimizaciones Implementadas

### En el Código

1. **Transaction Timeout**: 30 segundos para operaciones complejas
2. **HBL Generation**: Generación atómica con retry logic
3. **Bulk Operations**: Procesamiento eficiente de múltiples items
4. **Connection Pooling**: Gestión eficiente de conexiones de DB

### En los Tests

1. **Batch Processing**: Requests agrupados para evitar sobrecarga
2. **Progressive Delays**: Pausas entre batches para estabilidad
3. **Timeout Protection**: Timeouts para evitar tests colgados
4. **Realistic Data**: Datos de prueba realistas usando Faker

## Troubleshooting

### Errores Comunes

1. **"No agencies found"**

   ```bash
   # Ejecutar seeds de datos
   yarn seed
   ```

2. **"Test data not initialized"**

   - Verificar conexión a base de datos
   - Asegurar que las tablas tienen datos

3. **"Request timeout"**

   - Reducir concurrencia en tests
   - Verificar performance de base de datos
   - Aumentar timeouts en configuración

4. **"Artillery processor error"**
   ```bash
   # Instalar dependencias de Artillery
   yarn add -D @faker-js/faker
   ```

### Monitoreo Durante Tests

1. **Base de Datos**:

   ```sql
   -- Monitorear conexiones activas
   SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';

   -- Monitorear locks
   SELECT * FROM pg_locks WHERE NOT granted;
   ```

2. **Sistema**:
   - CPU usage
   - Memory usage
   - Network I/O
   - Disk I/O

## Tests Configurados para tu Entorno

### Datos de Producción Utilizados

- **Agency ID**: 1 (tu agencia principal)
- **User ID**: R5KTYKBbQhiSSoA8iT7KD3BnGSwJ376Q (tu usuario)
- **Customers**: 200 customers reales de tu base de datos
- **Receivers**: 200 receivers reales de tu base de datos
- **Services**: Todos los servicios disponibles
- **Customs Rates**: 200 tarifas aduanales reales

### Tests Específicos Creados

#### 1. Tests Realistas con Datos de Producción

```bash
# Test realista con tus datos reales
npx jest src/tests/stress/realisticInvoiceCreation.stress.test.ts --verbose
```

**Incluye 4 escenarios:**

1. **Sequential Load** (100 invoices) - Baseline con datos reales
2. **Concurrent Load** (150 invoices, 15 concurrent) - Simulando múltiples usuarios
3. **Peak Load** (300 invoices, 25 concurrent) - Carga máxima realista
4. **Usage Pattern** (100 invoices mixtos) - Patrón de uso real: 70% simple, 25% medio, 5% complejo

#### 2. Tests Genéricos (para comparación)

```bash
# Tests genéricos originales
npx jest src/tests/stress/invoiceCreation.stress.test.ts --verbose
```

## Comandos de Referencia Rápida

```bash
# Setup inicial
yarn install
yarn seed
yarn seed-customs-rates

# Tests de desarrollo con DATOS REALES
yarn test:stress                    # Todos los stress tests
npx jest realisticInvoiceCreation   # Solo tests realistas

# Tests de producción con DATOS REALES
yarn artillery:test                 # Full Artillery test (usa tu agency_id y user_id)
yarn artillery:quick               # Quick Artillery test

# Monitoreo
yarn test:coverage                 # Coverage report
yarn test:watch                    # Watch mode
```

## Métricas Específicas Monitoreadas

### Para tu Entorno de Producción

- **HBL Code Generation**: Tracking de códigos generados y duplicados
- **Agency-Specific Load**: Rendimiento específico para Agency ID 1
- **Real Data Performance**: Tiempos con customers/receivers reales
- **Concurrent User Simulation**: Simulación realista de múltiples usuarios

## Próximos Pasos

1. **Implementar métricas en tiempo real** con Prometheus/Grafana
2. **Tests de carga en staging** antes de deploy
3. **Alerting automático** para degradación de performance
4. **Optimización de queries** basada en resultados de tests
5. **Implementar circuit breakers** para alta disponibilidad
