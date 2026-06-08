#!/usr/bin/env python3
"""
crawl_pages_c4ai.py — Crawl4AI backend for donor site crawling.

Drop-in alternative to crawl_pages_fc.py: same CLI, same pages/*.json output,
same registry write. Difference: open-source self-hosted crawler instead of
Firecrawl managed API. LLM extraction via Anthropic Haiku through LiteLLM.

Flow:
  1. map_urls(base_url)         → BFS deep-crawl URL discovery
  2. filter_urls(urls)          → reuse FC filter (drops pagination, params, tags)
  3. arun_many(urls, ...)       → markdown + html + links [+ json(LLM schema)]
  4. write JSON per page        → same shape as FC backend (qa_pages.py compatible)

Usage:
  python site_pipeline/crawl_pages_c4ai.py --source-domain donor.ru [--limit 300]
  python site_pipeline/crawl_pages_c4ai.py --source-domain donor.ru --map-only
  python site_pipeline/crawl_pages_c4ai.py --source-domain donor.ru --with-llm
  python site_pipeline/crawl_pages_c4ai.py --source-domain donor.ru --smart-actions
  python site_pipeline/crawl_pages_c4ai.py --source-domain donor.ru --include-sections blog,uslugi

Runs with .venv311 (Crawl4AI requires Python 3.10+).
Requires ANTHROPIC_API_KEY in environment or site/.env if --with-llm is used.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Load site/.env so ANTHROPIC_API_KEY is available when run from project root.
_SITE_ENV = Path(__file__).parent.parent / "site" / ".env"
if _SITE_ENV.exists():
    for _line in _SITE_ENV.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#"):
            continue
        _m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", _line)
        if _m:
            _key, _val = _m.group(1), _m.group(2).strip().strip("'\"")
            os.environ.setdefault(_key, _val)

from crawl4ai import (  # noqa: E402
    AsyncWebCrawler,
    BrowserConfig,
    CacheMode,
    CrawlerRunConfig,
    LLMConfig,
    LLMExtractionStrategy,
)
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy  # noqa: E402

from registry import insert_crawl_run  # noqa: E402

from common import DEFAULT_OUTPUT, write_json  # noqa: E402

# Reuse heavy lifting from the Firecrawl backend: filtering, page-record
# building, normalization, and the LLM schema. Output format stays identical.
from crawl_pages_fc import (  # noqa: E402
    PAGE_EXTRACTION_SCHEMA,
    _THIN_THRESHOLD,
    _build_record,
    filter_urls,
)

DEFAULT_LLM_MODEL = "anthropic/claude-haiku-4-5-20251001"

_LLM_INSTRUCTION = (
    "Analyse this web page and extract structured metadata. "
    "Identify the page_type, list services or products, FAQ Q&A pairs, "
    "pricing tiers, portfolio or case results, key selling points, "
    "and the primary CTA text. Return only what is clearly present."
)


# ---------------------------------------------------------------------------
# Crawl4AI result → Firecrawl-shaped doc dict (so we can reuse _build_record)
# ---------------------------------------------------------------------------

def _adapt_result(result: Any, fallback_url: str) -> dict[str, Any]:
    """Map a Crawl4AI CrawlResult to the dict shape _build_record expects.

    Firecrawl's Document has .metadata, .markdown, .html, .links, .json/extract.
    Crawl4AI's CrawlResult has .metadata, .markdown(.raw_markdown), .cleaned_html,
    .html, .links (dict), .extracted_content (JSON string).
    """
    markdown = getattr(result, "markdown", "") or ""
    if hasattr(markdown, "raw_markdown"):
        markdown = markdown.raw_markdown or ""
    if not isinstance(markdown, str):
        markdown = str(markdown)

    raw_meta: dict[str, Any] = dict(getattr(result, "metadata", None) or {})
    source_url: str = getattr(result, "url", "") or fallback_url
    status_code = int(getattr(result, "status_code", 0) or 200)

    doc_metadata: dict[str, Any] = {
        "sourceURL": source_url,
        "title": raw_meta.get("title", "") or "",
        "description": raw_meta.get("description", "") or "",
        "language": raw_meta.get("language", "") or raw_meta.get("lang", "") or "",
        "robots": raw_meta.get("robots", "") or "",
        "ogImage": raw_meta.get("og:image", "") or raw_meta.get("ogImage", "") or "",
        "ogTitle": (
            raw_meta.get("og:title")
            or raw_meta.get("ogTitle")
            or raw_meta.get("title")
            or ""
        ),
        "ogDescription": (
            raw_meta.get("og:description")
            or raw_meta.get("ogDescription")
            or raw_meta.get("description")
            or ""
        ),
        "ogUrl": (
            raw_meta.get("og:url")
            or raw_meta.get("canonical")
            or source_url
        ),
        "statusCode": status_code,
        "publishedTime": (
            raw_meta.get("article:published_time")
            or raw_meta.get("publishedTime")
            or ""
        ),
        "modifiedTime": (
            raw_meta.get("article:modified_time")
            or raw_meta.get("modifiedTime")
            or ""
        ),
    }

    # Links: c4ai gives {'internal': [{href, text}], 'external': [...]}
    links_obj = getattr(result, "links", None) or {}
    internal = links_obj.get("internal") or []
    external = links_obj.get("external") or []
    flat_links: list[str] = []
    for item in (*internal, *external):
        if isinstance(item, dict):
            href = item.get("href")
        else:
            href = item
        if isinstance(href, str) and href.strip():
            flat_links.append(href.strip())

    # Extracted (LLM JSON output is a JSON string of either dict or list[dict])
    extracted: dict[str, Any] | None = None
    raw_extract = getattr(result, "extracted_content", None)
    if raw_extract:
        try:
            data = json.loads(raw_extract) if isinstance(raw_extract, str) else raw_extract
            if isinstance(data, list) and data:
                data = data[0]
            if isinstance(data, dict):
                extracted = data
        except (json.JSONDecodeError, TypeError):
            pass

    html_body = (
        getattr(result, "cleaned_html", None)
        or getattr(result, "html", None)
        or ""
    )

    return {
        "metadata": doc_metadata,
        "markdown": markdown,
        "html": html_body,
        "links": flat_links,
        "json_field": extracted,
        "url": source_url,
    }


# ---------------------------------------------------------------------------
# URL discovery (Crawl4AI BFS, equivalent to firecrawl.map_url)
# ---------------------------------------------------------------------------

async def _map_urls(base_url: str, source_domain: str, soft_cap: int) -> list[str]:
    """BFS deep-crawl in lightweight mode to enumerate URLs."""
    bfs = BFSDeepCrawlStrategy(
        max_depth=3,
        max_pages=soft_cap,
        include_external=False,
    )
    cfg = CrawlerRunConfig(
        deep_crawl_strategy=bfs,
        cache_mode=CacheMode.ENABLED,
        only_text=True,
        word_count_threshold=1,
        stream=True,
        verbose=False,
    )
    browser_cfg = BrowserConfig(headless=True, verbose=False)

    seen: set[str] = set()
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        async for result in await crawler.arun(base_url, config=cfg):
            if getattr(result, "success", False) and getattr(result, "url", None):
                seen.add(result.url)
            # Also harvest internal links seen on each page, mimicking sitemap-style breadth.
            links_obj = getattr(result, "links", None) or {}
            for item in (links_obj.get("internal") or []):
                href = item.get("href") if isinstance(item, dict) else item
                if isinstance(href, str) and source_domain in href:
                    seen.add(href)
    return list(seen)


# ---------------------------------------------------------------------------
# Batch scrape
# ---------------------------------------------------------------------------

def _build_llm_strategy(
    model: str, api_key: str
) -> LLMExtractionStrategy:
    return LLMExtractionStrategy(
        llm_config=LLMConfig(provider=model, api_token=api_key),
        schema=PAGE_EXTRACTION_SCHEMA,
        extraction_type="schema",
        instruction=_LLM_INSTRUCTION,
        chunk_token_threshold=4000,
        overlap_rate=0.05,
        apply_chunking=True,
        input_format="markdown",
        verbose=False,
    )


async def _scrape_batch(
    urls: list[str],
    with_llm: bool,
    llm_model: str,
) -> list[Any]:
    """Batch scrape urls; return list of CrawlResult."""
    llm_strategy: LLMExtractionStrategy | None = None
    if with_llm:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            sys.exit(
                "ANTHROPIC_API_KEY not set. Add it to site/.env or the environment "
                "(needed for --with-llm)."
            )
        llm_strategy = _build_llm_strategy(llm_model, api_key)

    cfg = CrawlerRunConfig(
        extraction_strategy=llm_strategy,
        cache_mode=CacheMode.ENABLED,
        word_count_threshold=10,
        page_timeout=45_000,
        verbose=False,
    )
    browser_cfg = BrowserConfig(headless=True, verbose=False)

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        results = await crawler.arun_many(urls, config=cfg)
        # arun_many returns a list when stream=False (default)
        return list(results)


# ---------------------------------------------------------------------------
# Smart-actions retry (matches Firecrawl backend semantics)
# ---------------------------------------------------------------------------

async def _retry_thin(
    records_by_path: dict[str, dict[str, Any]],
    source_domain: str,
    base_url: str,
    recrawl: bool,
) -> tuple[int, int]:
    thin_paths = [
        p for p, rec in records_by_path.items()
        if rec["quality"]["content_text_chars"] < _THIN_THRESHOLD
    ]
    if not thin_paths:
        return 0, 0

    cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_for="css:body",
        js_code=[
            "await new Promise(r => setTimeout(r, 1500));",
            "window.scrollTo(0, document.body.scrollHeight);",
            "await new Promise(r => setTimeout(r, 800));",
        ],
        scan_full_page=True,
        page_timeout=45_000,
        verbose=False,
    )
    browser_cfg = BrowserConfig(headless=True, verbose=False)

    improved = 0
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        for path in thin_paths:
            old_rec = records_by_path[path]
            old_chars = old_rec["quality"]["content_text_chars"]
            url = old_rec["seed"]["source_url"]
            try:
                result = await crawler.arun(url, config=cfg)
                doc = _adapt_result(result, url)
                new_rec = _build_record(doc, base_url, source_domain, recrawl)
                new_chars = new_rec["quality"]["content_text_chars"]
                if new_chars > old_chars:
                    records_by_path[path] = new_rec
                    improved += 1
                    print(f"  ✓ thin→rich {url} ({old_chars}→{new_chars} chars)")
                else:
                    print(f"  ~ no gain   {url} ({old_chars}→{new_chars} chars)")
            except Exception as exc:  # noqa: BLE001
                print(f"  ! retry failed {url}: {exc}", file=sys.stderr)
    return improved, len(thin_paths)


# ---------------------------------------------------------------------------
# Main crawl logic
# ---------------------------------------------------------------------------

async def _crawl_async(
    source_domain: str,
    limit: int,
    output_dir: Path,
    recrawl: bool,
    map_only: bool,
    with_llm: bool,
    smart_actions: bool,
    include_sections: list[str] | None,
    llm_model: str,
) -> None:
    base_url = f"https://{source_domain}"
    output_root = output_dir.parent if output_dir.name == "pages" else output_dir
    pages_dir = output_dir if output_dir.name == "pages" else output_dir / "pages"
    map_cache_path = output_root / "map_urls.json"
    output_root.mkdir(parents=True, exist_ok=True)

    # Step 1: discover URLs
    if map_cache_path.exists():
        print(f"[1/3] Loading cached map {map_cache_path} …")
        raw_urls = [
            item for item in json.loads(map_cache_path.read_text(encoding="utf-8"))
            if isinstance(item, str)
        ]
    else:
        soft_cap = min(limit * 4, 5000)
        print(f"[1/3] Mapping {base_url} (soft_cap={soft_cap}) …")
        raw_urls = await _map_urls(base_url, source_domain, soft_cap)
        write_json(map_cache_path, raw_urls)
    print(f"      {len(raw_urls)} URLs discovered.")

    # Step 2: filter (reuse FC logic)
    urls = filter_urls(raw_urls, source_domain, limit, include_sections)
    sections_info = f", sections={include_sections}" if include_sections else ""
    print(f"[2/3] {len(urls)} URLs after filtering (limit={limit}{sections_info}).")
    if not urls:
        sys.exit("No URLs to scrape after filtering. Check the domain or filters.")
    if map_only:
        for url in urls:
            print(url)
        print(f"Map-only mode. Saved map cache → {map_cache_path}")
        return

    # Step 3: batch scrape
    mode_str = "llm" if with_llm else ("recrawl" if recrawl else "base")
    print(f"[3/3] Scraping {len(urls)} pages (mode={mode_str}) …")
    results = await _scrape_batch(urls, with_llm, llm_model)
    print(f"      Received {len(results)} page results.")

    records_by_path: dict[str, dict[str, Any]] = {}
    for result in results:
        if not getattr(result, "success", False):
            print(f"  SKIP (failed): {getattr(result, 'url', '?')}", file=sys.stderr)
            continue
        try:
            fallback = getattr(result, "url", "") or base_url
            doc = _adapt_result(result, fallback)
            record = _build_record(doc, base_url, source_domain, recrawl)
            # FC backend stamps content_source='firecrawl' in _build_record;
            # rewrite for our backend so registry/audit can distinguish.
            record["fetch"]["content_source"] = "crawl4ai"
            records_by_path[record["seed"]["path"]] = record
        except Exception as exc:  # noqa: BLE001
            print(f"  SKIP (parse error): {exc}", file=sys.stderr)
    print(f"      Built {len(records_by_path)} records.")

    # Smart-actions: re-scrape thin pages with scroll+wait
    if smart_actions and records_by_path:
        thin_count = sum(
            1 for r in records_by_path.values()
            if r["quality"]["content_text_chars"] < _THIN_THRESHOLD
        )
        if thin_count:
            print(
                f"[3b/3] Smart-actions: retrying {thin_count} thin pages "
                f"(<{_THIN_THRESHOLD} chars) …"
            )
            improved, tried = await _retry_thin(
                records_by_path, source_domain, base_url, recrawl
            )
            print(f"       {improved}/{tried} pages improved.")
        else:
            print("[3b/3] Smart-actions: no thin pages found, skipping.")

    pages_dir.mkdir(parents=True, exist_ok=True)
    saved = 0
    for record in records_by_path.values():
        write_json(pages_dir / f"{record['id']}.json", record)
        saved += 1
    print(f"Done. Saved {saved} pages → {pages_dir}")

    # Registry: same shape as FC backend. credit_cost is a rough proxy
    # (page count for base, ×5 for LLM) so historical reports stay comparable.
    credit_cost = saved * (5 if with_llm else 1)
    try:
        run_id = insert_crawl_run(
            f"https://{source_domain}",
            page_count=saved,
            credit_cost=credit_cost,
            mode=f"c4ai_{mode_str}",
            output_dir=str(output_dir),
        )
        print(
            f"✓ Registry: crawl run {run_id} saved "
            f"(mode=c4ai_{mode_str}, pages={saved}, credits≈{credit_cost})"
        )
    except Exception as exc:  # noqa: BLE001
        print(f"  Registry write skipped: {exc}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crawl a donor site with Crawl4AI (Firecrawl drop-in)."
    )
    parser.add_argument(
        "--source-domain", required=True,
        help="Donor domain without scheme, e.g. donor.ru",
    )
    parser.add_argument(
        "--limit", type=int, default=300,
        help="Max pages to crawl (default 300).",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=DEFAULT_OUTPUT / "pages",
        help="Directory for page JSON files.",
    )
    parser.add_argument(
        "--recrawl", action="store_true",
        help="Re-crawl mode (Crawl4AI has no change-tracking; flag kept for CLI parity).",
    )
    parser.add_argument(
        "--map-only", action="store_true",
        help="Map and filter URLs, print them, then exit without scraping.",
    )
    parser.add_argument(
        "--with-llm", action="store_true",
        help="Add Anthropic LLM extraction (requires ANTHROPIC_API_KEY).",
    )
    parser.add_argument(
        "--smart-actions", action="store_true",
        help=(
            f"Re-scrape pages with thin content (<{_THIN_THRESHOLD} chars) using "
            "scroll+wait browser actions to trigger lazy-loaded JS content."
        ),
    )
    parser.add_argument(
        "--include-sections", type=str, default=None, metavar="SECTIONS",
        help=(
            "Comma-separated list of first-path-segment sections to keep, e.g. "
            "'blog,uslugi,qa'. Pages outside these sections are dropped after map."
        ),
    )
    parser.add_argument(
        "--llm-model", type=str, default=DEFAULT_LLM_MODEL,
        help=f"LiteLLM provider/model id (default: {DEFAULT_LLM_MODEL}).",
    )
    args = parser.parse_args()
    include_sections = (
        [s.strip() for s in args.include_sections.split(",") if s.strip()]
        if args.include_sections
        else None
    )
    asyncio.run(
        _crawl_async(
            source_domain=args.source_domain,
            limit=args.limit,
            output_dir=args.output_dir,
            recrawl=args.recrawl,
            map_only=args.map_only,
            with_llm=args.with_llm,
            smart_actions=args.smart_actions,
            include_sections=include_sections,
            llm_model=args.llm_model,
        )
    )


if __name__ == "__main__":
    main()
