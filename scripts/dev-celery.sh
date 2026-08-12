#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

if [[ ! -d .venv ]]; then
  echo "Run ./scripts/dev-backend.sh first to create the virtualenv."
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "Starting Celery worker (submission processing, embeddings, etc.)..."
exec celery -A config worker -l debug --concurrency=2
