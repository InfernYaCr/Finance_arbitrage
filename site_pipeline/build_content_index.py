from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

from common import DEFAULT_OUTPUT, write_json


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def page_record(page: dict[str, Any], qa_page: dict[str, Any] | None, page_path: Path) -> dict[str, Any]:
    seed = page.get("seed", {})
    meta = page.get("meta", {})
    quality = page.get("quality", {})
    fetch = page.get("fetch", {})
    issues = qa_page.get("issue_codes", []) if qa_page else []
    excluded = fetch.get("content_source") == "external_redirect" or "empty_content_html" in issues
    title = seed.get("title") or meta.get("html_title") or page.get("wp_title") or ""
    description = seed.get("meta_description") or meta.get("html_meta_description") or ""
    return {
        "id": page.get("id"),
        "url": seed.get("url"),
        "path": seed.get("path"),
        "section": seed.get("section"),
        "depth": seed.get("depth"),
        "title": title,
        "description": description,
        "h1": seed.get("h1") or "",
        "h2": seed.get("h2") or [],
        "content_source": fetch.get("content_source"),
        "status_code": fetch.get("status_code"),
        "final_url": fetch.get("final_url"),
        "canonical": meta.get("canonical") or "",
        "wp_json_endpoint": fetch.get("wp_json_endpoint") or "",
        "page_file": str(page_path),
        "text_chars": int(quality.get("content_text_chars") or 0),
        "links_count": int(quality.get("links_count") or 0),
        "images_count": int(quality.get("images_count") or 0),
        "severity": qa_page.get("max_severity", "unknown") if qa_page else "unknown",
        "issue_codes": issues,
        "excluded": excluded,
    }


def build_indexes(output_dir: Path, min_chars: int = 0) -> dict[str, Any]:
    pages_dir = output_dir / "pages"
    qa_report_path = output_dir / "qa_report.json"
    qa_report = load_json(qa_report_path) if qa_report_path.exists() else {"pages": []}
    qa_by_id = {row["id"]: row for row in qa_report.get("pages", [])}

    records = []
    redirects = []
    excluded_pages = []
    for page_path in sorted(pages_dir.glob("*.json")):
        page = load_json(page_path)
        record = page_record(page, qa_by_id.get(page.get("id")), page_path)
        records.append(record)
        if record["content_source"] == "external_redirect":
            redirects.append(
                {
                    "source_url": record["url"],
                    "target_url": record["final_url"],
                    "status_code": record["status_code"],
                    "reason": "external_redirect",
                }
            )
        thin = min_chars > 0 and record["text_chars"] < min_chars and not record["excluded"]
        if thin:
            record = {**record, "excluded": True}
        if record["excluded"]:
            excluded_pages.append(
                {
                    "id": record["id"],
                    "url": record["url"],
                    "final_url": record["final_url"],
                    "reason": "thin_content" if thin else (",".join(record["issue_codes"]) or record["content_source"]),
                }
            )
        records[-1] = record  # update last appended record with possible thin exclusion

    build_manifest = [
        {
            "id": record["id"],
            "path": record["path"],
            "url": record["url"],
            "section": record["section"],
            "title": record["title"],
            "description": record["description"],
            "h1": record["h1"],
            "text_chars": record["text_chars"],
            "severity": record["severity"],
            "issue_codes": record["issue_codes"],
            "page_file": record["page_file"],
        }
        for record in records
        if not record["excluded"]
    ]

    return {
        "records": records,
        "redirects": redirects,
        "excluded_pages": excluded_pages,
        "build_manifest": build_manifest,
    }


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_sqlite(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            CREATE TABLE pages (
                id TEXT PRIMARY KEY,
                url TEXT,
                path TEXT,
                section TEXT,
                depth INTEGER,
                title TEXT,
                description TEXT,
                h1 TEXT,
                content_source TEXT,
                status_code INTEGER,
                final_url TEXT,
                canonical TEXT,
                page_file TEXT,
                text_chars INTEGER,
                links_count INTEGER,
                images_count INTEGER,
                severity TEXT,
                excluded INTEGER
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE issues (
                page_id TEXT,
                issue_code TEXT
            )
            """
        )
        for row in rows:
            connection.execute(
                """
                INSERT INTO pages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    row["url"],
                    row["path"],
                    row["section"],
                    row["depth"],
                    row["title"],
                    row["description"],
                    row["h1"],
                    row["content_source"],
                    row["status_code"],
                    row["final_url"],
                    row["canonical"],
                    row["page_file"],
                    row["text_chars"],
                    row["links_count"],
                    row["images_count"],
                    row["severity"],
                    int(row["excluded"]),
                ),
            )
            for issue_code in row["issue_codes"]:
                connection.execute("INSERT INTO issues VALUES (?, ?)", (row["id"], issue_code))
        connection.execute("CREATE INDEX pages_section_idx ON pages(section)")
        connection.execute("CREATE INDEX pages_path_idx ON pages(path)")
        connection.execute("CREATE INDEX pages_severity_idx ON pages(severity)")
        connection.execute("CREATE INDEX issues_code_idx ON issues(issue_code)")
        connection.commit()
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Build compact indexes for generated page JSON files.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--min-chars",
        type=int,
        default=0,
        metavar="N",
        help="Exclude pages with fewer than N content text chars from build_manifest (default: 0 = no filter)",
    )
    args = parser.parse_args()

    indexes = build_indexes(args.out, min_chars=args.min_chars)
    write_json(args.out / "build_manifest.json", indexes["build_manifest"])
    write_json(args.out / "redirects.json", indexes["redirects"])
    write_json(args.out / "excluded_pages.json", indexes["excluded_pages"])
    write_jsonl(args.out / "content_index.jsonl", indexes["records"])
    write_sqlite(args.out / "content_index.sqlite", indexes["records"])

    print(f"Indexed pages: {len(indexes['records'])}")
    print(f"Buildable pages: {len(indexes['build_manifest'])}")
    print(f"Redirects: {len(indexes['redirects'])}")
    print(f"Excluded pages: {len(indexes['excluded_pages'])}")
    print(f"Saved {args.out / 'content_index.sqlite'}")


if __name__ == "__main__":
    main()
