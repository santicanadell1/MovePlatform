# K6 Load Tests — MOVE Platform

Scripts de carga para verificar los SLAs R1, R2 y R3 del obligatorio.

## Prerequisitos

1. **K6 instalado** → https://k6.io/docs/get-started/installation
2. **Stack Docker corriendo**: `docker compose up -d`
3. **Seed de datos K6** (ver abajo)

## Estructura

```
tests/k6/
  lib/
    auth.js         — helper login()
    data.js         — generadores de payload
    thresholds.js   — constantes SLA (p95 por escenario)
  scenarios/
    r1-reservas.js  — R1: POST /v1/reservas empresa (top-20 vs cold)
    r2-consultas.js — R2: GET /v1/reservas + GET /traslados bajo carga
    r3-gps.js       — R3: POST /api/tracking/gps (50 VUs)
  setup/
    seed-k6-data.ts — script de seed (output: k6-credentials.json)
    k6-credentials.json  ← generado por el seed (gitignored)
  run-all.sh        — corre los 3 escenarios con output Prometheus
```

## 1. Seed de datos K6

El seed crea 20 usuarios CLIENT_EMPRESA "top" y 1 "cold", sus CompanyProducts, reservas históricas y warmea el cache Redis top-20.

**Requiere** en `.env` del booking-service (o en el entorno):

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
DATABASE_URL=postgresql://move:move_secret@localhost:5432/move_db?schema=booking
REDIS_URL=redis://localhost:6379
```

**Ejecutar desde la raíz del repo:**

```bash
cd packages/booking-service
pnpm ts-node scripts/seed-k6-data.ts
```

Esto crea `tests/k6/setup/k6-credentials.json` con las credenciales de los usuarios de prueba.

Para limpiar y re-crear los usuarios K6:

```bash
pnpm ts-node scripts/seed-k6-data.ts --clean
```

## 2. Correr escenarios individuales

```bash
# R1 — reserva empresa
k6 run tests/k6/scenarios/r1-reservas.js

# R2 — consultas y listados
k6 run tests/k6/scenarios/r2-consultas.js

# R3 — GPS pipeline
k6 run tests/k6/scenarios/r3-gps.js
```

## 3. Correr todos con exportación a Prometheus/Grafana

```bash
bash tests/k6/run-all.sh
```

Ver resultados en Grafana: http://localhost:3000

## Variables de entorno

| Variable           | Default                              | Descripción                        |
|--------------------|--------------------------------------|------------------------------------|
| `K6_BOOKING_URL`   | `http://localhost:3001`              | booking-service directo            |
| `K6_OPERATIONS_URL`| `http://localhost:3002`              | operations-service directo         |
| `K6_TRACKING_URL`  | `http://localhost:3003`              | tracking-service directo           |
| `K6_PROMETHEUS_URL`| `http://localhost:9090/api/v1/write` | Prometheus remote write            |

> Los scripts apuntan a los servicios directamente (no vía nginx) porque el gateway
> no tiene path rewriting configurado (`/api/reservas` → `/v1/reservas`).
> Para R8 (escalado horizontal) usar `r8-escalado.js` que apunta al gateway (port 8000). Ver sección R8 al final.

## SLAs verificados

| Escenario                   | Threshold      | p95 medido | Estado |
|-----------------------------|----------------|------------|--------|
| R1 POST /reservas top-20    | p95 < 600 ms   | 69.09 ms   | ✅     |
| R1 POST /reservas cold      | p95 < 1 000 ms | 71.61 ms   | ✅     |
| R2 GET /reservas (consulta) | p95 < 300 ms   | 19.43 ms   | ✅     |
| R2 GET /traslados (listado) | p95 < 500 ms   | 14.75 ms   | ✅     |
| R3 POST /gps (HTTP)         | p95 < 5 000 ms | 19.94 ms   | ✅     |

Medición: 2026-06-20, sobre el stack actual (post-fixes de operaciones, seed y
asignación), vía gateway nginx en `http://localhost:8000`, 5 min por escenario,
**0 % de errores** (R3 tuvo 1 timeout aislado en 70 999 requests, 99.99 % de éxito).
El listado F18 (`GET /traslados`) lee `operations.transfers_projection`
(tabla local indexada) en vez del JOIN cross-schema de 5 tablas sobre 3 schemas.

