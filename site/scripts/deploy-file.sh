#!/usr/bin/env bash
# Upload a single file from dist/ to Beget over FTP.
# Usage:
#   ./scripts/deploy-file.sh .htaccess
#   ./scripts/deploy-file.sh mail.php
#   ./scripts/deploy-file.sh seo-uslugi/index.html
#
# The path is relative to dist/ and will be mirrored to the same path on the server.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"
      if [[ "$value" =~ ^\"(.*)\"$ ]]; then value="${BASH_REMATCH[1]}"
      elif [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < "$ENV_FILE"
fi

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  echo "Usage: deploy-file.sh <path-relative-to-dist>"
  exit 1
fi

DIST="$SCRIPT_DIR/../dist"
LOCAL="$DIST/$FILE"
if [[ ! -f "$LOCAL" ]]; then
  echo "❌  Not found in dist/: $FILE"
  exit 1
fi

BEGET_FTP_USER="${BEGET_FTP_USER:-}"
BEGET_FTP_PASS="${BEGET_FTP_PASS:-}"
BEGET_HOST="${BEGET_HOST:-}"
BEGET_FTP_PATH="${BEGET_FTP_PATH:-/}"

if [[ -z "$BEGET_FTP_USER" || -z "$BEGET_FTP_PASS" || -z "$BEGET_HOST" ]]; then
  echo "❌  Set BEGET_FTP_USER, BEGET_FTP_PASS and BEGET_HOST before deploying."
  exit 1
fi

REMOTE_DIR="$(dirname "$FILE")"
REMOTE_DIR="${REMOTE_DIR#./}"
[[ "$REMOTE_DIR" == "." ]] && REMOTE_DIR=""

echo "📤  Uploading $FILE → ftp://$BEGET_HOST/$FILE"

lftp -u "$BEGET_FTP_USER,$BEGET_FTP_PASS" "ftp://$BEGET_HOST" << LFTP_EOF
set ftp:ssl-allow no
set ftp:passive-mode on
set ftp:fix-pasv-address yes
set net:timeout 30
set net:max-retries 3
$([ -n "$REMOTE_DIR" ] && echo "mkdir -p \"$REMOTE_DIR\"" || true)
put "$LOCAL" -o "${REMOTE_DIR:+$REMOTE_DIR/}$(basename "$FILE")"
quit
LFTP_EOF

echo "✅  Done → http://$BEGET_HOST/$FILE"
