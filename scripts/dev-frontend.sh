#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

if [[ ! -f .env.local ]]; then
  if [[ -f .env.local.example ]]; then
    cp .env.local.example .env.local
    echo "Created frontend/.env.local from .env.local.example"
  else
    echo "Warning: no frontend/.env.local — API defaults to Docker port 18000."
  fi
fi

npm install

echo ""
echo "Starting Vite dev server on http://localhost:5173"
echo "Frontend logs appear in this terminal."
exec npm run dev
