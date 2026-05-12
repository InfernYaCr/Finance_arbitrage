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

## Roadmap

Полный план — см. `ROADMAP.md` в корне проекта.

Два трека:
- **Трек A** — UI сайта: Footer → ServiceLayout → ArchiveLayout → Homepage USP → Mobile → Polish
- **Трек B** — PBN-инфраструктура: Multi-donor pipeline → Batch deploy → Темы → Link config → MCP воркфлоу

**Текущий приоритет: A1.1 — Footer (4-колоночный подвал)**

Порядок всегда: завершить текущий этап A → следующий этап A → затем B1 → B2 → ...
При старте новой сессии: читать `ROADMAP.md`, брать первую `[ ]` задачу.

## Deploy

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run build && npm run deploy
```

Requires `site/.env` (not committed). Disable iCloud Private Relay before FTP.
Test URL: http://yourkedm.beget.tech/

## MCP servers

### Активны в каждой сессии (встроенные)

| MCP | Инструменты | Назначение |
|---|---|---|
| jcodemunch | `mcp__jcodemunch__*` | Индексация кода. Репо: `local/mosseo-site-pipeline-db570d70` |
| context7 | `mcp__context7__*` | Документация библиотек |
| claude-mem | `mcp__plugin_claude-mem_mcp-search__*` | Память между сессиями |
| Claude_Preview | `mcp__Claude_Preview__*` | Превью локального Astro-сайта |
| Claude_in_Chrome | `mcp__Claude_in_Chrome__*` | Браузерная автоматизация |

### Настроены в `.mcp.json` (активируются при рестарте Claude Code)

| MCP | Зачем | Требует |
|---|---|---|
| firecrawl | Краулинг новых донор-сайтов для PBN | `FIRECRAWL_API_KEY` (firecrawl.dev) |
| exa | Поиск доноров по нишам, анализ конкурентов | `EXA_API_KEY` (exa.ai) |
| playwright | Автотест задеплоенных сайтов | — |
| filesystem | Управление конфигами N сайтов | — |

API ключи добавлять в `site/.env`. Файл конфига: `.mcp.json` в корне проекта.

### jcodemunch — как пользоваться

```
repo: local/mosseo-site-pipeline-db570d70
```

Всегда запускать `mcp__jcodemunch__search_symbols` / `mcp__jcodemunch__get_symbol_source`
перед чтением файлов — экономит контекст.
