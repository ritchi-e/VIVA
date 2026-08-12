# ADR-008: Human-in-the-Loop Assessment

## Status

Accepted

## Context

AI-generated scores are not objective truth. Academic policy and product positioning require instructors to retain final grading authority. The UI must not imply automatic grade publication.

## Decision

All assessments start as **AI-generated drafts** (`Assessment.status`: draft / pending_review). Display disclaimer: *"AI-generated assessment. Instructor review required."*

Instructors may change criterion scores and notes; each change recorded in `AssessmentModification` (field, old/new value, reviewer, timestamp).

**Finalized** status only via explicit instructor action. `ai_overall_score` preserved separately from `instructor_score` / `final_score`.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Auto-publish above confidence threshold | Violates product ethics and SRS |
| Instructor-only manual grading | Loses AI efficiency benefit |
| Hidden AI scores | Reduces transparency |

## Trade-offs

- **Pros:** Policy alignment, audit trail, interview-ready design story.
- **Cons:** Extra UI and API for review workflow; more states to test.

## Consequences

- RBAC: students cannot finalize assessments.
- Assessment API docs in [assessment-engine.md](../assessment-engine.md).
