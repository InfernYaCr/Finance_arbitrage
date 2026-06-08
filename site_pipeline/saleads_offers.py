#!/usr/bin/env python3
"""
saleads_offers.py — read-only client for the Saleads.pro webmaster API.

Saleads API (https://saleads.pro/api/v1) is GET-only for webmasters:
offers, offer detail, stands (placements), connectors (tracking links),
clicks (stats). Creating stands/connectors is POST → 401, i.e. done in the
web LK, not via API. Server-side filtering is not supported (count stays
constant regardless of query filters), so we fetch all and filter locally.

Auth: token as GET param `token=` against host `saleads.pro` directly.
(The `my.saleads.pro` host 302-redirects and drops the Authorization header,
so we hit `saleads.pro` to keep the token.)

Usage:
  python site_pipeline/saleads_offers.py offers            # list all offers
  python site_pipeline/saleads_offers.py financial --top 30
  python site_pipeline/saleads_offers.py offer <uuid>      # full detail
  python site_pipeline/saleads_offers.py connectors        # tracking links
  python site_pipeline/saleads_offers.py clicks            # click/conversion stats
  python site_pipeline/saleads_offers.py export-links --out sites/finhelp-ru/saleads_links.json

Requires SALEADS_API_KEY in environment or site/.env.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

API_BASE = "https://saleads.pro/api/v1"

# geo id → name (from observed catalogue; id 1 dominates = Russia).
GEO_NAMES = {1: "Россия"}

# Offer names matching this are treated as financial vertical.
_FIN_RE = re.compile(
    r"займ|за[её]м|кредит|карт|МФО|банк|ипотек|рефинанс|вклад|loan|РКО|дебетов|банкрот"
    r"|инвест|брокер|накоплен|сбережен|финанс",
    re.IGNORECASE,
)

# Insurance vertical (ОСАГО/КАСКО/полисы/страхование жизни и имущества).
_INS_RE = re.compile(
    r"страх|осаго|каско|полис|антиклещ|cherehapa|черехапа|mafin|мафин"
    r"|выезжающ|ингосстрах|ренессанс жизн|пари ",
    re.IGNORECASE,
)

# HR / jobs / gig offers that share finance brand names (e.g. "Альфа Банк ... HR")
# but must NOT land on a finance/insurance content site.
_JOBS_RE = re.compile(
    r"\bHR\b|трудоустройств|ваканс|курьер|кладовщик|сборщик|комплектовщик"
    r"|менеджер по привлеч|представитель банка|мобильный банкир|альфа-агент"
    r"|работа в |вышедший сотрудник|стать.* исполнител|подключение мастер",
    re.IGNORECASE,
)

# Telecom / entertainment noise that trips finance keywords ("SIM-карта", "Т-Банк Афиша").
_NOISE_RE = re.compile(
    r"sim-карт|sim карт|симкарт|т2 |афиша|билет",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Env / token
# ---------------------------------------------------------------------------

def _load_env() -> None:
    site_env = Path(__file__).parent.parent / "site" / ".env"
    if not site_env.exists():
        return
    for line in site_env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if m:
            os.environ.setdefault(m.group(1), m.group(2).strip().strip("'\""))


def _token() -> str:
    token = os.environ.get("SALEADS_API_KEY") or os.environ.get("SALEADS_TOKEN")
    if not token:
        sys.exit(
            "SALEADS_API_KEY not set. Add it to site/.env or the environment."
        )
    return token


# ---------------------------------------------------------------------------
# HTTP (stdlib only, matches the no-deps style of the pipeline)
# ---------------------------------------------------------------------------

import time


def _get(path: str, **params: Any) -> dict[str, Any]:
    params["token"] = _token()
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"{API_BASE}{path}?{query}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        body = resp.read().decode("utf-8")
    return json.loads(body)


def _post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """POST with token as query param (mirrors GET auth pattern)."""
    token = _token()
    url = f"{API_BASE}{path}?token={urllib.parse.quote(token)}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        body = resp.read().decode("utf-8")
    return json.loads(body)


def _get_all(path: str, page_size: int = 1000) -> list[dict[str, Any]]:
    """Paginate through a list endpoint (offset/limit/count/data)."""
    out: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = _get(path, offset=offset, limit=page_size)
        data = page.get("data", []) or []
        out.extend(data)
        total = int(page.get("count", len(out)))
        offset += page_size
        if offset >= total or not data:
            break
    return out


# ---------------------------------------------------------------------------
# Domain helpers
# ---------------------------------------------------------------------------

def _goals(offer: dict[str, Any]) -> list[dict[str, Any]]:
    return [g for g in offer.get("goals", []) or [] if isinstance(g, dict)]


def _best_rub_payout(offer: dict[str, Any]) -> float:
    prices = [
        g["price"] for g in _goals(offer)
        if g.get("currency") == "RUB" and isinstance(g.get("price"), (int, float))
    ]
    return max(prices) if prices else 0.0


def is_financial(offer: dict[str, Any]) -> bool:
    return bool(_FIN_RE.search(offer.get("name", "")))


def is_insurance(offer: dict[str, Any]) -> bool:
    return bool(_INS_RE.search(offer.get("name", "")))


def is_jobs(offer: dict[str, Any]) -> bool:
    """HR / gig-work offers that must be excluded from a finance/insurance site."""
    return bool(_JOBS_RE.search(offer.get("name", "")))


def is_site_relevant(offer: dict[str, Any]) -> bool:
    """Finance OR insurance, excluding HR/jobs and telecom/entertainment noise."""
    name = offer.get("name", "")
    if _JOBS_RE.search(name) or _NOISE_RE.search(name):
        return False
    return bool(_FIN_RE.search(name) or _INS_RE.search(name))


def vertical_of(offer: dict[str, Any]) -> str:
    """Coarse vertical tag for per-site filtering and promo-slot routing."""
    name = offer.get("name", "")
    if _JOBS_RE.search(name):
        return "jobs"
    if _INS_RE.search(name):
        return "insurance"
    if re.search(r"займ|МФО|микро", name, re.IGNORECASE):
        return "mfo"
    if re.search(r"РКО|расчетн|бизнес|регистрац", name, re.IGNORECASE):
        return "business"
    if re.search(r"ипотек", name, re.IGNORECASE):
        return "mortgage"
    if re.search(r"карт", name, re.IGNORECASE):
        return "card"
    if re.search(r"кредит|рефинанс", name, re.IGNORECASE):
        return "credit"
    if re.search(r"банкрот|должник|юридич", name, re.IGNORECASE):
        return "debt_relief"
    if re.search(r"инвест|брокер|вклад|накоплен", name, re.IGNORECASE):
        return "investment"
    if _FIN_RE.search(name):
        return "finance"
    return "other"


def _fmt_payout(offer: dict[str, Any]) -> str:
    parts = []
    for g in _goals(offer):
        cur = g.get("currency", "")
        price = g.get("price")
        if price is None:
            continue
        sym = "₽" if cur == "RUB" else ("%" if cur == "%" else f" {cur}")
        parts.append(f"{price:g}{sym}")
    return " / ".join(parts) if parts else "—"


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_offers(args: argparse.Namespace) -> None:
    offers = _get_all("/offer")
    print(f"Total offers: {len(offers)}")
    for o in offers[: args.limit]:
        geo = ",".join(GEO_NAMES.get(g, str(g)) for g in o.get("geos", []) or [])
        print(f"  [{o['uuid'][:8]}] {o['name'][:64]:<64} {_fmt_payout(o):<22} ({geo})")


def cmd_financial(args: argparse.Namespace) -> None:
    offers = [o for o in _get_all("/offer") if is_financial(o)]
    offers.sort(key=_best_rub_payout, reverse=True)
    print(f"Financial offers: {len(offers)}")
    for o in offers[: args.top]:
        print(f"  {_best_rub_payout(o):>8.0f}₽  [{o['uuid'][:8]}]  {o['name'][:66]}")


def cmd_offer(args: argparse.Namespace) -> None:
    detail = _get(f"/offer/{args.uuid}")
    print(json.dumps(detail, ensure_ascii=False, indent=2))


def cmd_connectors(args: argparse.Namespace) -> None:
    connectors = _get_all("/connector")
    print(f"Connectors (tracking links): {len(connectors)}")
    for c in connectors:
        urls = c.get("urls", []) or []
        link = urls[0].get("url") if urls else ""
        short = urls[0].get("short_url") if urls else ""
        print(f"  offer={c.get('offer_uuid','')[:8]} status={c.get('status','')}")
        print(f"    url:   {link}")
        print(f"    short: {short}")


def cmd_clicks(args: argparse.Namespace) -> None:
    clicks = _get_all("/click")
    total_clicks = sum(int(c.get("num_clicks", 0) or 0) for c in clicks)
    total_conv = sum(len(c.get("conversions", []) or []) for c in clicks)
    print(f"Click records: {len(clicks)} | clicks: {total_clicks} | conversions: {total_conv}")
    for c in clicks[: args.limit]:
        print(
            f"  {c.get('created_at','')[:19]}  offer={c.get('offer_uuid','')[:8]} "
            f"clicks={c.get('num_clicks',0)} conv={len(c.get('conversions',[]) or [])} "
            f"utm={c.get('utm_marks',[])}"
        )


def cmd_export_links(args: argparse.Namespace) -> None:
    """Build affiliateLinks.json entries from connectors + offer payouts.

    Only connectors with status=approve and a tracking URL produce a link.
    Each entry is tagged with `vertical` for per-site/promo-slot routing.
    With --site-relevant, non-finance/insurance offers are skipped.
    """
    offers = {o["uuid"]: o for o in _get_all("/offer")}
    connectors = _get_all("/connector")
    links: list[dict[str, Any]] = []
    for c in connectors:
        offer = offers.get(c.get("offer_uuid", ""), {})
        if args.site_relevant and not is_site_relevant(offer):
            continue
        urls = c.get("urls", []) or []
        if not urls:
            continue
        # Use full UUID url — short_url is unreliable (returns same value for all connectors
        # via list/detail endpoints due to a Saleads API caching issue).
        # The full URL is always unique per connector and works correctly.
        href = urls[0].get("url") or ""
        if not href:
            continue
        name = offer.get("name", "Saleads offer")
        links.append({
            "id": f"saleads-{c.get('offer_uuid','')[:8]}",
            "label": name[:80],
            "href": href,
            "rel": "sponsored nofollow",
            "network": "saleads",
            "vertical": vertical_of(offer),
            "offer_uuid": c.get("offer_uuid", ""),
            "connector_uuid": c.get("uuid", ""),
            "payout": _fmt_payout(offer),
            "enabled": c.get("status") == "approve",
        })
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(links)} links → {out_path}")


def cmd_export_pool(args: argparse.Namespace) -> None:
    """Write the master connector registry (sites/affiliate_pool.json).

    Includes EVERY connector — approved and pending — tagged with vertical and
    status, so per-site link files can be filtered from one source of truth.
    Pending (status=wait) entries have href=null until Saleads issues a URL.
    """
    offers = {o["uuid"]: o for o in _get_all("/offer")}
    connectors = _get_all("/connector")
    pool: list[dict[str, Any]] = []
    for c in connectors:
        offer = offers.get(c.get("offer_uuid", ""), {})
        urls = c.get("urls", []) or []
        href = urls[0].get("url") if urls else None
        pool.append({
            "id": f"saleads-{c.get('offer_uuid','')[:8]}",
            "label": offer.get("name", "Saleads offer")[:80],
            "href": href,
            "network": "saleads",
            "vertical": vertical_of(offer),
            "offer_uuid": c.get("offer_uuid", ""),
            "connector_uuid": c.get("uuid", ""),
            "payout": _fmt_payout(offer),
            "status": c.get("status", ""),
            "enabled": c.get("status") == "approve" and bool(href),
        })
    pool.sort(key=lambda x: (x["vertical"], x["label"]))
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(pool, ensure_ascii=False, indent=2), encoding="utf-8")
    approved = sum(1 for p in pool if p["enabled"])
    print(f"Wrote {len(pool)} connectors ({approved} live, {len(pool)-approved} pending) → {out_path}")


def cmd_connect_missing(args: argparse.Namespace) -> None:
    """Create connectors for finance offers not yet connected.

    Uses /connector/get-or-create so it's safe to re-run — won't duplicate.
    Rate-limited: 2s between requests, 8s back-off on 429.
    """
    all_offers = _get_all("/offer")
    relevant = {o["uuid"]: o for o in all_offers if is_site_relevant(o)}

    connectors = _get_all("/connector")
    connected_uuids = {c.get("offer_uuid") for c in connectors}

    stands = _get_all("/stand")
    if not stands:
        sys.exit("No stands found. Create a stand in Saleads LK first.")
    stand_uuid = stands[0]["uuid"]
    print(f"Stand: {stands[0]['name']} [{stand_uuid[:8]}]")

    missing = [
        o for o in relevant.values()
        if o["uuid"] not in connected_uuids
        and (not o.get("geos") or 1 in (o.get("geos") or []))  # Russia or geo-agnostic
        and _best_rub_payout(o) >= args.min_payout
    ]
    missing.sort(key=_best_rub_payout, reverse=True)
    print(f"Finance/insurance offers to connect: {len(missing)} (min payout {args.min_payout}₽)\n")

    if args.dry_run:
        for o in missing:
            print(f"  DRY-RUN  [{vertical_of(o):<10}] {_best_rub_payout(o):>7.0f}₽  {o['name'][:60]}")
        return

    created, errors = 0, 0
    for i, offer in enumerate(missing):
        print(f"[{i+1}/{len(missing)}] {offer['name'][:60]} ({_best_rub_payout(offer):.0f}₽) ...", end=" ", flush=True)
        retries = 0
        while retries < 2:
            try:
                resp = _post("/connector/get-or-create", {
                    "offer_uuid": offer["uuid"],
                    "stand_uuid": stand_uuid,
                })
                # API returns the connector object (uuid + status) on success, or {errors}.
                # It does not expose a created/existed flag; status="wait" means it now
                # awaits Saleads moderation before a tracking URL is issued.
                if resp.get("errors"):
                    print(f"ERROR: {resp['errors']}")
                    errors += 1
                else:
                    print(f"ok (status={resp.get('status','?')})")
                    created += 1
                break
            except Exception as e:
                body = str(e)
                if "429" in body:
                    print(f"429 rate-limit, waiting 8s...", end=" ", flush=True)
                    time.sleep(8)
                    retries += 1
                else:
                    print(f"ERROR: {e}")
                    errors += 1
                    break
        time.sleep(2)

    print(f"\nDone: ok={created} errors={errors}")
    if created:
        print("New connectors are status=wait (Saleads moderation). Once approved they")
        print("get tracking URLs; then run `export-links` to refresh affiliateLinks.json.")


def main() -> None:
    _load_env()
    parser = argparse.ArgumentParser(description="Saleads.pro webmaster API client (read-only).")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_off = sub.add_parser("offers", help="List all offers")
    p_off.add_argument("--limit", type=int, default=50)
    p_off.set_defaults(func=cmd_offers)

    p_fin = sub.add_parser("financial", help="List financial offers by payout")
    p_fin.add_argument("--top", type=int, default=30)
    p_fin.set_defaults(func=cmd_financial)

    p_one = sub.add_parser("offer", help="Show full offer detail by uuid")
    p_one.add_argument("uuid")
    p_one.set_defaults(func=cmd_offer)

    p_con = sub.add_parser("connectors", help="List connectors (tracking links)")
    p_con.set_defaults(func=cmd_connectors)

    p_clk = sub.add_parser("clicks", help="List click/conversion stats")
    p_clk.add_argument("--limit", type=int, default=50)
    p_clk.set_defaults(func=cmd_clicks)

    p_exp = sub.add_parser("export-links", help="Export connectors to affiliateLinks.json shape")
    p_exp.add_argument("--out", default="sites/finhelp-ru/saleads_links.json")
    p_exp.add_argument("--site-relevant", action="store_true",
                       help="Keep only finance/insurance offers (drop HR/telecom/etc.)")
    p_exp.set_defaults(func=cmd_export_links)

    p_pool = sub.add_parser("export-pool", help="Write master connector registry (all statuses + verticals)")
    p_pool.add_argument("--out", default="sites/affiliate_pool.json")
    p_pool.set_defaults(func=cmd_export_pool)

    p_cm = sub.add_parser("connect-missing", help="Create connectors for unconnected finance/insurance offers")
    p_cm.add_argument("--min-payout", type=float, default=0.0, help="Min RUB payout to include (0 = all)")
    p_cm.add_argument("--dry-run", action="store_true", help="Print what would be created, no API writes")
    p_cm.set_defaults(func=cmd_connect_missing)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
