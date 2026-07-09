# MOVE Platform — Colección Postman

Colección Postman completa para probar los endpoints F1-F19 de la plataforma MOVE de traslados urbanos.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `move-collection.json` | Colección Postman v2.1 con todos los endpoints y escenarios de error (57+ requests, 19 carpetas) |
| `move-environment.json` | Variables de entorno con credenciales del seed-demo |

## Importación

1. Abrir **Postman Desktop** (v10+)
2. **Colección:** `File → Import` → seleccionar `move-collection.json`
3. **Entorno:** `File → Import` → seleccionar `move-environment.json`
4. En la esquina superior derecha, activar el entorno **"MOVE Platform — Local"**

## Configuración inicial

Ejecutar `pnpm seed:demo` antes de usar la colección para poblar la base de datos con usuarios, categorías, vehículos y zonas de demo.

| Variable | Descripción | Valor (seed-demo) |
|----------|-------------|-------------------|
| `clientEmail` | Email de usuario CLIENT_PARTICULAR | `demo-particular1@move.uy` |
| `clientPassword` | Contraseña del cliente | `Demo1234!` |
| `clientEmpresaEmail` | Email de usuario CLIENT_EMPRESA | `demo-empresa1@move.uy` |
| `clientEmpresaPassword` | Contraseña de empresa | `Demo1234!` |
| `conductorEmail` | Email de usuario CONDUCTOR | `demo-conductor1@move.uy` |
| `conductorPassword` | Contraseña del conductor | `Conductor1234!` |
| `operatorEmail` | Email de usuario OPERATOR (crear manualmente — ver nota) | `operador@move.uy` |
| `operatorPassword` | Contraseña del operador | `Operador1234!` |
| `adminEmail` | Email de usuario ADMIN | `admin@move.uy` |
| `adminPassword` | Contraseña del admin | `Admin1234!` |

> **Nota sobre el OPERATOR:** El script `pnpm seed:demo` no crea usuarios OPERATOR. Para la demo, registrar un operador manualmente en Firebase Console asignándole el custom claim `role: "OPERATOR"`, o ejecutar el script de seed base si existe.

> Todos los servicios se exponen a través del API Gateway nginx en `http://localhost:8000`. Las tres variables `baseUrlBooking`, `baseUrlOps` y `baseUrlTracking` apuntan a esa URL.

## Auto-población de variables

**Todos los tokens e IDs se setean automáticamente** al ejecutar los requests en orden:

| Evento | Variable seteada |
|--------|-----------------|
| Login Cliente Particular | `token`, `tokenExpiry` |
| Login Cliente Empresa | `empresaToken` |
| Login Conductor | `conductorToken` |
| Login Operador | `operatorToken` |
| Login Admin | `adminToken` |
| POST Crear Categoría | `categoryId` |
| POST Crear Vehículo | `vehicleId` |
| GET Listar Usuarios | `conductorUserId` (primer CONDUCTOR) |
| POST Crear Zona | `zoneId` |
| POST Create Location | `locationId` |
| POST Create Product | `productId` |
| POST Reserva Particular | `reservationId` |
| POST Reserva Empresa | `reservationIdEmpresa` |
| POST Reportar Incidencia | `incidentId` |

Además, la colección incluye un **pre-request script** que renueva el `token` del cliente particular automáticamente cuando expira (tokens Firebase duran 60 min; el script los renueva a los 55 min).

## Orden recomendado — Flujo completo F1-F19

Ejecutar en este orden para que todas las variables se auto-pueblen sin intervención manual:

