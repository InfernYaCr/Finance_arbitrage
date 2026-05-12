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


EXA_SEARCH_URL = "https://api.exa.ai/search"

EXCLUDE_DOMAINS = [
    "wikipedia.org",
    "youtube.com",
    "vk.com",
    "ok.ru",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "hh.ru",
    "avito.ru",
    "ozon.ru",
    "wildberries.ru",
    "vc.ru",
    "habr.com",
    "2gis.ru",
    "yell.ru",
    "zoon.ru",
]

NICHE_QUERIES = {
    "finance": {
        "query": "финансовый сайт сравнение займов кредитных карт рейтинги банков МФО",
        "highlight_query": "займы кредиты карты рейтинги условия банков МФО",
    },
    "seo_agency": {
        "query": "SEO агентство продвижение сайтов кейсы цены услуги",
        "highlight_query": "SEO услуги кейсы цены клиенты продвижение сайта",
    },
    "legal": {
        "query": "юридическая компания консультации судебная практика услуги",
        "highlight_query": "юридические услуги консультации цены практика",
    },
    "medical": {
        "query": "частная клиника диагностика лечение врачи услуги цены",
        "highlight_query": "клиника услуги врачи цены диагностика",
    },
}


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower().replace("www.", "")


def _request_exa(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("EXA_API_KEY")
    if not api_key:
        sys.exit("EXA_API_KEY not set. Add it to site/.env or the environment.")

    response = requests.post(
        EXA_SEARCH_URL,
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=45,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise SystemExit(f"Exa search failed: {exc}\n{response.text[:1000]}") from exc
    return response.json()


def discover(
    niche: str,
    query: str | None,
    highlight_query: str | None,
    num_results: int,
    out: Path,
) -> dict[str, Any]:
    preset = NICHE_QUERIES.get(niche, NICHE_QUERIES["finance"])
    final_query = query or preset["query"]
    final_highlight_query = highlight_query or preset["highlight_query"]
    payload = {
        "query": final_query,
        "type": "auto",
        "numResults": num_results,
        "excludeDomains": EXCLUDE_DOMAINS,
        "contents": {
            "highlights": {
                "query": final_highlight_query,
                "numSentences": 3,
                "highlightsPerUrl": 2,
            }
        },
    }
    result = _request_exa(payload)
    candidates = []
    for item in result.get("results", []):
        url = item.get("url") or ""
        highlights = item.get("highlights") or []
        highlight_scores = item.get("highlightScores") or []
        candidates.append(
            {
                "title": item.get("title") or "",
                "url": url,
                "domain": _domain(url),
                "score": item.get("score"),
                "published_date": item.get("publishedDate"),
                "highlights": highlights,
                "highlight_scores": highlight_scores,
                "qualified_for_review": bool(highlights),
            }
        )

    output = {
        "niche": niche,
        "query": final_query,
        "highlight_query": final_highlight_query,
        "request_id": result.get("requestId"),
        "candidates": candidates,
    }
    write_json(out, output)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Find donor candidates with Exa search highlights.")
    parser.add_argument("--niche", default="finance", choices=sorted(NICHE_QUERIES))
    parser.add_argument("--query", default=None)
    parser.add_argument("--highlight-query", default=None)
    parser.add_argument("--num-results", type=int, default=10)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT / "donor_candidates.json")
    args = parser.parse_args()

    output = discover(
        niche=args.niche,
        query=args.query,
        highlight_query=args.highlight_query,
        num_results=args.num_results,
        out=args.out,
    )
    print(f"Saved {len(output['candidates'])} candidates → {args.out}")
    for candidate in output["candidates"][:10]:
        score = candidate["score"] if candidate["score"] is not None else "n/a"
        print(f"- {candidate['domain']} score={score} {candidate['url']}")


if __name__ == "__main__":
    main()
