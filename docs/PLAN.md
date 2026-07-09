# MOVE Platform — Plan de Implementación

**Fecha**: 2026-05-14
**Entrega**: 2026-06-25 (42 días)
**Equipo**: Nicolás (305108), Santiago (282542), Felipe (281987)

---

## Fase 0 — Setup del proyecto (Semana 1: 14-18 mayo)

> Todos contribuyen. Base para que cada uno pueda trabajar independiente.

| #    | Tarea                                | Detalle                                                                                                                                                  | Responsable |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 0.1  | Monorepo pnpm workspace + tsconfig  | `pnpm-workspace.yaml` con `packages/*`. `tsconfig.base.json` con strict mode, paths aliases. Cada servicio extiende con `extends`                        | Nicolás     |
| 0.2  | Shared package (`@move/shared`)      | Tipos compartidos: `Role`, `ReservationStatus`, `AlertType`, interfaces de eventos RabbitMQ (`ReservationClassifiedEvent`, `AlertCreatedEvent`, etc.), constantes de colas Bull | Nicolás     |
| 0.3  | Docker Compose infra                 | Contenedores: postgres (postgis/postgis:16-3.4), redis:7, rabbitmq:3.13, ollama. Volumes, health checks, red interna `move-network`                     | Nicolás     |
| 0.4  | Scaffold booking-service             | Estructura Clean Arch (domain/application/infrastructure/presentation), Express app, inversify.config.ts, Dockerfile, health check GET /health           | Nicolás     |
| 0.5  | Scaffold operations-service          | Misma estructura que booking. Express app, inversify.config.ts, Dockerfile, health check GET /health                                                     | Felipe      |
| 0.6  | Scaffold tracking-service            | Misma estructura que booking. Express app, inversify.config.ts, Dockerfile, health check GET /health                                                     | Santiago    |
| 0.7  | ESLint + Prettier                    | `.eslintrc.json` y `.prettierrc` en raíz. Scripts `lint`, `lint:fix`, `format` en cada package.json. Reglas: no-unused-vars, no-explicit-any, import order | Nicolás     |
| 0.8  | Auth middleware compartido           | Middleware Firebase JWT: verifica token, extrae `uid` + `role` de custom claims. Middleware RBAC: `authorize(...roles)` que chequea el rol. En `@move/shared` o en cada servicio | Nicolás     |
| 0.9  | .env.example + docker-compose svcs   | `.env.example` con todas las vars. Docker Compose agrega los 3 servicios + ai-worker + gps-simulator con depends_on y health checks                      | Nicolás     |
| 0.10 | API Gateway nginx                    | `nginx.conf` con upstream para cada servicio. Routing: `/api/reservas/*` → booking, `/api/operaciones/*` → operations, `/api/tracking/*` → tracking      | Nicolás     |

**Entregable Fase 0**: `docker compose up` levanta toda la infra + 3 servicios respondiendo `GET /health` → `200 OK`.

---

## Fase 1 — Funcionalidades base (Semana 2-3: 19 mayo - 1 junio)

### Nicolás — booking-service