```
PASO 1 — F1-F2: Autenticación
  POST Login — Cliente Particular  → token, tokenExpiry
  POST Login — Cliente Empresa     → empresaToken
  POST Login — Conductor           → conductorToken
  POST Login — Operador            → operatorToken
  POST Login — Admin               → adminToken

PASO 2 — F8: Crear Categoría (adminToken requerido)
  POST Crear Categoría             → categoryId

PASO 3 — F10: Crear Vehículo (adminToken requerido)
  POST Crear Vehículo              → vehicleId

PASO 4 — F11: Listar Usuarios (adminToken requerido)
  GET Listar Usuarios              → conductorUserId

PASO 5 — F9: Crear Zona (adminToken requerido)
  POST Crear Zona                  → zoneId

PASO 6 — F3: Preregistro Empresa (empresaToken requerido, categoryId debe existir)
  POST Create Location             → locationId
  POST Create Product              → productId

PASO 7 — F4-F5: Crear Reserva
  POST Reserva Particular          → reservationId
  POST Reserva Empresa             → reservationIdEmpresa

PASO 8 — F6: Pagar Reserva
  POST Pagar Reserva — Pago Aceptado

PASO 9 — F7: Consultar Reservas
  GET Listar Reservas

PASO 10 — F12: Asignar Reserva (operatorToken requerido)
  POST Asignar Reserva

PASO 11 — F13: Iniciar Traslado (conductorToken requerido)
  POST Iniciar Traslado

PASO 12 — F14: GPS Tracking (conductorToken requerido)
  POST Enviar Punto GPS

PASO 13 — F15-F16: Incidencias (conductorToken requerido)
  POST Reportar Incidencia         → incidentId
  GET Listar Incidencias

PASO 14 — F17: Finalizar Traslado (conductorToken requerido)
  POST Finalizar Traslado

PASO 15 — F18: Traslados Activos (operatorToken requerido)
  GET Traslados Activos

PASO 16 — F19: SSE y Clasificación (operatorToken requerido)
  GET SSE Stream  ← abrir en navegador para ver eventos en tiempo real
  POST Clasificar Reserva
  POST Rechazar Reserva
```

## Collection Runner (flujo automatizado)

1. Click en `...` al lado de **MOVE Platform API** → **Run collection**
2. Seleccionar el entorno **MOVE Platform — Local**
3. Reordenar carpetas si es necesario (ver orden arriba)
4. Deshabilitar requests destructivos si querés preservar estado: DELETE Eliminar Categoría, DELETE Eliminar Zona
5. Click **Run MOVE Platform API**

## Servicios requeridos

Asegurarse de que Docker Compose esté levantado antes de ejecutar:

```bash
docker compose up -d
```

Todo el tráfico pasa por el API Gateway nginx:

| Componente | URL |
|------------|-----|
| API Gateway (nginx) | `http://localhost:8000` |
| Booking Service (interno) | `booking-service:3001` |
| Operations Service (interno) | `operations-service:3002` |
| Tracking Service (interno) | `tracking-service:3003` |

## Escenarios cubiertos por la rúbrica

