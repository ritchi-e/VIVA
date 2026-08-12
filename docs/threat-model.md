# Threat Model

Scope: MVP multi-tenant SaaS running in Docker locally; production deployment assumptions documented in [deployment.md](deployment.md).

## Assets

- Student submissions (PII, academic work)
- Instructor rubrics and grades
- Organization membership and roles
- API keys (OpenAI/Gemini) in environment
- JWT refresh tokens

## Threat actors

| Actor | Goal |
|-------|------|
| Malicious student | Cheat viva, access other students’ data, poison RAG |
| Compromised account | Lateral movement within or across orgs |
| External attacker | Data exfiltration, DoS, credential stuffing |

## Key threats & mitigations

| Threat | Mitigation |
|--------|------------|
| **Cross-tenant data access** | Org-scoped querysets; tenant isolation tests |
| **IDOR on submissions/sessions** | Object-level permissions per role |
| **Malicious document (prompt injection)** | Separate system vs retrieved content; no tool execution from submission text |
| **Upload malware** | Type/size limits; no execution; scan optional future |
| **Student code in repo** | Static fetch only; no `exec` on server |
| **JWT theft** | Short access TTL; HTTPS in prod; secure storage guidance for SPA |
| **Credential stuffing** | Throttling; strong password validators |
| **MinIO bucket misconfiguration** | Private bucket; no public anonymous in production |
| **AI grade manipulation** | HITL; AI outputs not final |

## Out of scope (MVP)

- Nation-state adversaries
- Hardware security modules
- Formal penetration test

## Review cadence

Revisit after Phase 10 security hardening and before production deploy.
