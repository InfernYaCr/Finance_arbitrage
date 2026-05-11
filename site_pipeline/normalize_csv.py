from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from common import DEFAULT_CSV, DEFAULT_OUTPUT, read_seeds, seeds_to_json, write_json


def build_report(seeds):
    section_counts = Counter(seed.section for seed in seeds)
    depth_counts = Counter(seed.depth for seed in seeds)
    return {
        "unique_pages": len(seeds),
        "sections": dict(section_counts.most_common()),
        "depths": dict(sorted(depth_counts.items())),
        "missing": {
            "title": sum(1 for seed in seeds if not seed.title),
            "meta_description": sum(1 for seed in seeds if not seed.meta_description),
            "h1": sum(1 for seed in seeds if not seed.h1),
            "h2": sum(1 for seed in seeds if not seed.h2),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize Screaming Frog/internal HTML CSV into page seeds.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    seeds = read_seeds(args.csv)
    write_json(args.out / "seeds.json", seeds_to_json(seeds))
    write_json(args.out / "seed_report.json", build_report(seeds))

    report = build_report(seeds)
    print(f"Saved {len(seeds)} unique page seeds to {args.out / 'seeds.json'}")
    print(f"Top sections: {list(report['sections'].items())[:10]}")
    print(f"Missing fields: {report['missing']}")


if __name__ == "__main__":
    main()
