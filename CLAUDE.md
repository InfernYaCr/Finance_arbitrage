# Mosseo Site Pipeline

## Новый фронт web/ (пилот rencredit)

Пилот сайта rencredit-online.ru строится в `web/` (npm workspaces). Старый `site/` (Astro 4) и Python `site_pipeline/` остаются как есть и обслуживают донорский конвейер.

```
web/
  apps/rencredit/        Astro 7 + Tailwind 4 + GSAP; контент в src/content/{articles,guides,news}/*.md(x) и offers/*.json
                         схемы Zod: src/content.config.ts (источник правды по frontmatter)
  packages/core/         офферы, JSON-LD, SEO-хелперы, типы (@pbn/core)
  packages/motion/       анимации, View Transitions, GSAP (@pbn/motion)
```

Правило: **контент это markdown в content collections, без краулинга донора.** Факты из первоисточников, офферы из `sites/affiliate_pool.json` через `content/offers/*.json`, ссылки только `/go/<poolId>/` с `rel="sponsored nofollow"`.

Команды (Windows; Bash или PowerShell, из корня репозитория):

```bash
npm --prefix web install                 # один раз
npm --prefix web run dev -- --port 4321  # dev (или launch.json: rencredit-dev)
npm --prefix web run build               # статика в web/apps/rencredit/dist
node scripts/check.mjs --quick           # быстрая проверка (она же Stop-хук)
node scripts/check.mjs                   # полная: quick + build + проверка dist
py scripts/test_guard.py                 # самопроверка PreToolUse-хука
```

Харнесс (`.claude/`, подробности `docs/harness/README.md`, окружение `docs/harness/ENV.md`):

- Скиллы: `site-design`, `motion-system`, `ymyl-content`, `offer-placement`, `news-pipeline`, плюс `grill-me`, `to-spec`, `handoff`, `diagnosing-bugs`, `code-review`.
- Агенты: `ui-builder`, `motion-designer`, `content-writer`, `news-writer`, `ymyl-fact-checker` (read-only), `seo-auditor` (read-only), `page-reviewer` (Playwright).
- Команды: `/check`, `/new-article <тема>`, `/new-news <тема>`, `/new-offer <poolId>`, `/review-page <url>`.
- Хук `.claude/hooks/guard.py` блокирует чтение `.env`, `git push`, массовые удаления, правку `sites/*/pages/*.json`, копирование файлов Яндекса/Метрики между сайтами. Не обходить.
- Зоны владения при параллельной работе: `web/apps/rencredit/src/{pages,layouts,components,styles}` (ui-builder), `web/packages/motion` (motion-designer), `src/content/{articles,guides}` (content-writer), `src/content/news` (news-writer), `web/packages/core` и `src/content/offers` (основной агент). Свою зону не покидать.

Read `AGENT_HANDOFF.md` first — it's the single entry-point snapshot (state,
commands, gotchas, next steps). Then `HANDOFF.md` for the chronological log of
project state, generated artifacts, QA status, deploy status, and next tasks.

This project is evolving from a Mosseo-derived content pipeline into a
multi-donor PBN/content-factory platform. `site_pipeline/` discovers/crawls and
normalizes donor content; `site/` is the single Astro renderer for selected
build datasets.

Current live test site:

```text
http://yourkedm.beget.tech/
```

Latest status (2026-06-08):

- Track A UI complete; multi-site `sites/` live (finhelp-ru active, + vsezaimyonline, rostpoisk).
- Crawler migrated to Crawl4AI (`crawl_pages_c4ai.py`, `.venv` (Python 3.11)); Firecrawl is fallback.
- Saleads CPA connected: all RU finance/insurance offers — 160 connectors
  (100 live + 60 pending moderation). `sites/affiliate_pool.json` = master registry (189).
