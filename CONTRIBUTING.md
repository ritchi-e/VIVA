# Contributing to AI Viva

Thank you for your interest in contributing. This project is a production-oriented educational assessment platform; changes should stay focused, tested where practical, and documented when they affect behavior or architecture.

## Getting started

1. Fork and clone the repository.
2. Copy `.env.example` to `.env` and adjust values if needed. Default `AI_PROVIDER=mock` avoids paid API calls.
3. Start the stack: `docker compose up --build`
4. For local backend development without Docker, use Python 3.11+ and PostgreSQL/pgvector; see [docs/development.md](docs/development.md).

## Development workflow

- Work on a feature branch from `main`.
- Keep commits logical and scoped (e.g. `feat(viva): persist session state transitions`).
- Update `docs/implementation-status.md` when completing a phase milestone.
- Update relevant `docs/` pages when you change APIs, data models, or security behavior.
- Add or extend ADRs in `docs/adr/` for significant architectural decisions.

## Code style

**Backend (Python / Django)**

- Follow existing app boundaries; prefer service layers over fat views.
- Use type hints where the codebase already does.
- Enforce tenant isolation and RBAC in the API layer, not only in the UI.
- Never commit secrets; use environment variables.

**Frontend (React / TypeScript)**

- Vite + React Router + Tailwind; not Next.js.
- Match existing component and routing patterns.
- Voice viva uses the browser Web Speech API (client-side STT/TTS).

## Testing

- Backend: `cd backend && pytest -q` (CI also runs coverage + migration check).
- Frontend: `cd frontend && npm ci && npm run lint && npm run build`.
- AI eval: `python scripts/eval/run_eval.py` (mock provider).
- See [docs/testing.md](docs/testing.md) and [docs/deployment.md](docs/deployment.md) for CI/CD.

## Pull requests

- Describe the problem and solution clearly.
- Link related issues if any.
- Confirm Docker Compose still starts and core paths work for your change.
- Do not include `.env`, API keys, or student-like real data.

## Security

Report security issues privately to the maintainers rather than opening a public issue. See [docs/security.md](docs/security.md) and [docs/threat-model.md](docs/threat-model.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
