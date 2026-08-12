# Security

## Authentication

- JWT access (30 min) / refresh (7 days) via SimpleJWT
- Password hashing: Django defaults
- Optional Google OAuth when env configured
- Rate limiting on auth endpoints

## Authorization

RBAC roles: `organization_admin`, `instructor`, `student`, `viewer`. Enforced in DRF permission classes, not in React alone.

## Multi-tenancy

Server-side queryset filtering by organization ([ADR-011](adr/ADR-011-multi-tenancy-strategy.md)). RAG queries must include tenant predicates in SQL.

## Data protection

- Secrets in environment variables only; `.env` gitignored
- Uploaded files in private bucket; presigned URLs when exposed
- Soft delete for domain records; audit for sensitive mutations

## Application hardening

- `SECURE_CONTENT_TYPE_NOSNIFF`, XSS filter, `X_FRAME_OPTIONS = DENY`
- CORS allowlist via `DJANGO_CORS_ALLOWED_ORIGINS`
- CSRF for session-based flows; JWT APIs use bearer tokens
- Upload type and size validation

## AI-specific

- Prompt injection defenses ([threat-model.md](threat-model.md))
- AI cannot finalize grades ([ADR-008](adr/ADR-008-human-in-the-loop-assessment.md))

## Audit

`AuditLog` for admin actions, assessment finalization, permission changes (expanded in Phase 10).
