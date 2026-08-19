# Scaling & Provider Rate Limits

## Provider Rate Limits

| Provider | API | Rate Limit (Tier 1) | Timeout | Retry |
|----------|-----|---------------------|---------|-------|
| OpenAI | Chat (gpt-5-nano) | ~500 RPM / 200K TPM | None | 3x exponential backoff |
| OpenAI | Embeddings (text-embedding-3-small) | ~3000 RPM | None | 3x exponential backoff |
| OpenAI | TTS (tts-1) | ~50 RPM | None | 3x exponential backoff |
| Deepgram | Nova-3 STT | ~100 concurrent | 45s | None (client-side) |
| Rumik | Mulberry TTS | ~20 RPM (estimated) | 45s | None |
| Gemini | Chat | ~60 RPM (free) / 1000 RPM (paid) | None | 3x exponential backoff |
| Gemini | Embeddings | ~1500 RPM | None | 3x exponential backoff |

## Concurrent Session Capacity

### Current Architecture (Single Linode VPS)

| Component | Config | Bottleneck |
|-----------|--------|------------|
| Daphne | 4 ASGI workers | ~60 concurrent WebSocket connections |
| Celery (main) | 4 workers, `celery` queue | Post-viva evaluation + assessment |
| Celery (ingestion) | 2 workers, `ingestion` queue | Submission processing |
| Django Channels thread pool | 40 threads (default) | ~15-20 concurrent viva turns before latency degrades |

### Estimated Limits

- **Comfortable**: 10-15 simultaneous viva sessions
- **Maximum before degradation**: ~20 sessions (limited by LLM call latency × thread pool)
- **TTS bottleneck**: OpenAI TTS at 50 RPM limits to ~50 audio turns/minute across all sessions

### Per-Session Resource Usage

Each viva session makes approximately:
- 5-8 LLM chat calls (live turn routing)
- 1 structured LLM call (batch evaluation)
- 5-8 TTS calls (question audio)
- 5-8 STT calls (answer transcription)
- ~20K input tokens, ~5K output tokens total

## Scaling Recommendations

### Tier Upgrades (Low Effort)

1. **OpenAI Tier 2+**: Increases RPM to 5000+ and TPM to 2M+. Apply at [platform.openai.com](https://platform.openai.com).
2. **Deepgram Growth plan**: Higher concurrency limits for STT.

### Horizontal Scaling (Medium Effort)

1. **Multiple Daphne instances** behind a load balancer with Redis channel layer for WebSocket state sharing.
2. **Separate Celery worker nodes** for evaluation-heavy workloads.
3. **Redis Cluster** for channel layer and Celery broker if single Redis becomes a bottleneck.

### Architecture Changes (High Effort)

1. **Async LLM calls**: Move from `database_sync_to_async` wrapping synchronous OpenAI client to native async (`openai.AsyncOpenAI`). Eliminates thread pool exhaustion.
2. **Streaming responses**: Use OpenAI streaming to start TTS while the LLM is still generating, reducing perceived latency.
3. **Pre-generation**: Generate the next question while the student is answering the current one (speculative execution).

## Monitoring

Track these metrics via the `AIRequest` model:
- `latency_ms` per provider/request_type — alert if p95 exceeds 3s
- Error rate by provider — alert on sustained >5% failure rate
- Token usage trends — forecast tier upgrade needs

Run the benchmark script to measure baseline:
```bash
python scripts/benchmark_viva.py --base-url http://localhost:8000 --concurrency 10 --questions 5
```
