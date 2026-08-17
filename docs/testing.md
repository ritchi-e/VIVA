# Testing

## Backend (Phase 11)

| Area | Examples |
|------|----------|
| Unit | Services, planners, state transitions |
| API | Auth, CRUD, pagination |
| RBAC | Role denied/allowed per endpoint |
| Tenant | Cross-org access must 404/403 |
| Submissions | Adapter parsing fixtures |
| RAG | Retrieval filters and citation refs |
| Viva | State machine illegal transitions rejected |
| Assessment | HITL modification audit trail |

Run: `docker compose exec backend python manage.py test`

## Frontend

- Component tests for forms and viva UI
- Auth flow tests (login, token refresh)
- Vitest or React Testing Library per `frontend/package.json` scripts

## End-to-end

Playwright path (target):

Create org → instructor → course → assignment → rubric → student → submit → process → viva → assess → instructor modify → finalize.

## CI / CD

| Pipeline | Trigger | Jobs |
|----------|---------|------|
| **CI** (`.github/workflows/ci.yml`) | PR + push to `main` | Backend tests + coverage, migration check, frontend lint/build, Compose validation, Docker builds, mock AI eval |
| **CD** (`.github/workflows/cd.yml`) | Successful CI on `main` | Push images to GHCR → SSH deploy to Linode → health check |

See [deployment.md](deployment.md#7-cicd-github-actions--linode) for secrets and Linode wiring.

## Related

- [ai-evaluation.md](ai-evaluation.md) — LLM quality metrics
- [ADR-012](adr/ADR-012-ai-evaluation-strategy.md)
