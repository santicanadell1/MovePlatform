# Guía de Contribución — MOVE Platform

## Documentación clave

Antes de empezar a desarrollar, leé estos documentos:

- **[Spec de arquitectura](docs/specs/2026-04-29-move-architecture-design.md)** — Diseño completo del sistema: servicios, flujos, eventos, ADRs, tácticas por requisito. Es la fuente de verdad de cómo implementar cada feature.
- **[Letra del obligatorio](docs/ObligatorioAR2026.md)** — Funcionalidades F1-F19, requisitos R1-R10, criterios de evaluación y rúbrica de demo.
- **[Contexto del proyecto](docs/context/project-context.md)** — Stack, patrones, decisiones arquitectónicas resumidas.
- **[Plan de trabajo](docs/PLAN.md)** — Fases, tareas asignadas, hitos y dependencias.
- **[Diagramas](docs/diagrams/architecture-diagrams.md)** — Vistas de componentes, comunicación y capas.
- **[CLAUDE.md](CLAUDE.md)** — Instrucciones para agentes de IA que trabajen en el repo.

## Setup del entorno (primera vez)

### 1. Levantar el stack

```bash
docker compose up --build -d
```

Esto automáticamente:
- Corre las migraciones de Prisma en cada servicio
- Ejecuta `seed-categories` (222 categorías con keywords)
- Ejecuta `seed-privileged-users` (admin, operadores, conductores)
- Descarga el modelo `nomic-embed-text` en Ollama (~274 MB, puede tardar)

### 2. Generar embeddings de categorías (manual, una sola vez)

Una vez que Ollama esté healthy (verificar con `docker compose ps`), correr:

```bash
# Desde packages/booking-service/
DATABASE_URL="postgresql://move:move_secret@localhost:5432/move_db?schema=booking" \
OLLAMA_URL="http://localhost:11434" \
npx ts-node --project tsconfig.json scripts/generate-embeddings.ts
```

Esto genera vectores de 768 dimensiones para las 222 categorías y los guarda en la tabla `booking.category_embeddings`. **Solo hay que hacerlo una vez** — los datos quedan persistidos en el volumen de postgres. Si se hace `docker compose down -v` (borra volúmenes), hay que repetirlo.

> **¿Por qué no es automático?** El script depende de que Ollama tenga el modelo descargado, lo cual puede tardar varios minutos en el primer arranque. Se dejó manual para evitar que el booking-service falle al iniciar si Ollama no está listo aún.

### 3. Verificar que todo funciona

```bash
# Health checks
docker compose ps

# Smoke test: reserva con clasificación automática (debe retornar QUOTED)
TOKEN=$(curl -s http://localhost:3001/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@test.com","password":"Test1234!"}' | \
  node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).data.token))")

curl -s http://localhost:3001/v1/reservas -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"origin":"Av. 18 de Julio 1234","destination":"Av. Brasil 2345","originLat":-34.9011,"originLng":-56.1645,"destinationLat":-34.8941,"destinationLng":-56.1823,"scheduledDate":"2026-12-01T10:00:00Z","goods":[{"description":"tejido crochet lana","quantity":1}]}'
# Esperado: status "QUOTED" con precio calculado
```

## Equipo

| Integrante | ID     | Responsabilidad principal                  |
| ---------- | ------ | ------------------------------------------ |
| Nicolás    | 305108 | booking-service, ai-worker, shared, infra  |
| Santiago   | 282542 | tracking-service, gps-simulator            |
| Felipe     | 281987 | operations-service, frontend-geo           |

## Flujo de trabajo

### 1. Crear branch desde develop

```bash
git checkout develop
git pull origin develop
git checkout -b feat/<service>/<descripcion>
```

Formato de branch:
- `feat/<service>/<descripcion>` — nueva funcionalidad
- `fix/<service>/<descripcion>` — corrección de bug
- `chore/<descripcion>` — configuración, deps, scripts
- `docs/<descripcion>` — documentación
- `test/<service>/<descripcion>` — tests

