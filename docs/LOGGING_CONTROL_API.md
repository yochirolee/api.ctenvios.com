# Logging Control API

## Descripción

API para controlar el guardado de logs en la base de datos desde el frontend. Solo usuarios con roles `ROOT` o `ADMINISTRATOR` pueden acceder a estos endpoints.

## Endpoints

### 1. Obtener Estado del Logging

**GET** `/api/v1/config/logging`

Obtiene el estado actual del logging (habilitado/deshabilitado).

**Headers:**

```
Authorization: Bearer <token>
```

**Response 200:**

```json
{
   "logging_enabled": true,
   "message": "Logging is currently enabled"
}
```

**Ejemplo con fetch:**

```javascript
const response = await fetch("/api/v1/config/logging", {
   method: "GET",
   headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
   },
});

const data = await response.json();
console.log("Logging enabled:", data.logging_enabled);
```

---

### 2. Activar/Desactivar Logging

**PUT** `/api/v1/config/logging`

Activa o desactiva el guardado de logs en la base de datos.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
   "enabled": true
}
```

**Response 200:**

```json
{
   "logging_enabled": true,
   "message": "Logging has been enabled",
   "updated_by": "admin@example.com",
   "updated_at": "2024-01-15T10:30:00.000Z"
}
```

**Ejemplo con fetch - Activar:**

```javascript
const response = await fetch("/api/v1/config/logging", {
   method: "PUT",
   headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
   },
   body: JSON.stringify({
      enabled: true,
   }),
});

const data = await response.json();
console.log("Logging enabled:", data.logging_enabled);
```

**Ejemplo con fetch - Desactivar:**

```javascript
const response = await fetch("/api/v1/config/logging", {
   method: "PUT",
   headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
   },
   body: JSON.stringify({
      enabled: false,
   }),
});

const data = await response.json();
console.log("Logging disabled:", !data.logging_enabled);
```

---

### 3. Obtener Todas las Configuraciones

**GET** `/api/v1/config`

Obtiene todas las configuraciones de la aplicación.

**Headers:**

```
Authorization: Bearer <token>
```

**Response 200:**

```json
[
   {
      "key": "logging_enabled",
      "value": "true",
      "description": "Controls whether application logs are saved to database",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "updated_by": "admin@example.com"
   }
]
```

---

### 4. Obtener Configuración Específica

**GET** `/api/v1/config/:key`

Obtiene una configuración específica por su clave.

**Headers:**

```
Authorization: Bearer <token>
```

**Response 200:**

```json
{
   "key": "logging_enabled",
   "value": "true"
}
```

**Response 404:**

```json
{
   "message": "Configuration key 'invalid_key' not found"
}
```

---

### 5. Actualizar Configuración

**PUT** `/api/v1/config/:key`

Actualiza o crea una configuración específica.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
   "value": "true",
   "description": "Optional description"
}
```

**Response 200:**

```json
{
   "key": "logging_enabled",
   "value": "true",
   "description": "Controls logging",
   "updated_by": "admin@example.com",
   "updated_at": "2024-01-15T10:30:00.000Z"
}
```

---

## Ejemplo Completo en React

```typescript
import { useState, useEffect } from "react";

interface LoggingConfig {
   logging_enabled: boolean;
   message: string;
}

export const LoggingControl = () => {
   const [loggingEnabled, setLoggingEnabled] = useState<boolean>(true);
   const [loading, setLoading] = useState<boolean>(false);
   const token = localStorage.getItem("token"); // O tu método de obtener token

   // Cargar estado inicial
   useEffect(() => {
      fetchLoggingStatus();
   }, []);

   const fetchLoggingStatus = async () => {
      try {
         const response = await fetch("/api/v1/config/logging", {
            headers: {
               Authorization: `Bearer ${token}`,
            },
         });
         const data: LoggingConfig = await response.json();
         setLoggingEnabled(data.logging_enabled);
      } catch (error) {
         console.error("Error fetching logging status:", error);
      }
   };

   const toggleLogging = async (enabled: boolean) => {
      setLoading(true);
      try {
         const response = await fetch("/api/v1/config/logging", {
            method: "PUT",
            headers: {
               Authorization: `Bearer ${token}`,
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ enabled }),
         });

         if (response.ok) {
            const data: LoggingConfig = await response.json();
            setLoggingEnabled(data.logging_enabled);
            alert(data.message);
         } else {
            const error = await response.json();
            alert(`Error: ${error.message}`);
         }
      } catch (error) {
         console.error("Error toggling logging:", error);
         alert("Error al cambiar el estado del logging");
      } finally {
         setLoading(false);
      }
   };

   return (
      <div>
         <h2>Control de Logging</h2>
         <p>Estado actual: {loggingEnabled ? "✅ Habilitado" : "❌ Deshabilitado"}</p>
         <button onClick={() => toggleLogging(!loggingEnabled)} disabled={loading}>
            {loggingEnabled ? "Desactivar Logging" : "Activar Logging"}
         </button>
      </div>
   );
};
```

---

## Ejemplo con Axios

```typescript
import axios from "axios";

const api = axios.create({
   baseURL: "/api/v1",
   headers: {
      "Content-Type": "application/json",
   },
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
   const token = localStorage.getItem("token");
   if (token) {
      config.headers.Authorization = `Bearer ${token}`;
   }
   return config;
});

// Obtener estado del logging
export const getLoggingStatus = async () => {
   const response = await api.get("/config/logging");
   return response.data;
};

// Activar/desactivar logging
export const updateLoggingStatus = async (enabled: boolean) => {
   const response = await api.put("/config/logging", { enabled });
   return response.data;
};
```

---

## Permisos Requeridos

-  **Roles permitidos**: `ROOT`, `ADMINISTRATOR`
-  **Autenticación**: Requerida (Bearer token)

## Comportamiento

-  Cuando el logging está **deshabilitado**, los logs **NO** se guardan en la base de datos
-  Los logs siguen apareciendo en la **consola** (para debugging)
-  El cambio es **inmediato** (no requiere reiniciar el servidor)
-  La configuración se almacena en la base de datos y persiste entre reinicios
-  El estado se cachea en memoria para mejor rendimiento (se actualiza cada 30 segundos automáticamente)

## Notas Importantes

1. **Por defecto**, el logging está **habilitado** (`logging_enabled = true`)
2. Desactivar el logging puede ayudar a **reducir la carga en la base de datos** durante períodos de alto tráfico
3. Se recomienda mantener el logging habilitado en **producción** para debugging y auditoría
4. El cambio es **reversible** en cualquier momento desde el frontend
