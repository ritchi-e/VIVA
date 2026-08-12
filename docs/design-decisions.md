# Design Decisions (index)

Quick index of major decisions. Authoritative detail lives in ADRs.

| Topic | Decision | ADR |
|-------|----------|-----|
| Application shape | Modular monolith | [ADR-001](adr/ADR-001-modular-monolith-architecture.md) |
| HTTP API | Django REST Framework | [ADR-002](adr/ADR-002-django-rest-framework.md) |
| Primary DB + vectors | PostgreSQL + pgvector | [ADR-003](adr/ADR-003-postgresql-pgvector.md) |
| Async + WS backing | Redis + Celery | [ADR-004](adr/ADR-004-redis-celery.md) |
| Files | MinIO / S3 abstraction | [ADR-005](adr/ADR-005-object-storage-minio-s3.md) |
| Viva lifecycle | Persisted state machine | [ADR-006](adr/ADR-006-stateful-viva-orchestration.md) |
| LLM integration | Provider abstraction, mock default | [ADR-007](adr/ADR-007-llm-provider-abstraction.md) |
| Grading authority | Human-in-the-loop | [ADR-008](adr/ADR-008-human-in-the-loop-assessment.md) |
| Grounding | In-DB RAG with citations | [ADR-009](adr/ADR-009-rag-architecture.md) |
| Live UI | Django Channels WebSocket | [ADR-010](adr/ADR-010-websocket-real-time-communication.md) |
| Tenancy | Shared schema, org scoping | [ADR-011](adr/ADR-011-multi-tenancy-strategy.md) |
| Quality measurement | Synthetic AI eval suite | [ADR-012](adr/ADR-012-ai-evaluation-strategy.md) |

## Stack locks (not FastAPI / Next.js)

- Backend: Django, DRF, Channels, Celery
- Frontend: React, Vite, TypeScript, Tailwind, React Router
- Voice MVP: browser Web Speech API

## Product locks

- Assess understanding, not AI usage
- AI assessments require instructor review

See also [architecture.md](architecture.md) and [development-plan.md](development-plan.md).
