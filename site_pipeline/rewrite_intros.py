#!/usr/bin/env python3
"""
rewrite_intros.py — LLM-rewrite first paragraph of article pages (PBN uniqueness).

Uses Claude Haiku to rewrite intro paragraphs, making each site's content unique
relative to the donor. Skips pages that are not articles or already rewritten.

Usage:
  python site_pipeline/rewrite_intros.py --output-dir site_pipeline/output/vsezaimyonline
  python site_pipeline/rewrite_intros.py --output-dir site_pipeline/output/vsezaimyonline --limit 20
  python site_pipeline/rewrite_intros.py --output-dir site_pipeline/output/vsezaimyonline --force
  python site_pipeline/rewrite_intros.py --output-dir site_pipeline/output/vsezaimyonline --niche finance

Requires ANTHROPIC_API_KEY in environment or site/.env.
Credits: ~1 Haiku API call per page (≈$0.0003 per page).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

_SITE_ENV = Path(__file__).parent.parent / "site" / ".env"
if _SITE_ENV.exists():
    for _line in _SITE_ENV.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#"):
            continue
        _m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", _line)
        if _m:
            os.environ.setdefault(_m.group(1), _m.group(2).strip().strip("'\""))

PROJECT_ROOT = Path(__file__).parent.parent

ARTICLE_PAGE_TYPES = {
    "article", "company", "content_page", "dictionary_article",
    "faq", "service",
}

NICHE_VOICE = {
    "finance": (
        "Ты независимый финансовый советник. Тон — нейтральный, конкретный, полезный. "
        "Пиши для человека, который выбирает финансовый продукт. Никакой рекламы."
    ),
    "seo_agency": (
        "Ты опытный SEO-специалист. Тон — профессиональный, конкретный, без лишних слов."
    ),
    "default": (
        "Ты опытный автор. Тон — нейтральный, информативный, без клише."
    ),
}


def _extract_first_paragraph(content_html: str) -> tuple[str, str]:
    """Return (first_paragraph_text, rest_html). Extracts text of first <p>."""
    m = re.match(r"(<p[^>]*>)(.*?)(</p>)", content_html, re.IGNORECASE | re.DOTALL)
    if not m:
        return "", content_html
    tag_open, inner, tag_close = m.group(1), m.group(2), m.group(3)
    text = re.sub(r"<[^>]+>", "", inner).strip()
    rest = content_html[m.end():]
    return text, rest


def _replace_first_paragraph(content_html: str, new_text: str) -> str:
    """Replace first <p>...</p> inner text with new_text."""
    def replacer(m: re.Match) -> str:
        return m.group(1) + new_text + m.group(3)
    return re.sub(
        r"(<p[^>]*>)(.*?)(</p>)",
        replacer,
        content_html,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )


def _rewrite_paragraph(client: object, text: str, h1: str, niche: str) -> str | None:
    """Call Claude Haiku to rewrite a paragraph. Returns new text or None on error."""
    voice = NICHE_VOICE.get(niche, NICHE_VOICE["default"])
    prompt = (
        f"Перепиши вводный абзац статьи своими словами. "
        f"Сохрани смысл и ключевые факты. Длина — примерно та же. "
        f"Верни только текст абзаца без кавычек и пояснений.\n\n"
        f"Заголовок статьи: {h1}\n\n"
        f"Абзац:\n{text}"
    )
    try:
        import anthropic
        resp = client.messages.create(  # type: ignore[union-attr]
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=voice,
            messages=[{"role": "user", "content": prompt}],
        )
        result = resp.content[0].text.strip()
        return result if result else None
    except Exception as exc:
        print(f"  LLM error: {exc}", file=sys.stderr)
        return None


def process_pages(
    output_dir: Path,
    limit: int,
    force: bool,
    niche: str,
    dry_run: bool,
) -> None:
    pages_dir = output_dir / "pages"
    if not pages_dir.exists():
        sys.exit(f"Pages dir not found: {pages_dir}")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("ANTHROPIC_API_KEY not set. Add it to site/.env or environment.")

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
    except ImportError:
        sys.exit("anthropic package not installed. Run: pip install anthropic")

    page_files = sorted(pages_dir.glob("*.json"))
    processed = 0
    skipped = 0

    for page_path in page_files:
        if processed >= limit:
            break

        page = json.loads(page_path.read_text(encoding="utf-8"))
        seed = page.get("seed", {})
        extracted = page.get("extracted", {})
        page_type = extracted.get("page_type") or seed.get("page_type") or "article"

        if page_type not in ARTICLE_PAGE_TYPES:
            skipped += 1
            continue

        # Skip if already rewritten (unless --force)
        if not force and page.get("_rewritten_intro"):
            skipped += 1
            continue

        content_html = extracted.get("content_html") or ""
        if not content_html:
            skipped += 1
            continue

        first_para, _ = _extract_first_paragraph(content_html)
        if len(first_para) < 80:
            skipped += 1
            continue

        h1 = seed.get("h1") or seed.get("title") or ""
        path = seed.get("path", page_path.name)

        print(f"  Rewriting {path} … ", end="", flush=True)

        if dry_run:
            print(f"[DRY] first para: {first_para[:60]}…")
            processed += 1
            continue

        new_para = _rewrite_paragraph(client, first_para, h1, niche)
        if not new_para:
            print("SKIP (LLM failed)")
            skipped += 1
            continue

        new_html = _replace_first_paragraph(content_html, new_para)
        extracted["content_html"] = new_html
        page["extracted"] = extracted
        page["_rewritten_intro"] = True

        page_path.write_text(
            json.dumps(page, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print("OK")
        processed += 1
        time.sleep(0.3)

    print(f"\nDone: {processed} rewritten, {skipped} skipped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="LLM-rewrite intro paragraphs for PBN uniqueness.")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=200, help="Max pages to process (default 200)")
    parser.add_argument("--force", action="store_true", help="Rewrite even if already rewritten")
    parser.add_argument("--niche", default="default", help="Niche ID for brand voice (finance, seo_agency, default)")
    parser.add_argument("--dry-run", action="store_true", help="Print pages without writing")
    args = parser.parse_args()

    process_pages(
        output_dir=args.output_dir,
        limit=args.limit,
        force=args.force,
        niche=args.niche,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
