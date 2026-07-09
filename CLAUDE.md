# MOVE Platform — Agent Instructions

## Project Overview

Plataforma de traslados urbanos (MOVE). Monorepo TypeScript con 3 servicios HTTP, 2 workers y un shared package.

## Architecture

```
packages/
  shared/              # Tipos, interfaces de eventos, constantes
  booking-service/     # F1-F7, F19 (puerto 3001)
  operations-service/  # F8-F12, F18 (puerto 3002)
  tracking-service/    # F13-F17 + GPS pipeline (puerto 3003)
  ai-worker/           # R10 categorización IA (Bull consumer)
  gps-simulator/       # R5 simulación GPS
```

Cada servicio sigue Clean Architecture:
```
src/
  domain/          # Entities, Value Objects, Repository interfaces (ports)
  application/     # Use Cases (1 use case = 1 intención del usuario)
  infrastructure/  # Adapters (Prisma, Redis, RabbitMQ, Firebase, etc.)
  presentation/    # Express controllers, routes, middlewares, DTOs
  inversify.config.ts  # DI container bindings
```

## Stack

- TypeScript 5.x, Node.js 20 LTS, Express 5.x
- Prisma (general) + pg (PostGIS queries)
- InversifyJS (DI), Zod (validación)
- Firebase Auth (JWT + custom claims RBAC)
- Bull/Redis (colas intra-service), RabbitMQ/amqplib (eventos inter-service)
- opossum (circuit breaker), Winston (logging JSON), prom-client (métricas)
- Jest + Supertest (testing), K6 (load testing)
- Ollama + pgvector (IA local)
- Docker Compose (13 contenedores)

## Package Manager

SIEMPRE usar `pnpm`. Nunca npm ni yarn.

## Commands

```bash
pnpm install                    # instalar dependencias
pnpm -r build                   # build todos los packages
pnpm -r test                    # tests todos los packages
pnpm -r lint                    # lint todos los packages
pnpm --filter booking-service dev   # dev server de un servicio
docker compose up -d            # levantar toda la infra
docker compose logs -f <svc>    # ver logs de un servicio
```

## Coding Conventions

### General
- Idioma del código: inglés (variables, funciones, clases, comentarios)
- Idioma de commits: español
- Idioma de documentación: español
- Inmutabilidad: siempre crear nuevos objetos, nunca mutar
- Archivos pequeños: 200-400 líneas típico, 800 máximo
- Funciones: máximo 50 líneas
- No deep nesting (>4 niveles)

### TypeScript
- Strict mode habilitado
- Usar `interface` para contratos, `type` para unions/intersections
- Errores de dominio como clases tipadas, nunca strings
- `Result<T, E>` para errores esperados, `throw` solo para bugs
- Zod para validación en bordes del sistema
- `readonly` en todos los campos de Value Objects

### Naming
- Files: kebab-case (`create-reservation.use-case.ts`)
- Classes: PascalCase (`CreateReservationUseCase`)
- Interfaces: PascalCase con I-prefix (`IReservationRepository`)
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE
- DB tables: snake_case plural (`reservations`, `gps_points`)
- DB columns: snake_case (`created_at`, `client_id`)

### Clean Architecture Rules
- Domain NO importa de Infrastructure ni Presentation
- Use Cases orquestan Domain + Ports, sin lógica de negocio directa
- Controllers solo: parsear request, llamar Use Case, mapear response
- DTOs en Presentation, nunca exponer Entities por la API
- DI por constructor, nunca `new` dentro de Use Cases

### Testing

**TDD obligatorio** en estos flujos (escribir test ANTES de implementar):
- F4.1 cascade de clasificación IA (embeddings → rule-based → LLM)
- F6 pago con circuit breaker (aceptado, rechazado, CB abierto)
- Pipeline GPS P1-P7 (validación, geofence, stop detection, alertas)
- F12 asignación con concurrencia (doble booking → 409)

**Tests estándar** en el resto:
- Jest + Supertest
- Coverage mínimo: 80%
- Tests unitarios de Domain y Application sin mocks de DB
- Al menos 1 test de integración por endpoint
- K6 para load testing de R1, R2, R3

**NO testear**:
- E2E con browser (Playwright/Cypress) — proyecto es backend-first
- Frontend-geo — SPA mínima de visualización
- Si necesitás mock de DB en tests de domain, hay violación de Clean Architecture

## Git Workflow

