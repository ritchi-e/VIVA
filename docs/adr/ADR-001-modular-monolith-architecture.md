# ADR-001: Modular Monolith Architecture

## Status

Accepted

## Context

AI Viva is a portfolio-grade SaaS with many domains (auth, submissions, RAG, live viva, assessments) but a single team and local Docker demo requirement. We need clear boundaries without operational overhead of many services.

## Decision

Implement a **modular monolith**: one Django codebase deployed as one ASGI process (Daphne) plus Celery workers, with domain logic split into Django apps (`accounts`, `orgs`, `viva`, …) and service modules inside apps.

## Alternatives considered

| Alternative | Why not (for MVP) |
|-------------|-------------------|
| Microservices per domain | High ops cost, distributed transactions, harder local demo |
| Separate AI service | Extra network hop; AI already abstracted in `ai` app |
| FastAPI backend | Conflicts with locked stack; DRF + Channels ecosystem fit |

## Trade-offs

- **Pros:** Simple deploy, shared transactions, easy refactor across apps, one migration stream.
- **Cons:** Scaling requires scaling whole app; blast radius of bugs is wider than isolated services.

## Consequences

- Use app-level imports sparingly; prefer services and stable model APIs.
- Defer service extraction only when a component has independent scaling or release cadence needs.
- Document module boundaries in [architecture.md](../architecture.md).