| #   | Feature                          | Detalle                                                                                                                                                                                                                                                                      | F/R   | Prioridad |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------- |
| 1.1 | Prisma schema booking            | Tablas: `clients` (id, firebaseUid, role, type, name, email), `reservations` (id, clientId, origin, destination, date, status, cost, vehicleId, conductorId), `goods` (id, reservationId, description, value, size, categoryId), `payments` (id, reservationId, amount, status, paidAt). Índices en (clientId, status, date) para F7/R2 | -     | Alta      |
| 1.2 | F1 — Registro de cliente         | `POST /api/usuarios/register`. Recibe type (EMPRESA\|PARTICULAR), datos personales. Crea usuario en Firebase Auth con custom claim `role`. Persiste en tabla `clients` con `firebaseUid`. Valida email único. Retorna 201 con datos del cliente (sin password). Zod schema para validar input. **Tests de dominio y application completados (TDD). Tests de integración HTTP diferidos a 3.8** (requieren Firebase emulator) | F1    | Alta      |
| 1.3 | F2 — Ingreso                     | `POST /api/usuarios/login`. Recibe email + password. Llama a Firebase Auth `signInWithEmailAndPassword`. Retorna JWT. Valida credenciales inválidas → 401, usuario no registrado → 404. Audit log de intentos fallidos con Winston. **Tests de dominio y application completados (TDD). Tests de integración HTTP diferidos a 3.8** (requieren Firebase emulator) | F2    | Alta      |
| 1.4 | F3 — Preregistro empresa         | `POST /api/empresas/:id/productos` — asociar producto a categoría MOVE. `PUT /api/empresas/:id/productos/:prodId` — cambiar asociación. `DELETE /api/empresas/:id/productos/:prodId` — eliminar. `GET /api/empresas/:id/productos` — listar. RBAC: solo CLIENT_EMPRESA. Tablas: `company_products` (id, clientId, name, categoryId), `company_locations` (id, clientId, name, address, lat, lng) | F3    | Alta      |
| 1.5 | F4.2 — Crear reserva empresa     | `POST /api/reservas`. RBAC: CLIENT_EMPRESA. Valida fecha futura, al menos 1 bien. Para cada bien: busca en `company_products` por productId → obtiene categoryId preregistrado. Si no encuentra producto preregistrado → 400. Crea reserva en estado PENDING_QUOTE. Llama a F5 cotización. Retorna reserva con costo y status QUOTED | F4.2  | Alta      |
| 1.6 | F5 — Cotizar reserva             | Use case `QuoteReservation`. Carga `pricing_rules` de DB (o cache en memoria). Calcula costo según: distancia (mock de servicio geo), categoría, reglas de recargo (F8). Persiste costo en reserva. Endpoint de recarga en caliente `POST /api/admin/pricing/reload` sin reiniciar servicio | F5    | Alta      |
| 1.7 | F6 — Confirmar y pagar           | `POST /api/reservas/:id/pagar`. Valida reserva en estado QUOTED. Llama a `IPaymentGateway.charge(amount)` wrapeado con opossum circuit breaker. OK → ACCEPTED, reserva → CONFIRMED. Rechaza → REJECTED + motivo. CB abierto → 503, reserva queda PENDING_PAYMENT. Mock: `MockPaymentGateway` que simula aceptar/rechazar/timeout | F6    | Alta      |
| 1.8 | F7 — Consultar reservas          | `GET /api/reservas?status=X&dateFrom=Y&dateTo=Z`. RBAC: CLIENT (solo sus reservas), OPERATOR (todas). Paginación cursor-based. Incluye: bienes, categoría, costo, estado, vehículo/conductor. Respuesta <500ms (R2)    | F7    | Media     |
| 1.9 | Cache Redis top-20               | Cache-aside: `SET top20:clients` con los 20 clientes con más reservas/semana (TTL 7 días). Job semanal Bull que recalcula. En F4.2: si clientId en top-20 → Redis (<600ms). Si no → DB directo (700-1000ms). Fallback si Redis caído → DB siempre | R1    | Alta      |

### Santiago — tracking-service

