from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from common import DEFAULT_OUTPUT, write_json


MENU_CONTAMINATION_PHRASES = [
    "Главная О компании Наши работы Отзывы в письмах Услуги Как мы работаем",
    "Перезвоните мне",
    "mobile-drop",
]

LOW_CONTENT_CHARS = 300
VERY_LOW_CONTENT_CHARS = 80
HIGH_LINK_DENSITY_MIN_LINKS = 30
HIGH_LINK_DENSITY_CHARS_PER_LINK = 120


def load_page(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalized_domain(url: str) -> str:
    return urlparse(url).netloc.lower().replace("www.", "")


def add_issue(issues: list[dict[str, str]], code: str, severity: str, message: str) -> None:
    issues.append({"code": code, "severity": severity, "message": message})


def assess_page(page: dict[str, Any], source_domain: str) -> dict[str, Any]:
    seed = page.get("seed", {})
    fetch = page.get("fetch", {})
    meta = page.get("meta", {})
    quality = page.get("quality", {})
    content_text = page.get("content_text") or ""
    content_html = page.get("content_html") or ""
    links = page.get("links") or []
    issues: list[dict[str, str]] = []

    status_code = int(fetch.get("status_code") or 0)
    final_url = fetch.get("final_url") or ""
    content_source = fetch.get("content_source") or ""
    fallback_selector = fetch.get("fallback_selector") or ""
    text_chars = int(quality.get("content_text_chars") or len(content_text))
    links_count = int(quality.get("links_count") or len(links))

    if status_code < 200 or status_code >= 400:
        add_issue(issues, "bad_status", "error", f"HTTP status is {status_code}.")

    if final_url and normalized_domain(final_url) != source_domain:
        add_issue(issues, "external_redirect", "error", f"Redirected outside {source_domain}: {final_url}")

    if not content_html.strip():
        add_issue(issues, "empty_content_html", "error", "content_html is empty.")

    if text_chars < VERY_LOW_CONTENT_CHARS:
        add_issue(issues, "very_low_content", "warning", f"Only {text_chars} text characters.")
    elif text_chars < LOW_CONTENT_CHARS:
        add_issue(issues, "low_content", "warning", f"Only {text_chars} text characters.")

    if content_source == "html_fallback":
        add_issue(issues, "html_fallback", "info", "Content was extracted from rendered HTML fallback.")

    if content_source == "html_fallback" and fallback_selector == "body":
        add_issue(issues, "body_fallback", "error", "Fallback selector is body; likely includes template chrome.")

    if not seed.get("title") and not meta.get("html_title"):
        add_issue(issues, "missing_title", "warning", "No CSV title or HTML title.")

    if not seed.get("meta_description") and not meta.get("html_meta_description"):
        add_issue(issues, "missing_description", "warning", "No CSV or HTML meta description.")

    if not seed.get("h1"):
        add_issue(issues, "missing_csv_h1", "warning", "CSV did not contain H1.")

    canonical = meta.get("canonical") or ""
    source_url = seed.get("url") or ""
    if canonical and source_url and canonical.rstrip("/") != source_url.rstrip("/"):
        add_issue(issues, "canonical_mismatch", "warning", f"Canonical differs from seed URL: {canonical}")

    for phrase in MENU_CONTAMINATION_PHRASES:
        if phrase in content_text or phrase in content_html:
            add_issue(issues, "template_contamination", "error", f"Found template phrase: {phrase}")
            break

    if links_count >= HIGH_LINK_DENSITY_MIN_LINKS and text_chars / max(links_count, 1) < HIGH_LINK_DENSITY_CHARS_PER_LINK:
        add_issue(
            issues,
            "high_link_density",
            "warning",
            f"{links_count} links for {text_chars} text characters; may be archive/navigation content.",
        )

    severity_rank = {"error": 3, "warning": 2, "info": 1}
    max_severity = "ok"
    if issues:
        max_severity = max(issues, key=lambda issue: severity_rank[issue["severity"]])["severity"]

    return {
        "id": page.get("id"),
        "url": source_url,
        "section": seed.get("section"),
        "status_code": status_code,
        "content_source": content_source,
        "fallback_selector": fallback_selector,
        "text_chars": text_chars,
        "links_count": links_count,
        "images_count": int(quality.get("images_count") or len(page.get("images") or [])),
        "max_severity": max_severity,
        "issue_codes": [issue["code"] for issue in issues],
        "issues": issues,
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "max_severity",
        "issue_codes",
        "url",
        "section",
        "status_code",
        "content_source",
        "fallback_selector",
        "text_chars",
        "links_count",
        "images_count",
        "id",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    key: ",".join(row[key]) if key == "issue_codes" else row.get(key, "")
                    for key in fieldnames
                }
            )


