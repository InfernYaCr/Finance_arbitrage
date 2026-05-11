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

- `site/src/pages/[...slug].astro` - route generator.
- `site/src/data/loadPages.ts` - loads parsed JSON and normalizes brand, contacts, media.
- `site/src/data/siteConfig.ts` - central config for brand, contacts, analytics, old-media mode.
- `site/src/lib/routing.ts` - page type mapping.
- `site/src/lib/seo.ts` - SEO fields.
- `site/src/lib/schema.ts` - JSON-LD.
- `site/src/layouts/` - visual page templates.
- `site/src/styles/global.css` - global and extracted legacy block styles.

Important current behavior:

- Do not hand-edit `site_pipeline/output/pages/*.json` for design, contacts, brand, or media changes.
- Old brand is normalized at render time.
- Old contacts/requisites/staff contacts are normalized or removed at render time.
- Old `/content/` and `/wp-content/` media defaults to `/images/placeholder.svg`.
- Change contacts in env/site config, not in parsed content.
- `PUBLIC_LEGACY_MEDIA_MODE` supports `placeholder`, `source`, and `local`.

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

Useful smoke-test routes:

- `/`
- `/seo-uslugi/`
- `/seo-uslugi/audit-sajta/audit-seo-podryadchika/`
- `/seo-prodvizhenie-sajta/`
- `/stoimost-uslug/`
- `/kontakty/`
