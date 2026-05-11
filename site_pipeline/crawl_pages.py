from __future__ import annotations

import argparse
import json
import re
import time
import urllib.robotparser
from collections import Counter
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

from common import (
    DEFAULT_CSV,
    DEFAULT_OUTPUT,
    USER_AGENT,
    absolutize_url,
    clean_text,
    read_seeds,
    safe_page_id,
    write_json,
)
from urllib.parse import urlparse


CONTENT_SELECTORS = [
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


RETRY_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}


def session(proxy: str | None = None) -> requests.Session:
    sess = requests.Session()
    sess.headers.update({"User-Agent": USER_AGENT})
    if proxy:
        sess.proxies.update({"http": proxy, "https": proxy})
    return sess


def request_with_retries(
    sess: requests.Session,
    url: str,
    timeout: int,
    retries: int,
    backoff: float,
) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = sess.get(url, timeout=timeout)
            if response.status_code not in RETRY_STATUS_CODES:
                return response
            last_error = requests.HTTPError(f"Retryable status {response.status_code} for {url}")
        except requests.RequestException as exc:
            last_error = exc
        if attempt < retries:
            time.sleep(backoff * (2**attempt))
    if last_error:
        raise last_error
    raise RuntimeError(f"Failed to fetch {url}")


def robots_parser(base_url: str, user_agent: str, timeout: int, proxy: str | None = None) -> urllib.robotparser.RobotFileParser:
    parsed = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(robots_url)
    sess = session(proxy)
    try:
        response = sess.get(robots_url, timeout=timeout)
        if response.status_code == 200:
            parser.parse(response.text.splitlines())
        else:
            parser.parse([])
    except requests.RequestException:
        parser.parse([])
    return parser


def fetch_text(
    sess: requests.Session,
    url: str,
    timeout: int = 25,
    retries: int = 2,
    backoff: float = 1.0,
) -> tuple[int, str, str]:
    response = request_with_retries(sess, url, timeout, retries, backoff)
    response.encoding = response.apparent_encoding or response.encoding
    return response.status_code, response.url, response.text


def find_wp_endpoint(soup: BeautifulSoup) -> str:
    for link in soup.find_all("link"):
        rel = " ".join(link.get("rel", [])) if isinstance(link.get("rel"), list) else str(link.get("rel", ""))
        href = link.get("href") or ""
        link_type = link.get("type") or ""
        if "alternate" in rel and "application/json" in link_type and "/wp-json/wp/v2/" in href:
            return href
    match = re.search(r"https://mosseo\.ru/wp-json/wp/v2/[^\"'<\s]+", str(soup))
    return match.group(0) if match else ""


def fetch_wp_json(
    sess: requests.Session,
    endpoint: str,
    timeout: int = 25,
    retries: int = 2,
    backoff: float = 1.0,
) -> dict[str, Any] | None:
    if not endpoint:
        return None
    response = request_with_retries(sess, endpoint, timeout, retries, backoff)
    if response.status_code != 200:
        return None
    try:
        return response.json()
    except json.JSONDecodeError:
        return None


def extract_meta(soup: BeautifulSoup, base_url: str) -> dict[str, Any]:
    title = clean_text(soup.title.string if soup.title else "")
    description = ""
    meta = soup.find("meta", attrs={"name": "description"})
    if meta:
        description = clean_text(meta.get("content"))
    canonical = ""
    canonical_link = soup.find("link", attrs={"rel": "canonical"})
    if canonical_link:
        canonical = absolutize_url(base_url, canonical_link.get("href"))
    body = soup.find("body")
    return {
        "html_title": title,
        "html_meta_description": description,
        "canonical": canonical,
        "body_class": body.get("class", []) if body else [],
    }


def extract_html_fallback(soup: BeautifulSoup, base_url: str) -> dict[str, Any]:
    working = BeautifulSoup(str(soup), "html.parser")
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
        return {"selector": "", "content_html": "", "content_text": "", "links": [], "images": []}

    selector, _, node = max(candidates, key=lambda item: item[1])
    links = sorted(
        {
            absolutize_url(base_url, anchor.get("href"))
            for anchor in node.find_all("a")
            if anchor.get("href")
        }
    )
    images = sorted(
        {
            absolutize_url(base_url, image.get("src") or image.get("data-src"))
            for image in node.find_all("img")
            if image.get("src") or image.get("data-src")
        }
    )
    return {
        "selector": selector,
        "content_html": str(node),
        "content_text": clean_text(node.get_text(" ")),
        "links": links,
        "images": images,
    }


