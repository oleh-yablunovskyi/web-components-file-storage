#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  [[ "${KEEP_STACK:-}" == "1" ]] || docker compose down -v
}
trap cleanup EXIT

(cd e2e && npm ci)
docker compose up -d --build --wait
cd e2e
npx playwright test "$@"
