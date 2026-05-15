#!/usr/bin/env python3
"""
create_site.py — PBN orchestrator. One command from donor URL to preview.

Usage:
  python create_site.py --donor https://vsezaimyonline.ru --niche finance \\
      --site-id myzaimy --brand "МойЗайм"

  # Skip crawl if pages already downloaded:
  python create_site.py --donor https://vsezaimyonline.ru --niche finance \\
      --site-id myzaimy --brand "МойЗайм" --skip-crawl

  # Start preview server after build:
  python create_site.py ... --preview

Typical time: ~20 min machine time (crawl) + ~1 min (build).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).parent


def _slug(url: str) -> str:
    """Convert a URL to a registry donor slug (host with dots→hyphens)."""
    host = urlparse(url).netloc or url
    return host.replace(".", "-").strip("-")


def _run(cmd: list[str], *, desc: str, cwd: Path | None = None) -> None:
    """Run a subprocess, print timing, exit on failure."""
    print(f"\n▶ {desc}")
    print(f"  $ {' '.join(cmd)}")
    t0 = time.monotonic()
    result = subprocess.run(cmd, cwd=cwd or PROJECT_ROOT)
    elapsed = time.monotonic() - t0
    if result.returncode != 0:
        sys.exit(f"\n✗ Step failed (exit {result.returncode}): {desc}")
    print(f"  ✓ Done in {elapsed:.1f}s")


def _venv_python() -> str:
    venv = PROJECT_ROOT / ".venv" / "bin" / "python"
    if venv.exists():
        return str(venv)
    return "python3"


def scaffold_site_config(
    site_id: str,
    donor_url: str,
    niche_data: dict,
    brand_name: str,
    brand_name_full: str | None,
) -> None:
    """Create sites/<site_id>/ with site.config.json, affiliateLinks.json, promoSlots.json."""
    site_dir = PROJECT_ROOT / "sites" / site_id
    site_dir.mkdir(parents=True, exist_ok=True)

    donor_id = _slug(donor_url)
    host = urlparse(donor_url).netloc or donor_url
    site_cfg = site_dir / "site.config.json"

    # Determine section_labels from niche profile for SECTION_LABELS override in generate_nav
    site_labels = niche_data.get("section_labels", {})

    config = {
        "site_id": site_id,
        "donor_id": donor_id,
        "brand": {
            "name": brand_name,
            "name_full": brand_name_full or f"{brand_name} — {niche_data.get('description', '')}",
            "aliases": [
                host,
                host.replace("www.", ""),
            ],
        },
        "contacts": {
            "phone": "",
            "phone_href": "",
            "phone_label": "",
            "email": "",
            "address": "",
            "worktime": "",
        },
        "form": {
            "action": "/mail.php",
            "to": "",
            "subject": f"Новая заявка с сайта {brand_name}",
        },
        "analytics": {
            "metrika_id": "",
            "gtag_id": "",
        },
        "deploy": {
            "site_url": "",
            "beget_host": "",
            "beget_ftp_user": "",
            "beget_ftp_path": "/",
        },
        "theme": niche_data.get("site", {}).get("theme", "alpha"),
        "enable_editorial_posts": False,
        "contact_path": niche_data.get("site", {}).get("contact_path", "/kontakty/"),
        "content_dir": f"../sites/{site_id}",
        "legacy_source_domain": donor_url,
        "legacy_brand_aliases": ",".join(
            [host, host.replace("www.", "")]
        ),
        "niche": niche_data.get("niche_id", ""),
        "section_labels_override": site_labels,
        "site_stats": niche_data.get("site_stats", []),
        "niche_cta": niche_data.get("niche_cta", {}),
    }

    site_cfg.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  ✓ Created {site_cfg}")

    for fname, content in [("affiliateLinks.json", "[]"), ("promoSlots.json", "[]")]:
        p = site_dir / fname
        if not p.exists():
            p.write_text(content + "\n", encoding="utf-8")
            print(f"  ✓ Created {p}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="PBN orchestrator — scaffold + crawl + build one site end-to-end.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--donor", required=True, help="Donor site URL, e.g. https://vsezaimyonline.ru")
    parser.add_argument("--niche", required=True, help="Niche ID from niches/<id>.json (e.g. finance, seo)")
    parser.add_argument("--site-id", required=True, help="New site ID, e.g. myzaimy")
    parser.add_argument("--brand", required=True, help="Brand name displayed on site, e.g. МойЗайм")
    parser.add_argument("--brand-full", default=None, help="Full brand name (optional)")
    parser.add_argument("--limit", type=int, default=150, help="Max pages to crawl (default: 150)")
    parser.add_argument("--skip-crawl", action="store_true", help="Skip crawl step (use existing pages)")
    parser.add_argument("--recrawl", action="store_true", help="Re-crawl donor: overwrite existing pages, then rebuild")
    parser.add_argument("--skip-build", action="store_true", help="Skip Astro build step")
    parser.add_argument("--preview", action="store_true", help="Start preview server after build")
    parser.add_argument("--min-chars", type=int, default=500, help="Min content chars for index/nav (default: 500)")
    args = parser.parse_args()

    t_start = time.monotonic()
    py = _venv_python()

    # --- Load niche profile ---
    from niche_profile import load_niche
    try:
        niche = load_niche(args.niche)
    except FileNotFoundError as exc:
        sys.exit(str(exc))

    print(f"\n{'='*60}")
    print(f"  PBN create_site")
    print(f"  Site:   {args.site_id}")
    print(f"  Donor:  {args.donor}")
    print(f"  Niche:  {args.niche} ({niche.label})")
    print(f"  Brand:  {args.brand}")
    print(f"{'='*60}")

    donor_slug = _slug(args.donor)
    output_dir = f"site_pipeline/output/{donor_slug}"

    # --- Step 1: Scaffold site config ---
    print("\n[1/5] Scaffolding site config…")
    scaffold_site_config(
        site_id=args.site_id,
        donor_url=args.donor,
        niche_data={
            "niche_id": niche.niche_id,
            "description": niche.description,
            "site": {"theme": niche.site.theme, "contact_path": niche.site.contact_path},
            "section_labels": niche.section_labels,
            "site_stats": niche.site_stats,
            "niche_cta": {
                "article_question": niche.niche_cta.article_question,
                "article_btn":      niche.niche_cta.article_btn,
                "sidebar_title":    niche.niche_cta.sidebar_title,
                "sidebar_desc":     niche.niche_cta.sidebar_desc,
                "sidebar_btn":      niche.niche_cta.sidebar_btn,
            },
        },
        brand_name=args.brand,
        brand_name_full=args.brand_full,
    )

    # --- Step 2: Crawl ---
    do_crawl = not args.skip_crawl
    if args.recrawl:
        do_crawl = True
        print(f"\n[2/5] Re-crawling {args.donor} (--recrawl: existing pages will be overwritten)…")
    elif do_crawl:
        print(f"\n[2/5] Crawling {args.donor}…")

    if do_crawl:
        crawl_cmd = [
            py, "site_pipeline/crawl_pages_fc.py",
            "--source-domain", args.donor,
            "--limit", str(args.limit),
            "--output-dir", output_dir,
        ]
        if niche.crawl.include_sections:
            crawl_cmd += ["--include-sections", ",".join(niche.crawl.include_sections)]
        if niche.crawl.smart_actions:
            crawl_cmd += ["--smart-actions"]
        _run(crawl_cmd, desc=f"Firecrawl: {args.donor} → {output_dir}")
    else:
        print(f"\n[2/5] Crawl skipped (--skip-crawl). Using {output_dir}")

    # --- Step 3: Build content index ---
    print(f"\n[3/5] Building content index (min-chars={args.min_chars})…")
    _run(
        [py, "site_pipeline/build_content_index.py",
         "--out", output_dir,
         "--min-chars", str(args.min_chars)],
        desc="build_content_index",
    )

    # --- Step 4: Export site ---
    print(f"\n[4/5] Exporting site {args.site_id}…")
    _run(
        [py, "export_site.py", "--site-id", args.site_id, "--output-dir", output_dir],
        desc="export_site",
    )

    # --- Step 5: Astro build ---
    if not args.skip_build:
        print(f"\n[5/5] Building Astro site…")
        env_cmd = ["/bin/bash", "gen-env.sh", args.site_id]
        _run(env_cmd, desc="gen-env.sh")
        _run(
            ["npm", "run", "build"],
            desc="npm run build",
            cwd=PROJECT_ROOT / "site",
        )
    else:
        print(f"\n[5/5] Build skipped (--skip-build).")

    elapsed_total = time.monotonic() - t_start
    print(f"\n{'='*60}")
    print(f"  ✅ Site {args.site_id!r} ready in {elapsed_total/60:.1f} min")
    print(f"  Preview: ./build-all.sh {args.site_id} --preview")
    print(f"  Config:  sites/{args.site_id}/site.config.json")
    print(f"  Next: fill contacts, metrika_id, deploy settings")
    print(f"{'='*60}")

    if args.preview:
        _run(
            ["/bin/bash", "build-all.sh", args.site_id, "--preview"],
            desc="Start preview server",
        )


if __name__ == "__main__":
    main()