def extract_from_wp_json(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        return {"source": "html_fallback", "wp": None, "content_html": "", "content_text": ""}
    wp_type = payload.get("type") or ("category" if "taxonomy" in payload else "")
    if wp_type in {"post", "page"}:
        content_html = payload.get("content", {}).get("rendered", "")
        excerpt_html = payload.get("excerpt", {}).get("rendered", "")
        return {
            "source": "wp_json",
            "wp": {
                "id": payload.get("id"),
                "type": wp_type,
                "slug": payload.get("slug"),
                "date": payload.get("date"),
                "modified": payload.get("modified"),
                "link": payload.get("link"),
                "featured_media": payload.get("featured_media"),
                "categories": payload.get("categories", []),
                "tags": payload.get("tags", []),
            },
            "wp_title": clean_text(payload.get("title", {}).get("rendered", "")),
            "excerpt_html": excerpt_html,
            "excerpt_text": clean_text(excerpt_html),
            "content_html": content_html,
            "content_text": clean_text(content_html),
        }
    if "taxonomy" in payload:
        description = payload.get("description", "")
        return {
            "source": "wp_json",
            "wp": {
                "id": payload.get("id"),
                "type": "category",
                "slug": payload.get("slug"),
                "taxonomy": payload.get("taxonomy"),
                "count": payload.get("count"),
                "link": payload.get("link"),
            },
            "wp_title": clean_text(payload.get("name", "")),
            "content_html": description,
            "content_text": clean_text(description),
        }
    return {"source": "html_fallback", "wp": None, "content_html": "", "content_text": ""}


def enrich_page(
    sess: requests.Session,
    seed,
    timeout: int = 25,
    retries: int = 2,
    backoff: float = 1.0,
) -> dict[str, Any]:
    status_code, final_url, html_text = fetch_text(sess, seed.url, timeout, retries, backoff)
    final_domain = urlparse(final_url).netloc.lower().replace("www.", "")
    if final_domain != "mosseo.ru":
        return {
            "id": safe_page_id(seed.url),
            "seed": seed.__dict__,
            "fetch": {
                "status_code": status_code,
                "final_url": final_url,
                "wp_json_endpoint": "",
                "content_source": "external_redirect",
                "fallback_selector": "",
            },
            "meta": {
                "html_title": "",
                "html_meta_description": "",
                "canonical": "",
                "body_class": [],
            },
            "wp": None,
            "wp_title": "",
            "excerpt_html": "",
            "excerpt_text": "",
            "content_html": "",
            "content_text": "",
            "links": [],
            "images": [],
            "quality": {
                "content_text_chars": 0,
                "links_count": 0,
                "images_count": 0,
                "has_csv_title": bool(seed.title),
                "has_csv_h1": bool(seed.h1),
                "issue": "redirected_outside_source_domain",
            },
        }
    soup = BeautifulSoup(html_text, "html.parser")
    endpoint = find_wp_endpoint(soup)
    wp_payload = fetch_wp_json(sess, endpoint, timeout, retries, backoff)
    wp_extract = extract_from_wp_json(wp_payload)
    fallback = extract_html_fallback(soup, final_url)

    content_html = wp_extract.get("content_html") or fallback["content_html"]
    content_text = wp_extract.get("content_text") or fallback["content_text"]
    content_source = wp_extract["source"] if wp_extract.get("content_html") else "html_fallback"

    content_soup = BeautifulSoup(content_html or "", "html.parser")
    links = sorted(
        {
            absolutize_url(final_url, anchor.get("href"))
            for anchor in content_soup.find_all("a")
            if anchor.get("href")
        }
        or set(fallback["links"])
    )
    images = sorted(
        {
            absolutize_url(final_url, image.get("src") or image.get("data-src"))
            for image in content_soup.find_all("img")
            if image.get("src") or image.get("data-src")
        }
        or set(fallback["images"])
    )

    return {
        "id": safe_page_id(seed.url),
        "seed": seed.__dict__,
        "fetch": {
            "status_code": status_code,
            "final_url": final_url,
            "wp_json_endpoint": endpoint,
            "content_source": content_source,
            "fallback_selector": fallback["selector"],
        },
        "meta": extract_meta(soup, final_url),
        "wp": wp_extract.get("wp"),
        "wp_title": wp_extract.get("wp_title", ""),
        "excerpt_html": wp_extract.get("excerpt_html", ""),
        "excerpt_text": wp_extract.get("excerpt_text", ""),
        "content_html": content_html,
        "content_text": content_text,
        "links": links,
        "images": images,
        "quality": {
            "content_text_chars": len(content_text),
            "links_count": len(links),
            "images_count": len(images),
            "has_csv_title": bool(seed.title),
            "has_csv_h1": bool(seed.h1),
        },
    }


def select_seeds(
    seeds,
    limit: int | None,
    sample_per_section: int | None,
    section: str | None = None,
    urls: list[str] | None = None,
):
    if urls:
        wanted = set(urls)
        seeds = [seed for seed in seeds if seed.url in wanted]
    if section:
        seeds = [seed for seed in seeds if seed.section == section]
    if sample_per_section:
        counts = Counter()
        selected = []
        for seed in seeds:
            if counts[seed.section] < sample_per_section:
                selected.append(seed)
                counts[seed.section] += 1
        return selected[:limit] if limit else selected
    return seeds[:limit] if limit else seeds


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl page seeds and export clean content JSON.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--sample-per-section", type=int, default=None)
    parser.add_argument("--section", default=None, help="Only crawl one normalized section, for example portfolio.")
    parser.add_argument("--url", action="append", default=None, help="Only crawl this normalized URL. Can be passed more than once.")
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument("--timeout", type=int, default=25)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--backoff", type=float, default=1.0)
    parser.add_argument("--proxy", default=None, help="Optional HTTP(S) proxy URL, for example http://user:pass@host:port")
    parser.add_argument("--resume", action="store_true", help="Skip pages that already have JSON files in the output folder.")
    parser.add_argument("--respect-robots", action="store_true", help="Skip URLs disallowed by robots.txt for this crawler user-agent.")
    parser.add_argument("--force-html", action="store_true", help="Skip WP REST API and use HTML fallback for all crawled pages.")
    args = parser.parse_args()

    seeds = select_seeds(read_seeds(args.csv), args.limit, args.sample_per_section, args.section, args.url)
    sess = session(args.proxy)
    robots = robots_parser(seeds[0].url, USER_AGENT, args.timeout, args.proxy) if args.respect_robots and seeds else None
    pages_dir = args.out / "pages"
    manifest = []
    failures = []
    skipped_robots = []
    skipped_existing = 0
    started_at = time.time()

    for index, seed in enumerate(seeds, start=1):
        print(f"[{index}/{len(seeds)}] {seed.url}")
        if robots and not robots.can_fetch(USER_AGENT, seed.url):
            skipped_robots.append({"url": seed.url, "reason": "robots_txt_disallow"})
            print("  skipped by robots.txt")
            continue
        page_path = pages_dir / f"{safe_page_id(seed.url)}.json"
        if args.resume and page_path.exists():
            try:
                page = json.loads(page_path.read_text(encoding="utf-8"))
                manifest.append(
                    {
                        "id": page["id"],
                        "url": seed.url,
                        "path": seed.path,
                        "section": seed.section,
                        "status_code": page["fetch"]["status_code"],
                        "content_source": page["fetch"]["content_source"],
                        "text_chars": page["quality"]["content_text_chars"],
                        "wp_json_endpoint": page["fetch"]["wp_json_endpoint"],
                    }
                )
                print("  skipped existing")
                skipped_existing += 1
                continue
            except (OSError, json.JSONDecodeError, KeyError):
                pass
        try:
            page = enrich_page(sess, seed, args.timeout, args.retries, args.backoff)
            write_json(page_path, page)
            manifest.append(
                {
                    "id": page["id"],
                    "url": seed.url,
                    "path": seed.path,
                    "section": seed.section,
                    "status_code": page["fetch"]["status_code"],
                    "content_source": page["fetch"]["content_source"],
                    "text_chars": page["quality"]["content_text_chars"],
                    "wp_json_endpoint": page["fetch"]["wp_json_endpoint"],
                }
            )
        except Exception as exc:
            failures.append({"url": seed.url, "error": repr(exc)})
        time.sleep(args.delay)

    summary = {
        "pages_requested": len(seeds),
        "pages_saved": len(manifest),
        "skipped_existing": skipped_existing,
        "skipped_robots": skipped_robots,
        "failures": failures,
        "content_sources": dict(Counter(item["content_source"] for item in manifest)),
        "status_codes": dict(Counter(item["status_code"] for item in manifest)),
        "low_content_pages": [item for item in manifest if item["text_chars"] < 200],
        "run": {
            "delay": args.delay,
            "timeout": args.timeout,
            "retries": args.retries,
            "backoff": args.backoff,
            "resume": args.resume,
            "respect_robots": args.respect_robots,
            "proxy_enabled": bool(args.proxy),
            "elapsed_seconds": round(time.time() - started_at, 2),
        },
    }
    write_json(args.out / "manifest.json", manifest)
    write_json(args.out / "crawl_report.json", summary)
    print(f"Saved {len(manifest)} page files to {pages_dir}")
    print(f"Failures: {len(failures)}")
    print(f"Content sources: {summary['content_sources']}")


if __name__ == "__main__":
    main()
