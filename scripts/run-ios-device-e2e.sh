#!/usr/bin/env bash
# Physical iOS: agent-device scheme opens often land on home. Launch the lab URL
# with CoreDevice, then replay a suite that opens the already-routed app.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <udid> [suite.ad] [deeplink]" >&2
  exit 1
fi

UDID="$1"
SUITE="${2:-e2e/qa-full-features.ad}"
URL="${3:-qrcode://e2e}"
BUNDLE_ID="${BUNDLE_ID:-com.qrcode.example}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

xcrun devicectl device process launch \
  --device "$UDID" \
  --payload-url "$URL" \
  "$BUNDLE_ID"

sleep 2

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/qrcode-ios-e2e.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
TMP="$TMP_DIR/suite.ad"

{
  echo "open \"$BUNDLE_ID\""
  # Drop leading open lines from the recorded suite; keep waits/presses.
  awk 'BEGIN{skip=1} /^open /{if(skip) next} {skip=0; print}' "$SUITE"
} >"$TMP"

if [[ ! -s "$TMP" ]]; then
  echo "suite $SUITE had no steps after open" >&2
  exit 1
fi

agent-device --udid "$UDID" test "$TMP" --retries 1
