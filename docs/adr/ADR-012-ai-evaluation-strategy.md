# ADR-012: AI Evaluation Strategy

## Status

Accepted

## Context

Portfolio and engineering quality require **measurable** AI behavior—not claimed accuracy. Question grounding, retrieval citations, and rubric alignment must be evaluated with reproducible datasets.

## Decision

Build a **synthetic evaluation dataset** (sample assignments, rubrics, answers, expected categories) and a **runner script** (`scripts/` in Phase 11) that:

- Runs against `AI_PROVIDER=mock` by default for CI
- Optionally runs with real providers when keys present
- Reports **actual** metrics: relevance, grounding, citation validity, consistency, latency, cost, failure rate

**Do not fabricate results** in documentation; `docs/ai-evaluation.md` stores reported numbers from last run.

Dimensions:

1. Question quality (grounding, rubric alignment, diversity)
2. Retrieval (hit rate, citation correctness)
3. Answer evaluation (alignment with rubric, evidence usage)
4. System (p95 latency, token cost, error rate)

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Manual-only QA | Not repeatable |
| Production A/B only | Too late, no CI signal |
| Single LLM-judge without fixtures | Circular evaluation |

## Trade-offs

- **Pros:** Honest portfolio story, regression detection when prompts change.
- **Cons:** Synthetic data may not match all disciplines; maintenance of golden sets.

## Consequences

- Eval does not block Phase 8 demo; full suite in Phase 11.
- See [ai-evaluation.md](../ai-evaluation.md) and [testing.md](../testing.md).
