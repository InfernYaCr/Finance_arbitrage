#!/usr/bin/env python3
"""
generate_nav.py — Generate sites/<id>/nav.json from build_manifest.json.

Usage:
  python generate_nav.py --site-id finhelp-ru
  python generate_nav.py --site-id rostpoisk
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent

SKIP_SECTIONS: set[str] = {"404", "sitemap", "robots", "search"}
CONTACT_SLUGS: set[str] = {
    "kontakty", "contact", "contacts",
    "about", "o-kompanii", "o-servise",
}

MAX_NAV_ITEMS = 6       # top-level items (excluding home and contacts)
MAX_DROPDOWN_ITEMS = 8  # items per dropdown column
MIN_SECTION_PAGES = 2   # skip one-off section slugs from top nav


def _short_title(title: str, max_words: int = 3) -> str:
    """Trim a page title to a short nav label."""
    for sep in (" - ", " – ", " | ", "—", " — "):
        if sep in title:
            title = title.split(sep)[0].strip()
    # Drop trailing year
    title = re.sub(r"\s+\d{4}(\s+г\.?)?\s*$", "", title)
    words = title.strip().split()
    result = " ".join(words[:max_words])
    return result.rstrip(",:;")


def _slug_label(slug: str) -> str:
    """Convert a URL slug to a human-readable label."""
    words = slug.replace("-", " ").split()
    return " ".join(w.capitalize() for w in words[:2])


def generate_nav(site_id: str) -> list[dict]:
    manifest_path = PROJECT_ROOT / "sites" / site_id / "build_manifest.json"
    manifest: list[dict] = json.loads(manifest_path.read_text(encoding="utf-8"))

    by_path = {p["path"]: p for p in manifest}

    # Group pages by top-level section slug
    sections: dict[str, list[dict]] = defaultdict(list)
    for page in manifest:
        parts = [x for x in page["path"].strip("/").split("/") if x]
        if parts:
            sections[parts[0]].append(page)

    nav: list[dict] = [{"label": "Главная", "href": "/"}]
    contact_items: list[dict] = []
    main_items: list[dict] = []

    for section, pages in sorted(sections.items(), key=lambda x: -len(x[1])):
        if section in SKIP_SECTIONS:
            continue

        section_url = f"/{section}/"

        # Landing page: prefer exact section URL; else infer label from children or slug
        landing = by_path.get(section_url)
        if landing:
            label = _short_title(landing["title"])
        else:
            # Use shallowest child's title if available, otherwise slug
            shallowest = min(pages, key=lambda p: (len(p["path"]), p["path"]), default=None)
            if shallowest and shallowest["path"] != section_url:
                label = _short_title(shallowest["title"], max_words=2)
            else:
                label = _slug_label(section)

        # Immediate children: depth == 2 for top-level sections
        children = [
            p for p in pages
            if len([x for x in p["path"].strip("/").split("/") if x]) == 2
        ]
        children.sort(key=lambda p: p["path"])

        item: dict = {"label": label, "href": section_url}
        if children:
            dropdown_items = [
                {"label": _short_title(p["title"]), "href": p["path"]}
                for p in children[:MAX_DROPDOWN_ITEMS]
            ]
            item["columns"] = [{"items": dropdown_items}]

        if section in CONTACT_SLUGS:
            contact_items.append({"label": label, "href": section_url})
        elif len(pages) >= MIN_SECTION_PAGES:
            main_items.append(item)

    nav.extend(main_items[:MAX_NAV_ITEMS])
    if contact_items:
        nav.append(contact_items[0])

    return nav


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate nav.json for a site")
    parser.add_argument("--site-id", required=True, help="Site ID (e.g. finhelp-ru)")
    args = parser.parse_args()

    nav = generate_nav(args.site_id)

    out_path = PROJECT_ROOT / "sites" / args.site_id / "nav.json"
    out_path.write_text(
        json.dumps(nav, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"✓ nav.json ({len(nav)} items) → {out_path}")


if __name__ == "__main__":
    main()