- Contact form posts to `/mail.php`; notifications pending (B5.5).
- Yandex Webmaster verification file deployed: `/yandex_b096686526decb58.html`.
- **Next:** full crawl of `vsezaimyonline.ru` (≥300 pages) → `promoSlots.json` +
  offer-aware page design (LAUNCH_PLAN §23) → re-export after 60 connectors approved.

## Claude quick context

Workspace: корень репозитория (Windows: `E:\Finance_arbitrage`). Все команды ниже выполняются из корня. Оболочка: Git Bash или PowerShell; Python только через `py` или `.venv\Scripts\python.exe`.

Окружение Python (`.venv`, Python 3.11, зависимости в корневом `requirements.txt`): см. `docs/harness/ENV.md`.

Main context files to read first:

- `AGENT_HANDOFF.md` — entry-point snapshot: state, commands, gotchas, next steps.
- `HANDOFF.md` — current state, decisions, commands, latest QA.
- `ROADMAP.md` — phase plan, next tasks, implementation order.
- `CRAWLER_ARCH.md` — Exa + Firecrawl donor discovery/crawl architecture.
- `MIGRATION_PLAN.md` — phased E0→E4 migration plan (bridge → registry).
- `NEW_PIPELINE_ARCH.md` — target architecture: SQLite registry, sites/, exporter.
- `PAGE_GENERATION_RESEARCH.md` — SEO + GEO + AI SEO page structure research.
- `LAUNCH_CHECKLIST.md` — deployment/SEO/forms/analytics checklist per site.
- `ARBITRAGE.md` — monetization strategy (CPA, PromoSlot, Keitaro).
- `CLEANUP_PLAN.md` — artifact triage: what to keep, archive, delete.

Reference only (archived, superseded):

- `docs/SITE_ARCHITECTURE.md` — superseded by NEW_PIPELINE_ARCH.md
- `docs/SITE_STRUCTURE.md` — mosseo.ru-specific, superseded by multi-site approach
- `docs/PIPELINE_PLAN_v1.md` — CSV pipeline plan, superseded by CRAWLER_ARCH.md

Generated content and indexes:

- `site_pipeline/output/pages/*.json` - parsed page payloads, generated and gitignored.
- `site_pipeline/output/build_manifest.json` - buildable routes for Astro.
- `site_pipeline/output/qa_report.json` - QA report.
- `site_pipeline/output/template_audit.json` - source template classification.
- `site_pipeline/output/content_index.sqlite` - quick local inspection DB.
- `site_pipeline/output/test_*`, `finance_test`, Exa smoke JSON, and
  `qualify_*.json` are temporary research/smoke artifacts and must not be
  committed.

Astro site:

- `site/src/pages/[...slug].astro` - route generator; maps pageType to layout.
- `site/src/data/loadPages.ts` - loads parsed JSON and normalizes brand, contacts, media.
- `site/src/data/siteConfig.ts` - central config for brand, contacts, analytics, social links.
- `site/src/lib/routing.ts` - page type mapping.
- `site/src/lib/seo.ts` - SEO fields.
- `site/src/lib/schema.ts` - JSON-LD.
- `site/src/components/Header.astro` - double-row header: topbar + nav with dropdowns.
- `site/src/components/Footer.astro` - site footer.
- `site/src/layouts/` - page layout templates (Home, Article, Archive, Service, Portfolio,
  FAQ, Dictionary, Contact).
- `site/src/styles/global.css` - design tokens + legacy WP block styles.

Page layouts:

| Layout | pageType(s) | Key content |
|---|---|---|
| HomeLayout | home | Hero, stats bar, nav grid, process steps, case cards, FAQ, CTA |
| ArticleLayout | article, company, content_page | Breadcrumbs, h1, date, body, PromoSlot, CTA |
| ArchiveLayout | archive, dictionary_archive | Child list + CTA banner |
| ServiceLayout | service | Hero + CTA btn, prose body, PromoSlot, CTA banner |
| PortfolioLayout | portfolio_archive, portfolio_case | Archive grid / case content |
| FaqLayout | faq | Badge, h1, body, PromoSlot, footer link |
| DictionaryLayout | dictionary_article | Badge, h1, definition, body, back link |
| ContactLayout | contact | Form (left) + info card (right) in CSS grid |

