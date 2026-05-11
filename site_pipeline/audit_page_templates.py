from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
from typing import Any

from bs4 import BeautifulSoup

from common import DEFAULT_OUTPUT, write_json


SERVICE_SECTIONS = {
    "seo-uslugi",
    "uslugi",
    "stoimost-uslug",
    "tarify-seo",
    "konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta",
    "seo-prodvizhenie-sajta",
    "kontekstnaya-reklama",
    "zakazat-kompleksnoe-prodvizhenie-sajta",
}

ARCHIVE_PATHS = {
    "/vse-o-seo-prodvizhenii/",
    "/seo-wikipedia/",
    "/portfolio/",
    "/faq/",
    "/novosti/",
    "/otzyvy/",
    "/photogallery/",
    "/seo-po-tematikam/",
    "/na-ponyatnom-yazyke/",
    "/optimizaciya/",
    "/vidy-tipy-sajtov-i-ih-klassifikaciya/",
    "/poiskovye-sistemy/",
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def path_depth(path: str) -> int:
    return len(path.strip("/").split("/")) if path.strip("/") else 0


def infer_page_type(path: str, section: str) -> str:
    if path == "/":
        return "home"
    if path == "/kontakty/":
        return "contact"
    if section == "o-kompanii":
        return "company"
    if path == "/portfolio/":
        return "portfolio_archive"
    if section in {"portfolio", "case"}:
        return "portfolio_case"
    if path == "/seo-wikipedia/":
        return "dictionary_archive"
    if section == "seo-wikipedia":
        return "dictionary_article"
    if path == "/faq/":
        return "archive"
    if section == "faq":
        return "faq"
    if section in SERVICE_SECTIONS:
        return "archive" if path_depth(path) == 1 else "service"
    if path in ARCHIVE_PATHS:
        return "archive"
    return "article"


def classify_template(content_html: str, content_text: str) -> str:
    soup = BeautifulSoup(content_html or "", "html.parser")
    if not content_html.strip():
        return "empty_or_redirect"
    if soup.select(".contacts"):
        return "contacts_template"
    if soup.select(".section-services") and soup.select(".serv-item"):
        return "service_catalog"
    if soup.select(".section-services"):
        return "service_category_nav"
    if soup.select(".section-portfolio") or soup.select(".portfolio"):
        return "portfolio_template"
    if soup.select(".section-case-page"):
        return "case_template"
    if soup.select(".section-quiz"):
        return "quiz_calculator"
    if soup.select(".section-blog"):
        return "blog_archive_template"
    if soup.select(".section-seowiki__children") or soup.select(".section-seowiki"):
        return "dictionary_archive_template"
    if soup.select(".section-faqs"):
        return "faq_archive_template"
    if soup.select(".taxonomy-description"):
        return "taxonomy_description"
    if soup.select(".content") or soup.select("article"):
        return "content_article"
    if len(content_text or "") < 300:
        return "thin_content"
    return "generic_content"


def page_row(page_path: Path) -> dict[str, Any]:
    page = load_json(page_path)
    seed = page.get("seed", {})
    fetch = page.get("fetch", {})
    quality = page.get("quality", {})
    content_html = page.get("content_html") or ""
    content_text = page.get("content_text") or ""
    path = seed.get("path") or ""
    section = seed.get("section") or ""
    soup = BeautifulSoup(content_html, "html.parser")
    return {
        "id": page.get("id"),
        "url": seed.get("url") or "",
        "path": path,
        "section": section,
        "page_type": infer_page_type(path, section),
        "source_template": classify_template(content_html, content_text),
        "content_source": fetch.get("content_source") or "",
        "fallback_selector": fetch.get("fallback_selector") or "",
        "text_chars": int(quality.get("content_text_chars") or len(content_text)),
        "links_count": int(quality.get("links_count") or len(page.get("links") or [])),
        "images_count": int(quality.get("images_count") or len(page.get("images") or [])),
        "serv_blocks": len(soup.select(".serv-block")),
        "serv_items": len(soup.select(".serv-item")),
        "taxonomy_description": int(bool(soup.select(".taxonomy-description"))),
        "page_file": str(page_path),
    }


def summarized_group(rows: list[dict[str, Any]]) -> dict[str, Any]:
    chars = [row["text_chars"] for row in rows]
    return {
        "count": len(rows),
        "min_chars": min(chars) if chars else 0,
        "median_chars": int(median(chars)) if chars else 0,
        "max_chars": max(chars) if chars else 0,
        "samples": [
            {
                "path": row["path"],
                "text_chars": row["text_chars"],
                "serv_items": row["serv_items"],
                "content_source": row["content_source"],
            }
            for row in rows[:8]
        ],
    }


def build_report(pages_dir: Path) -> dict[str, Any]:
    rows = [page_row(path) for path in sorted(pages_dir.glob("*.json"))]
    by_template = Counter(row["source_template"] for row in rows)
    by_page_type = Counter(row["page_type"] for row in rows)
    by_pair: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        by_pair[row["page_type"]][row["source_template"]] += 1

    groups: dict[str, dict[str, Any]] = {}
    for template in sorted(by_template):
        template_rows = [row for row in rows if row["source_template"] == template]
        groups[template] = summarized_group(template_rows)

    service_templates: dict[str, dict[str, Any]] = {}
    for template in sorted({row["source_template"] for row in rows if row["page_type"] == "service"}):
        template_rows = [
            row for row in rows if row["page_type"] == "service" and row["source_template"] == template
        ]
        service_templates[template] = summarized_group(template_rows)

    return {
        "summary": {
            "pages_checked": len(rows),
            "templates": dict(by_template.most_common()),
            "page_types": dict(by_page_type.most_common()),
            "page_type_templates": {
                page_type: dict(counter.most_common())
                for page_type, counter in sorted(by_pair.items())
            },
        },
        "template_groups": groups,
        "service_templates": service_templates,
        "pages": rows,
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "page_type",
        "source_template",
        "text_chars",
        "serv_blocks",
        "serv_items",
        "section",
        "path",
        "url",
        "content_source",
        "fallback_selector",
        "links_count",
        "images_count",
        "id",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify crawled pages by source HTML template.")
    parser.add_argument("--pages-dir", type=Path, default=DEFAULT_OUTPUT / "pages")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    report = build_report(args.pages_dir)
    write_json(args.out / "template_audit.json", report)
    write_csv(args.out / "template_audit.csv", report["pages"])

    summary = report["summary"]
    print(f"Checked {summary['pages_checked']} pages")
    print("Source templates:")
    for template, count in summary["templates"].items():
        print(f"  {template}: {count}")
    print("Page types:")
    for page_type, count in summary["page_types"].items():
        print(f"  {page_type}: {count}")
    print(f"Saved {args.out / 'template_audit.json'}")
    print(f"Saved {args.out / 'template_audit.csv'}")


if __name__ == "__main__":
    main()
