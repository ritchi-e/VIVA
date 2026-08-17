# Implementation Status

Last updated: 2026-08-09

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Repository & Docker | ✅ Done | Compose stack: postgres/pgvector, redis, minio, backend, celery, frontend, prometheus, grafana |
| Documentation | ✅ Done | PRD, SRS, architecture, ADRs, topic docs, interview guide, final review |
| Auth & multi-tenancy | ✅ Done | JWT, orgs/memberships, RBAC, `X-Organization-ID`, Google OAuth stub |
| Courses / assignments / rubrics | ✅ Done | Full CRUD + publish + nested rubric/LOs |
| Submissions pipeline | ✅ Done | MinIO upload, Celery adapters (PDF/DOCX/PPTX/ZIP/GitHub) |
| RAG / embeddings | ✅ Done | Chunk embeddings via AIProvider; cosine retrieval; knowledge nodes |
| Question engine | ✅ Done | Planner separated from wording; provenance stored |
| Viva orchestrator | ✅ Done | State machine + WebSocket + adaptive follow-ups |
| Answer evaluation | ✅ Done | Structured AI evaluation persisted |
| Assessment + HITL | ✅ Done | Draft assessment, modify audit trail, finalize |
| Voice (Web Speech) | ✅ Done | Browser STT/TTS with text fallback |
| Observability | ✅ Done | Structured JSON logs, Prometheus `/metrics`, Grafana datasource |
| Tests | ✅ Done | 6 pytest tests + frontend production build |
| AI evaluation | ✅ Done | Synthetic suite; mock provider results in `scripts/eval/results.json` |
| Demo seed | ✅ Done | `python manage.py seed_demo_data` |
| CI | ✅ Done | GitHub Actions: backend tests/coverage, frontend lint/build, Docker, AI eval |
| CD | ✅ Done | GHCR image publish + SSH deploy to Linode + health check |

Legend: ✅ Done · 🟡 In progress · ⬜ Pending

## Demo accounts (after seed)

Password for all: `DemoPass123!`

- `admin@northbridge.edu` — organization_admin
- `instructor@northbridge.edu` — instructor
- `alex.morgan@student.northbridge.edu` — student
- `jordan.lee@student.northbridge.edu` — student
- `riley.patel@student.northbridge.edu` — student

## Verified locally

- [x] Backend pytest (6 passed)
- [x] Frontend `npm run build`
- [x] AI evaluation suite (0 failures on mock provider)
- [ ] `docker compose up --build` (pending operator approval in this environment)

## AI evaluation snapshot (mock provider)

See [`scripts/eval/results.json`](../scripts/eval/results.json):

- cases: 3
- failure_rate: 0.0
- estimated_cost_usd: 0.0
- note: deterministic mock results; not comparable to production LLM quality