| #    | Feature                          | Detalle                                                                                                                                                                                                                                                                       | F/R   | Prioridad |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 1.10 | Prisma schema tracking           | Tablas: `transfers` (id, reservationId, vehicleId, conductorId, status, startedAt, finishedAt), `gps_points` (id, deviceId, transferId, lat, lng, timestamp, BRIN index), `alerts` (id, transferId, type, lat, lng, message, timestamp, UNIQUE constraint), `incidents` (id, transferId, conductorId, description, timestamp). PostGIS habilitado | -     | Alta      |
| 1.11 | F14 — Recibir GPS                | `POST /api/gps`. Auth por device token (no JWT usuario). Recibe `{ deviceId, lat, lng, timestamp }`. Zod: deviceId registrado, lat/lng en rango, timestamp no futuro. Válido → encola en Bull `gps-pipeline-p1`. Inválido → 400. Respuesta rápida al dispositivo (no espera procesamiento) | F14   | Alta      |
| 1.12 | Pipeline P1-P3                   | **P1 Validation**: device registrado, descarta duplicados por (deviceId + timestamp). **P2 Enrichment**: busca traslado activo en Redis (`transfer:active:{deviceId}`), sin traslado → descarta. **P3 Persistence**: INSERT en `gps_points` con BRIN index. Cada paso = Bull job que encola al siguiente | F14   | Alta      |
| 1.13 | F13 — Iniciar traslado           | `POST /api/tracking/traslados/:reservationId/iniciar`. RBAC: CONDUCTOR. Valida: conductor del JWT = asignado, vehículo coincide, no hay otro traslado activo para ese vehículo. Crea `transfers` con IN_TRANSIT. Guarda Redis `transfer:active:{deviceId}` para P2 | F13   | Alta      |
| 1.14 | F17 — Finalizar traslado         | `POST /api/tracking/traslados/:reservationId/finalizar`. RBAC: CONDUCTOR. Valida: conductor coincide, traslado en IN_TRANSIT. Status → COMPLETED, guarda `finishedAt`. Elimina Redis key. Deja de procesar GPS de ese vehículo | F17   | Alta      |
| 1.15 | GPS Simulator básico             | Script Node.js: envía puntos GPS cada 10s a `POST /api/gps`. Configurable: deviceId, ruta (lista de coordenadas), velocidad. Simula un vehículo moviéndose por Montevideo | R5    | Alta      |

### Felipe — operations-service

| #    | Feature                          | Detalle                                                                                                                                                                                                                                                                       | F/R   | Prioridad |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 1.16 | Prisma schema operations         | Tablas: `categories` (id, nameEs, nameEn, description, examples JSON, requiresMonitoring, generatesAlerts, surchargePercent), `pricing_rules` (id, categoryId, rules JSON), `zones` (id, name, type ENUM RED\|PREFERRED, geom GEOMETRY), `vehicles` (id, plate, type, capacity, gpsDeviceId, available), `users` (id, firebaseUid, name, role, status). Índice GiST en zones.geom | -     | Alta      |
| 1.17 | F8 — Categorías y reglas         | `GET/POST/PUT/DELETE /api/operaciones/categorias`. PUT modifica flags: requiresMonitoring, generatesAlerts, surchargePercent. DELETE solo si no tiene reservas asociadas (sino 409). RBAC: ADMIN. Reglas como JSON flexible, modificables sin tocar código | F8    | Alta      |
| 1.18 | Seed de categorías CSV           | Script que lee el CSV del profe (categorías en inglés/español + ejemplos) y hace upsert en `categories`. Ejecutable con `pnpm --filter operations-service seed`. Idempotente | F8    | Alta      |
| 1.19 | F9 — Gestión de zonas            | `POST/PUT/DELETE/GET /api/zonas`. Recibe GeoJSON polygon. Validar polígono con `ST_IsValid`. Tipos: RED y PREFERRED. RBAC: ADMIN. Índice GiST para consultas geoespaciales (usado por P4) | F9    | Alta      |
| 1.20 | F10 — Gestión de vehículos       | `POST/PUT/GET /api/vehiculos`. Registrar plate, type, capacity, gpsDeviceId. Modificar disponibilidad. Listar con filtros (available, type). RBAC: ADMIN. Validar matrícula única, gpsDeviceId único | F10   | Alta      |
| 1.21 | F11 — Gestión de usuarios        | `GET /api/usuarios` con filtros (role, status). `PUT /api/usuarios/:id/status` — activar/desactivar. No CRUD completo (la letra dice "ya se cuenta con BD"). RBAC: ADMIN | F11   | Media     |
| 1.22 | F12 — Asignar vehículo/conductor | `POST /api/operaciones/reservas/:id/asignar`. Recibe vehicleId + conductorId. Valida: capacidad >= tamaño bienes, vehículo no asignado en mismo horario (SELECT FOR UPDATE — ADR-018), conductor disponible. OK → ASSIGNED. Doble booking → 409. RBAC: OPERATOR | F12   | Alta      |
| 1.23 | F18 — Traslados en curso         | `GET /api/operaciones/traslados?status=IN_TRANSIT&vehicleId=X&conductorId=Y&categoryId=Z&hasAlerts=true`. Retorna: id, origen, destino, estado, vehículo (plate), conductor (nombre), alertas activas. Paginación. <500ms (R2). RBAC: OPERATOR | F18   | Media     |
| 1.24 | Completar validaciones en tracking-service | Dos validaciones pendientes en tracking-service por depender de la tabla `vehicles` (1.20). **1)** F13 iniciar traslado: consultar `GET /api/vehiculos/:vehicleId` para verificar que el vehículo no tiene otro traslado activo → 409 si tiene. **2)** Pipeline P1 GPS: consultar `GET /api/vehiculos?deviceId=:deviceId` para verificar que el deviceId está registrado → descartar punto si no existe. Depende de 1.20 + 1.22. Issue #40 | F13/F14 | Media     |

