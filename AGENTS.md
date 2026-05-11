<claude-mem-context>
# Memory Context

# [mosseo-site-pipeline] recent context, 2026-05-11 8:35pm GMT+3

No previous sessions found.
</claude-mem-context>

# Mosseo Site Pipeline — Agent Guide

This document is for AI agents (Claude, Codex, etc.) working on this project.
Read `HANDOFF.md` for current status. Read `CLAUDE.md` for quick commands.

## What this project is

A content pipeline + Astro static site that turns a Mosseo (mosseo.ru) CSV
export into a white-label SEO-agency website. The site is deployed to Beget
hosting at `yourkedm.beget.tech` and uses the test brand "Тестовый SEO-проект"
until real brand details are configured via env vars.

## Architecture in one paragraph

`site_pipeline/` scripts crawl mosseo.ru pages, extract content into 1013 JSON
files under `site_pipeline/output/pages/`, and build indexes
(`build_manifest.json`, `content_index.sqlite`). The `site/` Astro project
reads those JSON files at build time via `site/src/data/loadPages.ts`, maps
paths to page types via `site/src/lib/routing.ts`, derives SEO fields via
`site/src/lib/seo.ts`, and renders each page through one of the layout
components in `site/src/layouts/`.

## Key files agents need

| File | Purpose |
|---|---|
| `site/src/data/siteConfig.ts` | Brand, contacts, nav, analytics, social — all from env vars |
| `site/src/data/loadPages.ts` | Loads page JSON, normalises brand/contacts/media at runtime |
| `site/src/lib/routing.ts` | `getPageType()` maps path+section → pageType string |
| `site/src/lib/seo.ts` | `deriveSeoFields()` builds title, h1, description, breadcrumbs |
| `site/src/lib/schema.ts` | `buildJsonLd()` emits JSON-LD per page type |
| `site/src/pages/[...slug].astro` | Route generator — maps pageType to layout |
| `site/src/components/Header.astro` | Double-row header: topbar (phones/email/socials) + nav with dropdowns |
| `site/src/components/Footer.astro` | Footer: logo, nav list, copyright |
| `site/src/components/PromoSlot.astro` | Affiliate/promo slot component (config-driven) |
| `site/src/styles/global.css` | Design tokens + legacy WP class styles |

## Layout map

| Layout | pageType(s) | What it renders |
|---|---|---|
| `HomeLayout` | `home` | Hero → Stats bar → Nav grid → Process steps → Cases → FAQ → CTA |
| `ArticleLayout` | `article`, `company`, `content_page` | Breadcrumbs, h1, date, excerpt, body, PromoSlot, CTA block |
| `ArchiveLayout` | `archive`, `dictionary_archive` | Child page list + CTA banner |
| `ServiceLayout` | `service` | Hero (h1 + lead + CTA btn) + prose body + PromoSlot + CTA banner |
| `PortfolioLayout` | `portfolio_archive`, `portfolio_case` | Archive: child case grid / Case: content + footer links |
| `FaqLayout` | `faq` | Badge, h1, content body, PromoSlot, footer link |
| `DictionaryLayout` | `dictionary_article` | Badge, h1, definition, content body, back link |
| `ContactLayout` | `contact` | Two-column grid: contact form (left) + info card (right) |

## Critical rules — never violate these

1. **Never edit `site_pipeline/output/pages/*.json`** for design, brand,
   contacts, or media changes. These are generated artifacts.
2. **Brand and contacts are normalised at render time** in `loadPages.ts`.
   Change them in env vars / `siteConfig.ts`, not in JSON files.
3. **Old Mosseo media** (`/content/`, `/wp-content/`) is replaced with
   `/images/placeholder.svg` unless `PUBLIC_LEGACY_MEDIA_MODE=local`.
4. **Do not inject `content_html` from contact/home pages** via `set:html` —
   the extracted WordPress HTML for these pages contains nested `<div class="container">`
   blocks that break the outer layout via the HTML parser. These pages use
   structured components instead.
5. **`site/scripts/download-images.sh`** and **`site/scripts/ru-images.txt`**
   may be user/other-agent work — do not overwrite without checking.
6. **Before broad layout changes**, run `python site_pipeline/audit_page_templates.py`
   to understand the template distribution (service_catalog vs content_article etc.).

## siteConfig env vars (important additions from v2)

```bash
PUBLIC_COMPANY_PHONE_LABEL="звонок по РФ бесплатный"
PUBLIC_COMPANY_PHONE2=""          # second phone, hidden if empty
PUBLIC_COMPANY_PHONE2_HREF=""
PUBLIC_COMPANY_PHONE2_LABEL=""
PUBLIC_COMPANY_TELEGRAM=""        # Telegram username, hidden if empty
PUBLIC_SOCIAL_VK=""               # VK page URL, hidden if empty
PUBLIC_SOCIAL_TG=""               # Telegram channel URL, hidden if empty
PUBLIC_SOCIAL_OK=""               # OK page URL, hidden if empty
```

## What has been implemented (as of 2026-05-11)

- Full Astro site with 8 page layouts covering all 1011 buildable routes
- Double-row header: topbar with phones/email/callback/socials + main nav row
  with dropdown menus; topbar hidden on mobile (≤900px)
- Homepage: structured sections (hero, stats, nav-grid, process steps, case
  cards from `/portfolio/` children, FAQ from `/faq/` children, CTA)
- ContactLayout: rebuilt without `content_html` injection — form + blue info card
  in CSS grid; no HTML parser breakage
- PortfolioLayout archive mode: live grid from `getImmediateChildPages()`
- Routing fix: `portfolio_archive` → `PortfolioLayout` (was wrongly → `ArchiveLayout`)

## What is planned next (staged plan)

See the plan in the last session or reconstruct from this priority order:

**Этап 1 — Critical gaps**
1. Footer: expand to 4-column layout (brand | services | sections | contacts+social)
2. ServiceLayout: detect child pages and show service card grid in archive mode
3. ArchiveLayout: replace `content_html` with `getImmediateChildPages()` card grid

**Этап 2 — Homepage + content enrichment**
4. Homepage: add services grid block (children of `/seo-uslugi/`)
5. Homepage: add "Почему мы" / USP section
6. ArticleLayout: add sidebar with related articles from same section

**Этап 3 — Mobile**
7. Header: verify and fix burger menu (open/close, dropdown accordion, aria)
8. Global mobile breakpoints audit (container padding, tap targets ≥44px)
9. Per-layout mobile fixes (process grid, stats, CTA flex)

**Этап 4 — Polish**
10. FAQ archive: accordion instead of list of links
11. Portfolio case: results/metrics block
12. Pricing page: tariff table/cards
13. 404 page styling
14. "О компании" dedicated layout or enriched ArticleLayout

## Deploy

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run build && npm run deploy
```

Requires `site/.env` (not committed). Disable iCloud Private Relay before FTP.
Test URL: http://yourkedm.beget.tech/

## jcodemunch index

```
repo: local/mosseo-site-pipeline-db570d70
```

Use `mcp__jcodemunch__search_symbols` and `mcp__jcodemunch__get_symbol_source`
before reading files — saves context on large codebases.
