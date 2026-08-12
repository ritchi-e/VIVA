# ADR-011: Multi-Tenancy Strategy

## Status

Accepted

## Context

Multiple institutions use one deployment. Data leaks between organizations are unacceptable. Frontend route hiding is insufficient.

## Decision

**Shared database, shared schema** with **organization_id scoping**:

- Tenant root: `Organization`
- Users belong via `Membership` with role
- Every org-scoped queryset filtered server-side (mixins on views/querysets)
- RAG retrieval **must** include tenant filter in SQL, not only in prompt

No row-level security in PostgreSQL for MVP; application-layer enforcement with tests.

## Alternatives considered

| Alternative | Why not (MVP) |
|-------------|----------------|
| Database per tenant | Ops explosion |
| Schema per tenant | Migration complexity |
| Frontend-only filtering | Insecure |

## Trade-offs

- **Pros:** Simple ops, easy cross-org analytics for platform admin (future).
- **Cons:** One bug can leak data—requires rigorous RBAC + tenant tests.

## Consequences

- Permission classes in `common.permissions`.
- Tenant isolation test suite in Phase 11.
- See [security.md](../security.md).
