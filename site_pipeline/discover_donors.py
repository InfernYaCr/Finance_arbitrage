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

FIRECRAWL_SEARCH_QUERIES = {
    "finance": "российский финансовый сайт рейтинги займов кредитных карт банков МФО",
    "seo_agency": "SEO агентство продвижение сайтов кейсы цены услуги",
    "legal": "юридическая компания консультации судебная практика услуги",
    "medical": "частная клиника диагностика лечение врачи услуги цены",
}

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


def _discover_firecrawl(
    niche: str,
    query: str | None,
    num_results: int,
) -> list[dict[str, Any]]:
    """Search donors via Firecrawl search API (alternative to Exa)."""
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        sys.exit("FIRECRAWL_API_KEY not set. Add it to site/.env or the environment.")

    from firecrawl.v1 import V1FirecrawlApp  # local import to avoid mandatory dep
    app = V1FirecrawlApp(api_key=api_key)

    final_query = query or FIRECRAWL_SEARCH_QUERIES.get(niche, FIRECRAWL_SEARCH_QUERIES["finance"])
    print(f"  Firecrawl search: {final_query!r} (limit={num_results})")
    resp = app.search(
        final_query,
        limit=num_results,
        lang="ru",
        country="RU",
    )
    docs = resp.data if hasattr(resp, "data") else (resp if isinstance(resp, list) else [])
    candidates = []
    for doc in docs:
        url = getattr(doc, "url", None) or (doc.get("url") if isinstance(doc, dict) else None) or ""
        title = getattr(doc, "title", None) or (doc.get("title") if isinstance(doc, dict) else None) or ""
        if not url:
            continue
        domain = _domain(url)
        if any(ex in domain for ex in EXCLUDE_DOMAINS):
            continue
        candidates.append({
            "title": title,
            "url": url,
            "domain": domain,
            "score": None,
            "published_date": None,
            "highlights": [],
            "highlight_scores": [],
            "qualified_for_review": True,
            "backend": "firecrawl",
        })
    return candidates


def discover(
    niche: str,
    query: str | None,
    highlight_query: str | None,
    num_results: int,
    out: Path,
    backend: str = "exa",
) -> dict[str, Any]:
    if backend == "firecrawl":
        candidates = _discover_firecrawl(niche, query, num_results)
        output = {
            "niche": niche,
            "query": query or FIRECRAWL_SEARCH_QUERIES.get(niche, ""),
            "highlight_query": None,
            "request_id": None,
            "backend": "firecrawl",
            "candidates": candidates,
        }
        write_json(out, output)
        return output

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
                "backend": "exa",
            }
        )

    output = {
        "niche": niche,
        "query": final_query,
        "highlight_query": final_highlight_query,
        "request_id": result.get("requestId"),
        "backend": "exa",
        "candidates": candidates,
    }
    write_json(out, output)
    return output


def auto_qualify(candidates: list[dict[str, Any]], niche: str, min_score: float = 0.1) -> list[dict[str, Any]]:
    """Phase 2: qualify top candidates via Exa summary schema and write to registry."""
    try:
        import importlib.util, subprocess, sys as _sys
        spec = importlib.util.spec_from_file_location(
            "qualify_donor",
            Path(__file__).parent / "qualify_donor.py",
        )
        qmod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
        spec.loader.exec_module(qmod)  # type: ignore[union-attr]
    except Exception as exc:
        print(f"  WARN: could not load qualify_donor: {exc}", file=sys.stderr)
        return []

    results = []
    for c in candidates:
        if not c.get("qualified_for_review"):
            continue
        score = c.get("score") or 0
        if score < min_score:
            continue
        url = c["url"]
        print(f"  Qualifying {url} …", end=" ", flush=True)
        try:
            summary = qmod.qualify(url)
            verdict = summary.get("verdict", "PENDING")
            print(verdict)
            results.append({"url": url, "verdict": verdict, "summary": summary})
        except Exception as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find donor candidates with Exa search highlights.",
        epilog="Use --auto-qualify to run Phase 2: qualify top candidates via Exa summary.",
    )
    parser.add_argument("--niche", default="finance", choices=sorted(NICHE_QUERIES))
    parser.add_argument("--query", default=None)
    parser.add_argument("--highlight-query", default=None)
    parser.add_argument("--num-results", type=int, default=10)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT / "donor_candidates.json")
    parser.add_argument(
        "--backend", choices=["exa", "firecrawl"], default="exa",
        help="Search backend: 'exa' (default) uses Exa highlights; 'firecrawl' uses Firecrawl search.",
    )
    parser.add_argument(
        "--auto-qualify",
        action="store_true",
        help="Phase 2: qualify candidates with Exa summary and write CRAWL/SKIP to registry",
    )
    parser.add_argument("--min-score", type=float, default=0.1, help="Exa score threshold for auto-qualify")
    args = parser.parse_args()

    output = discover(
        niche=args.niche,
        query=args.query,
        highlight_query=args.highlight_query,
        num_results=args.num_results,
        out=args.out,
        backend=args.backend,
    )
    print(f"Saved {len(output['candidates'])} candidates → {args.out}")
    for candidate in output["candidates"][:10]:
        score = candidate["score"] if candidate["score"] is not None else "n/a"
        print(f"- {candidate['domain']} score={score} {candidate['url']}")

    if args.auto_qualify:
        print(f"\nPhase 2: auto-qualifying candidates (min_score={args.min_score}) …")
        qualified = auto_qualify(output["candidates"], niche=args.niche, min_score=args.min_score)
        crawl = [q for q in qualified if q["verdict"] == "CRAWL"]
        print(f"\nPhase 2 done: {len(crawl)}/{len(qualified)} candidates → CRAWL")


if __name__ == "__main__":
    main()