### 2. Desarrollar

- Seguir Clean Architecture (domain → application → infrastructure → presentation)
- Escribir tests (mínimo 80% coverage)
- Correr lint y typecheck antes de pushear:
  ```bash
  pnpm --filter <service> lint
  pnpm --filter <service> typecheck
  pnpm --filter <service> test
  ```

### 3. Commit (Conventional Commits)

```
<type>(<scope>): <descripción en español, imperativo>
```

| Type       | Cuándo                                  |
| ---------- | --------------------------------------- |
| `feat`     | Nueva funcionalidad                     |
| `fix`      | Corrección de bug                       |
| `refactor` | Cambio sin modificar comportamiento     |
| `docs`     | Documentación                           |
| `test`     | Tests nuevos o corrección de tests      |
| `chore`    | Deps, configs, scripts                  |
| `perf`     | Mejora de performance                   |
| `ci`       | Cambios en CI/CD                        |

Scopes válidos: `booking`, `operations`, `tracking`, `ai-worker`, `gps-sim`, `shared`, `infra`

Reglas:
- Mensaje en español, imperativo ("agregar", no "agregado")
- Primera línea máximo 72 caracteres
- Un commit = un cambio lógico que pase los tests

### 4. Pull Request

```bash
git push -u origin HEAD
```

Crear PR a `develop` con:
- Título corto (<70 chars)
- Body con resumen de cambios y test plan
- Asignar al menos 1 reviewer del equipo

### 5. Review y Merge

- CI debe pasar (lint + typecheck + tests)
- Al menos 1 approval
- Merge con "Squash and merge" o "Merge commit" (consistente)
- La branch se elimina automáticamente al mergear

## Estructura de directorios por servicio

```
packages/<service>/
  src/
    domain/
      entities/          # Clases de dominio
      value-objects/     # Value Objects inmutables
      ports/             # Interfaces de repositorios y servicios externos
      errors/            # Errores de dominio tipados
    application/
      use-cases/         # Un archivo por use case
      dtos/              # DTOs de entrada/salida de use cases
    infrastructure/
      repositories/      # Implementaciones de ports (Prisma, pg)
      services/          # Adapters de servicios externos
      messaging/         # RabbitMQ publishers/consumers, Bull queues
      config/            # Configuración del servicio
    presentation/
      controllers/       # Express route handlers
      routes/            # Express router definitions
      middlewares/       # Auth, validation, error handling
      dtos/              # Request/Response DTOs (Zod schemas)
    inversify.config.ts  # DI container
    server.ts            # Express app setup
    index.ts             # Entry point
  tests/
    unit/                # Tests de domain y application
    integration/         # Tests con Supertest
  prisma/
    schema.prisma        # Schema del servicio
  package.json
  tsconfig.json
```

## Convenciones de código

### Naming
| Elemento    | Convención           | Ejemplo                              |
| ----------- | -------------------- | ------------------------------------ |
| Archivos    | kebab-case           | `create-reservation.use-case.ts`     |
| Clases      | PascalCase           | `CreateReservationUseCase`           |
| Interfaces  | I-prefix PascalCase  | `IReservationRepository`             |
| Variables   | camelCase            | `reservationId`                      |
| Constantes  | UPPER_SNAKE_CASE     | `MAX_RETRY_COUNT`                    |
| DB tablas   | snake_case plural    | `reservations`                       |
| DB columnas | snake_case           | `created_at`                         |

### Imports
Orden dentro de cada archivo:
1. Node.js built-ins
2. Dependencias externas (express, inversify, etc.)
3. Shared package (`@move/shared`)
4. Imports internos del servicio (domain → application → infrastructure → presentation)

## Metodología de trabajo

### Kanban con GitHub Projects

Tablero con 4 columnas:

| Columna       | Significado                                    |
| ------------- | ---------------------------------------------- |
| `To Do`       | Tarea planificada, aún no empezada             |
| `In Progress` | Alguien la está trabajando (max 2 por persona) |
| `In Review`   | PR abierto, esperando review                   |
| `Done`        | Mergeado a develop                             |

