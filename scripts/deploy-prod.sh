#!/usr/bin/env bash
# Deploy / refresh production stack on the Linode host.
#
# Modes:
#   ./scripts/deploy-prod.sh              # build on the host (manual / first install)
#   ./scripts/deploy-prod.sh --pull       # pull GHCR images set via VIVA_*_IMAGE
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PULL_ONLY=0
if [[ "${1:-}" == "--pull" ]]; then
  PULL_ONLY=1
  shift
fi

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.production.example and fill secrets first."
  exit 1
fi

if grep -qE 'REPLACE_WITH|REPLACE_MINIO' .env; then
  echo "Refusing to deploy: .env still contains REPLACE_ placeholders."
  exit 1
fi

COMPOSE=(docker compose -f docker-compose.prod.yml)

if [[ "$PULL_ONLY" -eq 1 ]]; then
  if [[ -z "${VIVA_BACKEND_IMAGE:-}" || -z "${VIVA_FRONTEND_IMAGE:-}" ]]; then
    echo "Set VIVA_BACKEND_IMAGE and VIVA_FRONTEND_IMAGE (including tag) before --pull."
    exit 1
  fi
  "${COMPOSE[@]}" pull backend frontend celery-worker celery-beat
  "${COMPOSE[@]}" up -d --remove-orphans "$@"
else
  "${COMPOSE[@]}" pull || true
  "${COMPOSE[@]}" up -d --build --remove-orphans "$@"
fi

"${COMPOSE[@]}" ps
echo

HEALTH_URL="${HEALTHCHECK_URL:-https://mokhik.online/api/health/}"
echo "Waiting for ${HEALTH_URL} ..."
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Healthy: ${HEALTH_URL}"
    exit 0
  fi
  sleep 3
done

echo "Deploy finished but public health check did not pass yet — check Caddy/DNS."
"${COMPOSE[@]}" logs --tail=40 backend caddy || true
exit 1
