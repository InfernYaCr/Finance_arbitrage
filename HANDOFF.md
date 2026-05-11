# Mosseo Site Pipeline Handoff

## Current status

The pipeline has completed a full crawl and QA pass for the Mosseo page export.

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

Set the generated-site brand with:

```bash
PUBLIC_SITE_NAME="Тестовый SEO-проект"
PUBLIC_SITE_NAME_FULL="Тестовый SEO-проект — SEO-продвижение сайтов"
```

The current fallback brand is `Тестовый SEO-проект`.

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

## Next recommended work

1. Review `warning` rows in `qa_sections.csv`.
2. Decide whether short `portfolio` pages are acceptable as real case cards.
3. Start a static site generator prototype, likely Astro.
4. Use `build_manifest.json` to generate routes.
5. Use `pages/*.json` as per-page content payloads.
6. Use `redirects.json` for redirects.
7. Generate sitemap and robots output.
8. Verify generated pages with Playwright/browser checks.

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
