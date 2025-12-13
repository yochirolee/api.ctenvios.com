# Sistema de Logging Completo con Winston

## Descripción

El sistema ahora registra **todos los logs** (no solo errores) en la base de datos usando Winston. Esto proporciona un registro completo de actividad de la aplicación para análisis, debugging y auditoría.

## Arquitectura

### Componentes Principales

1. **Winston Logger** (`src/utils/logger.ts`)

   -  Logger principal configurado con niveles personalizados
   -  Transports: Console (desarrollo) y Database (producción)

2. **Database Transport** (`src/utils/database-transport.ts`)

   -  Transport personalizado que escribe logs a PostgreSQL
   -  Maneja errores de logging sin bloquear la aplicación

3. **AppLog Model** (`prisma/schema.prisma`)

   -  Modelo de base de datos para almacenar logs
   -  Incluye niveles, fuente, contexto de request, etc.

4. **HTTP Logger Middleware** (`src/middlewares/http-logger.middleware.ts`)
   -  Middleware que registra automáticamente todas las requests HTTP

## Niveles de Log

-  **ERROR**: Errores críticos que requieren atención
-  **WARN**: Advertencias (requests lentas, problemas potenciales)
-  **HTTP**: Todas las requests HTTP (GET, POST, etc.)
-  **INFO**: Información general de la aplicación
-  **DEBUG**: Información detallada para debugging

## Configuración por Ambiente

### Desarrollo

-  **Console**: Todos los niveles (debug y arriba)
-  **Database**: Todos los niveles (debug y arriba)

### Producción

-  **Console**: Solo info y arriba
-  **Database**: Solo HTTP y arriba (HTTP, WARN, ERROR)

## Uso del Logger

### Logger Básico

```typescript
import { logger } from "../utils/logger";

// Logging simple
logger.info("Usuario creado exitosamente");
logger.error("Error al procesar pago");
logger.warn("Request lenta detectada");
logger.debug("Detalles de debug");
```

### Logger con Contexto de Request

```typescript
import { createRequestLogger } from "../utils/logger";

// En un controller o middleware
router.post("/users", async (req, res) => {
   const requestLogger = createRequestLogger(req);

   requestLogger.info("Creando nuevo usuario", {
      email: req.body.email,
      role: req.body.role,
   });

   // ... código del controller
});
```

### Logger con Metadata Personalizada

```typescript
logger.error("Error en procesamiento de orden", {
   source: "orders",
   orderId: order.id,
   userId: user.id,
   details: {
      error: error.message,
      stack: error.stack,
   },
});
```

## Middleware Automático

El middleware `httpLoggerMiddleware` registra automáticamente:

-  Todas las requests HTTP entrantes
-  Status code de respuesta
-  Método HTTP
-  Path
-  IP address
-  User agent
-  User ID y email (si está autenticado)

## Consultar Logs

### Obtener todos los logs

```typescript
import repository from "../repositories";

const logs = await repository.appLogs.getAll(100, 0);
```

### Filtrar por nivel

```typescript
const errorLogs = await repository.appLogs.getByLevel(LogLevel.ERROR, 50, 0);
```

### Filtrar por fuente

```typescript
const httpLogs = await repository.appLogs.getBySource("http", 100, 0);
```

### Estadísticas

```typescript
const stats = await repository.appLogs.getStats();
// Retorna:
// - total_logs
// - logs_last_hour
// - logs_last_day
// - logs_last_week
// - logs_by_level
// - logs_by_source
```

## Campos Disponibles en AppLog

-  `level`: Nivel del log (ERROR, WARN, HTTP, INFO, DEBUG)
-  `message`: Mensaje del log
-  `source`: Fuente del log (http, prisma, application, system, auth, database)
-  `code`: Código de error (opcional)
-  `status_code`: HTTP status code (opcional)
-  `details`: JSON con detalles adicionales
-  `stack`: Stack trace (para errores)
-  `path`: Path de la request
-  `method`: Método HTTP
-  `ip_address`: IP del cliente
-  `user_agent`: User agent del cliente
-  `user_id`: ID del usuario (si está autenticado)
-  `user_email`: Email del usuario (si está autenticado o intentando autenticarse)
-  `created_at`: Timestamp del log

## Migración de Base de Datos

Después de agregar el modelo AppLog, ejecuta:

```bash
npx prisma migrate dev --name add_app_log_model
```

O en producción:

```bash
npx prisma migrate deploy
```

## Ventajas del Sistema Completo

1. **Registro Completo**: No solo errores, sino toda la actividad
2. **Contexto Rico**: Cada log incluye información del request y usuario
3. **Búsqueda y Análisis**: Fácil consultar logs por nivel, fuente, usuario, etc.
4. **Auditoría**: Registro completo de quién hizo qué y cuándo
5. **Debugging**: Stack traces y detalles completos para debugging
6. **Performance**: Logging asíncrono que no bloquea requests
7. **Escalable**: Fácil agregar nuevos niveles o fuentes

## Mejores Prácticas

1. **Usa niveles apropiados**: ERROR para errores críticos, INFO para eventos importantes
2. **Incluye contexto**: Siempre incluye información relevante en metadata
3. **No loguees información sensible**: Evita passwords, tokens, datos personales sensibles
4. **Usa requestLogger en controllers**: Para tener contexto automático del request
5. **Revisa logs regularmente**: Usa las estadísticas para monitorear la salud de la app

## Ejemplo Completo

```typescript
import { createRequestLogger } from "../utils/logger";
import { Request, Response } from "express";

router.post("/orders", authMiddleware, async (req: any, res: Response) => {
   const requestLogger = createRequestLogger(req);

   try {
      requestLogger.info("Creando nueva orden", {
         source: "orders",
         customerId: req.body.customer_id,
      });

      const order = await repository.orders.create(req.body);

      requestLogger.info("Orden creada exitosamente", {
         source: "orders",
         orderId: order.id,
      });

      res.status(201).json(order);
   } catch (error) {
      requestLogger.error("Error al crear orden", {
         source: "orders",
         error: error instanceof Error ? error.message : "Unknown error",
         stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({ message: "Error al crear orden" });
   }
});
```
