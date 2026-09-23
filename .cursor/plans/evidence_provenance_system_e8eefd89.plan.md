---
name: Evidence Provenance System
overview: "Phase 1 of the Evidence/Provenance/Auditability system for Mokhik: activate and extend existing models (SubmissionChunk, PlannedQuestion/VivaQuestion, AnswerEvaluation, AssessmentEvidence/AssessmentModification, AIRequest, RetrievalLog, AuditLog) rather than duplicating them, add one new lightweight `evidence` app for flags + dashboard/drill-down aggregation, and ship the instructor-facing Evidence Dashboard and Question Drill-down. Contradiction-detection AI, source-highlighting, and the export package are explicitly deferred to Phase 2."
todos:
  - id: migrations
    content: "Data model migrations: SubmissionChunk/SubmissionFile, PlannedQuestion, VivaQuestion, StudentAnswer, AnswerEvaluation (OneToOne→FK + confidence/versioning), AssessmentModification, AIRequest, RetrievalLog, new evidence app"
    status: completed
  - id: ingestion
    content: "Structure-aware chunking: propagate page/slide/paragraph/inner-ZIP-path onto SubmissionChunk in pipeline.py + adapters"
    status: completed
  - id: question-provenance
    content: Populate retrieval_query/prompt_version/model fields on PlannedQuestion and VivaQuestion
    status: completed
  - id: answer-provenance
    content: Wire audio_storage_key + ASR metadata + duration on StudentAnswer
    status: completed
  - id: evaluation-provenance
    content: Confidence/evidence_quality + supersede-on-regenerate logic in viva/evaluation.py; update all call sites to current_evaluation
    status: completed
  - id: evidence-flag
    content: "New evidence app: EvidenceFlag model + manual create/resolve API"
    status: completed
  - id: instructor-review
    content: Per-question instructor review endpoint on AssessmentViewSet + populate AssessmentEvidence in engine.py
    status: completed
  - id: audit-trail
    content: New AuditLog action vocabulary + log_audit() call sites + request-ID threading
    status: completed
  - id: dashboard-drilldown
    content: Evidence dashboard, question drill-down, and coverage read APIs/services
    status: completed
  - id: frontend
    content: "Frontend: types, evidenceApi, EvidenceDashboardPage, QuestionDrillDown, AssessmentReview updates"
    status: completed
  - id: security
    content: WebSocket org-check fix + tenant-isolation tests for all new evidence endpoints
    status: completed
  - id: testing
    content: Full unit/integration/security/regression/AI-failure test pass
    status: completed
  - id: docs-update
    content: Update architecture/security/api docs; document Phase 2 known limitations
    status: completed
isProject: false
---

# Evidence, Provenance & Auditability — Phase 1 (Core)

## Audit complete
- [`docs/evidence-system-audit.md`](../docs/evidence-system-audit.md) — full inventory of existing models/APIs/frontend/gaps/duplication risks/integration points.
- [`docs/evidence-system-design.md`](../docs/evidence-system-design.md) — Phase 1 design: models, migrations, APIs, services, security, testing, rollout.

## Key finding
Mokhik already has most of the raw provenance data (JSON blobs on `VivaQuestion.provenance`/`PlannedQuestion.metadata`, unused `AssessmentEvidence`, working `AssessmentModification` override-history, `AuditLog`, `AIRequest`, `RetrievalLog`). Phase 1 is mostly **activation + promotion of existing structures**, not new subsystems — with one genuinely new lightweight `evidence` app for flags and cross-cutting dashboard/drill-down reads.

## Confirmed scope decisions
- **Phased core** — defer contradiction detection (AI/heuristic), source-viewer highlighting, and export package to Phase 2.
- **Supersede-with-flag** on `AnswerEvaluation` (new row + `is_current`/`version`) rather than a separate revision model — requires converting `AnswerEvaluation.answer` from `OneToOneField` to `ForeignKey` (the one breaking migration in this phase).
- **Flag scaffold only** — `EvidenceFlag` model + manual instructor create/resolve API; no automated detection logic yet.

## What's genuinely new vs. extended
- **New:** `evidence` Django app (`EvidenceFlag` model, dashboard/drill-down/coverage read APIs, services).
- **Extended (no duplication):** `SubmissionChunk` (+location fields), `SubmissionFile` (+extractor_version), `PlannedQuestion`/`VivaQuestion` (+provenance columns), `StudentAnswer` (+metadata/duration), `AnswerEvaluation` (+confidence/evidence_quality/versioning — breaking OneToOne→FK), `AssessmentModification` (+per-question override FKs/action), `AIRequest` (+session/question/submission FKs, TTS/STT coverage), `RetrievalLog` (+question FK), `AuditLog` (new action vocabulary, no schema change).

## Implementation order
1. Data model & migrations (submissions → questions → viva → assessments → ai → rag → evidence app), in that order, with the `AnswerEvaluation` migration run and regression-tested in isolation before proceeding.
2. Ingestion pipeline: structure-aware chunking (page/slide/inner-ZIP-path propagation) in `submissions/pipeline.py` + adapters.
3. Question provenance: populate new fields in `questions/planner.py` and `viva/orchestrator.py`.
4. Answer provenance: wire `audio_storage_key`/ASR metadata in `viva/views.py`.
5. Evaluation provenance: confidence/evidence_quality + supersede logic in `viva/evaluation.py`, update all `answer.evaluation` call sites to `current_evaluation`.
6. `EvidenceFlag` model + manual create/resolve API in new `evidence` app.
7. Per-question instructor review endpoint (`assessments` app) + `AssessmentEvidence` population in `assessments/engine.py`.
8. Audit trail: new action constants + `log_audit()` call sites + request-ID threading.
9. Evidence dashboard + question drill-down + coverage read APIs (`evidence` app services + views).
10. Frontend: types, `evidenceApi`, `EvidenceDashboardPage`, `QuestionDrillDown`, `AssessmentReview` updates (render `evidence_items`, per-question actions, AI-vs-instructor distinction).
11. Security: WebSocket org-check gap fix, tenant-isolation tests for all new endpoints.
12. Full test pass: unit, integration (submission→...→audit trail), security, regression on existing suite, AI-failure edge cases.
13. Docs: update `architecture.md`/`security.md`/`api.md`, note Phase 2 deferred items as known limitations.

## Explicitly deferred (Phase 2)
Contradiction/inconsistency detection logic, exportable evidence/appeal package, rendered source highlighting (PDF/DOCX/PPTX/code), `AIUsage`/`AIModel` rollups, rich WebSocket provenance consumption in the live student viva UI.
