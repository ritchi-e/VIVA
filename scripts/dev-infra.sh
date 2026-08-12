#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Starting Postgres, Redis, and MinIO (infra only)..."
docker compose -f docker-compose.infra.yml up -d

echo ""
echo "Infra ready:"
echo "  Postgres  localhost:15432"
echo "  Redis     localhost:16379"
echo "  MinIO     http://localhost:19000 (console :19001)"
echo ""
echo "Stop Docker app containers if they are still running:"
echo "  docker compose stop backend frontend celery-worker celery-beat"
echo ""
echo "Next: ./scripts/dev-backend.sh   (terminal 1)"
echo "      ./scripts/dev-celery.sh    (terminal 2, optional for uploads)"
echo "      ./scripts/dev-frontend.sh  (terminal 3)"
