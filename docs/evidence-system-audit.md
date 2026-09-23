# Evidence, Provenance & Auditability System — Repository Audit

**Status:** Phase 0 output. Read before any implementation begins.
**Scope of this document:** inventory of what already exists in Mokhik relevant to evidence, provenance, RAG, viva assessment, evaluation, logging, and auditability — and what is genuinely missing.

This audit was produced by inspecting the actual codebase (Django backend under `backend/`, React frontend under `frontend/`, infra under the repo root) rather than assuming the spec's model list is needed wholesale. The headline finding: **Mokhik already has ~70% of the raw provenance data the spec asks for**, but it is scattered across untyped JSON blobs (`VivaQuestion.provenance`, `PlannedQuestion.metadata`, `AnswerEvaluation.raw`), several tables exist but are never populated (`AssessmentEvidence`, `AIUsage`, `AIModel`, `KnowledgeNode.source_ref`), and there is no unifying "evidence" concept, no flag/contradiction system, and no per-answer instructor override. The frontend already renders some of this (`source_ref` + excerpt on `VivaSessionDetailPage`), but `AssessmentEvidence`/`evidence_items` and WebSocket `provenance` are typed and never rendered.

---

## 1. Existing functionality

### 1.1 Submission provenance (partial)
- `Submission` has `version`, `metadata`, `processing_stage`, `processed_at`, `assignment_mismatch` (`backend/submissions/models.py:6-61`).
- `SubmissionFile` has `storage_key`, `checksum`, `content_type`, `extracted_text`, `structure` (`backend/submissions/models.py:64-80`).
- `RepositorySnapshot` has `owner`, `repo`, `default_branch`, **`commit_sha`**, `archive_storage_key`, `stage_timings` (`backend/submissions/models.py:83-107`).
- `RepositoryFile` has `path`, `language`, `category`, **`content_hash`**, `indexed` (`backend/submissions/models.py:110-133`).
- `CodeSymbol` / `CodeDependency` capture parsed function/class names, signatures, line ranges, import graph (`backend/submissions/models.py:136-201`).
- `SubmissionVersion` stores a JSON snapshot per version (`backend/submissions/models.py:285-292`) — but is not surfaced anywhere as a "diff" or provenance trail.

**Gap:** no unified "who uploaded what, when, with what parser version" record; parser/extractor version is not stored at all.

