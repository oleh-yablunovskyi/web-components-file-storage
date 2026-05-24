#!/usr/bin/env bash
set -euo pipefail

(cd api && npm run typecheck:test && npm test)
