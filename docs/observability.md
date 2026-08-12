# Observability

## Logging

- Root logger → console with **JSON formatter** (`common.logging.JSONFormatter`)
- `RequestLoggingMiddleware` for HTTP request metadata
- Celery task logs include task name and submission/session ids where applicable

## Metrics

- **django-prometheus** mounted at `/metrics`
- Compose service **Prometheus** scrapes backend (see `infra/prometheus.yml`)
- **Grafana** on port 3001 with provisioned datasource

### Target metrics (phased)

| Metric | Source |
|--------|--------|
| HTTP latency / status | Prometheus middleware |
| Celery queue depth | Worker/redis exporter (future) |
| AI request latency | `AIRequest.latency_ms` |
| Token usage / cost | `AIRequest`, `AIUsage` |
| Viva session failures | Counter on `FAILED` transitions |

## Dashboards

Grafana dashboards to be added in Phase 10 (API health, error rate, AI cost).

## Error tracking

Architecture placeholder for Sentry or similar; not required for local demo.

## Related

- [deployment.md](deployment.md)
- Phase 10 in [development-plan.md](development-plan.md)
