# Software Requirements Specification — AI Viva

**Version:** 0.1 (Phase 0)

## 1. System context

AI Viva is a web application: React SPA (browser) communicates with a Django monolith via REST and WebSocket; background workers process submissions and AI tasks; data persists in PostgreSQL; files in MinIO; Redis backs Celery and Channels.

## 2. Functional requirements

### 2.1 Authentication & authorization

- FR-AUTH-1: Email/password registration and login with JWT access/refresh (SimpleJWT).
- FR-AUTH-2: Optional Google OAuth when client ID/secret configured.
- FR-AUTH-3: RBAC roles: `organization_admin`, `instructor`, `student`, `viewer`.
- FR-AUTH-4: API rate limiting (DRF throttling).
- FR-AUTH-5: Password reset and email verification architecture (console backend in dev).

### 2.2 Multi-tenancy

- FR-TENANT-1: All org-scoped resources filtered by organization on the server.
- FR-TENANT-2: Membership links users to organizations with a role.

### 2.3 Instructional design

- FR-COURSE-1: CRUD courses within an organization.
- FR-ASSIGN-1: CRUD assignments with status lifecycle.
- FR-ASSIGN-2: Learning outcomes per assignment.
- FR-RUBRIC-1: Rubrics and weighted criteria linked to assignments.

### 2.4 Submissions

- FR-SUB-1: Upload PDF, DOCX, PPTX; GitHub URL; ZIP where practical.
- FR-SUB-2: Store blobs in object storage; metadata in PostgreSQL.
- FR-SUB-3: Async pipeline: validate → extract → chunk → embed → ready.
- FR-SUB-4: Submission status tracking and versioning.

### 2.5 RAG & intelligence

- FR-RAG-1: Chunk embeddings in pgvector with tenant/submission filters.
- FR-RAG-2: Semantic retrieval with citation references to source chunks.
- FR-RAG-3: Knowledge nodes for structured submission representation.

### 2.6 Questions & viva

- FR-Q-1: Question planner separate from LLM wording; coverage of rubric/LO.
- FR-Q-2: Provenance stored per question (source, criterion, LO, type).
- FR-VIVA-1: Stateful session machine: CREATED → … → COMPLETED / REVIEW_REQUIRED.
- FR-VIVA-2: Adaptive next-question selection using understanding state.
- FR-VIVA-3: WebSocket channel for live session updates.
- FR-VIVA-4: Text and voice modes (voice via browser Web Speech API).

### 2.7 Evaluation & assessment

- FR-EVAL-1: Structured answer evaluation (accuracy, evidence, depth, relevance, follow-up flag).
- FR-ASSESS-1: Assessment per viva with criteria, evidence, AI explanation.
- FR-ASSESS-2: Instructor modification with audit trail; AI cannot finalize grade alone.

### 2.8 AI platform

- FR-AI-1: Provider abstraction: chat, structured output, embeddings; mock default.
- FR-AI-2: OpenAI and Gemini implementations via environment configuration.
- FR-AI-3: Log requests: tokens, latency, cost estimate, success/failure.

### 2.9 Audit & observability

- FR-AUDIT-1: Audit log for sensitive actions.
- FR-OBS-1: Structured logging; Prometheus metrics endpoint; Grafana dashboards (compose).

## 3. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-PERF-1 | Submission processing must not block synchronous API beyond upload acknowledgment. |
| NFR-SEC-1 | Tenant isolation, input validation, upload limits, prompt-injection awareness. |
| NFR-REL-1 | Viva session state persisted; recoverable after worker/process failure. |
| NFR-OPS-1 | `docker compose up` starts full dev stack with health checks. |
| NFR-TEST-1 | Automated tests for auth, RBAC, tenant, core workflows (phased). |

## 4. External interfaces

- REST API under `/api/` (see [api.md](api.md)).
- WebSocket under `/ws/` for viva sessions (Channels).
- S3-compatible API to MinIO for file storage.

## 5. Data requirements

Normalized schema documented in [database.md](database.md). Soft delete and UUID primary keys on domain entities where implemented.

## 6. Traceability

Implementation progress: [implementation-status.md](implementation-status.md). Architecture: [architecture.md](architecture.md).
