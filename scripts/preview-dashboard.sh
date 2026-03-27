#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-4173}"
node "$ROOT/scripts/build-dashboard-data.js"
exec python3 -m http.server "$PORT" --directory "$ROOT/dashboard"
