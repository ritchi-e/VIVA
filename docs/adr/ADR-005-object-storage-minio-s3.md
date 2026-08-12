# ADR-005: Object Storage with MinIO / S3 Abstraction

## Status

Accepted

## Context

Student submissions (PDF, ZIP, etc.) must not live in PostgreSQL blobs. Production will use S3-compatible storage; local dev must not require AWS.

## Decision

Use **MinIO** in Docker Compose for development. Access via **boto3** and `common.storage` helpers. Store `storage_key` on `SubmissionFile`; bucket ensured by `manage.py ensure_bucket`.

Environment variables follow AWS naming (`AWS_S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, …) for portability to real S3.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Local filesystem only | Breaks multi-instance deploys |
| PostgreSQL bytea | Bad for large files and backups |
| Dedicated media server | Unnecessary for MVP |

## Trade-offs

- **Pros:** Same code path for MinIO and S3; scalable file serving.
- **Cons:** MinIO console credentials must not leak to production patterns; presigned URL policy to be hardened in Phase 10.

## Consequences

- Upload validation and size limits at API layer.
- Celery workers read objects by key, not local paths.
- See [deployment.md](../deployment.md) for production bucket policy.
