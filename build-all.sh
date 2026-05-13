#!/usr/bin/env bash
# build-all.sh — build Astro site for every site_id under sites/
#
# Usage:
#   ./build-all.sh                   # build all sites
#   ./build-all.sh rostpoisk         # build a single site
#   SKIP_EXPORT=1 ./build-all.sh     # skip export_site step (use existing sites/ data)
#
# Output:
#   site/dist/<site_id>/   — built HTML tree for each site

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$REPO_ROOT/site"
SITES_DIR="$REPO_ROOT/sites"
OUTPUT_BASE="$SITE_DIR/dist"

# Activate virtualenv if present
if [[ -f "$REPO_ROOT/.venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

# Determine which sites to build
if [[ "${1:-}" != "" ]]; then
  SITE_IDS=("$1")
else
  mapfile -t SITE_IDS < <(ls -1 "$SITES_DIR")
fi

echo "Building ${#SITE_IDS[@]} site(s): ${SITE_IDS[*]}"

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
    python3 "$REPO_ROOT/export_site.py" "$SITE_ID"
  fi

  # 3. Astro build
  echo "→ Running Astro build..."
  cd "$SITE_DIR"
  CONTENT_OUTPUT_DIR="../sites/$SITE_ID" \
    NODE_OPTIONS='--max-old-space-size=8192' \
    npx astro build

  # 4. Move dist to dist/<site_id>
  DEST="$OUTPUT_BASE/$SITE_ID"
  rm -rf "$DEST"
  mv "$SITE_DIR/dist" "$DEST"
  mkdir -p "$SITE_DIR/dist"  # recreate empty dist for next iteration
  echo "✓ Built → $DEST"

  cd "$REPO_ROOT"
done

echo ""
echo "All done. Artifacts in $OUTPUT_BASE/"
