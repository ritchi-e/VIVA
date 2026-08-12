# Question Engine

Separates **planning** from **wording** (ADR and product requirement).

## Planner (deterministic + rules)

Inputs: rubric criteria, learning outcomes, coverage state, understanding state, question budget, time remaining.

Outputs: `QuestionPlan` / `PlannedQuestion` rows with:

- Target rubric criterion / LO
- Question type (conceptual, methodology, defense, …)
- Difficulty
- Required evidence types
- Coverage flags

The planner decides *what* to assess; it does not rely on a single end-to-end LLM prompt for strategy.

## LLM wording

Given a `PlannedQuestion` spec + retrieved chunks, `AIService.chat` / `structured` generates `question_text` for `VivaQuestion`.

## Provenance

Stored on `VivaQuestion.provenance` and planned question metadata:

- Source artifact / section / page
- Rubric criterion id
- Learning outcome id
- Question type and pedagogical purpose

Instructor UI answers: **Why was this question asked?**

## Adaptive loop

After each answer evaluation, update `coverage_state` and `understanding_state` on `VivaSession`; planner selects next uncovered or weak area.

## Related

- [viva-orchestrator.md](viva-orchestrator.md)
- [answer-evaluation.md](answer-evaluation.md)
