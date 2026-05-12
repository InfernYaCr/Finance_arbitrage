# Mosseo Site Pipeline Plan

## Goal

Prepare a reliable pre-deployment content pipeline that turns the existing
Screaming Frog/internal HTML CSV into clean structured page data for a future
multi-page site build.

## Current decision

Use file-based JSON storage for the migration dataset:

- one JSON file per page in `site_pipeline/output/pages/`;
- one compact `manifest.json` for routing, sitemap, and build inputs;
- one `qa_report.json` plus `qa_review.csv` for quality review.

Expected volume for roughly 1013 pages is about 15-20 MB, so SQLite or another
database is unnecessary at this stage. Add a database later only if editorial
workflow, manual statuses, search, or versioning becomes necessary.

## Work phases

### Queued next implementation phase

- Review parallel SSH/deploy changes separately before merging them.
- Finish Beget deploy flow in small commits.
- Add contact/feedback forms and anti-spam.
- Add configurable Yandex Metrica and Google Analytics/GA4.
- Expand schema generation and QA for home, contacts, services, articles,
  FAQ, archives, portfolio/cases, and dictionary pages.
- Run SEO launch checks after each step.

### 1. Normalize source CSV

- Convert all URLs to canonical `https://mosseo.ru/...` form.
- Remove duplicates.
- Derive `path`, `section`, and `depth`.
- Preserve CSV SEO fields: title, description, H1, H2.

Output:

- `seeds.json`
- `seed_report.json`

### 2. Probe extraction strategy

- Test representative URLs across sections.
- Prefer WordPress REST API content when available.
- Use HTML fallback only for custom templates and archives.
- Identify external redirects and problematic templates early.

Output:

- `probe_report.json`

### 3. Crawl content safely

- Fetch each seed URL.
- Discover and fetch WordPress REST endpoint.
- Extract `content_html`, `content_text`, links, and images.
- Use retries/backoff for temporary failures.
- Use `--resume` to continue interrupted crawls.
- Use `--respect-robots` when running in strict public-crawl mode.
- Use `--proxy` only for approved infrastructure, not to bypass access limits.

Output:

- `pages/*.json`
- `manifest.json`
- `crawl_report.json`

### 4. Quality gate

- Flag empty or very short content.
- Flag external redirects.
- Flag `body` fallback pages.
- Flag template/menu contamination.
- Flag missing SEO fields and canonical mismatches.
- Export review CSV for quick manual inspection.

Output:

- `qa_report.json`
- `qa_review.csv`

### 4a. Template audit

- Classify every parsed page by source HTML template and generated page type.
- Use the audit to separate true missing content from intentionally short
  category/catalog pages.
- Review service pages by template family:
  - `service_catalog` pages are source service category pages with cards.
  - `quiz_calculator` pages are long service landing pages.
  - `generic_content` pages are normal prose/service content.
  - `service_category_nav` pages need manual spot checks because they have
    category navigation but no visible service cards.

Output:

- `template_audit.json`
- `template_audit.csv`

### 5. Build content indexes

- Export buildable pages to `build_manifest.json`.
- Export redirect-only URLs to `redirects.json`.
- Export non-buildable pages to `excluded_pages.json`.
- Build a compact JSONL index for search and inspection.
- Build a SQLite index for quick querying by section, severity, issue, or route.

Output:

- `build_manifest.json`
- `redirects.json`
- `excluded_pages.json`
- `content_index.jsonl`
- `content_index.sqlite`

### 6. Selector refinement

- Review pages with `error` and `warning` severities.
- Add template-specific selectors where fallback picks too much HTML.
- Re-crawl only affected pages or run full crawl with `--resume`.

### 7. Future site generation

- Use `manifest.json` and `pages/*.json` as build input.
- Generate matching routes, sitemap, robots, SEO tags, and page templates.
- Validate generated pages in browser and with link/metadata checks.

### 8. Beget deployment

- Configure SSH access to Beget hosting.
- Keep SSH credentials and deploy secrets outside the repository.
- Add a repeatable deploy script using SSH/SFTP/rsync, depending on account
  support.
- Support dry-run or staging deploy if possible.
- Verify generated files, redirects, `robots.txt`, and `sitemap.xml` after
  upload.

### 9. Analytics, forms, and anti-spam

- Add configurable Yandex Metrica support.
- Add configurable Google Analytics / GA4 support if required.
- Add feedback/contact form support.
- Choose form delivery method: Beget PHP/mail, SMTP, external service, or
  another approved backend.
- Protect forms with anti-spam controls such as honeypot, CSRF token, rate
  limiting, or captcha/turnstile where appropriate.
- Do not place intrusive bot protection on normal content pages.

### 10. SEO launch QA

- Preserve original URL paths for all buildable pages.
- Use extracted titles, descriptions, H1, canonical, links, images, and
  `content_html` formatting.
- Generate `sitemap.xml` from `build_manifest.json`.
- Generate `robots.txt`.
- Apply `redirects.json` and skip `excluded_pages.json`.
- Generate JSON-LD structured data through shared helpers:
  - `Organization` and `WebSite` globally.
  - `ContactPage` for contacts.
  - `Article` / `BlogPosting` for articles.
  - `FAQPage` only for real question/answer pages.
  - `Service` for service pages.
  - `CollectionPage` / `ItemList` for archives.
  - `CreativeWork`-style schema for portfolio/case pages.
- Validate internal links, canonical tags, page titles, descriptions, H1, image
  URLs, JSON-LD, and sitemap coverage.
- Run browser/Playwright checks on representative page types before launch.

### 11. Template and redesign architecture

- Keep parsed content independent from visual design.
- Add page type mapping by path/section.
- Use reusable layouts for home, article, archive, service, portfolio, contact,
  FAQ, and generic content pages.
- Keep SEO/meta/schema in shared helpers/components.
- Use design tokens/theme files so future redesigns do not require changing the
  content dataset.
- See root `SITE_ARCHITECTURE.md`.

### 12. Affiliate, partner links, and promo slots

- Add a central affiliate/partner link config, for example
  `affiliateLinks.json`.
- Add a central promo/sponsor slot config, for example `promoSlots.json`.
- Add reusable components/helpers such as `AffiliateLink` and `PromoSlot`.
- Allow promo/link targeting by page type, section, path, or exact page ID.
- Allow fast disabling/replacing of partner links and sponsor blocks.
- Generate UTM parameters centrally.
- Mark paid/sponsored/affiliate outbound links with `rel="sponsored nofollow"`
  by default.
- Keep an auditable list of monetization links for SEO/compliance review.

## Recommended full run

```bash
cd /Users/deniskononov/mosseo-site-pipeline
. .venv/bin/activate
python site_pipeline/normalize_csv.py
python site_pipeline/probe_pages.py --sample-per-section 1 --limit 30
python site_pipeline/crawl_pages.py --delay 1.0 --resume
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
python site_pipeline/audit_page_templates.py
```

If the source starts throttling:

```bash
python site_pipeline/crawl_pages.py --delay 1.0 --resume --proxy http://user:pass@host:port
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
```

If the crawl must strictly respect public crawling rules:

```bash
python site_pipeline/crawl_pages.py --delay 1.0 --resume --respect-robots
python site_pipeline/qa_pages.py
python site_pipeline/build_content_index.py
```