def write_section_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "section",
        "total",
        "ok",
        "info",
        "warning",
        "error",
        "wp_json",
        "html_fallback",
        "external_redirect",
        "top_issues",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_report(pages_dir: Path, source_domain: str) -> dict[str, Any]:
    page_files = sorted(pages_dir.glob("*.json"))
    rows = [assess_page(load_page(path), source_domain) for path in page_files]
    severity_counts = Counter(row["max_severity"] for row in rows)
    issue_counts = Counter(code for row in rows for code in row["issue_codes"])
    source_counts = Counter(row["content_source"] for row in rows)
    fallback_counts = Counter(
        row["fallback_selector"]
        for row in rows
        if row["content_source"] == "html_fallback" and row["fallback_selector"]
    )
    section_counts: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        section_counts[row["section"] or ""][(row["max_severity"])] += 1

    sections = []
    for section in sorted({row["section"] or "" for row in rows}):
        section_rows = [row for row in rows if (row["section"] or "") == section]
        severities = Counter(row["max_severity"] for row in section_rows)
        sources = Counter(row["content_source"] for row in section_rows)
        issues = Counter(code for row in section_rows for code in row["issue_codes"])
        sections.append(
            {
                "section": section,
                "total": len(section_rows),
                "ok": severities.get("ok", 0),
                "info": severities.get("info", 0),
                "warning": severities.get("warning", 0),
                "error": severities.get("error", 0),
                "wp_json": sources.get("wp_json", 0),
                "html_fallback": sources.get("html_fallback", 0),
                "external_redirect": sources.get("external_redirect", 0),
                "top_issues": ", ".join(f"{code}:{count}" for code, count in issues.most_common(5)),
            }
        )

    problem_rows = [row for row in rows if row["max_severity"] in {"error", "warning"}]
    return {
        "summary": {
            "pages_checked": len(rows),
            "severity_counts": dict(severity_counts),
            "issue_counts": dict(issue_counts.most_common()),
            "content_sources": dict(source_counts),
            "fallback_selectors": dict(fallback_counts),
            "sections_by_severity": {
                section: dict(counter) for section, counter in sorted(section_counts.items())
            },
        },
        "sections": sections,
        "problems": problem_rows,
        "pages": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Check crawled page JSON files before site generation.")
    parser.add_argument("--pages-dir", type=Path, default=DEFAULT_OUTPUT / "pages")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source-domain", default="mosseo.ru")
    args = parser.parse_args()

    report = build_report(args.pages_dir, args.source_domain)
    write_json(args.out / "qa_report.json", report)
    write_csv(args.out / "qa_review.csv", report["problems"])
    write_section_csv(args.out / "qa_sections.csv", report["sections"])

    summary = report["summary"]
    print(f"Checked {summary['pages_checked']} pages")
    print(f"Severity counts: {summary['severity_counts']}")
    print(f"Top issues: {list(summary['issue_counts'].items())[:10]}")
    print(f"Saved {args.out / 'qa_report.json'}")
    print(f"Saved {args.out / 'qa_review.csv'}")
    print(f"Saved {args.out / 'qa_sections.csv'}")


if __name__ == "__main__":
    main()
