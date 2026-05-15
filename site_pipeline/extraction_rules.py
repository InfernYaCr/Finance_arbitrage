from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

from common import clean_text


SKIP_SUMMARY_CLASS_PARTS = (
    "accordion",
    "banner",
    "card",
    "catalog",
    "company",
    "filter",
    "footer",
    "header",
    "listing",
    "modal",
    "nav",
    "offer",
    "post-block",
    "promo",
    "rating",
    "relink",
    "review",
    "sidebar",
    "subscribe",
    "tabs",
)


def _class_text(node: Any) -> str:
    value = node.get("class") if hasattr(node, "get") else None
    if isinstance(value, list):
        return " ".join(str(part) for part in value).lower()
    return str(value or "").lower()


def _has_skipped_summary_ancestor(node: Any) -> bool:
    for parent in node.parents:
        class_text = _class_text(parent)
        if any(part in class_text for part in SKIP_SUMMARY_CLASS_PARTS):
            return True
    return False


def infer_page_type(path: str, title: str = "") -> str:
    """Infer a stable content type from URL shape before optional LLM enrichment."""
    parts = [part for part in path.strip("/").split("/") if part]
    section = parts[0] if parts else "root"
    title_l = title.lower()

    if path == "/":
        return "home"
    if section in {"contact", "contacts", "kontakty"}:
        return "contact"
    if section == "ratings":
        return "rating"
    if section == "qa":
        return "qa_article"
    if section == "terms":
        return "dictionary"
    if section in {"mortgage", "autocredit", "banks", "business"}:
        return "article"
    if "калькулятор" in title_l or "calculator" in title_l:
        return "calculator"
    if "рейтинг" in title_l or title_l.startswith("топ"):
        return "rating"
    return "article"


def extract_faq_pairs(content_html: str) -> list[dict[str, str]]:
    """Extract FAQ pairs from common donor accordion/details markup."""
    if not content_html.strip():
        return []

    soup = BeautifulSoup(content_html, "html.parser")
    pairs: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for details in soup.select("details"):
        summary = details.select_one("summary")
        if not summary:
            continue
        title_node = summary.select_one(".accordion-title")
        question = clean_text((title_node or summary).get_text(" "))
        summary.extract()
        answer_node = details.select_one(".panel") or details
        answer = clean_text(answer_node.get_text(" "))
        if len(question) < 8 or len(answer) < 12:
            continue
        key = (question.casefold(), answer.casefold())
        if key not in seen:
            pairs.append({"question": question, "answer": answer})
            seen.add(key)

    return pairs


def derive_key_points(content_html: str, content_text: str, limit: int = 5) -> list[str]:
    """Pick concise list items from the article body as summary candidates."""
    if not content_html.strip():
        return []

    soup = BeautifulSoup(content_html, "html.parser")
    points: list[str] = []
    seen: set[str] = set()
    skip_words = {"главная", "все", "читать", "перейти", "отзывы"}

    for item in soup.select("li"):
        if _has_skipped_summary_ancestor(item):
            continue
        text = clean_text(item.get_text(" "))
        text_l = text.lower()
        if not 25 <= len(text) <= 180:
            continue
        if item.find(["a", "button", "input", "select"]):
            continue
        if item.get("data-listing") is not None:
            continue
        if any(word == text_l for word in skip_words):
            continue
        if text_l in seen:
            continue
        points.append(text)
        seen.add(text_l)
        if len(points) >= limit:
            break

    if len(points) >= 2:
        return points

    return []


def extract_dates(content_html: str) -> tuple[str, str]:
    """Extract (date_published, date_modified) from HTML. Returns ('', '') if not found."""
    import re
    if not content_html:
        return "", ""
    # JSON-LD datePublished / dateModified
    ld_match = re.search(
        r'"datePublished"\s*:\s*"([0-9T:+\-Z]{8,})"', content_html
    )
    ld_mod = re.search(
        r'"dateModified"\s*:\s*"([0-9T:+\-Z]{8,})"', content_html
    )
    if ld_match:
        pub = ld_match.group(1)[:10]
        mod = ld_mod.group(1)[:10] if ld_mod else pub
        return pub, mod
    # <time datetime="YYYY-MM-DD...">
    soup = BeautifulSoup(content_html, "html.parser")
    times = soup.find_all("time", datetime=True)
    dates = sorted({t["datetime"][:10] for t in times if len(t.get("datetime", "")) >= 10})
    if dates:
        return dates[0], dates[-1]
    return "", ""


def enrich_extracted(page: dict[str, Any]) -> dict[str, Any]:
    """Backfill extracted metadata without changing canonical page content."""
    seed = page.get("seed") or {}
    path = seed.get("path") or "/"
    title = seed.get("title") or page.get("wp_title") or ""
    content_html = page.get("content_html") or ""
    content_text = page.get("content_text") or ""
    current = page.get("extracted") if isinstance(page.get("extracted"), dict) else {}

    faq_pairs = current.get("faq_pairs") or extract_faq_pairs(content_html)
    key_points = current.get("key_points") or derive_key_points(content_html, content_text)
    page_type = current.get("page_type")
    if not page_type or page_type == "other":
        page_type = infer_page_type(path, title)

    date_pub = current.get("date_published") or ""
    date_mod = current.get("date_modified") or ""
    if not date_pub:
        date_pub, date_mod = extract_dates(content_html)

    page["extracted"] = {
        **current,
        "page_type": page_type,
        "services": current.get("services") or [],
        "faq_pairs": faq_pairs,
        "pricing_tiers": current.get("pricing_tiers") or [],
        "case_results": current.get("case_results") or [],
        "key_points": key_points,
        "cta_text": current.get("cta_text") or "",
        "date_published": date_pub,
        "date_modified": date_mod or date_pub,
        # LLM-enriched fields — preserved if already set, empty otherwise
        "summary": current.get("summary") or "",
        "entities": current.get("entities") or [],
        "data_points": current.get("data_points") or [],
        "target_query": current.get("target_query") or "",
    }
    return page


def enrich_page_file(path: Path) -> bool:
    page = path.read_text(encoding="utf-8")

    data = json.loads(page)
    before = json.dumps(data.get("extracted") or {}, ensure_ascii=False, sort_keys=True)
    enrich_extracted(data)
    after = json.dumps(data.get("extracted") or {}, ensure_ascii=False, sort_keys=True)
    if before == after:
        return False
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True
