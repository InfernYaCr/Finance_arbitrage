#!/usr/bin/env python3
"""
export_site.py — Export donor content into sites/<SITE_ID>/ for Astro build.

Reads the latest crawl_run for the site's donor from the registry,
copies pages/ and build_manifest.json into sites/<SITE_ID>/.

Usage:
  python export_site.py --site-id rostpoisk
  python export_site.py --site-id finhelp-ru
  python export_site.py --site-id rostpoisk --output-dir site_pipeline/output  # override source

After export, build with:
  ./gen-env.sh <site_id> && cd site && npm run build
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT / "site_pipeline"))
import registry as reg
from extraction_rules import enrich_page_file

# Fallback paths for donors crawled before registry existed
_LEGACY_OUTPUT_DIRS: dict[str, str] = {
    "mosseo-ru": "site_pipeline/output",
    "vsezaimyonline-ru": "site_pipeline/output/finance_test",
}


def _find_source_dir(donor_id: str, override: str | None) -> Path:
    """Find the content output directory for a donor."""
    if override:
        return PROJECT_ROOT / override

    # Try registry: latest crawl_run with an output_dir
    runs = reg.list_crawl_runs(donor_id)
    for run in runs:
        if run.get("output_dir"):
            p = Path(run["output_dir"])
            if not p.is_absolute():
                p = PROJECT_ROOT / p
            if p.exists():
                return p

    # Fallback to known legacy path
    if donor_id in _LEGACY_OUTPUT_DIRS:
        p = PROJECT_ROOT / _LEGACY_OUTPUT_DIRS[donor_id]
        if p.exists():
            print(f"  (using legacy fallback: {p})")
            return p

    sys.exit(
        f"Cannot find content source for donor '{donor_id}'.\n"
        f"Run a crawl first: python site_pipeline/crawl_pages_fc.py --source-domain <donor>\n"
        f"Or pass --output-dir explicitly."
    )


def export_site(site_id: str, output_dir_override: str | None = None) -> None:
    # Load site config
    config_path = PROJECT_ROOT / "sites" / site_id / "site.config.json"
    if not config_path.exists():
        sys.exit(f"Site config not found: {config_path}\nRun: python registry_cli.py add-site --id {site_id} --donor <url>")

    config = json.loads(config_path.read_text(encoding="utf-8"))
    donor_id = config.get("donor_id")
    if not donor_id:
        sys.exit(f"'donor_id' missing in {config_path}")

    print(f"Exporting {site_id} (donor: {donor_id}) …")

    # Find source
    source_dir = _find_source_dir(donor_id, output_dir_override)
    src_pages = source_dir / "pages"
    src_manifest = source_dir / "build_manifest.json"

    if not src_pages.exists():
        sys.exit(f"Pages directory not found: {src_pages}")
    if not src_manifest.exists():
        sys.exit(f"build_manifest.json not found: {src_manifest}")

    # Destination
    dest_dir = PROJECT_ROOT / "sites" / site_id
    dest_pages = dest_dir / "pages"
    dest_manifest = dest_dir / "build_manifest.json"

    # Clear and copy pages
    if dest_pages.exists():
        shutil.rmtree(dest_pages)
    shutil.copytree(src_pages, dest_pages)
    page_count = len(list(dest_pages.glob("*.json")))
    enriched_count = sum(1 for path in dest_pages.glob("*.json") if enrich_page_file(path))

    # Copy manifest and rewrite page_file paths to point to sites/<id>/pages/
    manifest = json.loads(src_manifest.read_text(encoding="utf-8"))
    pages_prefix = f"sites/{site_id}/pages/"
    for entry in manifest:
        filename = Path(entry["page_file"]).name
        entry["page_file"] = pages_prefix + filename
    dest_manifest.write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    print(f"✓ Copied {page_count} pages → {dest_pages}")
    if enriched_count:
        print(f"✓ Enriched extracted metadata in {enriched_count} page(s)")
    print(f"✓ Wrote build_manifest.json (page_file → {pages_prefix}*) → {dest_manifest}")

    # Copy per-site affiliate/promo configs to site/src/data/ if present
    astro_data_dir = PROJECT_ROOT / "site" / "src" / "data"
    for fname in ("affiliateLinks.json", "promoSlots.json"):
        src_cfg = dest_dir / fname
        dst_cfg = astro_data_dir / fname
        if src_cfg.exists():
            shutil.copy2(src_cfg, dst_cfg)
            print(f"✓ Copied {fname} → {dst_cfg}")

    # Generate nav.json from manifest
    try:
        from generate_nav import generate_nav
        nav = generate_nav(site_id)
        nav_path = dest_dir / "nav.json"
        nav_path.write_text(
            json.dumps(nav, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"✓ Generated nav.json ({len(nav)} items) → {nav_path}")
    except Exception as exc:
        print(f"  nav.json generation skipped: {exc}", file=sys.stderr)

    # Update content_dir in site.config.json to point to sites/<id>/
    relative_content_dir = f"../sites/{site_id}"
    if config.get("content_dir") != relative_content_dir:
        config["content_dir"] = relative_content_dir
        config_path.write_text(
            json.dumps(config, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"✓ Updated site.config.json content_dir → {relative_content_dir}")

    # Record build run in registry
    try:
        run_id = reg.insert_build_run(site_id, page_count=page_count, status="exported")
        print(f"✓ Registry: build run {run_id} recorded")
    except Exception as exc:
        print(f"  Registry write skipped: {exc}", file=sys.stderr)

    print(f"\nDone. Build with:\n  ./gen-env.sh {site_id} && cd site && npm run build")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export donor content into sites/<SITE_ID>/")
    parser.add_argument("--site-id", required=True, help="Site ID (e.g. rostpoisk)")
    parser.add_argument(
        "--output-dir", default=None,
        help="Override source content directory (relative to project root)",
    )
    args = parser.parse_args()
    export_site(args.site_id, args.output_dir)


if __name__ == "__main__":
    main()
