#!/usr/bin/env python3
"""
extract_offers.py — extract structured product offers from product_review-block
divs in crawled page JSON files and store them in extracted.offers[].

Usage:
    python site_pipeline/extract_offers.py --site-dir sites/vsezaimyonline
    python site_pipeline/extract_offers.py --site-dir sites/vsezaimyonline --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# HTML parsing helpers (no external deps — pure regex on well-known structure)
# ---------------------------------------------------------------------------

def _text(html: str) -> str:
    """Strip HTML tags and normalise whitespace."""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html)).strip()


def _find_blocks(html: str, class_name: str) -> list[str]:
    """Return a list of outer HTML strings for every <div class="class_name...">."""
    results: list[str] = []
    pattern = re.compile(
        r'<div\b[^>]*\bclass="' + re.escape(class_name) + r'[^"]*"[^>]*>',
        re.IGNORECASE,
    )
    for m in pattern.finditer(html):
        start = m.start()
        i = m.end()
        depth = 1
        while i < len(html) and depth > 0:
            nd = html.find('<div', i)
            nc = html.find('</div>', i)
            if nc == -1:
                i = len(html)
                break
            if nd != -1 and nd < nc:
                nte = html.find('>', nd)
                if nte != -1 and re.match(r'<div\b', html[nd:nte + 1], re.I):
                    depth += 1
                    i = nte + 1
                else:
                    i = nd + 1
            else:
                depth -= 1
                i = nc + 6
        results.append(html[start:i])
    return results


def _attr(html: str, tag: str, attr: str) -> str:
    """Extract first occurrence of attribute value from a tag."""
    m = re.search(
        r'<' + tag + r'\b[^>]*\s' + attr + r'=["\']([^"\']*)["\'][^>]*>',
        html, re.IGNORECASE,
    )
    return m.group(1).strip() if m else ''


# ---------------------------------------------------------------------------
# Offer extraction
# ---------------------------------------------------------------------------

def _extract_rank(block: str) -> int | None:
    m = re.search(r'rat-block-sticker[^>]*>.*?(\d+)\s*место', block, re.IGNORECASE | re.DOTALL)
    return int(m.group(1)) if m else None


def _extract_name_logo(block: str) -> tuple[str, str]:
    """Return (product_name, logo_url) from the header img."""
    m = re.search(r'rat-block-header[\s\S]*?<img\b[^>]*>', block, re.IGNORECASE)
    if not m:
        return '', ''
    img_tag = m.group(0)
    name = _attr(img_tag, 'img', 'alt') or _attr(img_tag, 'img', 'title')
    src = _attr(img_tag, 'img', 'src') or _attr(img_tag, 'img', 'data-src')
    return name, src


def _extract_lead(block: str) -> str:
    m = re.search(
        r'<div\b[^>]*\bclass="[^"]*product_review-lead[^"]*"[^>]*>([\s\S]*?)</div>',
        block, re.IGNORECASE,
    )
    if not m:
        return ''
    paras = re.findall(r'<p[^>]*>([\s\S]*?)</p>', m.group(1), re.IGNORECASE)
    return ' '.join(_text(p) for p in paras[:2]).strip()


def _extract_params(block: str) -> dict[str, str]:
    """Parse the rat-block-table key-value rows."""
    params: dict[str, str] = {}
    table_m = re.search(
        r'<div\b[^>]*\bclass="[^"]*rat-block-table[^"]*"[^>]*>([\s\S]*?)</div>\s*</div>',
        block, re.IGNORECASE,
    )
    if not table_m:
        return params
    rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', table_m.group(1), re.IGNORECASE)
    for row in rows:
        cells = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row, re.IGNORECASE)
        if len(cells) >= 2:
            key = _text(cells[0])
            val = _text(cells[1])
            if key:
                params[key] = val
    return params


def _extract_pros_cons(block: str) -> tuple[list[str], list[str]]:
    pm_m = re.search(
        r'<div\b[^>]*\bclass="[^"]*rat-block-pros-minus[^"]*"[^>]*>([\s\S]*)',
        block, re.IGNORECASE,
    )
    if not pm_m:
        return [], []
    pm_html = pm_m.group(1)
    cols = re.findall(r'<div\b[^>]*\bcol\b[^>]*>([\s\S]*?)</div>\s*</div>', pm_html, re.IGNORECASE)
    def _items(html: str) -> list[str]:
        return [_text(li) for li in re.findall(r'<li[^>]*>([\s\S]*?)</li>', html, re.I) if _text(li)]
    pros = _items(cols[0]) if len(cols) > 0 else []
    cons = _items(cols[1]) if len(cols) > 1 else []
    return pros, cons


def _extract_cta(block: str) -> str:
    m = re.search(r'data-href=["\']([^"\']+)["\']', block, re.IGNORECASE)
    return m.group(1).strip() if m else ''


def parse_offers(content_html: str) -> list[dict]:
    blocks = _find_blocks(content_html, 'product_review-block')
    offers: list[dict] = []
    for block in blocks:
        name, logo = _extract_name_logo(block)
        if not name:
            continue
        pros, cons = _extract_pros_cons(block)
        offer: dict = {
            'rank': _extract_rank(block),
            'name': name,
            'logo_url': logo,
            'description': _extract_lead(block),
            'params': _extract_params(block),
            'pros': pros,
            'cons': cons,
            'cta_path': _extract_cta(block),
        }
        offers.append(offer)
    return offers


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description='Extract product offers from crawled pages.')
    parser.add_argument('--site-dir', required=True, help='Path to sites/<id>/ directory')
    parser.add_argument('--dry-run', action='store_true', help='Print stats without writing')
    args = parser.parse_args()

    pages_dir = Path(args.site_dir) / 'pages'
    if not pages_dir.exists():
        sys.exit(f'Pages dir not found: {pages_dir}')

    files = sorted(pages_dir.glob('*.json'))
    total_offers = 0
    updated = 0

    for path in files:
        data: dict = json.loads(path.read_text(encoding='utf-8'))
        content_html: str = data.get('content_html') or ''
        if 'product_review-block' not in content_html:
            continue

        offers = parse_offers(content_html)
        if not offers:
            continue

        if not args.dry_run:
            if not isinstance(data.get('extracted'), dict):
                data['extracted'] = {}
            data['extracted']['offers'] = offers
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

        total_offers += len(offers)
        updated += 1
        print(f'  {path.name}: {len(offers)} offers')
        for o in offers[:3]:
            print(f'    [{o["rank"]}] {o["name"]} | params: {list(o["params"].keys())[:4]}')

    print(f'\n{"[DRY RUN] " if args.dry_run else ""}Done: {updated} pages, {total_offers} offers total')


if __name__ == '__main__':
    main()
