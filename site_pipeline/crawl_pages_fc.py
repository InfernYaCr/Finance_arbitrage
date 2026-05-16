#!/usr/bin/env python3
"""
crawl_pages_fc.py — Firecrawl backend for donor site crawling.

Flow:
  1. map_url(base_url)          → discover all URLs (1 credit)
  2. filter_urls(urls)          → drop pagination, params, tags
  3. batch_scrape_urls(urls)    → markdown + html + links [+ json(LLM schema)]
  4. write JSON per page        → compatible with qa_pages.py and Astro build

New vs crawl_pages.py:
  - No Screaming Frog dependency
  - Optional LLM extraction: page_type, services, faq_pairs, pricing_tiers, key_points
  - Full OG/language metadata
  - changeTracking support for re-crawl mode (--recrawl)

Usage:
  python site_pipeline/crawl_pages_fc.py --source-domain donor.ru [--limit 300]
  python site_pipeline/crawl_pages_fc.py --source-domain donor.ru --map-only
  python site_pipeline/crawl_pages_fc.py --source-domain donor.ru --with-llm
  python site_pipeline/crawl_pages_fc.py --source-domain donor.ru --recrawl
  python site_pipeline/crawl_pages_fc.py --source-domain donor.ru --smart-actions
  python site_pipeline/crawl_pages_fc.py --source-domain donor.ru --include-sections blog,uslugi,qa
  python site_pipeline/crawl_pages_fc.py --source-domain donor.ru --use-crawler

Requires FIRECRAWL_API_KEY in environment or site/.env.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse

from bs4 import BeautifulSoup

# Load site/.env so FIRECRAWL_API_KEY is available when run from project root.
_SITE_ENV = Path(__file__).parent.parent / "site" / ".env"
if _SITE_ENV.exists():
    for _line in _SITE_ENV.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#"):
            continue
        _m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", _line)
        if _m:
            key, val = _m.group(1), _m.group(2).strip().strip("'\"")
            os.environ.setdefault(key, val)

from firecrawl.v1 import V1FirecrawlApp  # noqa: E402
from firecrawl.v1.client import (  # noqa: E402
    V1JsonConfig,
    V1LocationConfig,
    V1ScrollAction,
    V1ScrapeOptions,
    V1WaitAction,
)

from registry import insert_crawl_run  # noqa: E402

from common import (  # noqa: E402
    DEFAULT_OUTPUT,
    absolutize_url,
    clean_text,
    depth_from_path,
    safe_page_id,
    section_from_path,
    write_json,
)
from extraction_rules import enrich_extracted  # noqa: E402

# ---------------------------------------------------------------------------
# URL filtering
# ---------------------------------------------------------------------------

_SKIP_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".avif",
    ".pdf", ".zip", ".doc", ".docx", ".xls", ".xlsx",
    ".css", ".js", ".xml", ".json", ".ico",
}

_SKIP_PATTERNS = re.compile(
    r"(?:"
    r"/page/\d+"           # WordPress pagination
    r"|[?&](?:page|p|paged|offset|start)=\d+"  # query pagination
    r"|[?&].+=.+"          # any query params (filter, sort, utm, etc.)
    r"|/tag/|/tags/"       # tag archives
    r"|/category/|/cat/"   # category archives (if not main content)
    r"|/reviews?(?:/|$)|/about/experts?(?:/|$)|/news(?:/|$)"  # finance donor: UGC, author profiles, news
    r"|/login(?:/|$)"      # auth pages
    r"|/feed/"             # RSS feeds
    r"|/wp-|/admin"        # WordPress internals
    r"|/amp(?:/|$)|\.html/amp"  # AMP duplicates
    r")"
)

CONTENT_SELECTORS = [
    ".parent-section",
    ".section-quiz",
    ".section-case-page",
    ".section-portfolio",
    ".section-service",
    ".section-seowiki",
    ".section-blog",
    ".wiki-content.content",
    ".taxonomy-description.base-content.content",
    ".taxonomy-description",
    ".section-faqs",
    ".section-services",
    ".section-seowiki__children",
    ".content",
    "article",
    "main",
]

DROP_SELECTORS = [
    "script",
    "style",
    "noscript",
    "header",
    "footer",
    "nav",
    "form",
    ".htop",
    ".hleft",
    ".hleft-menu",
    ".menu__bottom",
    ".mobile-drop",
    ".mobile-drop-wrapper",
    ".mobile__menu",
    ".menu__hover",
    ".section-breadcrumbs",
    ".section-lead",
    ".popup",
    ".popup-inner",
    ".wpj-jtoc",
]


def filter_urls(
    urls: list[str],
    source_domain: str,
    limit: int,
    include_sections: list[str] | None = None,
) -> list[str]:
    """Keep only useful content URLs from this domain, deduplicated.

    If *include_sections* is given (e.g. ['blog', 'uslugi', 'qa']),
    only URLs whose first path segment matches one of those values are kept.
    The root URL '/' is always kept regardless of include_sections.
    """
    section_re = (
        re.compile(
            r"^/(?:" + "|".join(re.escape(s) for s in include_sections) + r")(?:/|$)"
        )
        if include_sections
        else None
    )
    seen: set[str] = set()
    result: list[str] = []
    for raw in urls:
        parsed = urlparse(raw)
        domain = parsed.netloc.lower().replace("www.", "")
        if domain != source_domain:
            continue
        ext = Path(parsed.path).suffix.lower()
        if ext in _SKIP_EXTENSIONS:
            continue
        if _SKIP_PATTERNS.search(raw):
            continue
        if section_re and parsed.path not in ("/", "") and not section_re.match(parsed.path):
            continue
        # Normalise: drop fragment, lowercase scheme+host
        clean = urlunparse((
            parsed.scheme, parsed.netloc.lower(),
            parsed.path, "", "", "",
        ))
        if clean not in seen:
            seen.add(clean)
            result.append(clean)
        if len(result) >= limit:
            break
    return result


# ---------------------------------------------------------------------------
# LLM extraction schema
# ---------------------------------------------------------------------------

PAGE_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "page_type": {
            "type": "string",
            "enum": ["home", "service", "article", "faq", "case", "pricing",
                     "archive", "contact", "dictionary", "mfo_card", "rating",
                     "calculator", "qa_article", "other"],
            "description": "Best-fit page type based on content",
        },
        "services": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Named services or products mentioned on the page",
        },
        "faq_pairs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "q": {"type": "string"},
                    "a": {"type": "string"},
                },
                "required": ["q", "a"],
            },
            "description": "Question-answer pairs if this is a FAQ page",
        },
        "pricing_tiers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "price": {"type": "string"},
                    "features": {"type": "array", "items": {"type": "string"}},
                },
            },
            "description": "Pricing plans or tariff tiers if present",
        },
        "case_results": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Measurable outcomes from a portfolio case (before/after, numbers)",
        },
        "key_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Up to 5 main selling points or takeaways",
        },
        "cta_text": {
            "type": "string",
            "description": "Primary call-to-action button or headline text",
        },
    },
    "required": ["page_type"],
}


# ---------------------------------------------------------------------------
# Page record builder
# ---------------------------------------------------------------------------

def _get(obj: Any, *keys: str, default: Any = None) -> Any:
    """Safe attr/key access for Pydantic models or dicts."""
    for key in keys:
        if obj is None:
            return default
        if hasattr(obj, key):
            obj = getattr(obj, key)
        elif isinstance(obj, dict):
            obj = obj.get(key)
        else:
            return default
    return obj if obj is not None else default


def _extract_h1(markdown: str) -> str:
    m = re.search(r"^#\s+(.+)$", markdown or "", re.MULTILINE)
    return m.group(1).strip() if m else ""


def _extract_html_h1(html: str) -> str:
    if not html.strip():
        return ""
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    return clean_text(h1.get_text(" ")) if h1 else ""


def _normalize_path(path: str) -> str:
    if not path:
        return "/"
    if path.endswith(".html"):
        path = path[:-5]
    if path != "/" and not path.endswith("/"):
        path += "/"
    return path


def _extract_main_content(html: str, base_url: str) -> dict[str, Any]:
    if not html.strip():
        return {
            "selector": "",
            "content_html": "",
            "content_text": "",
            "links": [],
            "images": [],
        }

    working = BeautifulSoup(html, "html.parser")
    for selector in DROP_SELECTORS:
        for node in working.select(selector):
            node.decompose()

    candidates = []
    for selector in CONTENT_SELECTORS:
        for node in working.select(selector):
            text = clean_text(node.get_text(" "))
            if text:
                candidates.append((selector, len(text), node))
    if not candidates and working.body:
        text = clean_text(working.body.get_text(" "))
        candidates.append(("body", len(text), working.body))
    if not candidates:
        text = clean_text(working.get_text(" "))
        return {
            "selector": "document",
            "content_html": str(working),
            "content_text": text,
            "links": [],
            "images": [],
        }

    selector, _, node = max(candidates, key=lambda item: item[1])
    links = sorted({
        absolutize_url(base_url, anchor.get("href"))
        for anchor in node.find_all("a")
        if anchor.get("href")
    })
    images = sorted({
        absolutize_url(base_url, image.get("src") or image.get("data-src"))
        for image in node.find_all("img")
        if image.get("src") or image.get("data-src")
    })
    return {
        "selector": selector,
        "content_html": str(node),
        "content_text": clean_text(node.get_text(" ")),
        "links": links,
        "images": images,
    }


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            result.append(item.strip())
        elif isinstance(item, dict):
            text = item.get("name") or item.get("title") or item.get("service") or item.get("product")
            if isinstance(text, str) and text.strip():
                result.append(text.strip())
    return result


def _normalize_page_type(value: Any) -> str:
    allowed = {
        "home", "service", "article", "faq", "case", "pricing", "archive",
        "contact", "dictionary", "mfo_card", "rating", "calculator",
        "qa_article", "other",
    }
    if not isinstance(value, str):
        return "other"
    normalized = value.strip().lower().replace(" ", "_")
    if normalized in allowed:
        return normalized
    if "rating" in normalized or "рейтинг" in normalized:
        return "rating"
    if "calculator" in normalized or "калькулятор" in normalized:
        return "calculator"
    if "faq" in normalized or normalized in {"qa", "q&a"}:
        return "faq"
    if "service" in normalized or "услуг" in normalized:
        return "service"
    if "case" in normalized or "portfolio" in normalized:
        return "case"
    if "pricing" in normalized or "price" in normalized or "тариф" in normalized:
        return "pricing"
    if "article" in normalized or "стат" in normalized:
        return "article"
    return "other"


def _normalize_faq_pairs(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    pairs: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        q = item.get("q") or item.get("question")
        a = item.get("a") or item.get("answer")
        if isinstance(q, str) and isinstance(a, str) and q.strip() and a.strip():
            pairs.append({"question": q.strip(), "answer": a.strip()})
    return pairs


def _normalize_pricing_tiers(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    tiers: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            tiers.append({"name": item.strip(), "price": "", "features": []})
        elif isinstance(item, dict):
            name = item.get("name") or item.get("tier_name") or item.get("title") or ""
            price = item.get("price") or item.get("tier_price") or ""
            features = item.get("features") if isinstance(item.get("features"), list) else []
            if isinstance(name, str) and name.strip():
                tiers.append({"name": name.strip(), "price": str(price), "features": _as_string_list(features)})
    return tiers


def _normalize_extracted(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {
        "page_type": _normalize_page_type(value.get("page_type")),
        "services": _as_string_list(
            value.get("services")
            or value.get("services_or_products")
            or value.get("services_products")
            or value.get("products")
        ),
        "faq_pairs": _normalize_faq_pairs(value.get("faq_pairs") or value.get("faq")),
        "pricing_tiers": _normalize_pricing_tiers(value.get("pricing_tiers")),
        "case_results": _as_string_list(
            value.get("case_results")
            or value.get("portfolio_or_case_results")
            or value.get("portfolio_case_results")
        ),
        "key_points": _as_string_list(value.get("key_points") or value.get("key_selling_points")),
        "cta_text": (
            value.get("cta_text")
            or value.get("primary_cta_text")
            or ""
        ),
    }


def _build_record(
    doc: Any,
    base_url: str,
    source_domain: str,
    recrawl: bool = False,
) -> dict[str, Any]:
    meta = _get(doc, "metadata") or {}

    source_url: str = (
        _get(meta, "sourceURL")
        or _get(doc, "url")
        or base_url
    )
    parsed = urlparse(source_url)
    path = _normalize_path(parsed.path or "/")

    title: str = _get(meta, "title") or ""
    description: str = _get(meta, "description") or ""
    language: str = _get(meta, "language") or ""
    robots: str = _get(meta, "robots") or ""
    og_image: str = _get(meta, "ogImage") or ""
    og_title: str = _get(meta, "ogTitle") or title
    og_description: str = _get(meta, "ogDescription") or description
    canonical: str = _get(meta, "ogUrl") or source_url
    status_code: int = int(_get(meta, "statusCode") or 200)
    published_time: str = _get(meta, "publishedTime") or _get(meta, "article:published_time") or ""
    modified_time: str = _get(meta, "modifiedTime") or _get(meta, "article:modified_time") or ""

    md: str = _get(doc, "markdown") or ""
    html: str = _get(doc, "html") or ""
    raw_links: list[str] = _get(doc, "links") or []

    h1 = _extract_h1(md) or _extract_html_h1(html)
    extracted_content = _extract_main_content(html, source_url)
    content_html = extracted_content["content_html"] or html
    content_text = extracted_content["content_text"] or clean_text(md)

    internal_links = sorted({
        lnk for lnk in raw_links
        if isinstance(lnk, str) and source_domain in lnk
    })
    for lnk in extracted_content["links"]:
        if isinstance(lnk, str) and source_domain in lnk:
            internal_links.append(lnk)
    internal_links = sorted(set(internal_links))

    images: list[str] = list(extracted_content["images"])
    if og_image:
        images.append(og_image)
    images = sorted(set(images))

    # LLM extraction result (json format)
    extracted: dict[str, Any] = {}
    json_val = _get(doc, "json_field") or _get(doc, "extract")
    if isinstance(json_val, dict):
        extracted = _normalize_extracted(json_val)

    # changeTracking for re-crawl mode
    change_info: dict[str, Any] | None = None
    if recrawl:
        ct = _get(doc, "changeTracking")
        if ct is not None:
            change_info = {
                "change_status": _get(ct, "changeStatus") or "new",
                "visibility": _get(ct, "visibility") or "visible",
                "previous_scrape_at": _get(ct, "previousScrapeAt"),
            }

    record: dict[str, Any] = {
        "id": safe_page_id(source_url),
        "seed": {
            "source_url": source_url,
            "url": source_url,
            "path": path,
            "section": section_from_path(path),
            "depth": depth_from_path(path),
            "title": title,
            "meta_description": description,
            "h1": h1,
            "h2": [],
            "csv_line": 0,
        },
        "fetch": {
            "status_code": status_code,
            "final_url": source_url,
            "wp_json_endpoint": "",
            "content_source": "firecrawl",
            "fallback_selector": extracted_content["selector"],
        },
        "meta": {
            "html_title": og_title,
            "html_meta_description": og_description,
            "canonical": canonical,
            "body_class": [],
            "language": language,
            "robots": robots,
            "og_image": og_image,
        },
        "wp": {
            "id": 0, "type": "page", "slug": path.strip("/").replace("/", "-"),
            "date": published_time, "modified": modified_time or published_time,
            "link": source_url, "featured_media": 0, "categories": [], "tags": [],
        } if published_time else None,
        "wp_title": "",
        "excerpt_html": "",
        "excerpt_text": "",
        "content_html": content_html,
        "content_text": content_text,
        "links": internal_links,
        "images": images,
        "quality": {
            "content_text_chars": len(content_text),
            "links_count": len(internal_links),
            "images_count": len(images),
            "has_csv_title": bool(title),
            "has_csv_h1": bool(h1),
        },
        "extracted": extracted,
    }

    if change_info is not None:
        record["change_tracking"] = change_info

    return enrich_extracted(record)


# ---------------------------------------------------------------------------
# Smart-actions: retry thin pages
# ---------------------------------------------------------------------------

_THIN_THRESHOLD = 300  # chars; pages below this get a scroll/wait re-scrape


def _retry_thin_pages(
    app: V1FirecrawlApp,
    records: dict[str, dict[str, Any]],  # path → record, mutated in-place
    source_domain: str,
    base_url: str,
    recrawl: bool,
) -> tuple[int, int]:
    """Re-scrape pages with thin content using scroll+wait browser actions.

    Mutates *records* in-place for any page that improves.
    Returns (improved_count, tried_count).
    """
    thin_paths = [
        path for path, rec in records.items()
        if rec["quality"]["content_text_chars"] < _THIN_THRESHOLD
    ]
    if not thin_paths:
        return 0, 0

    improved = 0
    for path in thin_paths:
        old_rec = records[path]
        old_chars = old_rec["quality"]["content_text_chars"]
        url = old_rec["seed"]["source_url"]
        try:
            resp = app.scrape_url(
                url,
                formats=["markdown", "html", "links"],
                only_main_content=True,
                location=V1LocationConfig(country="RU", languages=["ru-RU"]),
                actions=[
                    V1WaitAction(type="wait", milliseconds=1500),
                    V1ScrollAction(type="scroll", direction="down"),
                    V1WaitAction(type="wait", milliseconds=800),
                ],
                timeout=45000,
            )
            new_rec = _build_record(resp, base_url, source_domain, recrawl)
            new_chars = new_rec["quality"]["content_text_chars"]
            if new_chars > old_chars:
                records[path] = new_rec
                improved += 1
                print(f"  ✓ thin→rich {url} ({old_chars}→{new_chars} chars)")
            else:
                print(f"  ~ no gain   {url} ({old_chars}→{new_chars} chars)")
        except Exception as exc:
            print(f"  ! retry failed {url}: {exc}", file=sys.stderr)

    return improved, len(thin_paths)


# ---------------------------------------------------------------------------
# Main crawl logic
# ---------------------------------------------------------------------------

def _crawl_via_crawler(
    app: V1FirecrawlApp,
    base_url: str,
    source_domain: str,
    limit: int,
    formats: list[str],
    json_opts: V1JsonConfig | None,
    include_sections: list[str] | None,
) -> list[dict[str, Any]]:
    """Use Firecrawl crawl_url() instead of map+batch_scrape.

    Better for sites where map misses URLs; Firecrawl follows links recursively.
    Returns list of raw record dicts (same shape as batch_scrape results).
    """
    include_paths: list[str] | None = None
    if include_sections:
        include_paths = [f"/{s}/*" for s in include_sections]

    scrape_opts = V1ScrapeOptions(
        formats=formats,  # type: ignore[arg-type]
        onlyMainContent=True,
        location=V1LocationConfig(country="RU", languages=["ru-RU"]),
        **({"jsonOptions": json_opts} if json_opts else {}),
    )

    print(f"  Using crawl_url() (limit={limit}, include_paths={include_paths}) …")
    resp = app.crawl_url(
        base_url,
        limit=limit,
        include_paths=include_paths,
        ignore_sitemap=False,
        scrape_options=scrape_opts,
        poll_interval=5,
    )
    return resp.data or []


def crawl(
    source_domain: str,
    limit: int,
    output_dir: Path,
    recrawl: bool = False,
    map_only: bool = False,
    with_llm: bool = False,
    smart_actions: bool = False,
    include_sections: list[str] | None = None,
    use_crawler: bool = False,
) -> None:
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        sys.exit("FIRECRAWL_API_KEY not set. Add it to site/.env or the environment.")

    base_url = f"https://{source_domain}"
    app = V1FirecrawlApp(api_key=api_key)
    output_root = output_dir.parent if output_dir.name == "pages" else output_dir
    pages_dir = output_dir if output_dir.name == "pages" else output_dir / "pages"
    map_cache_path = output_root / "map_urls.json"

    # Step 1: discover URLs
    if map_cache_path.exists():
        print(f"[1/3] Loading cached map {map_cache_path} …")
        raw_urls = [
            item for item in json.loads(map_cache_path.read_text(encoding="utf-8"))
            if isinstance(item, str)
        ]
    else:
        print(f"[1/3] Mapping {base_url} …")
        map_result = app.map_url(base_url, limit=min(limit * 3, 5000))
        raw_urls = _get(map_result, "links", default=[]) or []
        output_dir.mkdir(parents=True, exist_ok=True)
        write_json(map_cache_path, raw_urls)
    print(f"      {len(raw_urls)} URLs discovered.")

    # Step 2: filter
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
    formats: list[str] = ["markdown", "html", "links"]
    json_opts: V1JsonConfig | None = None
    if with_llm:
        formats.append("json")
        json_opts = V1JsonConfig(
            prompt=(
                "Analyse this web page and extract structured metadata. "
                "Identify the page_type, list services or products, FAQ Q&A pairs, "
                "pricing tiers, portfolio or case results, key selling points, "
                "and the primary CTA text. Return only what is clearly present."
            ),
            schema_field=PAGE_EXTRACTION_SCHEMA,
        )
    if recrawl:
        formats.append("changeTracking")

    if use_crawler:
        # Skip map+filter — use Firecrawl's recursive crawler directly.
        print(f"[3/3] Crawling via crawl_url() (formats={formats}, recrawl={recrawl}) …")
        docs: list[Any] = _crawl_via_crawler(
            app, base_url, source_domain, limit, formats, json_opts, include_sections
        )
    else:
        print(f"[3/3] Scraping {len(urls)} pages (formats={formats}, recrawl={recrawl}) …")
        batch_resp = app.batch_scrape_urls(
            urls,
            formats=formats,  # type: ignore[arg-type]
            only_main_content=True,
            json_options=json_opts,
            location=V1LocationConfig(country="RU", languages=["ru-RU"]),
            poll_interval=5,
        )
        docs: list[Any] = batch_resp.data or []
    print(f"      Received {len(docs)} page results.")

    # Build all records into a path-keyed dict before writing.
    records_by_path: dict[str, dict[str, Any]] = {}
    for doc in docs:
        try:
            record = _build_record(doc, base_url, source_domain, recrawl)
            records_by_path[record["seed"]["path"]] = record
        except Exception as exc:
            print(f"  SKIP (parse error): {exc}", file=sys.stderr)
    print(f"      Built {len(records_by_path)} records.")

    # Smart-actions: re-scrape pages with thin content.
    if smart_actions and records_by_path:
        thin_count = sum(
            1 for r in records_by_path.values()
            if r["quality"]["content_text_chars"] < _THIN_THRESHOLD
        )
        if thin_count:
            print(f"[3b/3] Smart-actions: retrying {thin_count} thin pages (<{_THIN_THRESHOLD} chars) …")
            improved, tried = _retry_thin_pages(
                app, records_by_path, source_domain, base_url, recrawl
            )
            print(f"       {improved}/{tried} pages improved.")
        else:
            print(f"[3b/3] Smart-actions: no thin pages found, skipping.")

    pages_dir.mkdir(parents=True, exist_ok=True)
    saved = 0
    for record in records_by_path.values():
        write_json(pages_dir / f"{record['id']}.json", record)
        saved += 1

    print(f"Done. Saved {saved} pages → {pages_dir}")

    # Record crawl run in registry
    mode = "llm" if with_llm else ("recrawl" if recrawl else "base")
    credit_cost = saved * (5 if with_llm else 1)
    try:
        run_id = insert_crawl_run(
            f"https://{source_domain}",
            page_count=saved,
            credit_cost=credit_cost,
            mode=mode,
            output_dir=str(output_dir),
        )
        print(f"✓ Registry: crawl run {run_id} saved (mode={mode}, pages={saved}, credits≈{credit_cost})")
    except Exception as exc:
        print(f"  Registry write skipped: {exc}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl a donor site with Firecrawl.")
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
        help="Re-crawl mode: add changeTracking to detect updated pages.",
    )
    parser.add_argument(
        "--map-only", action="store_true",
        help="Map and filter URLs, print them, then exit without scraping.",
    )
    parser.add_argument(
        "--with-llm", action="store_true",
        help="Add Firecrawl json LLM extraction to formats (costs extra credits).",
    )
    parser.add_argument(
        "--smart-actions", action="store_true",
        help=(
            f"Re-scrape pages with thin content (<{_THIN_THRESHOLD} chars) using "
            "scroll+wait browser actions to trigger lazy-loaded JS content."
        ),
    )
    parser.add_argument(
        "--include-sections", type=str, default=None,
        metavar="SECTIONS",
        help=(
            "Comma-separated list of first-path-segment sections to keep, e.g. "
            "'blog,uslugi,qa'. Pages outside these sections are dropped after map."
        ),
    )
    parser.add_argument(
        "--use-crawler", action="store_true",
        help=(
            "Use Firecrawl crawl_url() (recursive link-following) instead of "
            "map+batch_scrape. Better for sites where map misses URLs."
        ),
    )
    args = parser.parse_args()
    include_sections = (
        [s.strip() for s in args.include_sections.split(",") if s.strip()]
        if args.include_sections
        else None
    )
    crawl(
        source_domain=args.source_domain,
        limit=args.limit,
        output_dir=args.output_dir,
        recrawl=args.recrawl,
        map_only=args.map_only,
        with_llm=args.with_llm,
        smart_actions=args.smart_actions,
        include_sections=include_sections,
        use_crawler=args.use_crawler,
    )


if __name__ == "__main__":
    main()
