#!/usr/bin/env python3
"""
extract_offers_fc.py — Firecrawl /v1/extract for structured offer data.

Uses Firecrawl's LLM extraction endpoint to pull loan/credit/card product data
from rating pages (rates, amounts, terms, issuer names) into structured JSON.

Outputs: site_pipeline/output/<donor>/offers_extracted.json

Usage:
  python site_pipeline/extract_offers_fc.py --source-domain vsezaimyonline.ru
  python site_pipeline/extract_offers_fc.py --source-domain vsezaimyonline.ru \\
      --sections ratings,займы --limit 30
  python site_pipeline/extract_offers_fc.py --source-domain vsezaimyonline.ru \\
      --urls-file site_pipeline/output/vsezaimyonline/map_urls.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

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

from common import DEFAULT_OUTPUT, write_json  # noqa: E402

# Schema for financial product extraction
_OFFER_SCHEMA = {
    "type": "object",
    "properties": {
        "offers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name":         {"type": "string",  "description": "Product/issuer name"},
                    "rate_min":     {"type": "number",  "description": "Min interest rate % per year"},
                    "rate_max":     {"type": "number",  "description": "Max interest rate % per year"},
                    "amount_min":   {"type": "integer", "description": "Min loan/credit amount in RUB"},
                    "amount_max":   {"type": "integer", "description": "Max loan/credit amount in RUB"},
                    "term_min_days":{"type": "integer", "description": "Min term in days"},
                    "term_max_days":{"type": "integer", "description": "Max term in days"},
                    "approval_rate":{"type": "number",  "description": "Approval % if stated"},
                    "cta_url":      {"type": "string",  "description": "CTA / apply link URL"},
                    "rank":         {"type": "integer", "description": "Position in rating list (1-based)"},
                },
                "required": ["name"],
            },
        },
        "page_type": {
            "type": "string",
            "enum": ["loan_rating", "credit_card_rating", "mortgage_rating", "other"],
        },
    },
    "required": ["offers"],
}

_EXTRACT_PROMPT = (
    "Extract all financial products listed on this rating/review page. "
    "For each product capture: issuer name, min/max interest rates (% per year), "
    "min/max loan amounts (RUB), min/max terms (convert to days), "
    "approval rate if shown, the apply/CTA URL, and its rank in the list. "
    "Also classify the page as loan_rating, credit_card_rating, mortgage_rating, or other."
)


def _rating_urls(
    source_domain: str,
    sections: list[str],
    limit: int,
    urls_file: Path | None,
) -> list[str]:
    """Return URLs to extract from."""
    if urls_file and urls_file.exists():
        raw = json.loads(urls_file.read_text(encoding="utf-8"))
        candidates = [u for u in raw if isinstance(u, str)]
    else:
        candidates = [f"https://{source_domain}/*"]

    if sections:
        # Filter to section prefixes; fall back to wildcard per section
        filtered = [
            u for u in candidates
            if any(f"/{s}/" in u or u.endswith(f"/{s}") for s in sections)
        ]
        if not filtered:
            # If map_urls has nothing matching, use wildcards
            filtered = [f"https://{source_domain}/{s}/*" for s in sections]
        candidates = filtered

    return candidates[:limit]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract structured offer data from rating pages via Firecrawl /v1/extract."
    )
    parser.add_argument("--source-domain", required=True, help="Donor domain, e.g. vsezaimyonline.ru")
    parser.add_argument(
        "--sections", type=str, default="",
        help="Comma-separated URL sections to target, e.g. 'ratings,займы,кредиты'",
    )
    parser.add_argument(
        "--limit", type=int, default=50,
        help="Max URLs to extract from (default 50). Each URL costs ~5 credits.",
    )
    parser.add_argument(
        "--urls-file", type=Path, default=None,
        help="Path to map_urls.json to source URLs from (optional).",
    )
    parser.add_argument(
        "--out", type=Path, default=None,
        help="Output JSON path (default: site_pipeline/output/<donor>/offers_extracted.json)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        sys.exit("FIRECRAWL_API_KEY not set.")

    sections = [s.strip() for s in args.sections.split(",") if s.strip()]
    donor_slug = args.source_domain.replace(".", "-").strip("-")
    output_path = args.out or (DEFAULT_OUTPUT / donor_slug / "offers_extracted.json")

    # Determine URLs to extract from
    urls_file = args.urls_file
    if not urls_file:
        candidate = DEFAULT_OUTPUT / donor_slug / "map_urls.json"
        if candidate.exists():
            urls_file = candidate

    urls = _rating_urls(args.source_domain, sections, args.limit, urls_file)
    print(f"Extracting from {len(urls)} URL(s): {urls[:5]}{'…' if len(urls) > 5 else ''}")

    app = V1FirecrawlApp(api_key=api_key)
    resp = app.extract(
        urls=urls,
        prompt=_EXTRACT_PROMPT,
        schema=_OFFER_SCHEMA,
        enable_web_search=False,
    )

    result: dict[str, Any] = {
        "source_domain": args.source_domain,
        "sections": sections,
        "url_count": len(urls),
        "data": resp.data if hasattr(resp, "data") else resp,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(output_path, result)
    print(f"✓ Extracted → {output_path}")

    # Summary
    data = result["data"]
    if isinstance(data, dict):
        offers = data.get("offers", [])
        print(f"  Found {len(offers)} offers, page_type={data.get('page_type', '?')}")
    elif isinstance(data, list):
        total = sum(len(d.get("offers", [])) for d in data if isinstance(d, dict))
        print(f"  Total offers across {len(data)} pages: {total}")


if __name__ == "__main__":
    main()
