<claude-mem-context>
# Memory Context

# [mosseo-site-pipeline] recent context, 2026-05-13 1:31am GMT+3

No previous sessions found.
</claude-mem-context>

# Mosseo Site Pipeline — Agent Guide

> **Активный сайт — rencredit-online.ru. Точка входа: `AGENT_HANDOFF.md`**, правила и харнесс — начало `CLAUDE.md`. Остальное в этом файле — legacy (finhelp-ru/mosseo).

## Новый фронт web/ (пилот rencredit)

Пилот rencredit-online.ru живёт в `web/` (Astro 7 + Tailwind 4 + GSAP; пакеты `@pbn/core`, `@pbn/motion`). Контент это markdown/JSON в content collections (`web/apps/rencredit/src/content`, схемы в `src/content.config.ts`), без краулинга донора. Старые `site/` и `site_pipeline/` без изменений.

- Проверка: `node scripts/check.mjs --quick` (быстро), `node scripts/check.mjs` (с build и dist). Dev: `npm --prefix web run dev -- --port 4321`.
- Харнесс Claude Code: `.claude/` (хук `guard.py`, скиллы, агенты, команды). Карта: `docs/harness/README.md`, окружение Windows/Python: `docs/harness/ENV.md`. Подробнее в `CLAUDE.md` (блок в начале).
- Запреты: не читать `.env`, не `git push`, не править `sites/*/pages/*.json`, не копировать файлы подтверждения Яндекса/Метрики между сайтами, не использовать бренд «Ренессанс Кредит» как бренд сайта, ссылки на офферы только `/go/<poolId>/` с `rel="sponsored nofollow"`.
- Python: `py` и `.venv` (Python 3.11, `requirements.txt`); команды пайплайна ниже в Windows-варианте: `.venv\Scripts\python.exe site_pipeline\...`.

This document is for AI agents (Claude, Codex, etc.) working on this project.
Read `AGENT_HANDOFF.md` first (entry-point snapshot), then `HANDOFF.md` for the
chronological status log and `CLAUDE.md` for the full command/code map.

## What this project is

A content pipeline + Astro static-site renderer for white-label SEO / PBN sites.
The original Mosseo (mosseo.ru) CSV export is now the legacy baseline dataset;
the project also has early Exa + Firecrawl donor discovery/crawl support for
new niches. The first test site is deployed to Beget at `yourkedm.beget.tech`.
Brand, contacts, analytics, content dataset, and form settings come from env /
site config and must stay unique per site.

## Architecture in one paragraph

`site_pipeline/` scripts discover donors (Exa), crawl pages (Crawl4AI is the
current backend — `crawl_pages_c4ai.py`; Firecrawl `crawl_pages_fc.py` is the
fallback), normalize content into the shared `PageData + extracted` contract,
and build indexes/manifests. Monetization runs through Saleads CPA: offers are
connected via `saleads_offers.py` and rendered through `PromoSlot`. The `site/`
Astro project is the single
renderer: it reads the selected content output at build time via
`site/src/data/loadPages.ts`, maps paths to page types via
`site/src/lib/routing.ts`, derives SEO fields via `site/src/lib/seo.ts`, and
renders pages through `site/src/layouts/`. Donor CSS/style should become a
separate future `donor_style_profile`/theme-token input, not copied into page
JSON.

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
| `site_pipeline/crawl_pages_c4ai.py` | **Current** crawler: Crawl4AI map/scrape + LLM extraction (`.venv` (Python 3.11), Python 3.11) |
| `site_pipeline/crawl_pages_fc.py` | Firecrawl backend — fallback; c4ai reuses its normalization/filter helpers |
| `site_pipeline/saleads_offers.py` | Saleads CPA client: connect-missing / export-pool / export-links (vertical classifier) |
| `site_pipeline/discover_donors.py` | Exa donor discovery smoke path |
| `site_pipeline/qualify_donor.py` | Exa donor qualification smoke path |
| `sites/affiliate_pool.json` | Master connector registry (vertical + status); per-site `affiliateLinks.json` filtered from it |
| `CRAWLER_ARCH.md` | Exa + Firecrawl architecture, costs, contracts |

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
7. **Do not commit smoke/donor crawl outputs** — `site_pipeline/output/test_*`,
   `finance_test/`, `c4ai_smoke/`, donor dirs (`vsezaimyonline*/`), Exa smoke JSON,
   qualification JSON. They are gitignored; keep it that way.
8. **Do not copy donor CSS directly** into Astro layouts. Extract style signals
   into future theme tokens / `donor_style_profile` instead.

## Git workflow

- Do not do feature work directly on `main`. Create a topic branch first:
  `codex/<short-task-name>`.
- Keep commits atomic and revertable: one behavior/docs/deploy concern per commit.
- Prefer commit prefixes already used in the repo: `feat(...)`, `fix(...)`,
  `docs(...)`, `chore(...)`.
- Do not stage generated artifacts or unrelated untracked files just because
  they are present in the worktree.
- `site/scripts/download-images.sh` and `site/scripts/ru-images.txt` are
  legacy-media helper files. Leave them untracked unless the current task is
  explicitly about downloading/replacing legacy images.
