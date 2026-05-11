from __future__ import annotations

import argparse
from pathlib import Path

from crawl_pages import enrich_page, select_seeds, session
from common import DEFAULT_CSV, DEFAULT_OUTPUT, read_seeds, write_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe a representative subset without crawling everything.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT / "probe_report.json")
    parser.add_argument("--sample-per-section", type=int, default=1)
    parser.add_argument("--limit", type=int, default=30)
    args = parser.parse_args()

    seeds = select_seeds(read_seeds(args.csv), args.limit, args.sample_per_section)
    sess = session()
    results = []
    for seed in seeds:
        print(f"Probe: {seed.url}")
        try:
            page = enrich_page(sess, seed)
            results.append(
                {
                    "url": seed.url,
                    "section": seed.section,
                    "status_code": page["fetch"]["status_code"],
                    "body_class": page["meta"]["body_class"],
                    "wp_json_endpoint": page["fetch"]["wp_json_endpoint"],
                    "content_source": page["fetch"]["content_source"],
                    "fallback_selector": page["fetch"]["fallback_selector"],
                    "text_chars": page["quality"]["content_text_chars"],
                    "links_count": page["quality"]["links_count"],
                    "images_count": page["quality"]["images_count"],
                }
            )
        except Exception as exc:
            results.append({"url": seed.url, "section": seed.section, "error": repr(exc)})
    write_json(args.out, results)
    print(f"Saved probe report to {args.out}")


if __name__ == "__main__":
    main()
