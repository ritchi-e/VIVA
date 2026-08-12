#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

if [[ ! -d .venv ]]; then
  echo "Creating Python virtualenv in backend/.venv ..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q -r requirements.txt

if [[ ! -f "$ROOT/.env.local" ]]; then
  echo "Tip: cp .env.local.example .env.local so backend talks to localhost infra ports."
fi

echo "Running migrations and ensuring MinIO bucket..."
python manage.py migrate
python manage.py ensure_bucket

echo ""
echo "Starting Daphne on http://localhost:8000 (REST + WebSocket)"
echo "Debug logs appear in this terminal."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
