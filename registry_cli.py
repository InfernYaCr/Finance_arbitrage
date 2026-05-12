#!/usr/bin/env python3
"""
registry_cli.py — CLI for managing the PBN pipeline SQLite registry.

Usage:
  python registry_cli.py init
  python registry_cli.py add-donor --url https://mosseo.ru --niche seo --verdict CRAWL
  python registry_cli.py add-donor --url https://vsezaimyonline.ru --niche finance --verdict CRAWL --score 0.82
  python registry_cli.py list-donors
  python registry_cli.py add-site --id rostpoisk --donor https://mosseo.ru
  python registry_cli.py add-site --id finhelp-ru --donor https://vsezaimyonline.ru
  python registry_cli.py list-sites
  python registry_cli.py list-runs [--donor mosseo-ru]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add site_pipeline to path so we can import registry
sys.path.insert(0, str(Path(__file__).parent / "site_pipeline"))
import registry as reg


def _print_table(rows: list[dict], cols: list[str]) -> None:
    if not rows:
        print("  (empty)")
        return
    widths = {c: max(len(c), max(len(str(r.get(c) or "")) for r in rows)) for c in cols}
    header = "  ".join(c.ljust(widths[c]) for c in cols)
    sep = "  ".join("-" * widths[c] for c in cols)
    print(header)
    print(sep)
    for r in rows:
        print("  ".join(str(r.get(c) or "").ljust(widths[c]) for c in cols))


def cmd_init(_args: argparse.Namespace) -> None:
    reg.init_db()
    print(f"✓ Registry initialized at {reg.DB_PATH}")


def cmd_add_donor(args: argparse.Namespace) -> None:
    donor_id = reg.upsert_donor(
        args.url,
        niche=args.niche,
        verdict=args.verdict,
        score=args.score,
        notes=args.notes,
    )
    print(f"✓ Donor saved: {donor_id}  verdict={args.verdict}")


def cmd_list_donors(_args: argparse.Namespace) -> None:
    donors = reg.list_donors()
    print(f"\nDonors ({len(donors)}):\n")
    _print_table(donors, ["id", "verdict", "niche", "score", "page_count", "crawled_at", "url"])
    print()


def cmd_add_site(args: argparse.Namespace) -> None:
    # Load brand info from site.config.json if it exists
    config_path = Path(f"sites/{args.id}/site.config.json")
    brand_name = args.brand
    brand_name_full = None
    metrika_id = None
    beget_host = None
    beget_ftp_user = None
    theme = "alpha"

    if config_path.exists():
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        brand_name = brand_name or cfg.get("brand", {}).get("name")
        brand_name_full = cfg.get("brand", {}).get("name_full")
        metrika_id = cfg.get("analytics", {}).get("metrika_id")
        beget_host = cfg.get("deploy", {}).get("beget_host")
        beget_ftp_user = cfg.get("deploy", {}).get("beget_ftp_user")
        theme = cfg.get("theme", "alpha")
        print(f"  Loaded config from {config_path}")

    reg.upsert_site_target(
        args.id,
        args.donor,
        brand_name=brand_name,
        brand_name_full=brand_name_full,
        config_path=str(config_path) if config_path.exists() else None,
        theme=theme,
        metrika_id=metrika_id,
        beget_host=beget_host,
        beget_ftp_user=beget_ftp_user,
    )
    print(f"✓ Site target saved: {args.id}  donor={reg._slug(args.donor)}  brand={brand_name}")


def cmd_list_sites(_args: argparse.Namespace) -> None:
    sites = reg.list_site_targets()
    print(f"\nSite targets ({len(sites)}):\n")
    _print_table(sites, ["id", "donor_id", "brand_name", "theme", "beget_host", "created_at"])
    print()


def cmd_list_runs(args: argparse.Namespace) -> None:
    runs = reg.list_crawl_runs(args.donor)
    print(f"\nCrawl runs ({len(runs)}):\n")
    _print_table(runs, ["id", "donor_id", "mode", "page_count", "credit_cost", "finished_at", "output_dir"])
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="PBN pipeline registry CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="Initialize registry DB")

    p = sub.add_parser("add-donor", help="Add or update a donor")
    p.add_argument("--url", required=True)
    p.add_argument("--niche", default=None)
    p.add_argument("--verdict", choices=["CRAWL", "SKIP", "PENDING"], default="PENDING")
    p.add_argument("--score", type=float, default=None)
    p.add_argument("--notes", default=None)

    sub.add_parser("list-donors", help="List all donors")

    p = sub.add_parser("add-site", help="Add or update a site target")
    p.add_argument("--id", required=True, help="Site ID (e.g. rostpoisk)")
    p.add_argument("--donor", required=True, help="Donor URL (e.g. https://mosseo.ru)")
    p.add_argument("--brand", default=None, help="Brand name (auto-loaded from site.config.json)")

    sub.add_parser("list-sites", help="List all site targets")

    p = sub.add_parser("list-runs", help="List crawl runs")
    p.add_argument("--donor", default=None, help="Filter by donor id or url")

    args = parser.parse_args()
    {
        "init": cmd_init,
        "add-donor": cmd_add_donor,
        "list-donors": cmd_list_donors,
        "add-site": cmd_add_site,
        "list-sites": cmd_list_sites,
        "list-runs": cmd_list_runs,
    }[args.cmd](args)


if __name__ == "__main__":
    main()