Reglas:
- Cada tarea del plan (docs/PLAN.md) se crea como issue en GitHub y se agrega al board
- Asignar el issue a la persona responsable
- Mover la tarjeta al cambiar de estado
- Máximo 2 tareas "In Progress" por persona — terminar antes de empezar otra
- El board es la fuente de verdad del progreso del equipo

### Reuniones

- **Sync semanal** (15 min): qué hice, qué voy a hacer, si estoy bloqueado
- **Review de integración** al final de cada fase antes de mergear a develop

## Estrategia de testing

### Principio general

No hacemos TDD en todo el proyecto — no hay tiempo. Aplicamos **TDD selectivo en flujos críticos** y tests estándar en el resto.

### Niveles de testing

| Nivel              | Qué se testea                                    | Herramienta      | Cuándo          |
| ------------------ | ------------------------------------------------ | ----------------- | --------------- |
| **Unitarios**      | Domain entities, value objects, use cases         | Jest              | Siempre         |
| **Integración**    | Endpoints HTTP completos                         | Jest + Supertest  | Flujos críticos |
| **Load testing**   | Performance bajo carga (R1, R2, R3)              | K6                | Fase 3          |

### Flujos con TDD obligatorio (Red → Green → Refactor)

Estos flujos son los más complejos y los que el profe va a evaluar más de cerca. Escribir el test **antes** de implementar:

1. **F4.1 — Cascade de clasificación IA (R10)**
   - Test: dado una descripción, el cascade prueba embeddings → rule-based → LLM en orden
   - Test: si embeddings clasifica con confianza >0.85, no se llama a rule-based ni LLM
   - Test: si ninguno clasifica, la reserva queda PENDING_CLASSIFICATION

2. **F6 — Pago con circuit breaker (R7)**
   - Test: pago exitoso → status ACCEPTED
   - Test: pasarela rechaza → status REJECTED
   - Test: circuit breaker abierto → 503, reserva queda PENDING_PAYMENT

3. **Pipeline GPS P1-P7 (F14-F16, R3)**
   - Test: punto GPS válido pasa P1, inválido se descarta
   - Test: punto en zona roja genera alerta en P4
   - Test: vehículo detenido >X minutos genera alerta en P5
   - Test: pipeline completo ejecuta en <5s

4. **F12 — Asignación con concurrencia (ADR-018)**
   - Test: asignación exitosa cambia estado del vehículo
   - Test: doble asignación del mismo vehículo → 409

### Tests estándar (sin TDD estricto)

Para el resto de funcionalidades (CRUDs, consultas, auth):
- Escribir tests unitarios de domain después de implementar
- Escribir al menos 1 test de integración por endpoint
- Coverage mínimo por servicio: **80%**

### Qué NO testeamos

- **E2E con browser** (Playwright/Cypress): el proyecto es backend-first, la demo es con Postman
- **Frontend-geo**: es una SPA mínima de visualización, no justifica tests
- **Mocks de infraestructura en domain tests**: si necesitás un mock de DB para testear domain, hay una violación de Clean Architecture

### Estructura de tests

```
packages/<service>/tests/
  unit/
    domain/
      entities/           # Tests de entidades y value objects
      use-cases/          # Tests de use cases (ports mockeados)
  integration/
    controllers/          # Tests HTTP con Supertest
    repositories/         # Tests con DB real (test container)
```

### Comandos

```bash
pnpm --filter <service> test              # todos los tests
pnpm --filter <service> test -- --watch   # watch mode
pnpm --filter <service> test -- --coverage # con coverage
pnpm --filter <service> test -- -t "cascade" # por nombre
```

## Resolución de conflictos

Si dos personas tocan el mismo archivo:
1. Comunicar por el grupo antes de mergear
2. El que llegó primero mergea; el segundo hace rebase y resuelve
3. En caso de duda, pair review
