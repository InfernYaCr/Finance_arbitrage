#!/usr/bin/env bash
# Deploy site/dist/ to Beget over FTP (lftp).
# Usage:
#   ./scripts/deploy.sh           — production deploy
#   ./scripts/deploy.sh --dry-run — preview what will be sent
#
# Configure via env vars or .env file.
# NEVER commit real credentials here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

BEGET_FTP_USER="${BEGET_FTP_USER:-}"
BEGET_FTP_PASS="${BEGET_FTP_PASS:-}"
BEGET_HOST="${BEGET_HOST:-}"
BEGET_FTP_PATH="${BEGET_FTP_PATH:-/}"

if [[ -z "$BEGET_FTP_USER" || -z "$BEGET_FTP_PASS" || -z "$BEGET_HOST" ]]; then
  echo "❌  Set BEGET_FTP_USER, BEGET_FTP_PASS and BEGET_HOST before deploying."
  exit 1
fi

DIST="$SCRIPT_DIR/../dist"

if [[ ! -d "$DIST" ]]; then
  echo "❌  dist/ not found. Run 'npm run build' first."
  exit 1
fi

DRY_FLAG=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_FLAG="--dry-run"
  echo "🔍  Dry-run mode — no files will be transferred."
fi

echo "🚀  Deploying $DIST → ftp://$BEGET_HOST$BEGET_FTP_PATH"

lftp -u "$BEGET_FTP_USER,$BEGET_FTP_PASS" "ftp://$BEGET_HOST" << LFTP_EOF
set ftp:ssl-allow no
set ftp:passive-mode on
set ftp:fix-pasv-address yes
set net:timeout 60
set net:max-retries 5
set net:reconnect-interval-base 5
set mirror:parallel-transfer-count 1
mirror --reverse --verbose \
  --exclude='.DS_Store' \
  --exclude='.map$' \
  $DRY_FLAG \
  "$DIST/" \
  .
quit
LFTP_EOF

echo "✅  Deploy complete → https://$BEGET_HOST/"
