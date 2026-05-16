#!/usr/bin/env python3
"""
generate_tags.py — Auto-tag pages from niche profile tags_dict (F7.1).

Reads sites/<id>/build_manifest.json, matches each page's title+h1+description
against tags_dict keywords from the niche profile, and writes sites/<id>/page_tags.json.

Usage:
  python site_pipeline/generate_tags.py --site-id vsezaimyonline
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def _load_tags_dict(site_id: str) -> dict[str, list[str]]:
    """Load tags_dict from site.config.json → niche profile."""
    config_path = PROJECT_ROOT / "sites" / site_id / "site.config.json"
    if not config_path.exists():
        return {}
    config = json.loads(config_path.read_text(encoding="utf-8"))
    niche_id = config.get("niche", "")
    if not niche_id:
        return {}
    try:
        from niche_profile import load_niche
        profile = load_niche(niche_id)
        return profile.tags_dict
    except Exception as exc:
        print(f"  WARN: could not load niche '{niche_id}': {exc}", file=sys.stderr)
        return {}


def _tag_page(text: str, tags_dict: dict[str, list[str]]) -> list[str]:
    """Return tag IDs that match keywords in text."""
    text_lower = text.lower()
    matched: list[str] = []
    for tag_id, keywords in tags_dict.items():
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw.lower()) + r"\b", text_lower):
                matched.append(tag_id)
                break  # one match per tag is enough
    return matched


def generate_tags(site_id: str) -> dict[str, list[str]]:
    """Return {path: [tag_id, ...]} for all pages in build_manifest."""
    manifest_path = PROJECT_ROOT / "sites" / site_id / "build_manifest.json"
    if not manifest_path.exists():
        sys.exit(f"build_manifest.json not found: {manifest_path}")

    manifest: list[dict] = json.loads(manifest_path.read_text(encoding="utf-8"))
    tags_dict = _load_tags_dict(site_id)
    if not tags_dict:
        print("  WARN: empty tags_dict — no tags will be assigned.", file=sys.stderr)

    result: dict[str, list[str]] = {}
    for page in manifest:
        text = " ".join([
            page.get("title", ""),
            page.get("h1", ""),
            page.get("description", ""),
        ])
        tags = _tag_page(text, tags_dict)
        result[page["path"]] = tags

    # Stats
    tag_counts: dict[str, int] = defaultdict(int)
    for tags in result.values():
        for t in tags:
            tag_counts[t] += 1
    print(f"  Tagged {len(result)} pages with {len(tag_counts)} unique tags:")
    for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
        print(f"    {tag}: {count} pages")

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Auto-tag pages from niche profile tags_dict.")
    parser.add_argument("--site-id", required=True)
    parser.add_argument("--out", type=Path, default=None, help="Output JSON path (default: sites/<id>/page_tags.json)")
    args = parser.parse_args()

    tags = generate_tags(args.site_id)
    out_path = args.out or (PROJECT_ROOT / "sites" / args.site_id / "page_tags.json")
    out_path.write_text(json.dumps(tags, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ page_tags.json → {out_path}")


if __name__ == "__main__":
    main()