**Entregable Fase 1**: Todos los CRUDs funcionando. Flujo completo de reserva empresa: crear → cotizar → pagar. GPS recibido y persistido. Traslados iniciados/finalizados.

---

## Fase 2 — Features avanzadas e integración (Semana 4: 2-8 junio)

### Nicolás — IA + Clasificación + Eventos

| #   | Feature                             | Detalle                                                                                                                                                                                                                                                                       | F/R   | Prioridad |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 2.1 | F4.1 — Crear reserva particular     | `POST /api/reservas`. RBAC: CLIENT_PARTICULAR. Valida fecha futura, al menos 1 bien con descripción. Ejecuta cascade de clasificación (2.2). Si clasifica sync → cotizar → retornar QUOTED. Si pasa a LLM async → retornar PENDING_CLASSIFICATION (no bloquea). Si ninguno clasifica → publicar `reservation.unclassified` → notificar operador (F19) | F4.1  | Crítica   |
| 2.2 | Strategy ICategorizador             | Interface `ICategorizador` con `classify(description): Promise<ClassificationResult \| null>` (null = no clasificó, el cascade pasa al siguiente). 3 implementaciones: **Rule-based** (keywords desde `booking.categories.examples`, sync, <50ms), **Embeddings** (pgvector cosine ≥ threshold configurable default 0.6, sync, 100-500ms), **LLM** (Ollama via Bull, async, 2-30s). Cascade ordenado por costo creciente: rule-based → embeddings → LLM. Cada una retorna `{ categoryId, confidence, strategy }` | R10   | Crítica   |
| 2.3 | ai-worker                           | Proceso Node.js separado. Consume cola Bull `ai-categorization`. Llama a Ollama HTTP (`POST /api/generate`). Clasifica → publica `reservation.classified` en RabbitMQ. No clasifica → publica `reservation.unclassified`. Dockerfile propio, health check | R10   | Crítica   |
| 2.4 | Embeddings + pgvector               | Extensión `pgvector` en Postgres. Tabla `booking.category_embeddings` (categoryId, embedding vector(768)). Script `generate-embeddings.mjs` genera embeddings de cada categoría con Ollama `nomic-embed-text` usando el prefijo `search_document:` y enriquecimiento con `examples` (keywords). Repo usa `pg.Pool` con `search_path=booking,public` porque el tipo `vector` vive en `public` y Prisma con search_path=booking no lo ve. Query: `SELECT category_id, 1 - (embedding <=> $1::vector) AS similarity FROM booking.category_embeddings WHERE 1 - (embedding <=> $1::vector) >= $2 ORDER BY embedding <=> $1::vector LIMIT 1`. La query usa prefijo `search_query:` | R10   | Crítica   |
| 2.5 | Rule-based categorizador            | `DbRuleBasedCategorizador` carga keywords lazy desde columna JSON `booking.categories.examples` (seedeada desde `categories.csv` con 222 categorías). Tokeniza descripción, busca matches por categoría. Retorna categoría con más matches normalizado a confidence ≥ 0.5. Fallback rápido (<50ms, sin I/O externo) | R10   | Alta      |
| 2.6 | F19 — Notificación operador SSE     | `GET /api/reservas/notifications/stream` (SSE). `reservation.unclassified` por RabbitMQ → push SSE. `POST /api/reservas/:id/clasificar` — operador asigna categoría → publica `reservation.classified`. Si bien no es de MOVE → email mock al cliente. Tiempo: <1s RabbitMQ → SSE | F19   | Alta      |
| 2.7 | RabbitMQ publishers/consumers       | Publishers: `reservation.unclassified`, `reservation.classified`. Consumers: `reservation.classified` (retoma cotización), `alert.created` (mostrar alertas en consultas). Idempotencia por check de estado | -     | Alta      |
| 2.8 | Redis Pub/Sub SSE fan-out           | Si múltiples instancias de booking (R8), Redis Pub/Sub como canal fan-out entre instancias para SSE (ADR-017). Canal: `sse:reservations:unclassified` | F19   | Alta      |
| 2.9 | Audit logging R6                    | Middleware Winston: loguea cada request autenticado (userId, role, endpoint, method, statusCode) e intentos no autorizados (401/403 con IP). JSON con traceId. En todos los servicios | R6    | Alta      |

