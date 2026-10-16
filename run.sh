#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

cleanup() { echo ""; echo "shutting down…"; kill 0 2>/dev/null || true; }
trap cleanup INT TERM EXIT

echo "starting npm run dev…"
npm run dev &
DEV_PID=$!

echo "waiting for http://localhost:3000 …"
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
    break
  fi
  sleep 1
done

echo "starting python scheduler.py (30s interval)…"
python scheduler.py 30 &

wait $DEV_PID
