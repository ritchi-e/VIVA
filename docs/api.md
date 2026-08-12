# API Overview

Base URL (local): `http://localhost:18000/api`

Authentication: **JWT** — obtain tokens at `/api/auth/` (Phase 1). Send `Authorization: Bearer <access>` on protected routes.

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health/` | No | Liveness for Compose healthcheck |

## Mounted routes (scaffold)

Routes are registered in `backend/config/urls.py`. Implementations land in phased delivery.

| Prefix | App | Phase |
|--------|-----|-------|
| `/auth/` | accounts | 1 |
| `/orgs/` | orgs | 1 |
| `/courses/` | courses | 2 |
| `/assignments/` | assignments | 2 |
| `/rubrics/` | rubrics | 2 |
| `/submissions/` | submissions | 3 |
| `/viva/` | viva | 6 |
| `/assessments/` | assessments | 8 |
| `/ai/` | ai | 4+ |
| `/audit/` | audit | 10 |

## Conventions

- Pagination: page size 25 (`PAGE_SIZE` in settings)
- Filtering: `django-filter` query params per viewset
- Errors: JSON via `custom_exception_handler`
- Throttling: anon 60/min, user 300/min, auth 20/min (defaults)

## WebSocket

Base (local): `ws://localhost:18000/ws`

Viva session channel (Phase 6): authenticate on connect; see [viva-orchestrator.md](viva-orchestrator.md).

## Metrics

| Path | Description |
|------|-------------|
| `/metrics` | Prometheus (django-prometheus) |

## OpenAPI

DRF browsable API available in `DEBUG` mode. Formal OpenAPI export may be added in Phase 12.
