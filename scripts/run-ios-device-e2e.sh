#!/usr/bin/env bash
# CoreDevice delivers the lab deep link before agent-device attaches.
set -euo pipefail
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <udid> [manifest-flow-id]" >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FLOW_ARGS=()
if [[ $# -eq 2 ]]; then FLOW_ARGS=(--flow "$2"); fi
exec bun run example:replay -- --platform ios --udid "$1" --physical-ios ${FLOW_ARGS[@]+"${FLOW_ARGS[@]}"}
