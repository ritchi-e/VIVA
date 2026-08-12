# ADR-002: Django REST Framework

## Status

Accepted

## Context

The platform needs a typed HTTP API for the React SPA: CRUD for instructional entities, file uploads, pagination, filtering, JWT auth, and consistent error shapes. Django is the chosen web framework.

## Decision

Use **Django REST Framework (DRF)** for all REST endpoints with:

- JWT via `rest_framework_simplejwt`
- Default `IsAuthenticated`, custom permission classes per role/org
- `django-filter`, search, ordering
- Custom exception handler (`common.exceptions.custom_exception_handler`)
- Throttling for anon/user/auth rates

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| FastAPI | Explicitly out of stack scope |
| Django Ninja | Smaller ecosystem overlap with existing DRF patterns |
| GraphQL | Overkill for MVP; SPA maps cleanly to REST resources |

## Trade-offs

- **Pros:** Mature auth, serializers, browsable API in dev, aligns with Django admin.
- **Cons:** Serializer boilerplate; async views less central than in FastAPI (async work goes to Celery).

## Consequences

- No parallel API framework in the same project.
- WebSocket viva protocol lives in Channels, not DRF.
- API documentation maintained in [api.md](../api.md).