Esta medición vía gateway dio valores levemente más altos que la del 2026-06-04
(que apuntaba a los servicios directo, sin pasar por nginx), lo que es esperable
porque agrega el salto del proxy inverso. Todos los escenarios siguen muy por
debajo de sus umbrales.

> **R3 nota**: el endpoint GPS retorna 202 inmediatamente (asíncrono), así que
> este escenario mide la latencia de recepción y encolado, no la del pipeline
> completo. El procesamiento P1-P7 ocurre después, fuera del request.

---

## R8 — Escalado horizontal

Verifica que el sistema soporta 50× de carga mediante `docker compose --scale` y que los SLAs se restauran al escalar.

### Escenario

| Sub-escenario          | Carga         | Endpoint vía gateway          | Threshold     |
|------------------------|---------------|-------------------------------|---------------|
| `reservas_alta_carga`  | 500 req/min   | `POST /v1/reservas`           | p95 < 600 ms  |
| `gps_alta_carga`       | 250 VUs       | `POST /api/tracking/gps`      | p95 < 5 000 ms|

El escenario va **siempre vía nginx** (`http://localhost:8000`), no a los servicios directamente.
Esto valida el balanceo de carga real, incluyendo el consistent hashing de tracking por `X-Device-Id`.

### Procedimiento

```bash
# 1. Levantar el stack
docker compose up -d

# 2. Alta carga con 1 instancia (registrar si se viola algún threshold)
k6 run tests/k6/scenarios/r8-escalado.js

# 3. Escalar booking-service y tracking-service
docker compose up -d --scale booking-service=2 --scale tracking-service=2

# 4. Recargar nginx para que pickee las nuevas instancias vía DNS
docker compose exec api-gateway nginx -s reload

# 5. Repetir con la misma carga — los RNF deben restaurarse
k6 run tests/k6/scenarios/r8-escalado.js
```

### Tabla de resultados R8

| Instancias booking | Instancias tracking | p95 reservas | p95 GPS   | Error rate | Estado |
|--------------------|---------------------|--------------|-----------|------------|--------|
| 1                  | 1                   | 12.41 ms     | 17.44 ms  | 0.00 %     | ✅     |

Medición: 2026-06-20, 500 req/min reservas + 250 VUs GPS (50× del baseline de R2),
3 min, stack Docker local, vía gateway. 216 500 requests, 0 % de errores.

Hallazgo: con **una sola instancia** de cada servicio el sistema ya cumple los SLAs
a 50× de carga, por lo que en este hardware la carga de prueba no llega a saturar
una instancia. Por eso no fue necesario medir con 2 instancias para demostrar el
cumplimiento de R8. El escalado horizontal queda demostrado como una capacidad de
la arquitectura (servicios sin estado, estado en Redis y Postgres, consistent
hashing por dispositivo en tracking), más que como una necesidad bajo esta carga.

### Redis fan-out SSE con múltiples instancias

Con `booking-service` escalado a N instancias, la notificación SSE al operador (F19) sigue funcionando porque ya usa **Redis pub/sub** (ADR-017):

- Cualquier instancia que recibe el evento publica en el canal Redis `operator:notifications`
- **Todas** las instancias suscriben al canal vía `SseManager.initialize(redisSubscriber)`
- La instancia a la que el operador está conectado recibe el mensaje del canal y lo entrega por SSE

No hay ningún cambio de código necesario para escalar booking-service — el patrón pub/sub garantiza que las notificaciones llegan al operador sin importar a qué instancia está conectado.

### Consistent hashing para tracking

Con `tracking-service` escalado a N instancias, nginx usa `hash $http_x_device_id consistent` para que todos los puntos GPS del mismo dispositivo vayan siempre a la misma instancia. Esto es necesario para que P5 (stop detection) no genere falsos positivos por ver puntos de distintos dispositivos fuera de orden.

El escenario R8 envía el header `X-Device-Id` en cada request GPS para activar el hashing.