### 1.2 Evidence objects (exists, not unified)
- `SubmissionChunk` is the closest thing to an "Evidence" object today: `content`, `content_hash`, `source_ref`, `path`, `language`, `symbol`, `start_line`, `end_line`, `chunk_kind`, `embedding` (`backend/submissions/models.py:204-248`).
- For GitHub/code, `source_ref` is a real citation (`path:start-end`), and `start_line`/`end_line` are populated from parsed symbols.
- For PDF/DOCX/PPTX/ZIP uploads, **page/slide/paragraph/inner-file location is captured in `SubmissionFile.structure` but never propagated onto individual chunks** — chunks are flat character windows over concatenated text (`backend/submissions/pipeline.py:32-44, 134-155`). This is the single biggest gap for document-based evidence citation (Requirement #2).
- `KnowledgeNode.source_ref` field exists (`backend/rag/models.py:6-50`) but is **never set** by `build_knowledge_nodes()`.

### 1.3 Question provenance (exists in JSON, not typed)
- Two-tier model already exists: `PlannedQuestion` (plan-time) → `VivaQuestion` (asked in session).
- `PlannedQuestion.metadata` already carries `rag_chunks`, `rag_chunk_ids`, `source_chunk_id`, `source_quote`, `grounding_reason`, `planned_by` (`backend/questions/planner.py:376-385`).
- `VivaQuestion.provenance` JSON carries `rag_chunks`, `excerpt`, `source_ref`, `concept`, `expected_evidence`, `rationale` at ask-time (`backend/viva/orchestrator.py:262-288`).
- `PlannedQuestion` already has `concept`, `purpose`, `question_type`, `difficulty`, `rubric_criterion`, `learning_outcome`, `is_follow_up`, `parent_question` (`backend/questions/models.py:24-70`) — this covers most of Requirement #3's "question purpose" taxonomy already, though the exact enum values (decision justification, trade-off, counterfactual, etc.) need checking/extending against `PlannedQuestion.question_type` choices.
- **Gap:** no `prompt_version`, no explicit model/provider field on the question row (only inferable via `metadata["planned_by"]`), no FK from question → the `AIRequest` or `RetrievalLog` row that produced it.

### 1.4 "Why was this question asked?" (partially built, not exposed)
- The data exists (`VivaQuestion.provenance.rationale`, `.excerpt`, `.source_ref`) and is **already serialized** (`backend/viva/serializers.py`) and **already rendered** on `frontend/src/pages/VivaSessionDetailPage.tsx:138-145` (shows `source_ref` + `excerpt.quote` per question).
- Not rendered: `purpose`, `concept`, retrieval query, ranked list of retrieved chunks (only the single winning excerpt is shown).

### 1.5 Student answer provenance (partial — overwrite/idempotent, not versioned)
- `StudentAnswer`: `text`, `input_mode`, `audio_storage_key` (field exists, **never populated**), `submitted_at` (`backend/viva/models.py:86-91`).
- `QuestionAttempt` wraps each answer but only `attempt_number=1` is ever created — no retry/versioning flow exists (`backend/viva/orchestrator.py:290,385-429`).
- Answer submission is idempotent (returns existing answer if already answered) but there is **no edit history** — this satisfies "do not overwrite" only because there is no edit path at all yet.
- Voice: transcription happens via `POST .../transcribe/`, and the ASR result is returned ephemerally to the client, then sent back as plain text — **ASR model/version and audio reference are never persisted** (`backend/viva/views.py:214-256`).

### 1.6 Answer evaluation (exists, fixed schema, no confidence, overwritten)
- `AnswerEvaluation`: `conceptual_accuracy`, `evidence_support`, `depth`, `relevance`, `overall`, `explanation`, `evidence_refs` (chunk IDs), `raw` (full AI JSON), `is_ai_generated` (`backend/viva/models.py:94-105`).
- `evidence_refs` are **validated** against real `SubmissionChunk` IDs before being trusted (`backend/viva/evaluation.py:81-94`) — this is exactly Rule 1/Rule 3 territory already partially enforced.
- **Gap:** no `confidence` field, no rubric-dimension FK (four hardcoded dimensions only), no prompt version, and `update_or_create` **overwrites** the prior evaluation on re-run (`backend/viva/evaluation.py:100-114`) — this breaks Requirement #14/#25 Rule 6/7 (immutable history) today.

### 1.7 Rubric system (exists, configurable per assignment)
- `Rubric` (1:1 per `Assignment`) + `RubricCriterion` (`weight`, `max_score`, `category`, optional `learning_outcome` FK) — already configurable via instructor API (`backend/rubrics/models.py`, `backend/rubrics/views.py`).
- **Gap:** `AnswerEvaluation` does not map to rubric criteria (fixed 4 dimensions); only the post-viva `AssessmentCriterion` layer ties to `RubricCriterion`. Coverage-by-dimension (Requirement #19) would need to be derived from `AssessmentCriterion` + `PlannedQuestion.rubric_criterion`, not from `AnswerEvaluation`.

### 1.8 Contradiction / flag detection — **does not exist**
- The only "flag" concepts in the codebase are: plagiarism similarity flags (`PlagiarismReport`) and integrity/proctoring events (`VivaIntegrityEvent`: tab-hidden, fullscreen-left, camera-denied, grace-expired).
- There is **no model, service, or prompt** anywhere that compares submission claims vs. answer claims, or answer vs. answer, for inconsistency. This is a net-new capability (Requirement #8).

### 1.9 Confidence / uncertainty — **exists only at Assessment layer**
- `AssessmentCriterion.confidence` exists and is shown in the UI (`AssessmentReview.tsx`).
- `AnswerEvaluation` (per-question, pre-assessment) has **no** confidence field.
- No system-wide "Strong / Moderate / Weak / Insufficient evidence" enum exists anywhere; this needs to be introduced as a shared concept, ideally on both `AnswerEvaluation` and `AssessmentCriterion`.

### 1.10 Evidence quality classification — does not exist
- No field anywhere distinguishes "direct submission evidence" vs "derived/inferred" vs "student-stated" vs "general knowledge." This is net-new (Requirement #10).

### 1.11 Retrieval trace (exists at submission level, not linked to question/answer)
- `RetrievalLog`: `query`, `results` (chunk IDs + scores + content), `filters`, `latency_ms`, FK to `submission` only (`backend/rag/models.py:53-64`). Written on every retrieval call (`backend/rag/retrieval.py:168-174`).
- **Gap:** no FK from `RetrievalLog` → `PlannedQuestion`/`VivaQuestion`/`AnswerEvaluation`. You can see "a retrieval happened for this submission" but not "which retrieval produced this specific question." The winning chunks *are* duplicated onto the question/plan JSON (`rag_chunks`), so the data to link is available — it just isn't linked by FK today.
- No reranker exists (hybrid lexical-boost + path diversification only, `backend/rag/retrieval.py`).

### 1.12 AI provenance / telemetry (exists, incomplete coverage)
- `AIRequest`: `provider`, `model`, `request_type`, `input_tokens`, `output_tokens`, `estimated_cost_usd`, `latency_ms`, `success`, `metadata` — written centrally by `AIService._log()` for **chat/structured/embedding** calls (`backend/ai/service.py:42-56`, `backend/ai/models.py:17-48`).
- **Gap:** TTS and STT calls bypass `AIService` entirely (`backend/viva/views.py:214-312`) and are **not logged** to `AIRequest`. `AIUsage` (period rollups) and `AIModel` (registry) tables exist but are **never written to**. No FK from `AIRequest` to the question/answer/session it served — only org + user.

### 1.13 Instructor review (exists, but assessment-level only)
- `Assessment` → `AssessmentCriterion` → instructor can set `instructor_score` per criterion and `instructor_notes`, then `finalize()` (`backend/assessments/views.py`, `frontend/src/components/assessment/AssessmentReview.tsx`).
- `AssessmentModification` **already implements exactly the override-history pattern the spec asks for** in Requirement #14: `field_name`, `old_value`, `new_value`, `reviewer`, `reason`, timestamp (`backend/assessments/models.py:88-100`) — this is the model to extend, not replace.
- **Gap:** no way to override a single question's AI evaluation, no "agree / dismiss flag / mark insufficient evidence" actions, no distinction in the UI between "AI assessment" and "instructor decision" at the per-question level (only at the finalize/overall level).

### 1.14 Audit trail (exists, generic, not evidence-aware)
- `AuditLog`: `organization` FK, `actor` FK, `action`, `resource_type`, `resource_id`, `ip_address`, `metadata` — written via `audit.services.log_audit()` from several viewsets (`backend/audit/models.py:6-33`).
- Already logs: `viva.create`, `viva.finish`, `viva.integrity.*`, `assessment.modify`, `assessment.finalize`.
- **Gap:** does not log submission/evidence/question/answer/flag lifecycle events from the spec's list (#15); no correlation/request-ID linkage (a `RequestLoggingMiddleware` sets `X-Request-ID` for HTTP logs, but this is not threaded into `AuditLog.metadata`).

### 1.15 Evidence dashboard / drill-down UI — mostly does not exist in production
- `VivaSessionDetailPage.tsx` already renders a decent per-question drill-down: sequence, type, question text, concept, `source_ref`, excerpt blockquote, student answer, AI evaluation subscores.
- `AssessmentReview.tsx` renders overall assessment (`evidence_summary`, strengths/weaknesses, per-criterion `confidence`, AI vs instructor score) but **does not** show per-question source/excerpt, and `AssessmentEvidence`/`evidence_items` are typed in `types/index.ts` but **never rendered**.
- The only *visually* polished "evidence trace" UI in the repo is on the **marketing landing page** (`frontend/src/components/landing/Bento.tsx` `EvidenceTrace()`, `AgentRepoReel.tsx`) — not wired to any real API, purely illustrative.

### 1.16 Tenant isolation (exists, header-driven, not row-level ORM enforcement)
- No separate "Tenant" model — `Organization` is the tenant root. Isolation is enforced by **per-viewset `get_queryset()` filtering** on `organization_id` or join-chains (`course__organization_id`, `assignment__course__organization_id`), gated by `TenantContextMixin` + `X-Organization-ID` header + `Membership` validation (`backend/common/tenancy.py`).
- Students are additionally row-scoped (`student=request.user`) in `Submission`/`VivaSession`/`Assessment` querysets.
- **Gap:** no automated tests for cross-org leakage, no object-level permission checks (no django-guardian, no `has_object_permission` anywhere), `CourseEnrollment` role is **not** used for authorization (only org-level `Membership.role` gates access — any org instructor/admin can see all courses in the org). WebSocket consumer checks `session.student_id == user.id` but has **no explicit organization check** at all (`backend/viva/consumers.py:26-27`).

---

## 2. Existing models

| Model | App | Purpose | Relevant fields | Can reuse? |
|---|---|---|---|---|
| `Organization` | orgs | Tenant root | `name`, `slug`, `settings` | **Yes** — reuse as-is, do not duplicate |
| `Membership` | orgs | Org-level role | `organization`, `user`, `role`, `is_active` | **Yes** — reuse for org-level authz |
| `User` | accounts | Identity | `email`, `full_name`; runtime `active_organization_id`/`active_role` | **Yes** — reuse as actor everywhere |
| `Course` | courses | Org-scoped container | `organization`, `code`, `title` | **Yes** |
| `CourseEnrollment` | courses | Course-level role (underused) | `course`, `user`, `role` | **Yes**, but note it's not currently used for authz — don't assume it's enforced |
| `Assignment` | assignments | Assessable unit + viva config | `course`, `viva_config`, `due_at` | **Yes** |
| `LearningOutcome` | assignments | LO codes | `assignment`, `code` | **Yes** |
| `Rubric` / `RubricCriterion` | rubrics | Configurable grading dims | `weight`, `max_score`, `category`, `learning_outcome` | **Yes** — reuse for Requirement #7, extend if new dimensions needed |
| `Submission` | submissions | Student work + pipeline state | `assignment`, `student`, `version`, `metadata`, `processing_stage` | **Yes** — extend with parser/extractor version field |
| `SubmissionVersion` | submissions | Version snapshot JSON | `submission`, `version_number`, `snapshot` | **Yes** — reuse for provenance history, don't duplicate |
| `SubmissionFile` | submissions | Uploaded file metadata | `storage_key`, `checksum`, `structure`, `extracted_text` | **Yes** — extend `structure` propagation to chunks rather than adding a new file model |
| `RepositorySnapshot` | submissions | GitHub repo/commit record | `owner`, `repo`, `commit_sha`, `default_branch` | **Yes** — this *is* the GitHub provenance model the spec asks for |
| `RepositoryFile` | submissions | Indexed repo file | `path`, `language`, `content_hash` | **Yes** |
| `CodeSymbol` / `CodeDependency` | submissions | Parsed function/class + import graph | `name`, `start_line`, `end_line`, `signature` | **Yes** |
| `SubmissionChunk` | submissions | RAG chunk + embedding | `content`, `content_hash`, `source_ref`, `path`, `start_line`, `end_line`, `embedding` | **Yes — this is the base "Evidence" object.** Extend with page/section/offset fields rather than creating a parallel `Evidence` model |
| `EmbeddingCache` | submissions | Dedup cache | `content_hash`, `embedding_model`, `vector` | **Yes** |
| `QuestionCandidate` | submissions | Pre-viva seed questions | `evidence_chunk_ids`, `source_ref`, line range | **Yes**, though largely superseded by `PlannedQuestion` — verify usage before extending |
| `PlagiarismReport` | submissions | Similarity report | `matches`, similarity stats | **Yes** — separate concern from academic-integrity flags but same "flag" UX pattern to imitate |
| `KnowledgeNode` | rag | Concept graph node | `node_type`, `content`, `confidence`, `source_ref` (unused) | **Yes**, but low priority — `source_ref` needs to actually be populated if reused |
| `RetrievalLog` | rag | Retrieval telemetry | `query`, `results`, `filters`, `latency_ms`, `submission` | **Yes** — add FK to question/answer rather than creating a new retrieval-trace model |
| `QuestionPlan` | questions | Plan container | `submission`, `viva_session`, `plan`, `coverage` | **Yes** |
| `PlannedQuestion` | questions | Planned question + provenance metadata | `concept`, `purpose`, `question_type`, `difficulty`, `rubric_criterion`, `learning_outcome`, `metadata` (rag_chunks etc.), `is_follow_up`, `parent_question` | **Yes — this is the "Question provenance" model.** Promote key `metadata` keys to real columns rather than adding a new `Question` model |
| `VivaSession` | viva | Session state machine | `state`, `understanding_state`, `coverage_state`, `config` | **Yes** |
| `VivaQuestion` | viva | Asked question instance | `session`, `planned_question`, `sequence`, `provenance` (JSON) | **Yes — extend `provenance` into typed fields/FKs**, don't duplicate |
| `QuestionAttempt` | viva | Attempt wrapper | `question`, `attempt_number` | **Yes** |
| `StudentAnswer` | viva | Student response | `text`, `input_mode`, `audio_storage_key` (unused), `submitted_at` | **Yes** — needs append-only history added (new `AnswerRevision`-style model or reuse `AssessmentModification` pattern) |
| `AnswerEvaluation` | viva | Per-answer AI score | `conceptual_accuracy`, `evidence_support`, `depth`, `relevance`, `overall`, `evidence_refs`, `raw`, `is_ai_generated` | **Yes — extend with `confidence`, stop overwriting on regenerate (append-only)** |
| `VivaIntegrityEvent` | viva | Proctoring event | `event_type`, `client_ts`, `metadata` | **Yes** — reuse as the pattern for the new contradiction `Flag` model, but it is not itself a contradiction/flag system |
| `VivaProctorFrame` | viva | Proctor snapshot | `storage_key`, `captured_at` | **Yes** |
| `VivaSlotBooking` | viva | Scheduling | `slot_start`, `slot_end`, `status` | **Yes**, not directly relevant to evidence |
| `Assessment` | assessments | Post-viva holistic grade | `overall_score`, `ai_overall_score`, `status`, `reviewed_by`, `instructor_notes` | **Yes** |
| `AssessmentCriterion` | assessments | Rubric-aligned score | `ai_score`, `instructor_score`, `final_score`, `confidence` | **Yes — has confidence already; use as the template for adding confidence elsewhere** |
| `AssessmentEvidence` | assessments | Evidence quote per criterion | `criterion`, `answer`, `source_ref`, `quote`, `note` | **Yes — model already matches spec's "Evidence" shape almost exactly, but is never populated or rendered.** Populate + render before considering a new model |
| `AssessmentModification` | assessments | Instructor override audit trail | `field_name`, `old_value`, `new_value`, `reviewer`, `reason`, timestamp | **Yes — this is the Requirement #14 model.** Generalize to cover per-question overrides too, rather than creating a parallel override-history model |
| `AIModel` | ai | Provider/model registry | `provider`, `name`, `model_type`, `config` | **Yes**, currently unpopulated — wire it up rather than adding a new registry |
| `AIRequest` | ai | Per-call telemetry | `provider`, `model`, `input_tokens`, `output_tokens`, `estimated_cost_usd`, `latency_ms` | **Yes — this is the Requirement #12 model.** Add FK(s) to session/question/answer and extend coverage to TTS/STT rather than building new telemetry |
| `AIUsage` | ai | Period rollup | `period_start`, `period_end`, totals | **Yes**, currently unpopulated |
| `AuditLog` | audit | Generic action log | `organization`, `actor`, `action`, `resource_type`, `resource_id`, `metadata` | **Yes — this is the Requirement #15 append-only audit model.** Add new `action` values and correlate with request ID, don't build a parallel `AuditEvent` model |
| `UUIDModel` / `SoftDeleteModel` / `TimeStampedModel` | common | Base mixins | UUID PK, soft delete, timestamps | **Yes — every new model should inherit these** |

---

## 3. Existing APIs

| Area | Endpoint(s) | Notes |
|---|---|---|
| Submissions | `GET/POST /api/submissions/`, `GET /{id}/`, `GET /{id}/status/`, `GET /{id}/files/{file_id}/content/` | No evidence/chunk endpoint exposed |
| Viva sessions | `GET/POST /api/viva/sessions/`, `.../start/`, `.../prepare/`, `.../answer/`, `.../questions/`, `.../finish/`, `.../integrity/`, `.../proctor-frames/` | `questions/` already returns provenance-bearing question+evaluation data |
| Assessments | `GET /api/assessments/`, `GET /{id}/`, `POST /{id}/modify/`, `POST /{id}/finalize/` | `modify` is the existing override endpoint — extend, don't duplicate |
| Audit | `GET /api/audit/logs/`, `GET /{id}/` | Read-only, org-admin gated |
| AI usage | `GET /api/ai/usage/` | Org-level `AIRequest` aggregate only |
| Rubrics | `GET/POST /api/rubrics/`, `.../criteria/` | Fully CRUD, instructor-editable |
| **Not mounted at all** | `rag` app views, `questions` app views | Models exist, no URLs — an internal "evidence/retrieval debug" API could be mounted here without touching other apps |

WebSocket: `ws/viva/{session_id}/` — `VivaSessionConsumer` (`backend/viva/consumers.py`), handles `question`, `answer`, `processing`, `complete`, `error`. `provenance` is not currently sent as a distinct message type (it rides inside `question`'s excerpt only).

---

## 4. Existing frontend

| Screen/component | File | Relevant to evidence system |
|---|---|---|
| Submission detail (instructor) | `pages/SubmissionDetailPage.tsx` | Hosts `AssessmentReview`, `SubmissionWorkViewer`, `RepositorySummary`, `PlagiarismReportPanel` — natural host for a new "Evidence" tab |
| Assessment review | `components/assessment/AssessmentReview.tsx` | Overall score, `evidence_summary`, per-criterion AI vs instructor score + confidence, save/finalize actions. **`evidence_items` typed, never rendered** |
| Viva session detail (instructor) | `pages/VivaSessionDetailPage.tsx` | **Best existing drill-down**: per-question `source_ref` + excerpt blockquote + answer + AI subscores |
| Live viva (student) | `components/viva/VivaInterface.tsx` | Renders excerpt panel during session; WS `provenance` field on `question` message typed but unused |
| Design system | `components/ui/{Card,Badge,Button,Input,Textarea,Spinner}.tsx` | Reuse directly for the new dashboard |
| Layout patterns | `layout/{PageHeader,StateViews,AppShell}.tsx` | Reuse directly |
| Marketing-only evidence UI | `landing/Bento.tsx` (`EvidenceTrace`), `landing/AgentRepoReel.tsx` | Visual reference only, not wired to real data — do not confuse with production requirements |
| API client | `lib/api.ts` (single axios instance + domain objects: `submissionsApi`, `vivaApi`, `assessmentsApi`, etc.) | Add `evidenceApi`/extend `assessmentsApi` here, no new HTTP layer needed |
| State | `hooks/useAsync.ts` + React Context (`AuthContext`) | No react-query/redux — follow existing `useAsync` pattern for the new dashboard, don't introduce a new state library |
| Types | `types/index.ts` | `AssessmentEvidence`, `VivaExcerpt`, `VivaQuestion.source_ref/excerpt` already defined — extend, don't duplicate |

---

## 5. Missing functionality

Explicitly does **not** exist today and must be newly built:

1. **Per-chunk document location** (page/section/heading/paragraph/slide/inner-ZIP-path/char-offset) — structure is captured at the file level but not propagated to chunks.
2. **Contradiction/flag detection system** — no model, no comparison logic, no neutral-terminology flag taxonomy.
3. **Confidence/evidence-quality enum** shared across the pipeline (Strong/Moderate/Weak/Insufficient; direct/derived/stated/external) — exists only as raw numeric `confidence` on `AssessmentCriterion`.
4. **Per-question instructor override** — overrides exist only at `Assessment`/`AssessmentCriterion` level, not per `AnswerEvaluation`/`VivaQuestion`.
5. **Answer/evaluation immutability** — both are overwritten in place today; no append-only history.
6. **FK linkage between retrieval, AI calls, and the question/answer they produced** — data exists in parallel JSON blobs but isn't relationally joined.
7. **Evidence-lifecycle audit events** (submission created/processed, evidence created, question generated/asked, answer received, evaluation generated, flag created/resolved, review started/changed, assessment submitted/exported) — `AuditLog` exists but doesn't log most of these.
8. **TTS/STT AI telemetry** — bypasses `AIRequest` entirely today.
9. **Assessment coverage-by-rubric-dimension view** — no derivation logic exists; would need to be built from `PlannedQuestion.rubric_criterion` + `AnswerEvaluation`/`AssessmentCriterion`.
10. **Evidence source viewer with highlighting** — PDF is an iframe with no highlight/page-jump; DOCX/PPTX are flat `<pre>` text; no line-range-aware code viewer in production (only on the marketing page).
11. **Exportable evidence/appeal package** — no export endpoint or document generation exists anywhere in the backend.
12. **Automated tenant-isolation security tests** for the new evidence surfaces (existing isolation tests cover courses/dashboard/slots only).
13. **Data retention/deletion policy** — confirmed absent repo-wide (only referenced as a known gap in `improvement.md`); must be documented as a gap, not invented.
14. **Object-level (per-course) authorization** — today any org-level instructor/admin can see all courses/submissions in the org; `CourseEnrollment` role is not enforced.

---

## 6. Duplication risks

A naive implementation would very likely create these unnecessary duplicates — **avoid all of these**:

| Risk | Why it's tempting | What to do instead |
|---|---|---|
| New `Evidence` model | Spec explicitly names "Evidence" as a concept | Extend `SubmissionChunk` (add page/section/offset fields) instead of a parallel model. `AssessmentEvidence` already exists for the criterion-level citation use case — populate it. |
| New `Question`/`Answer` models | Spec's conceptual graph names them generically | `PlannedQuestion` + `VivaQuestion` already cover this; `StudentAnswer` already exists. Extend, don't replace. |
| New `Flag`/`Inconsistency` model that duplicates `VivaIntegrityEvent` | Both are "something worth instructor attention" | Keep `VivaIntegrityEvent` for proctoring; add a **new, distinct** `EvidenceFlag`/`ContradictionFlag` model for content-level flags — different domain, different lifecycle, but reuse the same "flag panel" UI pattern. |
| New "Instructor Review" / override model | Spec calls out override history explicitly | `AssessmentModification` already implements exactly this pattern — generalize its `field_name`/`old_value`/`new_value` shape to cover per-question overrides rather than inventing a second override-history table. |
| New audit/event log | Spec asks for an "append-only audit event system" | `AuditLog` already is one. Add new `action` values; do not build `AuditEvent`. |
| New AI telemetry model | Spec asks for token/cost/latency/model tracking | `AIRequest` + `AIService._log()` already does this for chat/embedding. Extend coverage to TTS/STT and add resource FKs; do not build a second telemetry table. |
| New retrieval-trace model | Spec asks for retrieval query/results/scores preserved | `RetrievalLog` already stores this per submission. Add FK to question/answer; do not build a second retrieval log. |
| New vector database | Spec explicitly forbids this, and pgvector via `SubmissionChunk.embedding_vec` already exists | Never introduce one. |
| New Organization/Tenant model | Spec's conceptual graph starts with "Organization" | `orgs.Organization` + `Membership` already are this. |
| New Course/Assignment/Student models | Same reasoning | `courses.Course`, `assignments.Assignment`, `accounts.User` already exist. |

---

## 7. Recommended integration points

1. **`SubmissionChunk`** (`backend/submissions/models.py:204-248`) — add `page_number`, `section_heading`, `slide_number`, `inner_path` (for ZIP), `start_offset`/`end_offset` nullable fields; populate them from the already-captured `SubmissionFile.structure` during chunking (`backend/submissions/pipeline.py:134-155`). This single change unlocks document-based evidence citation for Requirement #2 and #18 with no new model.

2. **`PlannedQuestion.metadata` / `VivaQuestion.provenance`** — promote the stable, always-present keys (`rag_chunk_ids`, `source_chunk_id`, `source_quote`, `purpose`) into real columns or a small `QuestionProvenance` side-table keyed 1:1 to `VivaQuestion`, so they can be queried/joined instead of parsed out of JSON for the dashboard and export.

3. **`AnswerEvaluation`** — add `confidence` (enum, mirroring the pattern already used on `AssessmentCriterion`), and change `evaluate_answer()`/`evaluate_session_answers()` (`backend/viva/evaluation.py`) to **insert a new row and supersede** rather than `update_or_create` in place, so evaluation history is reconstructable (Rule 7).

4. **`AssessmentEvidence`** — wire this up in `backend/assessments/engine.py` so it's actually populated per criterion at assessment-generation time, and render it in `AssessmentReview.tsx` (the type already exists, `evidence_items` is simply never read). This closes most of Requirement #16/#17's "supporting evidence" needs without a new model.

5. **`AssessmentModification`** — extend to also record per-question / per-`AnswerEvaluation` overrides (new `content_type`/`object_id` generic relation, or a sibling `question_id` nullable FK), giving Requirement #14 full coverage instead of only assessment-level overrides.

6. **`AuditLog`** — add the missing `action` values from Requirement #15's list and call `log_audit()` from the submission pipeline, question generation, evaluation, and new flag/review code paths. Thread the existing `X-Request-ID` (`common/middleware.py`) into `AuditLog.metadata` for correlation.

7. **`AIRequest`** — add nullable FKs (`viva_session`, `viva_question`, `submission`) and route TTS/STT calls (`backend/viva/views.py:214-312`) through `AIService` (or at minimum through the same `_log()` helper) so provider/model/latency/cost is captured for every AI call, not just chat/embedding.

8. **`RetrievalLog`** — add a nullable FK to `VivaQuestion`/`PlannedQuestion` so a specific question's retrieval trace can be pulled directly rather than re-deriving it from the JSON copy on the question.

9. **New models needed** (genuinely net-new, no existing equivalent):
   - `EvidenceFlag` (or `ContradictionFlag`) — type, severity, description, supporting evidence FK(s), related question/answer FK(s), confidence, resolution status. Distinct from `VivaIntegrityEvent`.
   - A thin `EvidenceSourceLocator`-style value object (could be a JSON schema on `SubmissionChunk` rather than a table) standardizing "page N / section X / lines A–B / slide N" across document types.
   - Possibly a small `AnswerRevision`/`EvaluationRevision` model if append-only history is preferred over "supersede with a new row + status flag" on the existing tables (design decision — see open questions).

10. **Frontend**: add an "Evidence" tab/section to `SubmissionDetailPage.tsx` that reuses `VivaSessionDetailPage`'s per-question citation rendering, extends it with the now-populated `AssessmentEvidence` list, and adds flag display using the existing `Badge`/nested-card patterns from `PlagiarismReportPanel.tsx`. No new state library, no new HTTP client — extend `lib/api.ts` and `types/index.ts`.

11. **Tenant isolation for new surfaces**: any new evidence/flag/review endpoint must follow the exact `TenantContextMixin` + `get_queryset()` join-chain pattern used by `SubmissionViewSet`/`VivaSessionViewSet` (`assignment__course__organization_id=org_id`), plus the existing student row-scoping (`student=request.user`) where applicable. New automated tests should follow the existing `common/tests/test_tenant.py` pattern but explicitly attempt cross-org access to evidence/flags/reviews.

---

## Summary judgment

Mokhik does not need a new evidence subsystem bolted on from scratch. It needs:
- **Structural promotion** of existing JSON provenance into queryable fields/FKs (`SubmissionChunk`, `PlannedQuestion`, `VivaQuestion`),
- **Activation** of models that already exist but are never populated (`AssessmentEvidence`, `AIUsage`, `AIModel`, `KnowledgeNode.source_ref`),
- **One or two genuinely new models** for contradiction flags and (possibly) revision history,
- **Frontend rendering** of data that is already typed but never shown (`evidence_items`, WS `provenance`),
- and **audit/telemetry breadth** extensions to existing `AuditLog`/`AIRequest`/`RetrievalLog`.

This significantly de-risks the project relative to the spec's implied scope, but the full spec (dashboard, drill-down, source viewer with highlighting, contradiction detection, export package, full audit coverage, security test suite) is still substantial multi-phase work. See open questions below before a design/implementation plan is finalized.
