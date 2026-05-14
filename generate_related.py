#!/usr/bin/env python3
"""
generate_related.py — Generate sites/<id>/related_pages.json using FTS5 similarity search.

For each page in the site's build_manifest, runs an FTS5 query against
content_index.sqlite to find 3–5 related pages within the same donor dataset.
Writes related_pages.json: { "<page_id>": [{ "path", "title", "h1" }, ...] }

Usage:
  python generate_related.py --site-id vsezaimyonline
  python generate_related.py --site-id finhelp-ru --top-k 5 --min-chars 500
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent

# Words to strip from FTS queries (stop-words + common Russian articles/prepositions)
_STOP_RE = re.compile(
    r"\b(?:и|в|на|с|по|за|для|из|от|до|при|как|это|все|уже|что|как|"
    r"или|но|а|то|же|ли|бы|ни|не|так|он|она|они|его|её|их|нет|да|"
    r"seo|www|http|https|ru|com)\b",
    re.IGNORECASE,
)
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_SPACES_RE = re.compile(r"\s{2,}")


def _fts_query(text: str, max_terms: int = 8) -> str:
    """Build an FTS5 query from a page title/h1: strip stop-words, take first N words."""
    text = _PUNCT_RE.sub(" ", text)
    text = _STOP_RE.sub(" ", text)
    text = _SPACES_RE.sub(" ", text).strip()
    words = [w for w in text.split() if len(w) > 3][:max_terms]
    if not words:
        return ""
    # OR query: match pages containing any of the terms
    return " OR ".join(f'"{w}"' for w in words)


def find_related(
    conn: sqlite3.Connection,
    page_id: str,
    title: str,
    h1: str,
    top_k: int = 5,
    min_chars: int = 0,
) -> list[dict]:
    """Return top_k related pages for a given page using FTS5."""
    query_text = h1 or title
    fts_query = _fts_query(query_text)
    if not fts_query:
        return []

    chars_filter = f"AND p.text_chars >= {min_chars}" if min_chars > 0 else ""

    try:
        rows = conn.execute(
            f"""
            SELECT f.id, f.path, f.title, f.h1
            FROM pages_fts f
            JOIN pages p ON p.id = f.id
            WHERE pages_fts MATCH ?
              AND f.id != ?
              AND p.excluded = 0
              {chars_filter}
            LIMIT ?
            """,
            (fts_query, page_id, top_k + 2),  # +2 to allow dedup after
        ).fetchall()
    except sqlite3.OperationalError:
        # FTS syntax error (e.g. empty query or special chars) — return empty
        return []

    seen_paths: set[str] = set()
    result = []
    for row in rows:
        rid, path, rtitle, rh1 = row
        if path in seen_paths:
            continue
        seen_paths.add(path)
        result.append({"path": path, "title": rtitle or rh1 or path, "h1": rh1 or ""})
        if len(result) >= top_k:
            break

    return result


def generate_related(
    site_id: str,
    top_k: int = 5,
    min_chars: int = 0,
) -> dict[str, list[dict]]:
    """Build related pages map for all pages in a site's build_manifest."""
    site_dir = PROJECT_ROOT / "sites" / site_id
    manifest_path = site_dir / "build_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"build_manifest.json not found: {manifest_path}")

    manifest: list[dict] = json.loads(manifest_path.read_text(encoding="utf-8"))

    # Find content_index.sqlite — copied to sites/<id>/ by export_site.py
    db_path = site_dir / "content_index.sqlite"
    if not db_path.exists():
        raise FileNotFoundError(
            f"content_index.sqlite not found: {db_path}\n"
            f"Run export first: python export_site.py --site-id {site_id}\n"
            f"Or rebuild index: python site_pipeline/build_content_index.py"
        )

    conn = sqlite3.connect(db_path)
    try:
        related: dict[str, list[dict]] = {}
        for entry in manifest:
            page_id = entry["id"]
            title = entry.get("title", "")
            h1 = entry.get("h1", "")
            related[page_id] = find_related(conn, page_id, title, h1, top_k, min_chars)
    finally:
        conn.close()

    return related


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate related_pages.json for a site using FTS5.")
    parser.add_argument("--site-id", required=True, help="Site ID (e.g. finhelp-ru)")
    parser.add_argument("--top-k", type=int, default=5, help="Max related pages per page (default: 5)")
    parser.add_argument("--min-chars", type=int, default=0, help="Min text chars for related candidates")
    args = parser.parse_args()

    print(f"Generating related pages for {args.site_id}…")
    related = generate_related(args.site_id, top_k=args.top_k, min_chars=args.min_chars)

    out_path = PROJECT_ROOT / "sites" / args.site_id / "related_pages.json"
    out_path.write_text(json.dumps(related, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    total_with_related = sum(1 for v in related.values() if v)
    print(f"✓ {total_with_related}/{len(related)} pages have related links → {out_path}")


if __name__ == "__main__":
    main()