### Santiago — Pipeline GPS completo + Alertas

| #    | Feature                             | Detalle                                                                                                                                                                                                                                                                       | F/R   | Prioridad |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 2.10 | Pipeline P4 — Geofence             | Bull job: query PostGIS `ST_Contains(geom, ST_Point($lng, $lat))`. Si zona RED → encola alerta type ZONE_RED_ENTRY en P6. Usa índice GiST de zones (creado por Felipe en F9) | F15   | Alta      |
| 2.11 | Pipeline P5 — Stop Detection       | Bull job: compara `lastMoveAt` (Redis `gps:lastmove:{deviceId}`) con timestamp actual. Diferencia > threshold (configurable, ej: 3 min) + distancia < umbral → alerta PROLONGED_STOP. Actualiza `lastMoveAt` en cada punto | F15   | Alta      |
| 2.12 | Pipeline P6 — Alert Generation     | Bull job: INSERT en `alerts` con UNIQUE constraint (transferId, type, lat, lng, timestamp). ON CONFLICT DO NOTHING para idempotencia. Encola en P7 | F16   | Alta      |
| 2.13 | Pipeline P7 — Notification         | Bull job: publica `alert.created` en RabbitMQ (fanout). Si RabbitMQ caído → alerta ya persistida en P6, se puede reenviar. Log con Winston | F16   | Alta      |
| 2.14 | RabbitMQ publishers tracking       | Publisher: `alert.created` (fanout), `incident.reported` (topic). Config de exchanges/queues. Si RabbitMQ no disponible → log error, dato ya en DB | -     | Alta      |
| 2.15 | GPS Simulator avanzado             | Rutas que pasan por zonas rojas (genera alerta), paradas prolongadas (genera alerta), múltiples vehículos. Configurable por JSON: `{ routes: [{ deviceId, waypoints, stopsAt, speed }] }` | R5    | Media     |
| 2.16 | Incidencias del conductor          | `POST /api/tracking/traslados/:id/incidencias` — RBAC: CONDUCTOR. Crea registro, publica `incident.reported`. `GET /api/tracking/traslados/:id/incidencias` — listar | -     | Media     |

### Felipe — Frontend geo + Integración

| #    | Feature                             | Detalle                                                                                                                                                                                                                                                                       | F/R   | Prioridad |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 2.17 | Frontend-geo SPA                    | HTML/JS con Leaflet + OpenStreetMap. Mapa centrado en Montevideo. Panel de zonas (polígonos coloreados), panel de traslados activos (marcadores). Vanilla JS, sin framework | UI    | Media     |
| 2.18 | Visualización de zonas              | Consume `GET /api/zonas` → dibuja polígonos. Rojas en rojo, preferentes en verde. Popup con info al click. Permite crear zonas dibujando con Leaflet.draw → envía GeoJSON | F9    | Media     |
| 2.19 | Visualización de traslados          | Consume `GET /api/operaciones/traslados?status=IN_TRANSIT` → marcadores en mapa. Polling cada 10s. Click muestra info (conductor, vehículo, alertas). Alertas resaltadas en rojo | F18   | Media     |
| 2.20 | RabbitMQ consumers operations      | Consumer: `alert.created` (agregar alertas a vista traslados), `incident.reported` (registrar en operations). Config exchanges/bindings | -     | Alta      |
| 2.21 | Colección Postman completa         | Una collection por servicio. Variables de entorno (BASE_URL, TOKEN). Carpetas por funcionalidad (F1-F19). Bodies de ejemplo y tests básicos (status code, campos). Datos precargados | Demo  | Alta      |

