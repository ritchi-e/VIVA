# ADR-006: Stateful Viva Orchestration

## Status

Accepted

## Context

A viva is a multi-step, failure-prone process (network drops, worker crashes, LLM timeouts). The system must resume from persisted state, not from ephemeral WebSocket memory.

## Decision

Implement a **server-side state machine** on `VivaSession` with explicit states:

`CREATED → PREPARING → READY → IN_PROGRESS ↔ PAUSED → COMPLETED | REVIEW_REQUIRED | FAILED`

Persist on each transition:

- `understanding_state`, `coverage_state` (JSON)
- `questions_asked`, timers, `error_message`
- Related rows: `VivaQuestion`, `QuestionAttempt`, `StudentAnswer`

A **Viva orchestrator service** (Phase 6) coordinates: load plan → ask → receive answer → evaluate → update state → select next question.

WebSocket consumers relay events; **orchestrator authority is the database**.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Stateless LLM-only loop | No recovery; no audit trail |
| Client-driven state | Security and consistency risk |
| Separate viva microservice | Monolith decision (ADR-001) |

## Trade-offs

- **Pros:** Recoverable sessions, instructor can inspect history, testable transitions.
- **Cons:** More DB writes per turn; must handle concurrent reconnect carefully.

## Consequences

- State machine tests required ([testing.md](../testing.md)).
- Details in [viva-orchestrator.md](../viva-orchestrator.md).