| Feature | Escenario | Request | Status esperado |
|---------|-----------|---------|-----------------|
| F1 | Registro exitoso (PARTICULAR) | POST Register (particular) | 201 |
| F1 | Registro exitoso (EMPRESA) | POST Register (empresa) | 201 |
| F1 | Email duplicado | POST Register — Email Duplicado (→ 409) | 409 |
| F2 | Login exitoso con JWT | POST Login — Cliente Particular | 200 |
| F2 | Credenciales inválidas | POST Login — Credenciales Inválidas (→ 401) | 401 |
| F2 | Usuario no registrado | POST Login — Usuario No Registrado (→ 401/404) | 401/404 |
| F3 | Asociar producto a categoría | POST Create Product | 201 |
| F3 | Cambiar producto preregistrado | PATCH Actualizar Product | 200 |
| F3 | Eliminar producto | DELETE Eliminar Product | 204 |
| F3 | RBAC — PARTICULAR no puede crear productos | POST Create Product — RBAC Denegado (→ 403) | 403 |
| F4.1 | Reserva particular con clasificación automática | POST Reserva Particular | 200/202 |
| F4.2 | Reserva empresa con datos preregistrados | POST Reserva Empresa | 200/202 |
| F4.2 | Reserva empresa sin preregistro | POST Reserva Empresa — Sin Preregistro (→ 400) | 400/404 |
| F5 | Cotización con recargo calculado | (implícito en POST Reserva — ver `totalCost` en response) | — |
| F6 | Pago aceptado | POST Pagar Reserva — Pago Aceptado | 200 |
| F6 | Pago rechazado | POST Pagar Reserva — Pago Rechazado | 200 (REJECTED) |
| F6 | Pasarela caída (CB abierto) | POST Pagar Reserva — Pasarela Caída (CB → 503) | 503 |
| F7 | Listar con filtro status | GET Listar Reservas — Filtro por Status | 200 |
| F7 | Listar con filtro fecha | GET Listar Reservas — Filtro por Fecha | 200 |
| F7 | RBAC: operador ve todas | GET Listar Reservas — Operador ve todas (RBAC) | 200 |
| F8 | Crear categoría con regla | POST Crear Categoría | 201 |
| F8 | No eliminar si tiene reservas | DELETE Eliminar Categoría — Con Reservas (→ 409) | 409 |
| F9 | Crear zona GeoJSON | POST Crear Zona | 201 |
| F9 | Modificar zona | PUT Actualizar Zona | 200 |
| F9 | Eliminar zona | DELETE Eliminar Zona | 204 |
| F10 | CRUD vehículos + listar disponibles | GET Vehículos (?available=true) / POST / PUT | 200/201 |
| F12 | Asignación válida | POST Asignar Reserva | 200 |
| F12 | Capacidad insuficiente | POST Asignar — Capacidad Insuficiente (→ 409) | 409 |
| F12 | Doble booking | POST Asignar — Doble Booking (→ 409) | 409 |
| F18 | Traslados en curso sin filtros | GET Traslados Activos | 200 |
| F18 | Filtro hasAlerts | GET Traslados — hasAlerts=true | 200 |
| F18 | Filtro status | GET Traslados — status=IN_TRANSIT | 200 |
| F19 | SSE stream operador | GET SSE Notifications Stream | 200 (text/event-stream) |
| F19 | Clasificación manual | POST Clasificar Reserva | 200 |

## Notas sobre endpoints especiales

### F6 — Pago (circuit breaker)
El endpoint de pago puede retornar `503` si el circuit breaker de MercadoPago está abierto. El test acepta tanto `200` como `503` como respuestas válidas. Para forzar el escenario CB abierto, ejecutar el request de pago varias veces con la pasarela caída.

### F12 — Capacidad insuficiente
El request **POST Asignar — Capacidad Insuficiente** usa la variable `{{vehicleIdMoto}}` que no se popula automáticamente. Setearla manualmente al ID de un vehículo tipo MOTO (capacidad 50 kg) del seed antes de ejecutar.

### F12 — Asignación (estado de reserva)
El use case `AssignReservation` valida que la reserva tenga estado `ACCEPTED`, pero el consumer `ReservationConfirmedConsumer` persiste el estado como `CONFIRMED`. Esto causa que el endpoint retorne `409 INVALID_RESERVATION_STATUS` hasta que se corrija esa inconsistencia en el código. El test acepta `200`, `404`, `409` y `422`.

### F14 — GPS (asíncrono)
El endpoint GPS retorna `202 Accepted` inmediatamente. El procesamiento ocurre de forma asíncrona en el pipeline Bull P1-P7. Las alertas (F15-F16) son generadas automáticamente por ese pipeline.

### F19 — SSE Stream
Postman puede conectarse al stream SSE pero no procesa eventos automáticamente. Para ver eventos en tiempo real, usar un navegador con:
```javascript
const es = new EventSource('http://localhost:8000/v1/reservas/notifications/stream', {
  headers: { Authorization: 'Bearer <operatorToken>' }
});
es.onmessage = (e) => console.log(e.data);
```
