# Interview Guide — AI Viva

Answers reflect the **actual** implementation in this repository.

## Product

**Why this product?**  
Generative AI makes submission authorship hard to verify. Detectors are brittle. AI Viva assesses whether a student can explain and defend submitted work.

**What problem does it solve?**  
Instructors need evidence of understanding, not a binary “AI wrote this” score.

**Who is the user / who pays?**  
Instructors and institutions. Students are end users of the viva experience. Institution admins manage org membership.

**Why not ChatGPT alone?**  
ChatGPT has no tenant isolation, assignment rubrics, submission ingestion, persisted viva state, audit trail, or human-in-the-loop grade finalization.

**Why not an AI detector?**  
Detectors target generation provenance. AI Viva targets demonstrated understanding with evidence for instructor review.

**Limitations?**  
Mock AI is default; production quality depends on configured LLM. OCR is limited. Student code is never executed. Browser Web Speech quality varies by browser. AI scores are recommendations only.

## Architecture

**Why Django / DRF?**  
Modular monolith, mature auth/admin/ORM, DRF for REST, Channels for WebSockets — one deployable app (ADR-001/002).

**Why PostgreSQL + pgvector?**  
Relational integrity for multi-tenant assessment data; vectors for RAG in the same database (ADR-003). Embeddings are stored on `SubmissionChunk` (JSON in MVP; pgvector-ready).

**Why Redis + Celery?**  
Async document processing, embeddings, and report work without blocking API requests (ADR-004).

**Why WebSockets?**  
Live viva turn-taking with reconnect; REST answer fallback exists (ADR-010).

**Why modular monolith?**  
Portfolio-scale complexity without microservice operational cost (ADR-001).

**Scaling?**  
Scale Celery workers horizontally; put API behind multiple Daphne/gunicorn workers; move MinIO to S3; add read replicas; cache embeddings; keep viva state in Postgres.

## AI

**Why RAG?**  
Questions and evaluations must ground in the student’s artifacts and rubric, with citations where possible (ADR-009).

**Question generation?**  
`questions/planner.py` plans coverage (type, criterion, purpose, evidence). Wording is a separate LLM step. Provenance is stored on `VivaQuestion`.

**Adaptive questioning?**  
`viva/orchestrator.py` updates `understanding_state`, can insert follow-ups when evaluation requires it, and selects uncovered planned questions.

**Hallucinations?**  
System prompts separate untrusted student content; structured schemas; citations from retrieved chunks; instructor review required.

**Evaluate the evaluator?**  
`scripts/eval/` synthetic dataset measures grounding, retrieval hit@1, score-band consistency, latency/cost (mock).

**Prompt injection?**  
Student text treated as data; instructions tell models to ignore embedded directives; threat model documented in `docs/threat-model.md`.

## Distributed systems

**Celery crash?**  
Task retries; submission status `FAILED` with error; re-queue possible. Viva state lives in Postgres so sessions recover after process death.

**Idempotency?**  
Submission processing keyed by submission id; assessment `update_or_create` on viva session.

**Concurrent sessions?**  
Each viva is a row with state machine transitions; WebSocket group per session id.

## Security

**Tenant isolation?**  
`X-Organization-ID` + membership check; querysets filter by organization (ADR-011). Never trust frontend filtering alone.

**Can AI finalize grades?**  
No. Assessments remain pending until instructor `finalize` (ADR-008). Disclaimer is always shown.

**Malicious documents?**  
Type/size validation, no code execution, object storage isolation, prompt-injection defenses.

## Cost

**Reduce tokens?**  
Chunking, retrieval top-k, structured short schemas, mock provider for local/dev.

**Model selection?**  
`AI_PROVIDER=mock|openai|gemini` plus model env vars.

**Monitor cost?**  
`AIRequest` rows track tokens, latency, estimated USD; `/api/ai/usage/` for admins.
