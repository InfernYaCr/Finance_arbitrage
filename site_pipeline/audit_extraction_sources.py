from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

from common import DEFAULT_CSV, DEFAULT_OUTPUT, read_seeds, write_json
from crawl_pages import (
    extract_from_wp_json,
    extract_html_fallback,
    fetch_text,
    fetch_wp_json,
    find_wp_endpoint,
    session,
    should_prefer_html_fallback,
)


def audit_seed(sess, seed, timeout: int, retries: int, backoff: float) -> dict[str, Any]:
    status_code, final_url, html_text = fetch_text(sess, seed.url, timeout, retries, backoff)
    soup = BeautifulSoup(html_text, "html.parser")
    endpoint = find_wp_endpoint(soup)
    fallback = extract_html_fallback(soup, final_url)
    wp_extract = extract_from_wp_json(fetch_wp_json(sess, endpoint, timeout, retries, backoff))
    wp_chars = len(wp_extract.get("content_text") or "")
    html_chars = len(fallback.get("content_text") or "")
    diff_chars = html_chars - wp_chars
    ratio = round(html_chars / max(wp_chars, 1), 2)
    prefer_html = should_prefer_html_fallback(wp_extract, fallback)
    return {
        "url": seed.url,
        "path": seed.path,
        "section": seed.section,
        "status_code": status_code,
        "final_url": final_url,
        "wp_json_endpoint": endpoint,
        "wp_chars": wp_chars,
        "html_chars": html_chars,
        "diff_chars": diff_chars,
        "ratio": ratio,
        "fallback_selector": fallback.get("selector") or "",
        "recommended_source": "html_fallback" if prefer_html else wp_extract.get("source", "html_fallback"),
        "prefer_html": prefer_html,
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "prefer_html",
        "ratio",
        "diff_chars",
        "wp_chars",
        "html_chars",
        "fallback_selector",
        "recommended_source",
        "section",
        "path",
        "url",
        "status_code",
        "wp_json_endpoint",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare WP REST content against HTML fallback before bulk recrawls.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--section", default=None)
    parser.add_argument("--url", action="append", default=None)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--output-prefix", default="extraction_audit")
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument("--timeout", type=int, default=25)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--backoff", type=float, default=0.5)
    parser.add_argument("--proxy", default=None)
    args = parser.parse_args()

    seeds = read_seeds(args.csv)
    if args.url:
        wanted = set(args.url)
        seeds = [seed for seed in seeds if seed.url in wanted]
    if args.section:
        seeds = [seed for seed in seeds if seed.section == args.section]
    if args.offset:
        seeds = seeds[args.offset :]
    if args.limit:
        seeds = seeds[: args.limit]

    sess = session(args.proxy)
    rows = []
    failures = []
    started_at = time.time()
    for index, seed in enumerate(seeds, start=1):
        print(f"[{index}/{len(seeds)}] {seed.url}", flush=True)
        try:
            rows.append(audit_seed(sess, seed, args.timeout, args.retries, args.backoff))
        except Exception as exc:
            failures.append({"url": seed.url, "error": repr(exc)})
        time.sleep(args.delay)

    rows.sort(key=lambda row: (not row["prefer_html"], -row["diff_chars"], row["path"]))
    summary = {
        "checked": len(seeds),
        "rows": len(rows),
        "failures": failures,
        "prefer_html_count": sum(1 for row in rows if row["prefer_html"]),
        "elapsed_seconds": round(time.time() - started_at, 2),
        "top_prefer_html": [row for row in rows if row["prefer_html"]][:50],
    }
    write_json(args.out / f"{args.output_prefix}.json", {"summary": summary, "rows": rows})
    write_csv(args.out / f"{args.output_prefix}.csv", rows)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
