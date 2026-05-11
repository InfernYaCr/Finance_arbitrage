# Mosseo Site Pipeline

Read `HANDOFF.md` first. It contains the current project state, generated
artifacts, QA status, and the next recommended tasks.

This project is a pre-deployment content pipeline for turning the Mosseo CSV
export into structured JSON data and build indexes for a future static site.

## Claude quick context

Workspace:

```bash
/Users/deniskononov/mosseo-site-pipeline
```

Main context files to read first:

- `HANDOFF.md` - current state, decisions, commands, latest QA.
- `SITE_ARCHITECTURE.md` - architecture, SEO/schema, contacts/media strategy.
- `SITE_STRUCTURE.md` - section map, page counts, priority QA routes.
- `LAUNCH_CHECKLIST.md` - deployment/SEO/forms/analytics checklist.
- `site_pipeline/PLAN.md` - pipeline and implementation phases.

Generated content and indexes:

- `site_pipeline/output/pages/*.json` - parsed page payloads, generated and gitignored.
- `site_pipeline/output/build_manifest.json` - buildable routes for Astro.
- `site_pipeline/output/qa_report.json` - QA report.
- `site_pipeline/output/template_audit.json` - source template classification.
- `site_pipeline/output/content_index.sqlite` - quick local inspection DB.

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
- Old brand is normalized at render time in `loadPages.ts`.
- Old contacts/requisites/staff contacts are normalized or removed at render time.
- Old `/content/` and `/wp-content/` media defaults to `/images/placeholder.svg`.
- Change contacts in env/site config, not in parsed content.
- `PUBLIC_LEGACY_MEDIA_MODE` supports `placeholder`, `source`, and `local`.
- **Never inject `content_html` from contact or homepage JSON via `set:html`** — the
  extracted WP HTML contains nested `<div class="container">` that breaks outer layout
  via the HTML parser. Contact and Home use structured components instead.
- `siteConfig.ts` has `phone2`, `phoneLabel`, `telegram`, `social.{vk,telegram,ok}` —
  all read from env vars; empty string hides the element.

Parallel-work caution:

- `AGENTS.md`, `site/scripts/download-images.sh`, and `site/scripts/ru-images.txt`
  may be user/other-agent work. Do not overwrite or revert them without checking.

Use the local virtual environment:

```bash
. .venv/bin/activate
```

Current code entry points:

- `site_pipeline/normalize_csv.py`
- `site_pipeline/crawl_pages.py`
- `site_pipeline/qa_pages.py`
- `site_pipeline/build_content_index.py`
- `site_pipeline/probe_pages.py`
- `site_pipeline/audit_extraction_sources.py`
- `site_pipeline/audit_page_templates.py`

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
cd /Users/deniskononov/mosseo-site-pipeline
. .venv/bin/activate
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
python site_pipeline/audit_page_templates.py
```

Astro build/check:

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run build
npm run check
```

Local preview:

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run preview -- --host 127.0.0.1 --port 4321
```

Deploy to Beget:

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run build && npm run deploy
```

Credentials are read automatically from `site/.env` (not committed). Before
running, disable iCloud Private Relay (System Settings → Apple ID → iCloud →
Private Relay → Off) — otherwise FTP data connections fail with `425 Bad IP`.
Stop with Ctrl+C if needed.

FTP account: `yourkedm_testseo` → `yourkedm.beget.tech` → root = `/seo-test/public_html`.
Test domain: http://yourkedm.beget.tech/

Useful smoke-test routes:

- `/`
- `/seo-uslugi/`
- `/seo-uslugi/audit-sajta/audit-seo-podryadchika/`
- `/seo-prodvizhenie-sajta/`
- `/stoimost-uslug/`
- `/kontakty/`