### Branches
- `main` — release final (merge solo desde develop)
- `develop` — integración continua
- Feature branches desde develop: `feat/<service>/<description>`
- Fix branches: `fix/<service>/<description>`
- Chore branches: `chore/<description>`

Ejemplos:
```
feat/booking/create-reservation
feat/tracking/gps-pipeline
fix/operations/zone-validation
chore/ci-setup
```

### Commits (Conventional Commits)
```
<type>(<scope>): <description>
```
Types: feat, fix, refactor, docs, test, chore, perf, ci, build
Scopes: booking, operations, tracking, ai-worker, gps-sim, shared, infra

Ejemplos:
```
feat(booking): agregar endpoint de creación de reserva
fix(tracking): manejar coordenadas GPS inválidas
test(operations): agregar tests de integración para CRUD de zonas
chore(infra): agregar health checks a docker-compose
```

### Pull Requests
- Siempre PR a develop (nunca push directo)
- Requiere al menos 1 review
- CI debe pasar (lint + typecheck + tests)
- Título corto (<70 chars), body con summary y test plan
- Auto-delete branch on merge

## Services Communication

- HTTP REST: solo APIs públicas detrás del api-gateway (nginx)
- NO hay llamadas HTTP entre servicios
- RabbitMQ: eventos inter-service (reservation.unclassified, alert.created, etc.)
- Bull/Redis: pipelines internos (GPS P1-P7, ai-categorization)
- SSE: notificaciones real-time al operador

## Security Checklist
- JWT validado en cada request (Firebase Auth middleware)
- RBAC con custom claims por endpoint
- Zod validation en todos los inputs
- Parameterized queries (Prisma maneja esto)
- No secrets en código (usar .env)
- Error responses sin stack traces ni paths internos
- Audit log de accesos autorizados y no autorizados (Winston)

## Documentación de referencia

Antes de implementar cualquier feature, consultá estos documentos:

| Documento | Qué contiene |
|---|---|
| [`docs/specs/2026-04-29-move-architecture-design.md`](docs/specs/2026-04-29-move-architecture-design.md) | Spec completo: tabla RF→AC, descomposición de servicios, flujos detallados (reserva empresa, particular, pago, pipeline GPS, SSE), comunicación inter-service, ADRs, estrategias de resiliencia |
| [`docs/context/project-context.md`](docs/context/project-context.md) | Contexto general: equipo, stack, patrones, requisitos no funcionales clave, convenciones de commits |
| [`docs/ObligatorioAR2026.md`](docs/ObligatorioAR2026.md) | Letra del obligatorio: funcionalidades F1-F19, requisitos R1-R10, criterios de evaluación, rúbrica de demo |
| [`docs/diagrams/architecture-diagrams.md`](docs/diagrams/architecture-diagrams.md) | Diagramas Mermaid: vista de componentes, comunicación, clean architecture, cascade IA |
| [`docs/PLAN.md`](docs/PLAN.md) | Plan de implementación: 4 fases, tareas por integrante, hitos, dependencias |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Convenciones del equipo: git workflow, Kanban, estrategia de testing, estructura de directorios |
| [`docs/context/external-services.md`](docs/context/external-services.md) | Servicios externos: Firebase Auth, MercadoPago, OpenRouteService, Ollama, pgvector — qué son, cómo se usan, Ports & Adapters, variables de entorno |

### Reglas para agentes

- **Siempre** leer el spec de arquitectura antes de implementar una feature — contiene los flujos exactos, las tácticas elegidas y las justificaciones
- Si una decisión está documentada en un ADR, seguirla. No cambiar sin consultar al equipo
- Los eventos RabbitMQ y sus contratos están definidos en el spec — respetar nombres y payloads
- El cascade de clasificación (R10) tiene un orden específico (Embeddings → Rule-based → LLM) — no alterar
- Todos los servicios externos usan Ports & Adapters (ADR-022): nunca llamar al SDK de MercadoPago, Firebase u ORS directamente desde un use case — siempre a través de su interfaz (Port)
- Para implementar un adapter nuevo, ver `docs/context/external-services.md` — tiene las interfaces definidas y las variables de entorno requeridas

## Environment Variables

Cada servicio tiene su `.env` (no se commitea). Ver `.env.example` para referencia.

Variables compartidas:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
RABBITMQ_URL=amqp://...
FIREBASE_PROJECT_ID=...
```
