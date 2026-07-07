# Mosseo Site Pipeline Handoff

## Current status

The pipeline has completed a full crawl and QA pass for the original page
export. The Astro site is built and deployed to the first Beget test host.

### 2026-06-08 update — офферы теперь реально рендерятся на сайте (3 бага исправлены)

`promoSlots.json` существовал, но не работал: `link_ids` ссылались на мёртвые id
(`finance-mfo-top` и т.п.), которых больше нет в `affiliateLinks.json`. Копнув
глубже, нашлись ещё два блокирующих бага в цепочке `PromoSlot.astro` →
`affiliate.ts` → `/go/[offer].astro`:

1. **Нет синка данных в билд.** `affiliate.ts` статически импортирует
   `site/src/data/{affiliateLinks,promoSlots}.json` — а это шаблонные заглушки
   `[]`/`[]` (закоммичены нарочно в `b809e8a` как безопасный дефолт). `gen-env.sh`
   копировал только `.env`, но не копировал `sites/<id>/*.json` в `site/src/data/`.
   Весь пул из 101 оффера был невидим для Astro-билда.
2. **`buildUtmHref` падал на каждом `/go/` маршруте.** `/go/[offer].astro`
   дёргает `link.utm.source` при генерации статических путей для КАЖДОЙ ссылки —
   а `saleads_offers.py export-links` это поле не писал. `TypeError` на всех
   101 `/go/`-страницах при `npm run build`.
3. **`promoSlots.json`** ссылался на несуществующие id (см. выше).

**Исправлено:**
- `saleads_offers.py::cmd_export_links` — добавлено поле `utm: {source, medium,
  campaign: vertical}` в каждую запись `affiliateLinks.json`.
- `sites/finhelp-ru/promoSlots.json` — пересобран: 1 generic-слот
  (`sections: []`, матчит любую статью) с топ-офферами по 4 универсальным
  вертикалям (mfo/card/credit/business). Точная разбивка по разделам —
  после полного краула (LAUNCH_PLAN §23), сейчас донор-датасет мал (~30 стр)
  и таксономия разделов нестабильна.
- `gen-env.sh` — в конец добавлено копирование
  `sites/<SITE_ID>/{affiliateLinks,promoSlots}.json` → `site/src/data/`.

**Проверено end-to-end** (build + Astro preview в браузере): `npm run build`
собрал все 134 страницы включая 101 `/go/`-маршрут без единого краша;
`/go/saleads-42c379c0/` возвращает 200 с meta-refresh на реальный трек-URL
Saleads (`utm_campaign=mfo`); на живой странице `/7-dney/` промо-блок
`.promo-slot[data-slot-id="finance-generic-article"]` отрендерился с 4
кликабельными офферами.

### 2026-06-08 update — Saleads офферы подключены (финансы + страхование, Россия)

**Что сделано:** через API подключены ВСЕ доступные для России финансовые и
страховые офферы Saleads. Создание коннекторов работает программно (скрытый
endpoint `/connector/get-or-create`) — ручная работа в ЛК больше не нужна.

**Цифры (2026-06-08):**
- Каталог Saleads: 393 оффера.
- Коннекторов всего: **189** (было 128 → `connect-missing` создал 61). Статусы:
  129 `approve` (с рабочим URL) + 60 `wait` (на модерации Saleads).
- Релевантных финансы/страхование: **160** (100 live + 60 pending).
- `sites/finhelp-ru/affiliateLinks.json` = **101 оффер** (только live, с тегом `vertical`).
- `sites/affiliate_pool.json` = **189** (мастер-реестр: vertical + status, все статусы).

**Новые команды в `site_pipeline/saleads_offers.py`** (stdlib-only, токен из `site/.env` → `SALEADS_API_KEY`):
```bash
python site_pipeline/saleads_offers.py connect-missing --dry-run   # просмотр
python site_pipeline/saleads_offers.py connect-missing             # создать коннекторы (идемпотентно)
python site_pipeline/saleads_offers.py export-pool                 # → sites/affiliate_pool.json
python site_pipeline/saleads_offers.py export-links --site-relevant \
   --out sites/finhelp-ru/affiliateLinks.json                      # per-site, финансы/страхование
```

**Классификация (в коде, regex):** `_FIN_RE` (финансы) ∪ `_INS_RE` (страхование),
минус `_JOBS_RE` (HR/работа банков — «Альфа Банк … HR» НЕ попадает на финсайт),
минус `_NOISE_RE` (телеком SIM / Т-Афиша). Поле `vertical` у каждого оффера:
`mfo / card / insurance / business / credit / mortgage / investment / debt_relief / finance`.

**Топ-офферы (live):** Альфа Ипотека 31250₽, ББанкрот 18750₽, Ваш Фин.Партнёр 16000₽,
ДрайвЗайм 13500₽, УБРиР РКО 11250₽, ОТП РКО 9000₽, ИЛМА 7500₽.

