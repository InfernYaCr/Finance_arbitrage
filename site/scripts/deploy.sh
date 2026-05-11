#!/usr/bin/env bash
# Deploy site/dist/ to Beget over rsync+SSH.
# Usage:
#   ./scripts/deploy.sh           — production deploy
#   ./scripts/deploy.sh --dry-run — preview what will be sent
#
# Configure via env vars or edit defaults below.
# NEVER commit real credentials here.

set -euo pipefail

BEGET_USER="${BEGET_USER:-}"
BEGET_HOST="${BEGET_HOST:-}"
BEGET_PATH="${BEGET_PATH:-}"   # e.g. /home/yourlogin/seo-test/public_html

if [[ -z "$BEGET_USER" || -z "$BEGET_HOST" || -z "$BEGET_PATH" ]]; then
  echo "❌  Set BEGET_USER, BEGET_HOST and BEGET_PATH before deploying."
  echo "    Example:"
  echo "    BEGET_USER=yourlogin BEGET_HOST=yourlogin.beget.tech BEGET_PATH=/home/yourlogin/seo-test/public_html ./scripts/deploy.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/../dist"

if [[ ! -d "$DIST" ]]; then
  echo "❌  dist/ not found. Run 'npm run build' first."
  exit 1
fi

DRY=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY="--dry-run"
  echo "🔍  Dry-run mode — no files will be transferred."
fi

echo "🚀  Deploying $DIST → $BEGET_USER@$BEGET_HOST:$BEGET_PATH"

rsync -avz --delete \
  --exclude='.DS_Store' \
  --exclude='*.map' \
  -e "ssh -p 22" \
  $DRY \
  "$DIST/" \
  "$BEGET_USER@$BEGET_HOST:$BEGET_PATH/"

echo "✅  Deploy complete → https://${BEGET_HOST}/"