**Entregable Fase 2**: Flujo completo: reserva particular → cascade IA → SSE operador → pipeline GPS → alertas → mapa con zonas y traslados.

---

## Fase 3 — NFRs, Testing y Observabilidad (Semana 5: 9-15 junio)

### Nicolás — Performance + Observabilidad + Tests booking

| #   | Feature                             | Detalle                                                                                                                                                                                                                                                                       | R     | Prioridad |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 3.1 | Circuit breakers completos          | opossum en: `IPaymentGateway` (booking), `IAuthService` (booking). Config: timeout 5s, errorThreshold 50%, resetTimeout 30s. Half-open → prueba 1 request → closed. Log de estado CB con Winston | R7    | Alta      |
| 3.2 | Winston logging estructurado       | Logger compartido en `@move/shared`. JSON: timestamp ISO 8601, level, service, version, traceId, message. Middleware Express genera traceId por request. NUNCA loggear passwords, tokens, PII | R4    | Alta      |
| 3.3 | Métricas Prometheus                 | `prom-client`: `http_request_duration_seconds` (histogram), `http_requests_total` (counter), errores. Custom: `reservations_created_total`, `gps_points_processed_total`, `alerts_generated_total`. Endpoint `GET /metrics` | R4    | Alta      |
| 3.4 | Prometheus + Grafana                | `prometheus.yml` scrapeando los 3 servicios cada 15s. Grafana con provisioning: datasource + dashboards precargados (requests/min, latencia p95, errores). En Docker Compose | R4    | Alta      |
| 3.5 | K6 load tests                      | Scripts K6: **R1** crear reserva empresa (<600ms top-20, <1000ms otros). **R2** consultar reservas (<300ms), listar traslados (<500ms). **R3** pipeline GPS (<5s). Escenarios: carga normal (100 reservas/min + 50 GPS) y 50x (R8). Reportes p50/p95/p99 | R1-R3 | Alta      |
| 3.6 | Comparativa R10                    | Documento con datos reales: latencia (p50/p95), precisión (% correctas sobre set de prueba), complejidad. Tabla de 6 ejes. Justificación del cascade. Va en documentación final | R10   | Crítica   |
| 3.7 | Tests unitarios booking domain     | Entities (Reservation, Good, Client — validaciones, inmutabilidad), value objects (Money, DateRange), use cases (CreateReservation, QuoteReservation, ProcessPayment — mocks de repos). TDD en cascade y pago CB. Coverage ≥ 80% | -     | Alta      |
| 3.8 | Tests integración booking          | Supertest: register, login, crear reserva (empresa y particular), pagar (OK, rechazado, CB abierto), consultar con filtros. Validan status, body, side effects en DB. **Requiere Firebase emulator** (`firebase emulators:start`) levantado en Docker Compose antes de implementar | -     | Alta      |
| 3.9 | Escalado horizontal R8             | Definir baja (10 reservas/min, 5 GPS) y alta demanda (500 reservas/min, 250 GPS = 50x). `docker compose --scale`. Verificar con K6. Documentar resultados | R8    | Media     |

### Santiago — Resiliencia tracking + Tests

| #    | Feature                             | Detalle                                                                                                                                                                                                                                                                       | R     | Prioridad |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 3.10 | Health checks /health y /ready     | Cada servicio: `GET /health` (liveness, solo 200). `GET /ready` (readiness: DB SELECT 1, Redis PING, RabbitMQ checkQueue). Docker Compose usa /ready para depends_on | R7    | Alta      |
| 3.11 | Tests unitarios tracking domain    | Pipeline filters (P1 descarta inválidos, P2 enriquece, P4 detecta zona roja, P5 detecta parada), entities (Transfer, GpsPoint, Alert). TDD en P4 y P5. Coverage ≥ 80% | -     | Alta      |
| 3.12 | Tests integración tracking         | Supertest: POST /gps (válido e inválido), POST /iniciar (conductor correcto/incorrecto), POST /finalizar, GET /incidencias. Verificar pipeline genera alertas | -     | Alta      |
| 3.13 | Consistent hashing nginx           | `upstream tracking` con `hash $http_x_device_id consistent`. Cada dispositivo siempre va a la misma instancia. Necesario para P5 (stop detection sin falsos positivos) | R8    | Media     |
| 3.14 | GPS simulator escenarios demo      | Escenarios para video: (1) traslado normal, (2) entrada zona roja → alerta, (3) parada prolongada → alerta, (4) finalización correcta. Configurable por JSON | R5    | Alta      |