**⚠️ Подводные камни:**
- Хост API — `saleads.pro` (НЕ `my.saleads.pro`: он 302-редиректит и срезает авторизацию). Токен как GET-параметр `?token=`.
- `short_url` багует (один кэш на все коннекторы) → используем полный `urls[0].url`.
- Rate-limit: 2с между запросами, 8с back-off на 429 (зашито в `connect-missing`).
- Токен светился в чате — **перевыпустить** в ЛК.

**Что дальше по офферам:**
1. Дождаться модерации 60 `wait`-коннекторов → повторить `export-pool` + `export-links`.
2. После краула донора — `promoSlots.json` + дизайн под офферы (LAUNCH_PLAN раздел 23).

### 2026-05-21 update — Crawl4AI backend (drop-in for Firecrawl)

Open-source self-hosted crawler bolted on alongside Firecrawl. Same CLI, same
`pages/*.json` output, same registry write. LLM extraction via Anthropic Haiku
through LiteLLM (no local model — API only for now).

- New venv: `.venv311` (Python 3.11) — Crawl4AI requires 3.10+.
- New module: `site_pipeline/crawl_pages_c4ai.py` — reuses `filter_urls` /
  `_build_record` / `PAGE_EXTRACTION_SCHEMA` from `crawl_pages_fc.py`, only the
  fetch/extract layer is rewritten. Records get `content_source: "crawl4ai"`.
- Requirements: `site_pipeline/requirements_c4ai.txt`.
- Registry mode strings: `c4ai_base`, `c4ai_llm`, `c4ai_recrawl` (so historical
  reports keep distinguishing backends).

Setup once:
```bash
/opt/homebrew/bin/python3.11 -m venv .venv311
.venv311/bin/pip install -r site_pipeline/requirements_c4ai.txt
.venv311/bin/crawl4ai-setup
```

Smoke test (no LLM):
```bash
.venv311/bin/python site_pipeline/crawl_pages_c4ai.py \
  --source-domain vsezaimyonline.ru --limit 5 \
  --output-dir site_pipeline/output/c4ai_smoke/pages
```

Verified 2026-05-21: 5 pages built, QA `1 ok / 4 warning` (link density + thin
content on donor pages — same shape FC produces). Registry run recorded with
`mode=c4ai_base`.

With LLM (Anthropic Haiku 4.5 via LiteLLM, requires `ANTHROPIC_API_KEY`):
```bash
.venv311/bin/python site_pipeline/crawl_pages_c4ai.py \
  --source-domain vsezaimyonline.ru --limit 30 --with-llm
```

The old Firecrawl backend (`crawl_pages_fc.py` + `.venv`) stays in place as a
fallback for the first month. Once 1–2 donors are crawled with c4ai cleanly,
the Firecrawl subscription can be cancelled.

---

### 2026-05-14 update — SITE_BUILD_PLAN + ветка codex/pbn-factory

**SITE_BUILD_PLAN.md** (711b16e → 6946c37) — архитектурный план PBN-фабрики:
- 9 фаз F1–F9: platform cleanup → niche profiles → create_site.py → LLM-rewrite → related → templates → tags → schema → footprint
- PBN-метрики: time-to-live < 30 мин, 0 ручных шагов, < $5/сайт, 80%+ уникальность
- `vsezaimyonline` тест-краул 100 страниц: QA ок, Astro build ок

