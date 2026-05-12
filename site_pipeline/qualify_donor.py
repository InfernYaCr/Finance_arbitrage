from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

from common import DEFAULT_OUTPUT, write_json


_SITE_ENV = Path(__file__).parent.parent / "site" / ".env"
if _SITE_ENV.exists():
    for _line in _SITE_ENV.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#"):
            continue
        _match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", _line)
        if _match:
            os.environ.setdefault(_match.group(1), _match.group(2).strip().strip("'\""))


EXA_CONTENTS_URL = "https://api.exa.ai/contents"

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["CRAWL", "SKIP"]},
        "site_type": {"type": "string"},
        "niche": {"type": "string"},
        "content_kinds": {"type": "array", "items": {"type": "string"}},
        "crawl_value": {"type": "integer", "minimum": 0, "maximum": 100},
        "skip_reasons": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "string"},
    },
    "required": ["verdict", "crawl_value", "content_kinds", "skip_reasons"],
}


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower().replace("www.", "")


def _request_exa(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("EXA_API_KEY")
    if not api_key:
        sys.exit("EXA_API_KEY not set. Add it to site/.env or the environment.")

    response = requests.post(
        EXA_CONTENTS_URL,
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"Exa contents failed: {exc}\n{response.text[:1000]}") from exc
    return response.json()


def qualify(url: str, out: Path | None = None) -> dict[str, Any]:
    payload = {
        "urls": [url],
        "summary": {
            "query": (
                "Decide if this website is a useful donor for a Russian white-label content site. "
                "Prefer content-rich sites with articles, rankings, comparisons, FAQs, pricing or product condition pages. "
                "Skip thin directories, pure UGC, login pages, social networks, shops without editorial content, and author-only pages."
            ),
            "schema": SUMMARY_SCHEMA,
        },
        "text": {"maxCharacters": 3000},
        "maxAgeHours": 24,
    }
    result = _request_exa(payload)
    item = (result.get("results") or [{}])[0]
    output = {
        "url": url,
        "domain": _domain(url),
        "request_id": result.get("requestId"),
        "title": item.get("title") or "",
        "summary": item.get("summary"),
        "text_chars": len(item.get("text") or ""),
    }
    if out:
        write_json(out, output)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Qualify one donor URL with Exa contents summary.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    out = args.out
    if out is None:
        domain = _domain(args.url) or "donor"
        out = DEFAULT_OUTPUT / f"qualify_{domain}.json"
    output = qualify(args.url, out)
    print(f"Saved qualification → {out}")
    print(output.get("summary"))


if __name__ == "__main__":
    main()
