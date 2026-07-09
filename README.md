# MOVE Platform

Plataforma de gestión de traslados urbanos de bienes: reservas, cotización, asignación de vehículos y **seguimiento GPS en tiempo real** con detección automática de alertas.

Este proyecto es el entregable del obligatorio de **Arquitectura de Software** (Universidad ORT Uruguay, 2026). La consigna pedía diseñar e implementar una plataforma completa que resolviera un dominio real (una empresa de traslados de bienes) aplicando decisiones de arquitectura fundamentadas, atributos de calidad medibles y patrones de diseño, no solo "que funcione".

---

## Qué hace

- **Reservas** de traslados para clientes empresa (con productos preregistrados) y particulares (con descripción en texto libre).
- **Clasificación automática con IA** del bien a trasladar, mediante una cascada de tres estrategias (reglas, embeddings y un LLM local).
- **Cotización** según distancia real de ruta (OpenRouteService) y categoría del bien.
- **Pago** con circuit breaker, tolerante a fallas de la pasarela.
- **Asignación** de vehículo y conductor por parte de un operador.
- **Seguimiento GPS en tiempo real**: un pipeline procesa cada punto y genera alertas cuando el vehículo entra en una zona roja o se detiene demasiado tiempo.
- **Observabilidad**: métricas en Prometheus, dashboards en Grafana, logs estructurados con trazas.

---

## Arquitectura

Elegimos una arquitectura **Service-Based orientada a eventos**, porque nos pareció la opción que mejor equilibraba lo que pedía la consigna: servicios independientes y desplegables por separado, pero sin la complejidad operativa de los microservicios puros, que para el alcance del proyecto no se justificaba.

Se apoya en tres decisiones centrales:

- **Una única base PostgreSQL dividida en tres esquemas** (uno por servicio). Cada servicio accede solo a su esquema, lo que da separación lógica de datos sin tener que resolver consistencia entre bases distribuidas.
- **Servicios de baja granularidad**: tres servicios grandes de dominio en lugar de decenas de servicios pequeños, más fáciles de razonar y operar para este alcance.
- **Comunicación 100% asíncrona entre servicios** vía colas de RabbitMQ. Ningún servicio llama a otro de forma directa, así una falla en un servicio no tumba a los demás: el evento espera en la cola y se procesa cuando el servicio se recupera. Esto es lo que sostiene la disponibilidad del sistema.

El sistema son **13 contenedores Docker**: tres servicios HTTP (booking, operations, tracking), dos workers (clasificación IA y simulador GPS), un API Gateway (nginx como reverse proxy) y la infraestructura de apoyo (PostgreSQL, Redis, RabbitMQ, Ollama, OpenRouteService, Prometheus, Grafana).

Cada servicio sigue **Clean Architecture** en cuatro capas (dominio, aplicación, infraestructura, presentación), con inyección de dependencias, de modo que el dominio no depende de la infraestructura.

---

## Decisiones y patrones de arquitectura

Estas son las decisiones que sostienen los atributos de calidad que pedía la consigna:

- **Pipes and Filters (pipeline GPS):** cada punto GPS recorre siete etapas encadenadas (validación, enriquecimiento, persistencia, geofence, detección de paradas, generación de alerta, notificación), cada una con su propia cola sobre Redis. El endpoint encola el punto y responde al instante; el procesamiento es asíncrono. Esto da **rendimiento** (no bloquea la recepción), **escalabilidad** (cada etapa escala por separado) y **modificabilidad** (se cambia una etapa sin tocar las demás).
- **Ports & Adapters:** todos los servicios externos (pago, autenticación, geolocalización, email, IA) están detrás de una interfaz, con adapters intercambiables. Cambiar de proveedor no toca la lógica de negocio, y en tests se inyectan mocks.
- **Circuit Breaker (opossum):** sobre pago, autenticación y geolocalización. Ante fallas, el circuito se abre y falla rápido en lugar de colgarse, protegiendo el flujo de reservas (disponibilidad).
- **Degradación graciosa:** si OpenRouteService no responde, la cotización cae a un cálculo de distancia en línea recta (Haversine) en vez de fallar.
- **Federated Identity:** la autenticación se delega en Firebase (JWT con custom claims); la autorización (RBAC por rol) se resuelve en cada servicio.
- **Proyecciones de eventos (read models):** operations mantiene copias locales de datos que nacen en otros servicios, actualizadas por eventos de RabbitMQ, para no cruzar esquemas ajenos y preservar el aislamiento.
- **Clasificación IA en cascada:** reglas por palabras clave, luego búsqueda semántica con embeddings (pgvector) y, solo si hace falta, un LLM local (Ollama), corrido de forma asíncrona en un worker para no bloquear al cliente.

---

## Rendimiento y escalado

El sistema se probó con **k6** bajo carga normal y bajo carga 50x (500 reservas/min, 250 usuarios virtuales de GPS): **216.500 requests con 0% de errores**, cumpliendo los SLAs. El escalado horizontal se hace con `docker compose --scale`, y nginx balancea la carga; al escalar tracking usa consistent hashing por dispositivo para que los puntos de un mismo vehículo lleguen siempre a la misma instancia.

---

## Stack

**Backend:** TypeScript · Node.js 20 · Express · Inversify (DI)
**Datos:** PostgreSQL (PostGIS + pgvector) · Prisma · Redis
**Mensajería y colas:** RabbitMQ (entre servicios) · Bull sobre Redis (pipelines internos)
**Resiliencia:** opossum (circuit breaker)
**IA:** Ollama (nomic-embed-text para embeddings, qwen2.5 como LLM)
**Geolocalización:** OpenRouteService · turf.js
**Auth:** Firebase (JWT + RBAC)
**Frontend:** TypeScript · Vite · Leaflet (mapa)
**Observabilidad:** Prometheus · Grafana · Winston
**Validación:** Zod
**Infra:** Docker · Docker Compose · nginx (API gateway / reverse proxy)

---

## Cómo levantarlo

Requiere Docker. Con las variables de entorno configuradas (ver `.env.example` en la raíz y en cada servicio):

```bash
docker compose up -d
```

Levanta los 13 contenedores. El API Gateway queda expuesto en `http://localhost:8000`.

---

## Documentación

- [Informe final](docs/MOVE-informe-final.pdf) — documentación completa de la arquitectura (vistas, decisiones y ADRs, atributos de calidad).
- [Letra del obligatorio](docs/letra-obligatorio.pdf) — la consigna original de la materia, como referencia del problema a resolver.

---

## Equipo

Proyecto desarrollado en equipo de tres para el obligatorio de Arquitectura de Software (Universidad ORT Uruguay, 2026).
