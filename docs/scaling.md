# Scaling

MVP targets single-region, modular monolith scale-out—not microservices.

## Web tier

- Horizontal scale: multiple **Daphne** processes behind a load balancer
- WebSocket: sticky sessions or shared Redis channel layer (already used)
- Static frontend: CDN or nginx container replicas

## Workers

- Scale **Celery workers** independently for submission/embedding load
- Separate queues later: `extraction`, `embeddings`, `default` if needed

## Database

- PostgreSQL read replicas for reporting (future)
- pgvector indexes (HNSW) when chunk count grows
- Connection pooling (PgBouncer) at high concurrency

## Redis

- Dedicated Redis for Channels vs Celery in large deploys
- Memory limits and eviction policies tuned per workload

## Object storage

- S3 scales horizontally; lifecycle policies for old submission versions

## AI cost

- Mock in dev; cache embeddings per chunk hash
- Smaller models for wording vs evaluation where quality allows
- Track spend via `AIRequest` aggregates

## When to split services

Consider extracting only if:

- Embedding throughput blocks API latency despite worker scale
- Regulatory requirement for isolated AI inference

Otherwise retain monolith per [ADR-001](adr/ADR-001-modular-monolith-architecture.md).
