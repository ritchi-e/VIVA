# Roadmap

## MVP (Phases 0–8)

Core loop: auth → org → course → assignment → rubric → submission → RAG → question plan → viva → evaluation → assessment → instructor HITL.

Phases 9–12: voice polish, security/observability, tests/AI eval, demo seed, CI, deployment docs.

## V2 (documented, not committed)

- **Assignment-level plagiarism report** — instructor sets viva booking deadline; after all vivas complete, run one cohort-wide check and deliver a single detailed report (who, why, evidence). Current MVP is per-submission only. See [plagiarism.md](plagiarism.md).
- GitHub-native programming assessment workflows
- Advanced presentation analysis (slide layout, speaker notes weighting)
- LMS integrations (Moodle, Google Classroom)
- Instructor analytics dashboards
- Question banks and assessment templates
- Server-side STT/TTS provider implementation

## V3 (documented, not committed)

- Institution-wide admin and policy controls
- Multi-model routing and cost optimization
- Self-hosted / local LLM option
- Public API platform for partners
- Enterprise deployment patterns (SSO, SLA)

## Dependencies

V2 LMS integrations depend on stable core API and tenant model. V3 enterprise features depend on audit, observability, and security hardening from Phase 10.

Track implementation reality in [implementation-status.md](implementation-status.md).
