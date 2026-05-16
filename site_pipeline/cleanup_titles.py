#!/usr/bin/env python3
"""
cleanup_titles.py — Strip donor brand from h1/title fields in page JSON files.

Uses regex first; falls back to Claude Haiku LLM for tricky cases.

Usage:
  python site_pipeline/cleanup_titles.py --output-dir site_pipeline/output/vsezaimyonline
  python site_pipeline/cleanup_titles.py --output-dir site_pipeline/output/vsezaimyonline --dry-run
  python site_pipeline/cleanup_titles.py --output-dir site_pipeline/output/vsezaimyonline --llm-fallback

Reads donor brand aliases from the nearest sites/<id>/site.config.json matching the output dir.
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


def _find_aliases(output_dir: Path) -> list[str]:
    """Guess site ID from output_dir name, load aliases from site.config.json."""
    donor_slug = output_dir.name  # e.g. vsezaimyonline
    # Try sites/*/site.config.json that reference this donor
    for config_path in sorted((PROJECT_ROOT / "sites").glob("*/site.config.json")):
        try:
            cfg = json.loads(config_path.read_text(encoding="utf-8"))
            if cfg.get("donor_id", "") == donor_slug:
                aliases = cfg.get("brand", {}).get("aliases", [])
                return [a for a in aliases if a]
        except Exception:
            continue
    return []


def _build_alias_re(aliases: list[str]) -> re.Pattern[str] | None:
    if not aliases:
        return None
    # Also match with .ru/.com stripped
    expanded: list[str] = []
    for a in aliases:
        expanded.append(re.escape(a))
        stripped = re.sub(r"\.(ru|com|net|org)$", "", a, flags=re.I)
        if stripped != a:
            expanded.append(re.escape(stripped))
    pattern = r"(?:\s*[-–|—]\s*|\s+)(?:" + "|".join(expanded) + r")(\s*[-–|—]\s*|\s*$)"
    return re.compile(pattern, re.IGNORECASE)


def _regex_clean(text: str, alias_re: re.Pattern[str]) -> str:
    cleaned = alias_re.sub("", text).strip(" -–—|")
    return cleaned if cleaned else text


def _llm_clean(title: str, h1: str, aliases: list[str]) -> tuple[str, str]:
    """Call Claude Haiku to clean title and h1 if regex didn't help."""
    try:
        import anthropic
    except ImportError:
        return title, h1

    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    aliases_str = ", ".join(aliases)
    prompt = (
        f"Remove any mention of the following brand names from the title and h1 below. "
        f"Keep the rest unchanged. Return JSON: {{\"title\": \"...\", \"h1\": \"...\"}}\n\n"
        f"Brand names to remove: {aliases_str}\n\n"
        f"title: {title}\n"
        f"h1: {h1}"
    )
    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        # Extract JSON from response
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            data = json.loads(m.group())
            return data.get("title", title), data.get("h1", h1)
    except Exception:
        pass
    return title, h1


def process_pages(output_dir: Path, dry_run: bool, llm_fallback: bool) -> None:
    pages_dir = output_dir / "pages"
    if not pages_dir.exists():
        sys.exit(f"Pages dir not found: {pages_dir}")

    aliases = _find_aliases(output_dir)
    if not aliases:
        print("WARN: no brand aliases found; nothing to strip.", file=sys.stderr)
    else:
        print(f"Stripping aliases: {aliases}")

    alias_re = _build_alias_re(aliases)
    page_files = sorted(pages_dir.glob("*.json"))
    changed = 0
    llm_used = 0

    for page_path in page_files:
        page = json.loads(page_path.read_text(encoding="utf-8"))
        seed = page.get("seed", {})
        orig_title = seed.get("title") or ""
        orig_h1 = seed.get("h1") or ""

        new_title = orig_title
        new_h1 = orig_h1

        if alias_re and orig_title:
            new_title = _regex_clean(orig_title, alias_re)
        if alias_re and orig_h1:
            new_h1 = _regex_clean(orig_h1, alias_re)

        # LLM fallback: if brand still appears in title/h1 after regex
        needs_llm = False
        if llm_fallback and aliases:
            for alias in aliases:
                base = re.sub(r"\.(ru|com)$", "", alias, flags=re.I)
                if base.lower() in new_title.lower() or base.lower() in new_h1.lower():
                    needs_llm = True
                    break

        if needs_llm:
            new_title, new_h1 = _llm_clean(new_title, new_h1, aliases)
            llm_used += 1
            time.sleep(0.3)

        if new_title != orig_title or new_h1 != orig_h1:
            changed += 1
            if dry_run:
                print(f"  [DRY] {page_path.name}")
                if new_title != orig_title:
                    print(f"    title: {orig_title!r} → {new_title!r}")
                if new_h1 != orig_h1:
                    print(f"    h1:    {orig_h1!r} → {new_h1!r}")
            else:
                seed["title"] = new_title
                seed["h1"] = new_h1
                page["seed"] = seed
                page_path.write_text(
                    json.dumps(page, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )

    suffix = " (dry-run)" if dry_run else ""
    print(f"Done{suffix}: {changed}/{len(page_files)} pages updated, {llm_used} used LLM fallback.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Strip donor brand from page titles/h1.")
    parser.add_argument("--output-dir", type=Path, required=True, help="Crawl output dir (contains pages/)")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    parser.add_argument("--llm-fallback", action="store_true", help="Use Claude Haiku when regex misses brand")
    args = parser.parse_args()

    process_pages(args.output_dir, dry_run=args.dry_run, llm_fallback=args.llm_fallback)


if __name__ == "__main__":
    main()
