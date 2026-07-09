# GPS Simulator — Guía de demo

Herramienta de simulación de puntos GPS para el video de demostración del sistema MOVE.

## Requisitos previos

- Docker Compose corriendo: `docker compose up -d`
- Seed de datos de demo ejecutado: `pnpm --filter operations-service seed:demo`
- Sistema con `pnpm -r build` compilado

## Escenarios disponibles

| Archivo | Descripción | Alerta generada |
|---|---|---|
| `scenario-normal.json` | Traslado sin incidentes por el Centro | Ninguna |
| `scenario-zona-roja.json` | Ruta que entra al Cerro (zona restringida) | `ZONE_RED_ENTRY` |
| `scenario-parada.json` | Vehículo detenido >3 min en un punto | `STOP_DETECTED` |

## Flujo de demo paso a paso

### 1. Obtener JWT del conductor

```bash
curl -s -X POST \
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<FIREBASE_API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo-conductor1@move.uy","password":"Conductor1234!","returnSecureToken":true}' \
  | jq -r '.idToken'
```

Copiá el `idToken` resultante.

### 2. Editar el escenario con el token

Abrí el archivo JSON del escenario y reemplazá `JWT_CONDUCTOR_AQUI` con el token obtenido:

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsI..."
}
```

### 3. Iniciar el traslado (obligatorio antes del simulador)

El seed crea las reservas en base de datos pero **no activa el dispositivo en Redis**. P2 del pipeline descarta todos los puntos GPS si el dispositivo no tiene un traslado activo. Este paso es obligatorio:

```bash
curl -s -X POST http://localhost:8000/api/tracking/traslados/<reservationId>/iniciar \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"vehicleId": "<vehicleId>", "deviceId": "GPS-DEMO-001"}'
```

El `reservationId` y `vehicleId` se obtienen de las reservas creadas por el seed (estado `ASSIGNED`).

### 4. Correr el escenario

```bash
pnpm --filter @move/gps-simulator start config/scenario-zona-roja.json
```

El simulador imprime cada punto enviado con su coordenada e índice:

```
[GPS-DEMO-001] [1/10] lat=-34.885, lng=-56.205
[GPS-DEMO-001] [2/10] lat=-34.886, lng=-56.212
...
```

### 5. Verificar alertas generadas

```sql
SELECT type, created_at FROM tracking.alerts ORDER BY created_at DESC LIMIT 10;
```

O desde el frontend-geo, el panel de operaciones muestra las alertas en tiempo real vía SSE.

### 6. Finalizar el traslado

```bash
curl -s -X POST http://localhost:8000/api/tracking/traslados/<reservationId>/finalizar \
  -H "Authorization: Bearer <JWT>"
```

Esto libera el dispositivo en Redis y permite reutilizarlo en otro escenario.

---

## Notas técnicas

- **P4 (geofence)**: detecta entrada a zona usando `ST_Contains` sobre `operations.zones`. La primera vez que un punto cae dentro de la zona genera `ZONE_RED_ENTRY` o `ZONE_PREFERRED_ENTRY`.
- **P5 (stop detection)**: compara el punto actual con `gps:lastmove:{deviceId}` en Redis. Si la distancia es < 50m y el tiempo acumulado > 180s, genera `STOP_DETECTED`. El escenario de parada usa 210s de margen.
- **Consistent hashing**: nginx enruta todos los puntos del mismo `deviceId` siempre al mismo pod de tracking (header `X-Device-Id`).
- **Escenario de parada**: tarda ~4 minutos en completarse por diseño (210s de parada + tránsito). Para acelerar en demo se puede reducir `STOP_THRESHOLD_SECONDS` via variable de entorno en el contenedor `tracking-service`.
