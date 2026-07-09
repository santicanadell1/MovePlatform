# MOVE Platform

Plataforma de gestión de traslados urbanos de bienes: reservas, cotización, asignación de vehículos y **seguimiento GPS en tiempo real** con detección automática de alertas.

Este proyecto es el entregable del obligatorio de **Arquitectura de Software** (Universidad ORT Uruguay, 2026). La consigna pedía diseñar e implementar una plataforma completa que resolviera un dominio real (una empresa de traslados de bienes) aplicando decisiones de arquitectura fundamentadas, atributos de calidad medibles y patrones de diseño, no solo "que funcione".

Lo desarrollamos en equipo de tres. Mi parte fue el **tracking-service**: la recepción de GPS y todo el pipeline de procesamiento en tiempo real que detecta zonas peligrosas y paradas prolongadas y genera las alertas.

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

Elegimos una arquitectura **Service-Based orientada a eventos**, un punto intermedio entre SOA y microservicios.

- **No es microservicios** porque no usamos una base de datos por servicio: tenemos una única base **PostgreSQL** dividida en **tres esquemas** (uno por servicio), lo que da separación lógica sin la complejidad de la consistencia distribuida.
- **No es SOA clásico** porque no hay un ESB pesado: los servicios se integran a través de un broker liviano.
- La comunicación **entre servicios es 100% asíncrona** por colas de RabbitMQ. Ningún servicio llama a otro de forma directa, así una falla en un servicio no tumba a los demás: el evento espera en la cola y se procesa cuando el servicio se recupera.

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

## Equipo y mi rol

Proyecto desarrollado en equipo de tres para el obligatorio de Arquitectura de Software (ORT, 2026).

Mi aporte fue el **tracking-service**: el endpoint de recepción de GPS, el pipeline completo de siete etapas (Pipes and Filters con colas Bull), la generación de alertas por geofence y por parada prolongada, el simulador GPS para pruebas, y los tests del servicio.