Important current behavior:

- Do not hand-edit `site_pipeline/output/pages/*.json` for design, contacts, brand, or media changes.
- Old/donor brand aliases are normalized at render time in `loadPages.ts` /
  `brand.ts`.
- Old contacts/requisites/staff contacts are normalized or removed at render time.
- Old `/content/` and `/wp-content/` media defaults to `/images/placeholder.svg`.
- Change contacts in env/site config, not in parsed content.
- `PUBLIC_LEGACY_MEDIA_MODE` supports `placeholder`, `source`, and `local`.
- `CONTENT_OUTPUT_DIR` selects an alternate content output for Astro builds.
- `ENABLE_EDITORIAL_POSTS=false` should be used for donor-only builds.
- `PUBLIC_LEGACY_SOURCE_DOMAIN` and `PUBLIC_LEGACY_BRAND_ALIASES` normalize
  donor links/brand mentions; do not normalize product brands such as banks/MFOs.
- Donor CSS/style should become a future `donor_style_profile` / theme-token
  input. Do not copy donor CSS directly into Astro layouts.
- **Never inject `content_html` from contact or homepage JSON via `set:html`** — the
  extracted WP HTML contains nested `<div class="container">` that breaks outer layout
  via the HTML parser. Contact and Home use structured components instead.
- `siteConfig.ts` has `phone2`, `phoneLabel`, `telegram`, `social.{vk,telegram,ok}` —
  all read from env vars; empty string hides the element.

Parallel-work caution:

- `site/scripts/download-images.sh` and `site/scripts/ru-images.txt` are
  legacy-media helpers — do not overwrite or revert without checking.
- `AGENTS.md` is a maintained project doc (agent guide); keep it in sync with
  `AGENT_HANDOFF.md` when project state changes.

Git workflow:

- Feature work should happen on a topic branch, not directly on `main`.
- Use branch names like `codex/b0-predeploy-safety`.
- Keep commits small and revertable: separate site behavior, deploy plumbing,
  public cleanup, and docs when practical.
- Do not stage unrelated untracked files. In particular,
  `site/scripts/download-images.sh` and `site/scripts/ru-images.txt` are
  legacy-media helper files and should stay out of non-media commits.
- Roll back committed work with `git revert <sha>`. Do not use destructive
  reset/checkout commands unless the user explicitly asks.

Use the local virtual environment:

```bash
.venv\Scripts\activate   # PowerShell/cmd; Git Bash: source .venv/Scripts/activate
```

Current code entry points:

- `site_pipeline/normalize_csv.py`
- `site_pipeline/crawl_pages.py`
- `site_pipeline/qa_pages.py`
- `site_pipeline/build_content_index.py`
- `site_pipeline/probe_pages.py`
- `site_pipeline/audit_extraction_sources.py`
- `site_pipeline/audit_page_templates.py`
- `site_pipeline/crawl_pages_c4ai.py` - **current** crawler: Crawl4AI map/scrape + LLM extraction (`.venv` (Python 3.11)).
- `site_pipeline/crawl_pages_fc.py` - Firecrawl backend (fallback); c4ai reuses its helpers.
- `site_pipeline/saleads_offers.py` - Saleads CPA client: connect-missing / export-pool / export-links.
- `site_pipeline/discover_donors.py` - Exa donor search via highlights.
- `site_pipeline/qualify_donor.py` - Exa donor qualification via summary schema.

Do not treat `site_pipeline/output/pages/*.json` as source code. They are the
generated content dataset. Use `site_pipeline/output/build_manifest.json`,
`site_pipeline/output/redirects.json`, and
`site_pipeline/output/content_index.sqlite` for downstream site generation.

