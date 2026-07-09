## Resumen

<!-- Qué cambia y por qué. 1-3 oraciones. -->

**Servicio(s)**: `<!-- booking / operations / tracking / ai-worker / gps-sim / shared / infra -->`
**Funcionalidad(es)**: `<!-- F1, F4.1, F14-F16, etc. o "N/A" si es chore/infra -->`
**Requisito(s) no funcional(es)**: `<!-- R1, R7, R10, etc. o "N/A" -->`

## Cambios

-

## Comunicación inter-service

<!-- Completar SOLO si el PR agrega/modifica eventos o colas. Sino borrar sección. -->

- Evento(s) RabbitMQ: `<!-- reservation.unclassified, alert.created, etc. -->`
- Cola(s) Bull: `<!-- gps-pipeline-*, ai-categorization, etc. -->`

## Plan de testing

- [ ] Tests unitarios pasan (`pnpm --filter <service> test`)
- [ ] Tests de integración pasan (si aplica)
- [ ] Lint y typecheck pasan (`pnpm -r lint && pnpm -r typecheck`)
- [ ] Probado localmente con `docker compose up` (si afecta infra)
- [ ] Coverage >= 80% en archivos modificados

## Checklist

- [ ] Sigue Clean Architecture (domain no importa de infrastructure/presentation)
- [ ] Conventional Commits en español
- [ ] Sin secrets hardcodeados
- [ ] Validación de inputs con Zod en los bordes
- [ ] Error handling con tipos explícitos (no strings ni Error genérico)
- [ ] RBAC verificado en el endpoint (si es nuevo endpoint)
- [ ] ADR creado/actualizado (si es decisión arquitectónica)
