# ADR-007: LLM Provider Abstraction

## Status

Accepted

## Context

The product must run demos without API keys, support OpenAI and Gemini in production, and log cost/latency. Call sites (RAG, questions, evaluation) must not hardcode vendor SDKs.

## Decision

Implement `ai.providers` with protocols for **chat**, **structured output**, and **embeddings**. Concrete providers: **Mock** (default), **OpenAI**, **Gemini**. Selection via `AI_PROVIDER` env.

Central **AIService** logs every call to `AIRequest` with tokens, estimated USD, latency, success.

STT/TTS provider interfaces defined but **not used in MVP** (browser voice); reserved for future Whisper or cloud TTS.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Direct OpenAI calls in views | No mock, no swap, no audit |
| LiteLLM only | Extra dependency; still need domain logging schema |
| Single vendor lock-in | Portfolio and institutional flexibility |

## Trade-offs

- **Pros:** Deterministic mock for tests; honest cost tracking; clear failure boundaries.
- **Cons:** Maintenance of multiple adapters; structured output schemas must be validated per provider.

## Consequences

- Never commit API keys; `.env` only.
- Invalid structured responses trigger retry/fail paths ([ai-evaluation.md](../ai-evaluation.md)).
- Mock provider must stay deterministic for CI.
