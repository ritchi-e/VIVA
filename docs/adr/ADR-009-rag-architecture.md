# ADR-009: RAG Architecture

## Status

Accepted

## Context

Questions and evaluations must cite **student submission content**, rubric, and assignment instructions—not model parametric knowledge. Retrieval must respect tenant and submission boundaries.

## Decision

**In-database RAG** over:

- `SubmissionChunk` (primary corpus)
- Assignment/rubric/LO text (embedded or joined)
- Optional `KnowledgeNode` structured graph-lite representation

Pipeline: chunk → embed via `EmbeddingProvider` → store in pgvector → retrieve with metadata filters (`organization_id`, `submission_id`, file type, section) → pass ranked chunks to LLM with **citation instructions**.

Log retrievals in `RetrievalLog` where implemented.

**Never fabricate citations**; if no chunk supports a claim, evaluation must reflect uncertainty.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| LLM-only (no RAG) | Hallucination on submission specifics |
| Full knowledge graph DB | Over-engineering for MVP |
| Cross-submission retrieval | Privacy violation |

## Trade-offs

- **Pros:** Grounded questions, traceable evidence refs, single DB.
- **Cons:** Chunking quality affects everything; embedding cost per submission.

## Consequences

- Chunking strategy documented in [submission-processing.md](../submission-processing.md).
- Details in [rag.md](../rag.md).
