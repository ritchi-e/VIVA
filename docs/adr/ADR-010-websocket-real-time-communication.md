# ADR-010: WebSocket Real-Time Communication

## Status

Accepted

## Context

Live viva UI needs low-latency updates: current question, recording state, processing indicator, timer, reconnection—without polling the REST API every second.

## Decision

Use **Django Channels** with **Redis channel layer** for WebSocket routes under `/ws/` (e.g. viva session channel). **Daphne** serves ASGI (HTTP + WebSocket).

Protocol: JSON messages for server → client events (`question`, `state`, `error`, `complete`) and client → server (`answer`, `pause`, `resume`).

**Authoritative state remains in PostgreSQL** (ADR-006); WebSocket is transport.

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| REST polling | Poor UX, load |
| Socket.io separate server | Extra process outside monolith |
| SSE only | Weaker bidirectional answer flow |

## Trade-offs

- **Pros:** Native Django integration; Redis already in stack.
- **Cons:** Connection auth (JWT on connect), sticky sessions in some deploys, reconnection logic in frontend.

## Consequences

- Frontend `VITE_WS_URL` in `.env.example`.
- Voice audio does not stream over WebSocket in MVP (text transcripts only).
- See [voice.md](../voice.md) and [viva-orchestrator.md](../viva-orchestrator.md).