**sites/vsezaimyonline/** — новый тест-сайт (финансовая ниша):
- `site.config.json`: brand "ЗаймыОнлайн", theme "beta", donor vsezaimyonline-ru
- `affiliateLinks.json` / `promoSlots.json`: пустые заглушки

**Текущая ветка**: `codex/pbn-factory`
**Следующий шаг**: F1 (platform cleanup) → F2 (niche profiles) → F5 (Related Pages) → F3 (create_site.py)

---

### 2026-05-14 update — B3.5 + B5.3 + B1.6–B1.7 (Firecrawl improvements)

**B3.5 datePublished/dateModified (d878434):**
- `crawl_pages_fc.py`: читает `publishedTime`/`modifiedTime` из Firecrawl metadata → создаёт `wp` stub
- `extraction_rules.py`: `extract_dates()` — JSON-LD datePublished + `<time datetime>` fallback
- `site/src/lib/seo.ts`: цепочка `wp.date → extracted.date_published` для `datePublished`/`dateModified`
- `site/src/data/types.ts`: добавлены `date_published?`/`date_modified?` в `ExtractedData`

**B5.1–B5.2 per-site affiliate (ac222c9):**
- `sites/<id>/affiliateLinks.json` + `promoSlots.json` — per-site конфиги
- `export_site.py`: копирует их в `site/src/data/` при экспорте
- `site/src/lib/affiliate.ts`: `resolveSlotHtml()` + `ResolvedPromoSlot`, ссылки через `/go/<id>/`

**B5.3 /go/ редиректы (0590b64):**
- `site/src/pages/go/[offer].astro` — статические страницы с meta refresh + `window.location.replace`
- Только для `enabled: true` ссылок (getStaticPaths фильтрует)

**B1.6 --smart-actions (4a445ad):**
- После batch scrape страницы с `content_text_chars < 300` пере-скрейпятся с `actions: [wait 1.5s → scroll → wait 0.8s]`
- Триггерит lazy-load JS; mutates records dict in-place если результат лучше
- `_retry_thin_pages()` в `crawl_pages_fc.py`

**B1.7 --include-sections (4f6b247):**
- `filter_urls()` принимает `include_sections: list[str] | None`
- `--include-sections blog,uslugi,qa` — оставляет только URL с нужным первым сегментом пути
- Экономит кредиты: пагинация, теги, корзина, юридические страницы не скрейпятся

Следующий шаг: **B3.4** (Related Pages блок через `content_index.sqlite` FTS)

### 2026-05-14 update — B2.4 + B3.2–B3.3 + B4.1–B4.4 (Codex session)

Три коммита Codex (0cc51f3, 5523fda, 6753044):

**Темы (B4.1, B4.2, B4.4):**
- `site/src/styles/themes/alpha.css` — токены текущей темы (синяя акцентная)
- `site/src/styles/themes/beta.css` — финансовая тема (teal `:root[data-theme='beta']`, Inter)
- `BaseLayout.astro`: `<html data-theme={PUBLIC_THEME}>`, дефолт `alpha`
- `gen-env.sh`: читает `site.config.json#theme` → `PUBLIC_THEME`
- `sites/finhelp-ru/site.config.json`: `"theme": "beta"`

**FAQPage Schema + Summary (B3.2, B3.3):**
- `schema.ts`: FAQPage JSON-LD из `faq_pairs`, поддержка форматов `question/answer` и `q/a`
- `schema.ts`: `SpeakableSpecification` с `cssSelector: ['.article-summary']` если есть `key_points ≥ 2`
- `ArticleLayout.astro`: блок `.article-summary` из `key_points[]` перед основным контентом
- `ServiceLayout.astro`: аналогичный summary-блок

**Hardening (B2.4):**
- `build-all.sh`: `--dry-run` флаг, preview health-check, bash 3 safe

**Backfill metadata:**
- `site_pipeline/extraction_rules.py`: правила нормализации extracted-полей (faq_pairs, key_points и др.)
- `export_site.py` + `crawl_pages_fc.py`: backfill при экспорте

QA после коммитов: `./build-all.sh finhelp-ru` — 30 pages OK, `npm run check` — 0 errors.

### 2026-05-13 update — B2.3 + B3.1 universal renderer

**B2.3 `build-all.sh`** — complete:
- Iterates over all `sites/` (or single `--site-id`), runs `gen-env.sh` → `export_site.py` → `npm run build` → `mv` to `builds/<id>/`
- `--preview` flag: kills existing server on :4321, starts fresh `npx serve builds/<LAST_BUILT>` (no `-s` SPA mode)
- `NODE_OPTIONS=--max-old-space-size=8192` set for 1000+ page builds
- Output dir: `builds/` (repo root), not `site/dist/`, to avoid mv-into-self error
- Bash 3.x safe: no negative array indexing, uses `LAST_BUILT` variable

**B3.1 universal HomeLayout + Header + siteConfig** — complete:
- `HomeLayout.astro`: removed all SEO-niche-specific blocks (stats bar, howWeWork steps, USP cards). Nav-grid, services, cases, FAQ blocks now 100% driven by `navItems` from `loadNav.ts`
- `siteConfig.ts`: removed hardcoded `nav` array; `siteDescription` now reads `PUBLIC_SITE_DESCRIPTION` env
- `Header.astro`: phone/email links wrapped in guards (hidden when empty); "перезвоните мне" href reads `PUBLIC_CONTACT_PATH` env
- `generate_nav.py`: added `_strip_brand()` + `CONTACT_LABELS` — donor brand aliases stripped from nav labels; known contact slugs get fixed Russian labels
- `sites/finhelp-ru/nav.json` regenerated: clean labels, no donor brand fragments

Build flow (2026-05-13):
```bash
# Single site
./build-all.sh finhelp-ru

# All sites with local preview
./build-all.sh --preview

# Or manually
python export_site.py --site-id rostpoisk   # or finhelp-ru
./gen-env.sh rostpoisk                      # generates site/.env
cd site && npm run build                    # 8GB heap, ~33min for 1013 pages; ~1min for 30 pages
```

Current best next steps:
- **B3.2** FAQPage Schema.org (max SEO impact, ~30 lines in schema.ts)
- **B5.5** Form notifications via Telegram Bot API (practical deploy blocker)

### 2026-05-13 update — B2.2 (export_site.py)

`export_site.py` is complete and verified:

- `python export_site.py --site-id rostpoisk` — copies 1013 pages + rewrites manifest page_file paths → `sites/rostpoisk/pages/`
- `python export_site.py --site-id finhelp-ru` — copies 30 pages + rewrites manifest page_file paths → `sites/finhelp-ru/pages/`
- Manifest `page_file` entries are rewritten to `sites/<id>/pages/<file>.json` so each site is self-contained.
- `site/astro.config.mjs` — added `vite.server.watch.ignored` to exclude `sites/*/pages/` from dev-server watch.
- `site/package.json` — build scripts now set `NODE_OPTIONS='--max-old-space-size=8192'` (required for 1000+ page builds; 30-page finance build works without it).

### 2026-05-13 update — B2.0 + B2.1 (multi-site infrastructure)

Multi-site infrastructure is now in place:

- `sites/rostpoisk/site.config.json` — brand, contacts, analytics, deploy config.
- `sites/finhelp-ru/site.config.json` — finance donor config (contacts/deploy TBD).
- `gen-env.sh <site_id>` — generates `site/.env` from `site.config.json`, preserves FTP/API secrets.
- `preview.sh <site_id>` — gen-env + build + local preview on :4321. No deploy triggered.
- `registry/registry.db` — SQLite registry (gitignored). Schema: donors, crawl_runs, site_targets, build_runs.
- `site_pipeline/registry.py` — sqlite3 wrapper for all registry operations.
- `registry_cli.py` — CLI: `init`, `add-donor`, `list-donors`, `add-site`, `list-sites`, `list-runs`.
- `qualify_donor.py` — now auto-writes verdict/score/niche to registry after Exa.
- `crawl_pages_fc.py` — now auto-writes crawl_run (pages, credits, mode) to registry after scrape.

Registry seeded: mosseo-ru (SEO, CRAWL) + vsezaimyonline-ru (finance, CRAWL, score=0.82).
Site targets seeded: rostpoisk + finhelp-ru.

Architecture decisions:
- `CONTENT_OUTPUT_DIR` is a bridge — stays until `export_site.py` (B2.2) replaces it.
- Nav is still hardcoded in `nav.ts` — will be replaced by `generate_nav.py` + `loadNav.ts` (B3.1).
- SQLite from the start — donors will exceed 5, JSON registry skipped.

Current best next step: B2.2 `export_site.py` — isolates content per SITE_ID from registry.

### 2026-05-13 update — B1.3/B1.4/B1.5

- `crawl_pages_fc.py`: map-only, cached maps, base/LLM/recrawl modes.
- mosseo.ru smoke (limit=30): QA clean, warnings only on archive pages.
- vsezaimyonline.ru smoke (limit=30): 27 ok, 3 warnings, 0 errors.
- Exa smoke: discover_donors + qualify_donor functional.
- Finance build via CONTENT_OUTPUT_DIR: 32 pages OK.

Latest live test deploy:

```text
URL: http://yourkedm.beget.tech/
Date: 2026-05-12
Status: deploy complete
```

Production-readiness foundation B0 is complete for this first test site:

- unique test brand is configured through `site/.env`
- unique test contacts are configured through `site/.env`
- Yandex Metrika counter is configured through `PUBLIC_METRIKA_ID`
- Yandex Webmaster verification file is deployed:
  `/yandex_b096686526decb58.html`
- contact form posts to `/mail.php`
- `mail.php` is generated into `site/dist/` during build
- B0 predeploy guard runs before every deploy
- public runtime files were scanned for old source-brand mentions

Workspace:

```bash
/Users/deniskononov/mosseo-site-pipeline
```

The source CSV is:

```bash
/Users/deniskononov/Downloads/internal_html.csv
```

## What has been built

Pipeline scripts:

- `site_pipeline/normalize_csv.py` normalizes the CSV into page seeds.
- `site_pipeline/probe_pages.py` probes extraction strategy.
- `site_pipeline/crawl_pages.py` crawls pages into JSON files.
- `site_pipeline/qa_pages.py` validates crawled page JSON.
- `site_pipeline/build_content_index.py` builds compact downstream indexes.
- `site_pipeline/audit_extraction_sources.py` compares WP REST content with
  rendered HTML fallback and finds pages where HTML is materially richer.
- `site_pipeline/audit_page_templates.py` classifies parsed pages by source HTML
  template and Astro page type.

Generated outputs:

- `site_pipeline/output/pages/*.json` has 1013 page JSON files.
- `site_pipeline/output/qa_report.json` has full QA details.
- `site_pipeline/output/qa_review.csv` has pages needing review.
- `site_pipeline/output/qa_sections.csv` has section-level QA.
- `site_pipeline/output/build_manifest.json` has buildable pages.
- `site_pipeline/output/redirects.json` has redirect-only URLs.
- `site_pipeline/output/excluded_pages.json` has excluded pages.
- `site_pipeline/output/content_index.jsonl` is a compact search/index file.
- `site_pipeline/output/content_index.sqlite` is a SQLite page index.
- `site_pipeline/output/template_audit.json` has source-template classification.
- `site_pipeline/output/template_audit.csv` is the flat template-audit table.

## Latest QA result

Full dataset:

```text
pages checked: 1013
ok: 535
info: 352
warning: 124
error: 2
```

Content sources:

```text
wp_json: 545
html_fallback: 466
external_redirect: 2
```

The higher `html_fallback` count is expected. A full extraction audit found
that many WordPress REST responses omit rich template blocks. Those pages were
recrawled from rendered HTML.

Buildable pages:

```text
1011
```

Excluded/redirect pages:

```text
https://mosseo.ru/seo-slovar/yuzabiliti/ -> https://mosseo.expert/seo-wikipedia/yuzabiliti/
https://mosseo.ru/uslugi/ -> https://mosseo.expert/seo-uslugi/
```

These two are intentionally excluded from page generation and represented in
`redirects.json` / `excluded_pages.json`.

## Important decisions

Use JSON files as the canonical content dataset for now. The full dataset is
small enough to keep as files, and this makes it easy to inspect and regenerate
individual pages.

Use `build_manifest.json` as the future site-generator input. Do not generate
pages from `excluded_pages.json`.

Use `redirects.json` to configure redirects or external-link handling.

Use `content_index.sqlite` for quick queries by section, path, severity, issue,
or source type.

The Astro site now has a local git repository on branch `main`. Baseline commit:

```text
c39e88c Initial Mosseo pipeline baseline
```

Use small commits before risky parser/template changes.

Brand replacement is handled in the site data-loading layer, not by editing
1000+ extracted JSON files. Old brand spellings (`МОССЕО`, `MOSSEO`, `Mosseo`,
`Моссео`) are normalized to the configured test brand during rendering.

Old contact details and old Mosseo media are also normalized at render time in
`site/src/data/loadPages.ts`. Do not edit generated JSON to change phones,
email, legal details, addresses, or old images.

Set the generated-site brand with env vars in `site/.env`.

```bash
PUBLIC_SITE_NAME="..."
PUBLIC_SITE_NAME_FULL="..."
```

For the current Beget test deploy, a fictional test brand is configured in the
local uncommitted `site/.env`. Do not commit real brand/contact/deploy secrets.

Set generated-site contacts with env vars in `site/.env`.

```bash
PUBLIC_COMPANY_PHONE="..."
PUBLIC_COMPANY_PHONE_HREF="+7..."
PUBLIC_COMPANY_EMAIL="..."
PUBLIC_COMPANY_ADDRESS="..."
PUBLIC_COMPANY_WORKTIME="..."
PUBLIC_COMPANY_LEGAL_NAME="ООО «Тестовый SEO-проект»"
PUBLIC_COMPANY_INN="0000000000"
PUBLIC_COMPANY_KPP="000000000"
PUBLIC_COMPANY_OGRN="0000000000000"
PUBLIC_COMPANY_BANK="Банк уточняется"
PUBLIC_COMPANY_BIK="000000000"
PUBLIC_COMPANY_ACCOUNT="00000000000000000000"
PUBLIC_COMPANY_CORRESPONDENT_ACCOUNT="00000000000000000000"
```

Old extracted images are controlled with:

```bash
PUBLIC_LEGACY_MEDIA_MODE="placeholder" # placeholder | source | local
PUBLIC_MEDIA_PLACEHOLDER="/images/placeholder.svg"
```

Default is `placeholder`, which hides old Mosseo `/content/` and
`/wp-content/` images. Use `source` only for temporary visual comparison with
the original site. Use `local` after copying approved images into
`site/public/content/` and/or `site/public/wp-content/`.

### B0 implementation notes (2026-05-12)

Files added/changed for predeploy safety:

- `site/scripts/check-b0-env.mjs` validates required brand, contacts, Metrika
  ID, and contact form action before deploy.
- `site/scripts/generate-mail-php.mjs` generates `dist/mail.php` after Astro
  build.
- `site/src/layouts/ContactLayout.astro` posts to
  `siteConfig.contactForm.action`, currently `/mail.php`.
- `site/src/pages/thanks.astro` provides a static success page.
- `site/src/components/Analytics.astro` injects the configured Yandex Metrika
  counter.
- `site/public/yandex_b096686526decb58.html` is the Yandex Webmaster
  verification file.
- `site/scripts/deploy.sh` loads `.env` without shell-evaluating values, so
  Russian text and spaces in env values are safe.

Verification already run locally:

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run check:b0
npm run check
npm run build
php -l dist/mail.php
npm run deploy:dry
npm run deploy
```

Expected follow-up checks on the live host:

- open `http://yourkedm.beget.tech/yandex_b096686526decb58.html`
- verify the site in Yandex Webmaster
- check that Yandex Metrika receives visits for counter `109164667`
- submit a test contact form on `/kontakty/`
- confirm the recipient mailbox in `PUBLIC_CONTACT_FORM_TO` exists and receives
  the message

The live `/seo-uslugi/` page contains a large `.section-services` catalog block
with grouped service links/cards. The generated site originally rendered only
the WP category description. Archive templates now derive child-page catalogs
from `build_manifest.json` so service/archive landing pages can show section
cards without depending on the original WordPress slider markup.

Current service-catalog behavior:

- `/seo-uslugi/` uses the source `.section-services` catalog, not the generated
  fallback catalog.
- Nested `/seo-uslugi/.../` category pages with `.serv-items` are intentionally
  short because the live source pages are catalog/category pages, not long
  articles.
- Service catalog pages render full-width so the extracted cards do not look
  compressed.
- `site/src/styles/global.css` contains styling for extracted legacy classes
  such as `.serv-blocks`, `.sbi`, `.serv-items`, and `.serv-item`.

Latest template audit:

```text
generic_content: 582
content_article: 136
dictionary_archive_template: 84
portfolio_template: 53
quiz_calculator: 50
service_catalog: 50
blog_archive_template: 47
thin_content: 3
service_category_nav: 3
empty_or_redirect: 2
case_template: 1
faq_archive_template: 1
contacts_template: 1
```

Service page template mix:

```text
generic_content: 132
service_catalog: 49
quiz_calculator: 37
service_category_nav: 3
```

## Extractor details

Primary extraction strategy:

1. Fetch source URL.
2. Discover WordPress REST endpoint from page HTML.
3. Use `content.rendered` from WordPress JSON when available.
4. Use HTML fallback for custom templates and archive pages.

Important fallback selectors already added:

- `.parent-section`
- `.section-quiz`
- `.section-case-page`
- `.section-portfolio`
- `.section-service`
- `.section-services`
- `.section-seowiki`
- `.section-blog`
- `.section-faqs`
- `.section-seowiki__children`
- `.content`

Safety features in crawler:

- `--resume`
- `--delay`
- `--retries`
- `--backoff`
- `--proxy`
- `--respect-robots`
- `--section`
- `--url`
- `--urls-file`
- `--force-html`

## Commands

Activate environment:

```bash
cd /Users/deniskononov/mosseo-site-pipeline
. .venv/bin/activate
```

Re-run QA and indexes:

```bash
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
python site_pipeline/audit_page_templates.py
```

Full safe crawl:

```bash
python site_pipeline/normalize_csv.py
python site_pipeline/crawl_pages.py --delay 1.0 --resume
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
```

Recrawl one section:

```bash
python site_pipeline/crawl_pages.py --section portfolio --delay 0.2
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
```

Recrawl one URL:

```bash
python site_pipeline/crawl_pages.py --url https://mosseo.ru/example/ --delay 0.1
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
```

Inspect SQLite:

```bash
python3 - <<'PY'
import sqlite3
conn = sqlite3.connect('site_pipeline/output/content_index.sqlite')
for row in conn.execute('select severity, count(*) from pages group by severity'):
    print(row)
conn.close()
PY
```

## Astro site — current implementation state (2026-05-12)

The Astro site is fully operational. All 1011 routes build cleanly.
**Track A (UI) is fully complete.** Track B (PBN infrastructure) is next.

### Completed — Track A (all done)

**A1 · Critical gaps**
- Footer: 4-column grid (brand+social | 7 services | company nav | contacts+socials).
  CSS: `2fr 1.5fr 1.2fr 1.5fr` → 2-col at ≤1024px → 1-col at ≤640px.
- ServiceLayout: child service card grid before body (auto-fill minmax 260px,
  accent left border). Read via `getImmediateChildPages(page.path)`.
- ArchiveLayout: replaced raw `content_html` with `getImmediateChildPages()`
  card grid. `showGeneratedCatalog = directChildren.length > 0 && !hasSourceCatalog`.

**A2 · Content enrichment**
- Homepage services block: top 8 children of `/seo-uslugi/` in grid after nav-grid.
- Homepage USP block: 6 hardcoded advantage items (icon+title+desc) after process steps.
- ArticleLayout sidebar: sibling pages from same parent (≥3 siblings → sticky 300px
  aside with related-links block + accent CTA card). Grid: `1fr 300px`, 1-col at ≤900px.

**A3 · Mobile**
- Header burger: `min-width: 44px; min-height: 44px` — meets tap target requirement.
- Container padding, global tap targets ≥44px.
- Per-layout mobile fixes (process grid, stats, CTA flex at ≤480px).

**A4 · Polish**
- FAQ archive: `<details>/<summary>` accordion with chevron SVG, no JS needed.
- Portfolio case: generic metrics block (ТОП-10, +150%, 3–6 мес.) — 3-col grid,
  1-col at ≤480px.
- Pricing page: tariff cards (border: 2px accent) + info cards grid.
  Tariffs detected by `path.includes('tarif')`.
- 404 page: styled with 6rem accent code + two action buttons.
- "О компании": ArticleLayout child-pages nav block — shows 7 child links between
  body and PromoSlot (`.article-children` component in ArticleLayout).

**Earlier baseline (still applies)**
- 8 page layouts: Home, Article, Archive, Service, Portfolio (archive + case),
  FAQ, Dictionary, Contact
- Double-row header: topbar (phones, email, socials, worktime) + nav with
  dropdowns; topbar hidden on mobile (≤900px)
- Homepage structured sections: hero, stats bar, nav grid, process steps,
  case cards (live from `/portfolio/` children), FAQ list (live from `/faq/`
  children), CTA banner
- ContactLayout rebuilt without `content_html` injection
- PortfolioLayout archive mode: live grid via `getImmediateChildPages()`
- Routing fix: `portfolio_archive` → `PortfolioLayout`
- `siteConfig.ts`: `phoneLabel`, `phone2`, `phone2Href`, `phone2Label`,
  `telegram`, `social.{vk, telegram, ok}` — all from env vars, hidden when empty

### Next work — Track B (PBN infrastructure), Variant 3

**Variant 3** means: get Firecrawl + Exa API keys and run real multi-donor crawl.
Firecrawl MCP is already connected (`mcp__firecrawl__*` tools available).
Exa MCP not yet connected (needs `EXA_API_KEY` in `site/.env`).

**B1 · Multi-donor pipeline (priority)**

B1.1 ✅ Done (2026-05-12, commit a0d9b54):
- `find_wp_endpoint`: regex generalized to `https?://[^"'<\s]+/wp-json/wp/v2/...`
- `enrich_page`: `source_domain: str = ""` param, check skipped if empty
- `crawl_pages.py main`: `--source-domain` (auto-detected from first seed if omitted)
- `qa_pages.py`: `--source-domain` default `None`; external_redirect check guarded

B1.2 — Firecrawl MCP backend:
- `mcp__firecrawl__firecrawl_crawl(url, maxDepth, limit)` crawls entire donor
- `mcp__firecrawl__firecrawl_scrape(url)` fetches single page
- New `site_pipeline/crawl_firecrawl.py` or flag `--backend firecrawl` in existing
  crawl script; output format same as current `pages/*.json`

B1.3 — Universal content extractor:
- Current extractor relies on WP REST API (`/wp-json/wp/v2/pages/`) with HTML fallback
- New donor may not run WP or may have different structure
- Generalize: try WP REST → fall back to a ranked list of content selectors →
  fall back to `<main>` / `<article>` / largest text block

B1.4 — Test run on second donor:
- Pick a niche SEO-agency site as donor (Exa search once key is available)
- Crawl with Firecrawl, run through extractor, build manifest, check QA report

**B0/B6.4 are done for the first test site.** Repeat B0 for every new site in
the network with a different brand, contacts, and Metrika counter.

**B2+ stays pending** (batch deploy, themes, link config) — do B1 first, except
small post-deploy validation tasks listed below.

### Immediate next steps after the 2026-05-12 deploy

1. Verify Yandex Webmaster ownership using:
   `http://yourkedm.beget.tech/yandex_b096686526decb58.html`
2. Open Yandex Metrika and confirm counter `109164667` receives a real visit.
3. Submit a test request through `http://yourkedm.beget.tech/kontakty/`.
4. Confirm `PUBLIC_CONTACT_FORM_TO` points to a mailbox that exists on Beget or
   to another real recipient.
5. Run browser smoke checks for `/`, `/seo-uslugi/`, `/kontakty/`,
   `/portfolio/`, `/faq/`, and one article/service detail page.
6. After smoke checks, continue B1.2: Firecrawl MCP backend.

### Deploy

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run check:b0
npm run build
npm run deploy:dry
npm run deploy   # reads credentials from site/.env
```

One-liner:

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run build && npm run deploy   # reads credentials from site/.env
```

Test URL: http://yourkedm.beget.tech/
FTP host is configured in uncommitted `site/.env`.
Disable iCloud Private Relay before FTP (System Settings → Apple ID → iCloud).

## Next recommended work (pipeline)

1. Review `warning` rows in `qa_sections.csv`.
2. Decide whether short `portfolio` pages are acceptable as real case cards.
3. Generate sitemap and robots output.
4. Verify generated pages with Playwright smoke tests.

## Site implementation requirements

The future generated site is expected to be deployed on Beget hosting.

Deployment:

- Configure SSH access to Beget.
- Prefer a repeatable deploy command/script over manual file uploads.
- The deploy flow should build the static site locally or in CI, then sync the
  generated output to Beget over SSH/SFTP/rsync, depending on what the hosting
  account supports.
- Keep credentials out of the repository. Use local environment variables,
  SSH config, or a private deploy config that is ignored by git.
- Add a dry-run or staging deploy option if possible.

Analytics:

- Add Yandex Metrica counter support.
- Add Google analytics support if needed, likely GA4.
- Keep counter IDs configurable through environment variables or a site config
  file, not hardcoded deeply in templates.
- Ensure analytics scripts are included once, do not break page rendering, and
  can be disabled for local development.

Forms:

- Add feedback/contact form support where needed.
- Decide whether the form sends via Beget PHP/mail, SMTP, a serverless endpoint,
  or an external form service.
- Add anti-spam protection before exposing forms publicly.
- Possible anti-bot options: honeypot field, rate limiting if backend exists,
  CSRF token if using dynamic backend, simple captcha/turnstile if needed.
- Do not add intrusive bot protection to normal content pages; protect only
  forms and abuse-prone endpoints.

SEO requirements:

- Preserve original paths for buildable pages.
- Use title, description, H1, canonical, and content from page JSON/indexes.
- Generate `sitemap.xml` from `build_manifest.json`.
- Generate `robots.txt`.
- Apply redirects from `redirects.json`.
- Check canonical consistency and avoid generating pages for excluded redirects.
- Validate internal links after build.
- Validate per-page metadata after build.
- Preserve useful HTML formatting from `content_html`: headings, paragraphs,
  lists, links, images, tables, strong/emphasis.
- Add JSON-LD structured data / microdata through shared schema helpers.
- Important schema targets: home, contacts, articles/blog, FAQ, service pages,
  portfolio/case pages, archives, and SEO Wikipedia/dictionary pages.
- Do not invent schema data. Emit only reliable fields from page JSON,
  WordPress metadata, and site config.
- See `SITE_ARCHITECTURE.md` for the schema and template architecture plan.

Design / template requirements:

- Keep content data separate from visual templates.
- Make page type mapping configurable by section/path.
- Use reusable layouts for home, article, archive, service, portfolio, contact,
  FAQ, and generic content pages.
- Put SEO/meta/schema generation in shared helpers/components, not scattered
  across templates.
- Allow future redesigns by changing layouts/components/theme tokens without
  editing parsed JSON content.

Affiliate / partner link requirements:

- The future site may include partner links, sponsored placements, and
  traffic-arbitrage promo blocks inside articles, service pages, contacts, or
  other important pages.
- These must be config/data-driven, not hardcoded into parsed page content or
  individual templates.
- Add a reusable affiliate/link helper and promo slot component when building
  the generator.
- Partner links should be editable from a central file such as
  `affiliateLinks.json`.
- Sponsored/promo text blocks should be editable from a central file such as
  `promoSlots.json`.
- Support targeting by page type, section, path, or exact page ID.
- Support fast disabling/replacing of links and promos.
- Default paid/sponsored/affiliate outbound links to `rel="sponsored nofollow"`
  unless there is a specific reason not to.
- UTM tags should be generated by helper logic rather than hand-written
  repeatedly.
- Keep an auditable list of outbound monetization links.
- Example use case to remember: an article discussing Sape's 2026 link-market
  research, PBN economics, portals/media, IKS filtering, rental links, and
  profitable niches, with a configurable sponsor line at the end.
- See `SITE_ARCHITECTURE.md` for the planned data/config structure.

Security / correctness:

- Do not use proxying to bypass restrictions. Proxy support exists only for
  approved infrastructure.
- Avoid sending scraped content to third-party AI APIs unless the user explicitly
  approves and the content is safe to process.
- Keep secrets out of committed files.
- Add a final launch checklist covering SEO, analytics, robots, sitemap, forms,
  redirects, and Beget deploy verification.

## MCP / memory note

The code has been indexed with jcodemunch:

```text
repo: local/mosseo-site-pipeline-db570d70
```

`claude-mem` is available on this machine. It stores local memory in
`~/.claude-mem` and normally begins injecting relevant memory from the second
Claude Code session in a project. This `HANDOFF.md` is the reliable project-local
handoff independent of memory injection.
