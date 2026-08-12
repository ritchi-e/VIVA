# ADR-004: Redis + Celery

## Status

Accepted

## Context

Submission processing, embeddings, and report generation are long-running. Live viva uses WebSockets. We need a broker, result backend, and Channel layer backend without adding Kafka for MVP.

## Decision

Use **Redis** for:

- Celery broker and result backend (separate logical DB indexes in `REDIS_URL` family)
- Django Channels layer (`CHANNELS_REDIS_URL`)
- Optional caching later

Run **Celery worker** and **Celery beat** as separate Compose services.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| RabbitMQ | Extra service; Redis sufficient at MVP scale |
| Django-Q / RQ | Less ecosystem alignment with Channels + beat schedules |
| Synchronous processing in request | Blocks API; poor UX for large PDFs |

## Trade-offs

- **Pros:** Single Redis image in Compose; familiar Celery task model, retries, timeouts in settings.
- **Cons:** Redis persistence must be configured for production; Celery task idempotency must be designed explicitly.

## Consequences

- Task timeouts: `CELERY_TASK_TIME_LIMIT` / soft limit in settings.
- Idempotent tasks for extraction and embedding ([submission-processing.md](../submission-processing.md)).
- Beat used for scheduled jobs (cleanup, retries) in later phases.
