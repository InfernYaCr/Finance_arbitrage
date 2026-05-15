#!/usr/bin/env python3
"""
enrich_llm.py — Fill LLM-enriched fields in page JSON files using Claude API.

Fields populated per page:
  extracted.summary      — 1-2 sentence plain-text summary (Russian)
  extracted.entities     — named entities: banks, products, brands
  extracted.data_points  — key numbers/stats from the page
  extracted.target_query — primary search query the page targets

Usage:
  python site_pipeline/enrich_llm.py --site-id vsezaimyonline
  python site_pipeline/enrich_llm.py --site-id vsezaimyonline --limit 20 --force
  python site_pipeline/enrich_llm.py --pages-dir sites/vsezaimyonline/pages

Requires ANTHROPIC_API_KEY in environment.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

try:
    import anthropic
except ImportError:
    print("ERROR: anthropic package not installed. Run: pip install anthropic", file=sys.stderr)
    sys.exit(1)

MODEL = "claude-haiku-4-5-20251001"
MAX_CONTENT_CHARS = 4000
RATE_LIMIT_SLEEP = 0.3  # seconds between API calls

SYSTEM_PROMPT = """\
You are a data extraction assistant for a Russian finance content site.
Given a page title, h1 and text excerpt, return a JSON object with these fields:
- summary: 1-2 sentence plain-text summary in Russian (max 200 chars)
- entities: list of named entities (bank names, product names, brands), max 8
- data_points: list of key numbers/stats as short strings, max 6 (e.g. "до 1 000 000 ₽", "120 дней без %")
- target_query: the single most likely Russian search query this page targets (max 60 chars)

Respond ONLY with valid JSON. No markdown, no explanation."""


def _truncate(text: str, limit: int = MAX_CONTENT_CHARS) -> str:
    return text[:limit] if len(text) > limit else text


def enrich_page(client: anthropic.Anthropic, title: str, h1: str, content_text: str) -> dict:
    user_msg = f"Title: {title}\nH1: {h1}\n\nText:\n{_truncate(content_text)}"
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}
    except anthropic.APIError as e:
        print(f"  API error: {e}", file=sys.stderr)
        return {}


def process_pages_dir(
    pages_dir: Path,
    force: bool = False,
    limit: int | None = None,
) -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    files = sorted(pages_dir.glob("*.json"))

    processed = 0
    skipped = 0
    for page_file in files:
        if limit and processed >= limit:
            break

        data = json.loads(page_file.read_text(encoding="utf-8"))
        extracted = data.get("extracted") or {}

        if not force and extracted.get("summary"):
            skipped += 1
            continue

        seed = data.get("seed") or {}
        title = seed.get("title") or data.get("wp_title") or ""
        h1 = seed.get("h1") or ""
        content_text = data.get("content_text") or ""

        if len(content_text) < 100:
            skipped += 1
            continue

        print(f"  Enriching {page_file.name[:50]} …", end=" ", flush=True)
        result = enrich_page(client, title, h1, content_text)

        if result:
            extracted["summary"] = result.get("summary") or extracted.get("summary") or ""
            extracted["entities"] = result.get("entities") or extracted.get("entities") or []
            extracted["data_points"] = result.get("data_points") or extracted.get("data_points") or []
            extracted["target_query"] = result.get("target_query") or extracted.get("target_query") or ""
            data["extracted"] = extracted
            page_file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print("✓")
            processed += 1
        else:
            print("skip (empty response)")
            skipped += 1

        time.sleep(RATE_LIMIT_SLEEP)

    print(f"\nDone: {processed} enriched, {skipped} skipped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="LLM-enrich page JSON files.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--site-id", help="Site ID under sites/ (e.g. vsezaimyonline)")
    group.add_argument("--pages-dir", type=Path, help="Direct path to pages/ directory")
    parser.add_argument("--limit", type=int, default=None, help="Max pages to process")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if summary already set")
    args = parser.parse_args()

    if args.site_id:
        pages_dir = PROJECT_ROOT / "sites" / args.site_id / "pages"
    else:
        pages_dir = args.pages_dir

    if not pages_dir.exists():
        print(f"ERROR: pages dir not found: {pages_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Enriching pages in {pages_dir} …")
    process_pages_dir(pages_dir, force=args.force, limit=args.limit)


if __name__ == "__main__":
    main()