Before changing layouts broadly, run:

```bash
python site_pipeline/audit_page_templates.py
```

This distinguishes content articles from source-template pages such as service
catalogs, calculator/service landings, portfolio templates, and dictionary
archives.

## Common commands

Pipeline QA:

```bash
.venv\Scripts\activate   # PowerShell/cmd; Git Bash: source .venv/Scripts/activate
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
python site_pipeline/audit_page_templates.py
```

Crawl4AI (current crawler, Python 3.11 venv):

```bash
.venv\Scripts\python.exe site_pipeline/crawl_pages_c4ai.py \
  --source-domain vsezaimyonline.ru --limit 500 --with-llm \
  --include-sections banks,credits,loans,cards,mortgage,autocredit,qa,ratings,terms
```

Saleads CPA offers (token in `site/.env` → `SALEADS_API_KEY`):

```bash
.venv\Scripts\activate   # PowerShell/cmd; Git Bash: source .venv/Scripts/activate
python site_pipeline/saleads_offers.py connect-missing --dry-run   # preview missing RU finance/insurance offers
python site_pipeline/saleads_offers.py connect-missing             # create connectors (idempotent)
python site_pipeline/saleads_offers.py export-pool                 # → sites/affiliate_pool.json (master)
python site_pipeline/saleads_offers.py export-links --site-relevant \
   --out sites/finhelp-ru/affiliateLinks.json                      # per-site finance/insurance links
```

Firecrawl / Exa smoke commands (fallback crawler + donor discovery):

```bash
.venv\Scripts\activate   # PowerShell/cmd; Git Bash: source .venv/Scripts/activate
python site_pipeline/crawl_pages_fc.py --source-domain mosseo.ru --limit 30 --output-dir site_pipeline/output/test_fc --map-only
python site_pipeline/discover_donors.py --niche finance --num-results 5 --out site_pipeline/output/exa_finance_smoke.json
python site_pipeline/qualify_donor.py --url https://vsezaimyonline.ru --out site_pipeline/output/qualify_vsezaimyonline.json
```

Astro build/check:

```bash
cd site
npm run build
npm run check
```

Alternate donor dataset build:

```bash
cd site
CONTENT_OUTPUT_DIR=../site_pipeline/output/finance_test \
ENABLE_EDITORIAL_POSTS=false \
PUBLIC_LEGACY_SOURCE_DOMAIN=https://vsezaimyonline.ru \
PUBLIC_LEGACY_BRAND_ALIASES='ВсеЗаймыОнлайн,Все Займы Онлайн,VseZaimyOnline,К5М' \
npm run build
```

Local preview:

```bash
cd site
npm run preview -- --host 127.0.0.1 --port 4321
```

Deploy to Beget:

```bash
cd site
npm run check:b0
npm run build
npm run deploy:dry
npm run deploy
```

Credentials and brand/contact/Metrika values are read from `site/.env`
(not committed). Before running, disable iCloud Private Relay/VPN/proxy if FTP
hangs or returns `425 Security: Bad IP connecting`.

Test domain: http://yourkedm.beget.tech/

Post-deploy smoke checks:

```text
http://yourkedm.beget.tech/
http://yourkedm.beget.tech/yandex_b096686526decb58.html
http://yourkedm.beget.tech/kontakty/
http://yourkedm.beget.tech/seo-uslugi/
http://yourkedm.beget.tech/portfolio/
http://yourkedm.beget.tech/faq/
```

Required before calling the first site fully done:

- Verify ownership in Yandex Webmaster.
- Confirm Metrika counter receives visits.
- Submit one test form from `/kontakty/` and confirm email delivery.

Useful smoke-test routes:

- `/`
- `/seo-uslugi/`
- `/seo-uslugi/audit-sajta/audit-seo-podryadchika/`
- `/seo-prodvizhenie-sajta/`
- `/stoimost-uslug/`
- `/kontakty/`
