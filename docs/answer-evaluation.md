# Answer Evaluation

Evaluates each `StudentAnswer` against the active question, rubric criterion, learning outcome, and retrieved submission evidence.

## Output model

`AnswerEvaluation` fields (aligned with models):

| Field | Purpose |
|-------|---------|
| `conceptual_accuracy` | 0–10 scale (AI-generated) |
| `evidence_support` | Uses submission evidence |
| `depth` | Depth of explanation |
| `relevance` | Relevance to question |
| `overall` | Composite |
| `requires_follow_up` | Planner input |
| `explanation` | Narrative for instructor |
| `evidence_refs` | Chunk / source references |
| `is_ai_generated` | Always true for AI path |

Scores are **assessment evidence**, not final grades.

## LLM structured output

`AIService.structured` with a JSON schema; validate and retry on malformed responses. Context includes:

- Question text
- Student answer text
- Top retrieval chunks (RAG)
- Rubric criterion description

## Prompt injection

Student answer and submission text are untrusted; system prompts separated from retrieved content blocks ([threat-model.md](threat-model.md)).

## Related

- [assessment-engine.md](assessment-engine.md)
- [ADR-007](adr/ADR-007-llm-provider-abstraction.md)