### Felipe — Tests operations + Demo prep

| #    | Feature                             | Detalle                                                                                                                                                                                                                                                                       | R     | Prioridad |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 3.15 | Tests unitarios operations domain  | Entities (Zone, Vehicle, Category), use cases (AssignVehicle — capacidad, disponibilidad, doble booking). TDD en F12 concurrencia. Coverage ≥ 80% | -     | Alta      |
| 3.16 | Tests integración operations       | Supertest: CRUD zonas (GeoJSON), vehiculos, POST /asignar (OK y doble booking), GET /traslados con filtros | -     | Alta      |
| 3.17 | Seed data para demo                | Script: 5 clientes (3 empresa, 2 particular), 10 vehículos, 5 conductores, 3 zonas Montevideo (1 roja, 2 preferentes), 20 reservas en distintos estados, categorías con reglas. `pnpm seed:demo` | Demo  | Alta      |
| 3.18 | Colección Postman final            | Actualizar con todos los endpoints finales. Cubrir escenarios de la rúbrica: registro OK/duplicado, login OK/inválido, reserva sin bienes, pago CB, doble booking, traslado con alertas. Pre-request scripts | Demo  | Alta      |

**Entregable Fase 3**: Observabilidad (Grafana), load tests (K6), 80%+ coverage, health checks, comparativa R10.

---

## Fase 4 — Integración final, Demo y Documentación (Semana 6: 16-25 junio)

| #   | Tarea                                   | Detalle                                                                                                                                                                                   | Responsable        |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 4.1 | Tests integración cross-service         | Flujos completos: reserva particular → cascade → clasificación → cotización → pago → asignación → traslado → GPS → alertas. Eventos RabbitMQ end-to-end | Nicolás + Santiago |
| 4.2 | Fix bugs de integración                 | Buffer para bugs de 4.1 y preparación del video                                                                                                               | Todos              |
| 4.3 | Docker Compose final                    | 13 contenedores con `docker compose up`. Health checks encadenados. README con instrucciones de setup | Nicolás            |
| 4.4 | Documentación PDF                       | Max 20 páginas, Views & Beyond: **Module View** (servicios y capas), **C&C View** (HTTP/RabbitMQ/Bull/SSE), **Deployment View** (Docker). Cada vista: UML 2, catálogo, ADRs. Tradeoffs. Link al repo | Nicolás            |
| 4.5 | Video demo                              | Max 30 min con voz. Levantar sistema, recorrer CADA item de la rúbrica con Postman, GPS en mapa, alertas, Grafana. Datos precargados con seed | Todos              |
| 4.6 | Revisión documentación                  | Todos revisan PDF. Verificar ADRs (contexto, decisión, consecuencias), UML correcto, link al repo | Santiago + Felipe  |
| 4.7 | Release tag en main                     | Merge develop → main. Tag `v1.0.0`. Antes de 21h del 25/06 | Nicolás            |

---

## Checklist de la rúbrica (para el video demo)

Cada item debe mostrarse explícitamente en el video:

| Funcionalidad                     | Items a demostrar                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| F1 Registro                       | Registrar ambos tipos. No permitir duplicados                                                                      |
| F2 Ingreso                        | Login OK con rol válido. Credenciales inválidas. Rol inválido                                                      |
| F3 Preregistro                    | Asociar producto a categoría. Cambiar/eliminar. Mostrar RBAC                                                       |
| F4.1 Reserva particular           | Crear con descripción → clasificación automática. No clasificado → notificación operador. Mostrar RBAC             |
| F4.2 Reserva empresa              | Crear con datos preregistrados. Rechazar bien sin preregistro. Mostrar RBAC                                        |
| F5 Cotizar                        | Cálculo de costo con reglas. Mostrar RBAC                                                                          |
| F6 Pagar                          | Aceptado, rechazado, pasarela caída (CB). Mostrar RBAC                                                            |
| F7 Consultar reservas             | Filtros válidos. Sin resultados. No mostrar reservas de otro cliente                                               |
| F8 Categorías y reglas            | Crear regla. No eliminar regla usada en reserva. Mostrar RBAC                                                      |
| F9 Zonas                          | Crear, modificar, eliminar. Mostrar en mapa                                                                        |
| F10 Vehículos                     | Mostrar BD de vehículos                                                                                            |
| F12 Asignar                       | Asignación válida. Vehículo ya asignado → error                                                                    |
| F13-F17 Traslado + GPS + Alertas  | Traslado completo con GPS. Alertas zona roja y parada. Cambio de posición en el tiempo                              |
| F18 Traslados en curso            | Consulta sin y con filtros                                                                                         |
| F19 Clasificación manual          | Notificación al operador. Velocidad de recepción (<1s)                                                             |

---

## Dependencias críticas

```
Fase 0 (setup) ──────────────────┐
                                  ▼
Fase 1 (CRUDs) ──────────────────┐
  booking (Nicolás) ──────────────│── independiente
  tracking (Santiago) ────────────│── independiente
  operations (Felipe) ────────────│── independiente
                                  ▼
Fase 2 (avanzadas) ──────────────┐
  F4.1 cascade depende de ────── F8 categorías + seed CSV (Felipe)
  Pipeline P4 depende de ─────── F9 zonas con PostGIS (Felipe)
  F12 asignación depende de ──── F10 vehículos + F13 traslados
  F19 SSE depende de ──────────── F4.1 cascade (Nicolás)
  Embeddings depende de ──────── Seed categorías (Felipe) + Ollama (Docker)
                                  ▼
Fase 3 (NFRs) ───────────────────┐
  K6 tests dependen de ────────── Features completas (todos)
  R10 comparativa depende de ──── 3 estrategias implementadas (Nicolás)
  Tests dependen de ──────────── Features de cada servicio
                                  ▼
Fase 4 (integración + entrega)
  Video depende de ────────────── Seed data (Felipe) + GPS simulator (Santiago)
  PDF depende de ──────────────── Todo implementado y testeado
```

## Hitos

| Fecha      | Hito                                                    |
| ---------- | ------------------------------------------------------- |
| 18/05      | Setup completo, `docker compose up` funciona            |
| 01/06      | CRUDs completos, flujos básicos F1-F19 funcionando      |
| 08/06      | IA cascade, GPS pipeline completo, alertas, SSE, mapa   |
| 15/06      | Tests 80%+, K6, Grafana, comparativa R10, health checks |
| 22/06      | Video demo grabado, PDF listo, bugs corregidos           |
| 25/06 21h  | Merge a main, tag v1.0.0, PDF en gestión                |

## Riesgos

| Riesgo                                  | Impacto | Mitigación                                                    |
| --------------------------------------- | ------- | ------------------------------------------------------------- |
| Ollama lento en hardware del equipo     | Alto    | Mock de LLM para desarrollo, medir real solo para comparativa |
| PostGIS queries lentas                  | Medio   | Índice GiST + pocas zonas en demo. Docker image preconfigurada |
| Firebase Auth setup complejo            | Bajo    | Mock de auth para desarrollo local, Firebase solo en demo      |
| Integración entre servicios tardía      | Alto    | Contratos RabbitMQ en `@move/shared` desde Fase 0              |
| Scope creep en frontend                 | Medio   | Frontend mínimo: Leaflet vanilla JS, sin framework             |
| Felipe/Santiago bloqueados por Fase 0   | Medio   | Nicolás entrega scaffolds día 2, los demás arrancan día 3      |
| No llegar a 80% coverage               | Medio   | Priorizar TDD en flujos críticos, CRUDs simples al final       |
