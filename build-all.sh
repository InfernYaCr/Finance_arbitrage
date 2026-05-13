#!/usr/bin/env bash
# build-all.sh — build Astro site for every site_id under sites/
#
# Usage:
#   ./build-all.sh                        # build all sites
#   ./build-all.sh rostpoisk              # build a single site
#   ./build-all.sh rostpoisk --preview    # build + restart preview on localhost:4321
#   SKIP_EXPORT=1 ./build-all.sh         # skip export_site step (use existing sites/ data)
#
# Output:
#   site/dist/<site_id>/   — built HTML tree for each site

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$REPO_ROOT/site"
SITES_DIR="$REPO_ROOT/sites"
OUTPUT_BASE="$SITE_DIR/dist"
PREVIEW_PORT=4321
DO_PREVIEW=0

# Parse args: first non-flag = site_id, --preview = restart preview server
SITE_IDS=()
for arg in "$@"; do
  if [[ "$arg" == "--preview" ]]; then
    DO_PREVIEW=1
  elif [[ "$arg" != --* ]]; then
    SITE_IDS+=("$arg")
  fi
done

# Activate virtualenv if present
if [[ -f "$REPO_ROOT/.venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

# If no site_id given, build all
if [[ ${#SITE_IDS[@]} -eq 0 ]]; then
  mapfile -t SITE_IDS < <(ls -1 "$SITES_DIR")
fi

echo "Building ${#SITE_IDS[@]} site(s): ${SITE_IDS[*]}"

LAST_BUILT=""

for SITE_ID in "${SITE_IDS[@]}"; do
  CONFIG="$SITES_DIR/$SITE_ID/site.config.json"
  if [[ ! -f "$CONFIG" ]]; then
    echo "⚠  Skipping $SITE_ID — no site.config.json found" >&2
    continue
  fi

  echo ""
  echo "════════════════════════════════════════"
  echo "  Building: $SITE_ID"
  echo "════════════════════════════════════════"

  # 1. Generate .env from site config
  echo "→ Generating site/.env..."
  "$REPO_ROOT/gen-env.sh" "$SITE_ID"

  # 2. Export pages + nav.json (unless skipped)
  if [[ "${SKIP_EXPORT:-0}" != "1" ]]; then
    echo "→ Exporting pages..."
    python3 "$REPO_ROOT/export_site.py" --site-id "$SITE_ID"
  fi

  # 3. Astro build
  echo "→ Running Astro build..."
  cd "$SITE_DIR"
  CONTENT_OUTPUT_DIR="../sites/$SITE_ID" \
    NODE_OPTIONS='--max-old-space-size=8192' \
    npx astro build

  # 4. Move dist to dist/<site_id> via tmp (can't mv a dir into its own subdir)
  DEST="$OUTPUT_BASE/$SITE_ID"
  TMP_DIST="$(mktemp -d)"
  cp -r "$SITE_DIR/dist/." "$TMP_DIST/"
  rm -rf "$DEST"
  mv "$TMP_DIST" "$DEST"
  rm -rf "$SITE_DIR/dist" && mkdir -p "$SITE_DIR/dist"
  echo "✓ Built → $DEST"
  LAST_BUILT="$SITE_ID"

  cd "$REPO_ROOT"
done

echo ""
echo "All done. Artifacts in $OUTPUT_BASE/"

# --preview: убиваем старый процесс на порту и стартуем новый
if [[ "$DO_PREVIEW" -eq 1 && -n "$LAST_BUILT" ]]; then
  PREVIEW_ROOT="$OUTPUT_BASE/$LAST_BUILT"

  echo ""
  echo "→ Перезапуск preview на http://localhost:${PREVIEW_PORT} (${LAST_BUILT})..."

  # Убиваем всё, что слушает нужный порт
  PIDS=$(lsof -ti tcp:"$PREVIEW_PORT" 2>/dev/null || true)
  if [[ -n "$PIDS" ]]; then
    echo "  Останавливаем PID(s): $PIDS"
    kill "$PIDS" 2>/dev/null || true
    sleep 0.5
  fi

  # Запускаем новый preview в фоне
  npx --yes serve "$PREVIEW_ROOT" -l "$PREVIEW_PORT" &>/tmp/build-all-preview.log &
  echo "✓ Preview запущен → http://localhost:${PREVIEW_PORT}/"
  echo "  Логи: /tmp/build-all-preview.log"
fi
