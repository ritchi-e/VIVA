# Development Guide

## Prerequisites

- Docker & Docker Compose

## Docker workflow

```bash
cp .env.example .env
docker compose up
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:13000 |
| Backend API | http://localhost:18000/api |
| Django admin | http://localhost:18000/admin |
| Postgres (host) | `localhost:15432` |
| Redis (host) | `localhost:16379` |
| MinIO API / console | http://localhost:19000 / http://localhost:19001 |
| Prometheus | http://localhost:19090 |
| Grafana | http://localhost:13001 (admin / admin) |

Backend code is volume-mounted in dev (`./backend:/app`).

### First-time setup

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py seed_demo_data
```

### Logs (debugging)

```bash
docker compose logs -f backend
docker compose logs -f celery-worker
docker compose logs -f frontend
```

### Stop / restart

```bash
docker compose down
docker compose up -d
docker compose restart backend
```

Rebuild only when Dockerfiles or dependencies change: `docker compose up --build`.

## AI provider

Default `AI_PROVIDER=mock` — no external calls. To test OpenAI or Gemini, set keys in `.env` and switch provider.

## Code layout

- Django apps under `backend/<app>/`
- Shared utilities: `backend/common/`
- AI: `backend/ai/`
- Frontend routes: `frontend/src/` (React Router)

## Docs

Update `docs/implementation-status.md` when finishing a phase. ADRs for architectural changes.

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [testing.md](testing.md)
