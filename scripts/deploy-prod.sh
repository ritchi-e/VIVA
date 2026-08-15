#!/usr/bin/env bash
# Deploy / refresh production stack on the Linode host.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.production.example and fill secrets first."
  exit 1
fi

if grep -q 'REPLACE_WITH\|REPLACE_MINIO' .env; then
  echo "Refusing to deploy: .env still contains REPLACE_ placeholders."
  exit 1
fi

docker compose -f docker-compose.prod.yml pull || true
docker compose -f docker-compose.prod.yml up -d --build "$@"
docker compose -f docker-compose.prod.yml ps
echo
echo "Check: https://mokhik.online/api/health/"
