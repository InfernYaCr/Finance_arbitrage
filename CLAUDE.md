# Mosseo Site Pipeline

Read `HANDOFF.md` first. It contains the current project state, generated
artifacts, QA status, and the next recommended tasks.

This project is a pre-deployment content pipeline for turning the Mosseo CSV
export into structured JSON data and build indexes for a future static site.

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
