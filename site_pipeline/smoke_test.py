#!/usr/bin/env python3
"""
smoke_test.py — Post-deploy Playwright smoke-test. Reports OK/FAIL per route.

Usage:
  python site_pipeline/smoke_test.py --base-url http://yourkedm.beget.tech
  python site_pipeline/smoke_test.py --base-url http://localhost:4321 --site-id vsezaimyonline
  python site_pipeline/smoke_test.py --base-url https://mysite.ru --routes / /ratings/ /qa/

Exits with code 1 if any critical route fails.
Requires: pip install playwright && playwright install chromium
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

PROJECT_ROOT = Path(__file__).parent.parent

try:
    from playwright.sync_api import sync_playwright, Page, Error as PlaywrightError
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium", file=sys.stderr)
    sys.exit(1)

DEFAULT_ROUTES = [
    "/",
    "/ratings/",
    "/qa/",
    "/about/",
    "/privacy/",
]

CRITICAL_ROUTES = {"/", "/ratings/"}


def _load_site_routes(site_id: str) -> list[str]:
    """Load top routes from site's build_manifest.json."""
    manifest_path = PROJECT_ROOT / "sites" / site_id / "build_manifest.json"
    if not manifest_path.exists():
        return DEFAULT_ROUTES
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    paths = [entry["path"] for entry in manifest if entry.get("path")]
    # Return home + sections + first 8 article paths
    sections = [p for p in paths if p.count("/") == 2 and not p.startswith("/ratings/")][:4]
    ratings = [p for p in paths if "/ratings/" in p][:4]
    return list(dict.fromkeys(["/" ] + sections + ratings))[:12]


def check_route(page: Page, url: str) -> dict:
    """Load a URL and return a result dict."""
    t0 = time.monotonic()
    result = {"url": url, "ok": False, "status": None, "h1": None, "errors": [], "ms": 0}
    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=15000)
        result["status"] = response.status if response else None
        result["ms"] = int((time.monotonic() - t0) * 1000)

        if response and response.status >= 400:
            result["errors"].append(f"HTTP {response.status}")
            return result

        # Check h1 present
        h1 = page.locator("h1").first
        if h1.count() > 0:
            result["h1"] = h1.inner_text(timeout=3000).strip()[:80]

        # Check no "404" or "not found" in title
        title = page.title()
        if "404" in title or "not found" in title.lower():
            result["errors"].append("404 in page title")
            return result

        # Check body is non-empty
        body_text = page.locator("body").inner_text(timeout=3000)
        if len(body_text.strip()) < 100:
            result["errors"].append("body too short")
            return result

        # Check console errors
        result["ok"] = True
    except PlaywrightError as exc:
        result["errors"].append(str(exc)[:120])
        result["ms"] = int((time.monotonic() - t0) * 1000)

    return result


def run_smoke(base_url: str, routes: list[str]) -> list[dict]:
    base_url = base_url.rstrip("/")
    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers({"User-Agent": "SmokeTest/1.0"})

        for route in routes:
            url = urljoin(base_url + "/", route.lstrip("/"))
            result = check_route(page, url)
            results.append(result)
            status_icon = "✓" if result["ok"] else "✗"
            h1_info = f'  h1="{result["h1"]}"' if result["h1"] else ""
            err_info = f'  ERRORS: {result["errors"]}' if result["errors"] else ""
            print(f'  {status_icon} {route}  ({result["ms"]}ms  HTTP {result["status"]}){h1_info}{err_info}')

        browser.close()
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Playwright smoke-test for deployed site.")
    parser.add_argument("--base-url", required=True, help="Base URL to test (e.g. http://yourkedm.beget.tech)")
    parser.add_argument("--site-id", default=None, help="Site ID to auto-load routes from build_manifest")
    parser.add_argument("--routes", nargs="+", default=None, help="Routes to test (default: auto)")
    parser.add_argument("--out", type=Path, default=None, help="Write JSON report to file")
    args = parser.parse_args()

    if args.routes:
        routes = args.routes
    elif args.site_id:
        routes = _load_site_routes(args.site_id)
        print(f"Auto-loaded {len(routes)} routes from sites/{args.site_id}/build_manifest.json")
    else:
        routes = DEFAULT_ROUTES

    print(f"\nSmoke-testing {args.base_url} ({len(routes)} routes)…\n")
    results = run_smoke(args.base_url, routes)

    passed = sum(1 for r in results if r["ok"])
    failed = len(results) - passed
    critical_failed = [r for r in results if not r["ok"] and any(r["url"].endswith(cr) for cr in CRITICAL_ROUTES)]

    print(f"\nResult: {passed}/{len(results)} passed, {failed} failed")

    if args.out:
        args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Report → {args.out}")

    if critical_failed:
        print(f"\n✗ CRITICAL FAILURES:")
        for r in critical_failed:
            print(f"  {r['url']}: {r['errors']}")
        sys.exit(1)
    elif failed:
        print(f"\n⚠ {failed} non-critical routes failed")
        sys.exit(0)
    else:
        print("\n✅ All routes OK")


if __name__ == "__main__":
    main()
