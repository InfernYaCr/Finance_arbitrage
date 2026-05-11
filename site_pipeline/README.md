# Mosseo content pipeline

This folder contains the pre-deployment pipeline for turning `internal_html.csv`
into a structured page dataset. It does not build or deploy the website yet.

## Recommendation

Use the CSV as the canonical URL seed list, then extract content primarily from
WordPress REST API endpoints discovered in each HTML page:

1. Fetch page HTML from `Address`.
2. Find `<link rel="alternate" type="application/json" href=".../wp-json/wp/v2/...">`.
3. Fetch the REST object.
4. Use `content.rendered` for posts/pages and category `description` for archives.
5. Fall back to HTML extraction only when REST content is empty or unavailable.

This is more stable than scraping rendered HTML because the visible page includes
menus, lead forms, popups, breadcrumbs, footers, and other template blocks.

## Storage format

Keep the crawl output as files for now:

- `pages/*.json` - one page per file; easy to inspect, diff, regenerate, and feed into Astro/Next.
- `manifest.json` - compact build/index input for sitemap, route generation, and QA.
- `qa_report.json` / `qa_review.csv` - quality gates before using the data for site generation.

For 1013 pages the expected JSON size is roughly 15-20 MB, so a database is not
needed yet. Add SQLite later only if the project needs an admin UI, editorial
statuses, search, versioning, or manual review workflow.

## Screaming Frog

Screaming Frog is useful for exports and QA:

- URL inventory
- titles, descriptions, H1/H2
- status codes, canonicals, duplicate detection
- custom extraction prototypes

It is not ideal as the only content source for rebuilding a site because it
creates manual export steps and does not give a clean, versioned transformation
from source URL to page JSON. Keep it as an audit/input tool; use this pipeline
for reproducible migration.

## Setup

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r site_pipeline/requirements.txt
```

## Commands

Normalize CSV into seeds:

```bash
python site_pipeline/normalize_csv.py
```

Probe representative pages:

```bash
python site_pipeline/probe_pages.py --sample-per-section 1 --limit 30
```

Crawl a small batch:

```bash
python site_pipeline/crawl_pages.py --limit 20
```

Run QA on crawled JSON:

```bash
python site_pipeline/qa_pages.py
```

Build compact content indexes:

```bash
python site_pipeline/build_content_index.py
```

Classify parsed source templates:

```bash
python site_pipeline/audit_page_templates.py
```

Full crawl:

```bash
python site_pipeline/crawl_pages.py --delay 1.0 --resume
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
python site_pipeline/audit_page_templates.py
```

Full crawl with a proxy, if the source starts returning 429/403 or timing out:

```bash
python site_pipeline/crawl_pages.py --delay 1.0 --resume --proxy http://user:pass@host:port
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
```

Strict public-crawl mode with `robots.txt` checks:

```bash
python site_pipeline/crawl_pages.py --delay 1.0 --resume --respect-robots
python site_pipeline/qa_pages.py
```

## Output

Default output goes to `site_pipeline/output/`:

- `seeds.json` - normalized URL list from CSV
- `seed_report.json` - inventory summary
- `probe_report.json` - extractor strategy report
- `pages/*.json` - one structured content file per URL
- `manifest.json` - compact list of crawled pages
- `crawl_report.json` - crawl quality summary
- `qa_report.json` - detailed post-crawl quality report
- `qa_review.csv` - spreadsheet-friendly list of pages needing review
- `qa_sections.csv` - section-level QA summary
- `build_manifest.json` - buildable pages for the future site generator
- `redirects.json` - external/canonical redirects to handle separately
- `excluded_pages.json` - pages excluded from generation
- `content_index.jsonl` - compact searchable page index
- `content_index.sqlite` - SQLite index for quick querying
- `template_audit.json` - source-template classification
- `template_audit.csv` - spreadsheet-friendly template audit

Each page JSON contains:

- CSV seed metadata
- fetch status and final URL
- discovered WordPress REST endpoint
- HTML meta fields
- WordPress metadata when available
- clean `content_html` and `content_text`
- content links and images
- basic quality counters

## Runtime sanitization

Generated JSON keeps source content. Site rendering normalizes old brand,
contacts, legal details, and legacy media through `site/src/data/loadPages.ts`
and `site/src/data/siteConfig.ts`.

Change contacts with environment variables such as:

```bash
PUBLIC_COMPANY_PHONE="+7 000 000-00-00"
PUBLIC_COMPANY_EMAIL="hello@example.test"
PUBLIC_COMPANY_ADDRESS="Адрес уточняется"
```

Control old extracted images with:

```bash
PUBLIC_LEGACY_MEDIA_MODE="placeholder" # placeholder | source | local
PUBLIC_MEDIA_PLACEHOLDER="/images/placeholder.svg"
```

Do not mass-edit `pages/*.json` for these changes.

## Full-crawl safety

The crawler is intentionally polite and resumable:

- `--delay` pauses between pages.
- `--retries` retries temporary failures and 429/5xx responses.
- `--backoff` increases wait time between retries.
- `--resume` skips existing page JSON files.
- `--respect-robots` skips URLs disallowed by `robots.txt`.
- `--proxy` is optional and should be used only for approved infrastructure,
  not to bypass a third-party site's access restrictions.

Recommended order before site generation:

1. `normalize_csv.py`
2. `probe_pages.py --sample-per-section 1 --limit 30`
3. `crawl_pages.py --delay 1.0 --resume`
4. `qa_pages.py`
5. `build_content_index.py`
6. `audit_page_templates.py`
7. Review `qa_review.csv` and improve selectors for any `body_fallback`,
   `template_contamination`, or `empty_content_html` pages.
