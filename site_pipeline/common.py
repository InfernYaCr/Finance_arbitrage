from __future__ import annotations

import csv
import hashlib
import html
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse


DEFAULT_CSV = Path("/Users/deniskononov/Downloads/internal_html.csv")
DEFAULT_OUTPUT = Path("site_pipeline/output")
USER_AGENT = "ManjerokSitePipeline/0.1 (+local content migration)"


@dataclass
class PageSeed:
    source_url: str
    url: str
    path: str
    section: str
    depth: int
    title: str
    meta_description: str
    h1: str
    h2: list[str]
    csv_line: int


def normalize_url(raw_url: str) -> str:
    raw_url = raw_url.strip()
    parsed = urlparse(raw_url)
    scheme = "https"
    netloc = parsed.netloc.lower().replace("www.", "")
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/") + "/"
    return urlunparse((scheme, netloc, path, "", "", ""))


def url_path(url: str) -> str:
    return urlparse(url).path or "/"


def section_from_path(path: str) -> str:
    parts = [part for part in path.strip("/").split("/") if part]
    return parts[0] if parts else "root"


def depth_from_path(path: str) -> int:
    return len([part for part in path.strip("/").split("/") if part])


def safe_page_id(url: str) -> str:
    parsed = urlparse(url)
    slug = (parsed.path.strip("/") or "index").replace("/", "__")
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    slug = re.sub(r"[^a-zA-Z0-9_.-]+", "-", slug)
    return f"{slug}--{digest}"


def read_seeds(csv_path: Path) -> list[PageSeed]:
    seen: dict[str, PageSeed] = {}
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for line_number, row in enumerate(reader, start=2):
            if not row.get("Address"):
                continue
            source_url = row["Address"].strip()
            normalized = normalize_url(source_url)
            path = url_path(normalized)
            h2 = [
                value.strip()
                for value in (row.get("H2-1", ""), row.get("H2-2", ""))
                if value and value.strip()
            ]
            seed = PageSeed(
                source_url=source_url,
                url=normalized,
                path=path,
                section=section_from_path(path),
                depth=depth_from_path(path),
                title=(row.get("Title 1") or "").strip(),
                meta_description=(row.get("Meta Description 1") or "").strip(),
                h1=(row.get("H1-1") or "").strip(),
                h2=h2,
                csv_line=line_number,
            )
            if normalized not in seen or not seen[normalized].title:
                seen[normalized] = seed
    return sorted(seen.values(), key=lambda seed: seed.path)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def seeds_to_json(seeds: list[PageSeed]) -> list[dict[str, Any]]:
    return [asdict(seed) for seed in seeds]


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def absolutize_url(base_url: str, maybe_url: str | None) -> str:
    if not maybe_url:
        return ""
    return urljoin(base_url, html.unescape(maybe_url.strip()))

