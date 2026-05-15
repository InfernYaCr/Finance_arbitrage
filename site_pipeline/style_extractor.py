#!/usr/bin/env python3
"""
style_extractor.py — Extract donor_style_profile from a donor website's CSS.

Fetches the donor's homepage, discovers linked stylesheets, parses them for
color, font, and radius tokens, and writes a donor_style_profile.json plus an
optional generated theme CSS file.

Usage:
  python site_pipeline/style_extractor.py --url https://vsezaimyonline.ru
  python site_pipeline/style_extractor.py --url https://vsezaimyonline.ru --out sites/vsezaimyonline/donor_style_profile.json
  python site_pipeline/style_extractor.py --url https://vsezaimyonline.ru --emit-theme sites/vsezaimyonline/theme_donor.css
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: install dependencies: pip install requests beautifulsoup4", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(__file__).parent.parent

# CSS color patterns
_HEX_RE = re.compile(r"#([0-9a-fA-F]{3,8})\b")
_RGB_RE = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")
_FONT_FAMILY_RE = re.compile(r"font-family\s*:\s*([^;}{]+)", re.IGNORECASE)
_BORDER_RADIUS_RE = re.compile(r"border-radius\s*:\s*([\d.]+(?:px|rem|em))", re.IGNORECASE)
_BACKGROUND_RE = re.compile(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))", re.IGNORECASE)
_COLOR_RE = re.compile(r"(?:^|[^-])color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))", re.IGNORECASE)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StyleExtractor/1.0)"}
TIMEOUT = 15


def _fetch(url: str) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"  WARN: could not fetch {url}: {e}", file=sys.stderr)
        return None


def _discover_stylesheet_urls(base_url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for tag in soup.find_all("link", rel=lambda r: r and "stylesheet" in r):
        href = tag.get("href")
        if href:
            urls.append(urljoin(base_url, href))
    return urls[:8]  # limit to first 8 stylesheets


def _hex_to_rgb(h: str) -> tuple[int, int, int] | None:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) == 6:
        try:
            return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        except ValueError:
            return None
    return None


def _luminance(r: int, g: int, b: int) -> float:
    def chan(c: int) -> float:
        v = c / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)


def _classify_colors(hexes: list[str]) -> dict[str, str]:
    """Heuristically classify extracted hex colors into bg/text/accent roles."""
    parsed: list[tuple[str, tuple[int, int, int], float]] = []
    for h in hexes:
        rgb = _hex_to_rgb(h)
        if rgb:
            parsed.append((h, rgb, _luminance(*rgb)))

    if not parsed:
        return {}

    parsed.sort(key=lambda x: x[2])  # darkest first

    bg_candidates = [p for p in parsed if p[2] > 0.8]
    dark_candidates = [p for p in parsed if p[2] < 0.1]
    mid_candidates = [p for p in parsed if 0.05 < p[2] < 0.7]

    result: dict[str, str] = {}
    if bg_candidates:
        result["bg"] = bg_candidates[-1][0]  # lightest
    if dark_candidates:
        result["text"] = dark_candidates[0][0]  # darkest
    if mid_candidates:
        # pick most saturated mid-range color as accent
        def saturation(rgb: tuple[int, int, int]) -> float:
            r, g, b = (c / 255 for c in rgb)
            mx, mn = max(r, g, b), min(r, g, b)
            return (mx - mn) / mx if mx else 0

        mid_candidates.sort(key=lambda x: saturation(x[1]), reverse=True)
        result["accent"] = mid_candidates[0][0]

    return result


def extract_profile(donor_url: str) -> dict:
    """Fetch donor homepage + stylesheets and extract style tokens."""
    parsed = urlparse(donor_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    print(f"Fetching homepage: {donor_url}")
    html = _fetch(donor_url)
    if not html:
        return {}

    # Collect inline <style> tags from homepage HTML
    soup = BeautifulSoup(html, "html.parser")
    all_css = "\n".join(tag.get_text() for tag in soup.find_all("style"))

    css_urls = _discover_stylesheet_urls(donor_url, html)
    print(f"Found {len(css_urls)} external stylesheets")
    for url in css_urls:
        print(f"  Fetching {url}")
        css = _fetch(url)
        if css:
            all_css += css + "\n"

    if not all_css.strip():
        return {}

    # Extract colors
    hex_colors: list[str] = [f"#{m.group(1).upper()}" for m in _HEX_RE.finditer(all_css)]
    # Deduplicate, keep order
    seen: set[str] = set()
    unique_hex: list[str] = []
    for c in hex_colors:
        h = c.upper()
        if h not in seen and h not in {"#FFF", "#FFFFFF", "#000", "#000000"}:
            seen.add(h)
            unique_hex.append(h)

    color_roles = _classify_colors(unique_hex[:60])

    # Extract font families
    fonts: list[str] = []
    for m in _FONT_FAMILY_RE.finditer(all_css):
        raw = m.group(1).strip().split(",")[0].strip().strip("'\"")
        if raw and raw.lower() not in {"inherit", "initial", "unset", "revert"} and raw not in fonts:
            fonts.append(raw)

    # Extract border-radius samples
    radii: list[str] = list({m.group(1) for m in _BORDER_RADIUS_RE.finditer(all_css)})[:5]

    profile = {
        "donor_url": donor_url,
        "color_roles": color_roles,
        "top_colors": unique_hex[:20],
        "font_families": fonts[:4],
        "border_radii": sorted(radii),
    }
    return profile


def emit_theme_css(profile: dict, theme_name: str = "donor") -> str:
    """Generate a minimal CSS theme file from a style profile."""
    roles = profile.get("color_roles", {})
    fonts = profile.get("font_families", [])
    radii = profile.get("border_radii", [])

    bg = roles.get("bg", "#ffffff")
    text = roles.get("text", "#1a1a1a")
    accent = roles.get("accent", "#2563eb")

    font_stack = ", ".join(f'"{f}"' for f in fonts[:2]) + ", ui-sans-serif, system-ui, sans-serif" if fonts else "ui-sans-serif, system-ui, sans-serif"

    radius_md = radii[len(radii) // 2] if radii else "0.5rem"
    radius_lg = radii[-1] if len(radii) > 1 else "0.75rem"

    return f""":root[data-theme='{theme_name}'] {{
  /* Generated from donor: {profile.get("donor_url", "")} */
  --color-bg: {bg};
  --color-surface: color-mix(in srgb, {bg} 85%, #ccc);
  --color-surface-alt: color-mix(in srgb, {bg} 70%, #ccc);
  --color-text: {text};
  --color-text-muted: color-mix(in srgb, {text} 60%, #888);
  --color-text-light: color-mix(in srgb, {text} 40%, #888);
  --color-accent: {accent};
  --color-accent-hover: color-mix(in srgb, {accent} 85%, #000);
  --color-accent-light: color-mix(in srgb, {accent} 12%, #fff);
  --color-border: color-mix(in srgb, {bg} 60%, #bbb);
  --color-border-strong: color-mix(in srgb, {bg} 30%, #aaa);

  --font-sans: {font_stack};

  --radius-sm: calc({radius_md} * 0.5);
  --radius-md: {radius_md};
  --radius-lg: {radius_lg};
  --radius-xl: calc({radius_lg} * 1.5);
}}
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract donor style profile from CSS.")
    parser.add_argument("--url", required=True, help="Donor homepage URL")
    parser.add_argument("--out", type=Path, default=None, help="Output JSON path (default: stdout)")
    parser.add_argument("--emit-theme", type=Path, default=None, help="Also write a theme CSS file")
    parser.add_argument("--theme-name", default="donor", help="data-theme name for generated CSS")
    args = parser.parse_args()

    profile = extract_profile(args.url)
    if not profile:
        print("ERROR: could not extract profile", file=sys.stderr)
        sys.exit(1)

    json_out = json.dumps(profile, ensure_ascii=False, indent=2) + "\n"

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json_out, encoding="utf-8")
        print(f"✓ Profile written → {args.out}")
    else:
        print(json_out)

    if args.emit_theme:
        css = emit_theme_css(profile, args.theme_name)
        args.emit_theme.parent.mkdir(parents=True, exist_ok=True)
        args.emit_theme.write_text(css, encoding="utf-8")
        print(f"✓ Theme CSS written → {args.emit_theme}")


if __name__ == "__main__":
    main()