- Before deploy-related commits, run:

```bash
cd site
npm run check:b0
npm run build
```

- For Beget form changes, also run:

```bash
php -l dist/mail.php
```

- Use `git revert <sha>` for rollback of committed work. Do not use
  `git reset --hard` or checkout away user changes unless the user explicitly
  asks for it.

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
CONTENT_OUTPUT_DIR="../site_pipeline/output" # optional alternate build dataset
ENABLE_EDITORIAL_POSTS="true"     # false for donor-only builds
PUBLIC_LEGACY_SOURCE_DOMAIN=""    # optional donor domain for link/media rewrite
PUBLIC_LEGACY_BRAND_ALIASES=""    # comma-separated donor brand aliases
```

## Track A (UI) reference — what the renderer already ships

> Historical baseline (закрыт 2026-05-12). Текущий статус проекта — в `AGENT_HANDOFF.md`.

**Track A (UI) — fully complete.**

- Full Astro site with 8 page layouts covering all 1011 buildable routes
- Double-row header: topbar with phones/email/callback/socials + main nav row
  with dropdown menus; topbar hidden on mobile (≤900px)
- Homepage: hero, stats bar, nav-grid, process steps, **services grid** (top 8
  children of `/seo-uslugi/`), **USP block** (6 advantage items), case cards,
  FAQ items, CTA
- ContactLayout: form + blue info card in CSS grid; no `content_html` injection
- PortfolioLayout archive: live grid; case: generic metrics block (3-col: ТОП-10 /
  +150% / 3–6 мес.) above prose body
- ArchiveLayout: `showGeneratedCatalog` replaces `content_html` with:
  - FAQ path → `<details>/<summary>` accordion (no JS)
  - Pricing path → tariff `.pricing-card` (2px accent border) + info `.archive-card`
  - Default → grouped child cards with sub-links
- ServiceLayout: child service grid before body (`auto-fill minmax(260px, 1fr)`)
- Footer: 4-column grid (brand+social | 7 services | company nav | contacts)
- ArticleLayout sidebar: sibling pages (≥3 → sticky 300px aside); child-pages
  nav block between body and PromoSlot (used by "О компании" with 7 children)
- Mobile: burger `min-width/height: 44px`; container padding; per-layout responsive
- 404 page: accent "404" code + two action buttons

## Roadmap

Полный план — см. `ROADMAP.md` в корне проекта.
Стратегия монетизации и арбитража трафика — см. `ARBITRAGE.md`.
Риски и пре-мортем — см. `RISKS.md` (читать перед любой задачей трека B).

Два трека:
- **Трек A** — UI сайта: **ЗАВЕРШЁН** (A1–A4 закрыты, 2026-05-12).
- **Трек B** — PBN-инфраструктура: multi-donor pipeline → монетизация → деплой-сетка.

**Состояние Трека B (2026-06-08):**
- ✅ Multi-site структура `sites/` (finhelp-ru активен, + vsezaimyonline, rostpoisk).
- ✅ Crawl4AI backend (`crawl_pages_c4ai.py`, `.venv` (Python 3.11)) — заменил Firecrawl.
- ✅ Saleads CPA: подключены все RU финансовые/страховые офферы (160 коннекторов,
  100 live + 60 на модерации). `affiliate_pool.json` = мастер-реестр (189).
- ⏳ **Следующее:** полный краул `vsezaimyonline.ru` (≥300 стр) → `promoSlots.json`
  + дизайн под офферы (LAUNCH_PLAN §23) → дождаться модерации 60 коннекторов
  → крауд-ссылки (B7.1), UptimeRobot (B7.2), второй сайт.

Подход: один Astro renderer, разные источники приводятся к общему
`PageData + extracted`. Exa — donor discovery/qualification; Crawl4AI — crawl/extraction
(LLM через Anthropic Haiku/LiteLLM). API keys из `site/.env`; не печатать и не коммитить.

При старте новой сессии: читать `AGENT_HANDOFF.md`, затем `HANDOFF.md` / `ROADMAP.md`.
Сначала проверить ветку и `git status`, затем брать первую `[ ]` задачу Трека B.

## Deploy

```bash
cd site
npm run check:b0
npm run build
npm run deploy:dry
npm run deploy
```

Requires `site/.env` (not committed). Disable iCloud Private Relay/VPN/proxy
before FTP if it hangs or returns `425 Security: Bad IP connecting`.
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

| MCP | Зачем | Статус |
|---|---|---|
| firecrawl | Краулинг новых донор-сайтов для PBN | ✅ Подключён (FIRECRAWL_API_KEY задан) |
| exa | Поиск доноров по нишам, квалификация доноров | ✅ Проверен через `discover_donors.py` / `qualify_donor.py` |
| playwright | Автотест задеплоенных сайтов | ✅ Готов |

API ключи добавлять в `site/.env`. Файл конфига: `.mcp.json` в корне проекта.

### jcodemunch — как пользоваться

```
repo: local/mosseo-site-pipeline-db570d70
```

Всегда запускать `mcp__jcodemunch__search_symbols` / `mcp__jcodemunch__get_symbol_source`
перед чтением файлов — экономит контекст.
