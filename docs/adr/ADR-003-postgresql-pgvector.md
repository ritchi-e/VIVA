# ADR-003: PostgreSQL + pgvector

## Status

Accepted

## Context

The system needs relational data (orgs, rubrics, sessions) and **vector similarity search** over submission chunks for RAG, with **tenant and submission filters** in the same query.

## Decision

Use **PostgreSQL 16** as the sole primary database with the **pgvector** extension. Store embeddings alongside chunk rows (or dedicated vector column on `SubmissionChunk`). Use SQL filters for `organization_id` / `submission_id` with vector distance operators.

## Alternatives considered

| Alternative | Why not (MVP) |
|-------------|----------------|
| Pinecone / Weaviate | Extra service, cost, tenant isolation complexity |
| Elasticsearch vectors | Heavier ops; relational joins still needed |
| SQLite dev only | No pgvector parity in CI without extra setup |

## Trade-offs

- **Pros:** One datastore, ACID, joins for citations, simpler backup/restore.
- **Cons:** Vector index tuning (HNSW/IVFFlat) is ops work; very large corpora may need sharding later.

## Consequences

- Docker image `pgvector/pgvector:pg16`.
- Embedding dimension must match provider (`EMBEDDING_DIMENSIONS` in settings).
- Migration to dedicated vector DB remains possible if retrieval becomes a bottleneck ([scaling.md](../scaling.md)).
