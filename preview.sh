#!/usr/bin/env bash
# preview.sh — build and open local preview for a site
#
# Usage:
#   ./preview.sh rostpoisk
#   ./preview.sh finhelp-ru
#
# Opens http://127.0.0.1:4321 in the browser after build.
# Deploy is NOT triggered — run `npm run deploy` manually when ready.

set -euo pipefail

SITE_ID="${1:-}"
if [[ -z "$SITE_ID" ]]; then
  echo "Usage: $0 <site_id>" >&2
  echo "Available sites:" >&2
  ls sites/ >&2
  exit 1
fi

echo "→ Generating site/.env for ${SITE_ID}..."
./gen-env.sh "$SITE_ID"

echo "→ Building..."
cd site && npm run build

echo ""
echo "✓ Build complete. Opening preview at http://127.0.0.1:4321"
echo "  Press Ctrl+C to stop. Deploy: cd site && npm run deploy"
echo ""

npm run preview -- --host 127.0.0.1 --port 4321
