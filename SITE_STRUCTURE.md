# Site Structure Overview

This file is the human-facing map of the generated site.

Canonical route source:

```text
site_pipeline/output/build_manifest.json
```

Generated pages:

```text
site/dist/
```

## Current Totals

- Buildable pages: 1011
- Generated pages after Astro build: 1013, including 404 and editorial additions
- Sitemap URLs: 1012
- Top-level routes: 26
- URL depth:
  - depth 0: 1
  - depth 1: 26
  - depth 2: 465
  - depth 3: 458
  - depth 4: 58
  - depth 5: 3

## Main Sections

| Section | Pages | Notes |
| --- | ---: | --- |
| `vse-o-seo-prodvizhenii` | 443 | Blog, SEO articles, SEO news, nested archive pages |
| `seo-wikipedia` | 125 | Dictionary/glossary content |
| `seo-uslugi` | 93 | Service catalog and service detail pages |
| `portfolio` | 53 | Portfolio archives and case pages |
| `uslugi` | 53 | Legacy/service-like pages; one source URL is an external redirect |
| `faq` | 47 | FAQ archive and question pages |
| `seo-prodvizhenie-sajta` | 44 | SEO promotion content/service pages |
| `na-ponyatnom-yazyke` | 38 | Educational SEO articles |
| `seo-po-tematikam` | 26 | SEO by business niche/topic |
| `konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta` | 19 | Audit/consulting service cluster |
| `optimizaciya` | 14 | Optimization articles/service pages |
| `vidy-tipy-sajtov-i-ih-klassifikaciya` | 12 | Site type taxonomy content |
| `stoimost-uslug` | 9 | Pricing/cost pages |
| `kontekstnaya-reklama` | 8 | Ads/SMM/contextual advertising pages |
| `o-kompanii` | 8 | Company pages |
| `poiskovye-sistemy` | 6 | Search engine pages |

Single-page sections:

```text
calc
case
kontakty
novosti
otzyvy
photogallery
privacy
prodvizhenie-sajta-samostoyatelno
rejting-seo
tarify-seo
zakazat-kompleksnoe-prodvizhenie-sajta
zerkalo-sajta-pereezd-sklejka-i-rasklejka-veb-resursa
```

## Top-Level Routes

```text
/
/calc/
/case/
/faq/
/konsultacii-ehkspertov-po-seo-i-soprovozhdenie-sajta/
/kontakty/
/kontekstnaya-reklama/
/na-ponyatnom-yazyke/
/o-kompanii/
/optimizaciya/
/otzyvy/
/photogallery/
/poiskovye-sistemy/
/portfolio/
/privacy/
/prodvizhenie-sajta-samostoyatelno/
/rejting-seo/
/seo-po-tematikam/
/seo-prodvizhenie-sajta/
/seo-uslugi/
/seo-wikipedia/
/stoimost-uslug/
/tarify-seo/
/vidy-tipy-sajtov-i-ih-klassifikaciya/
/vse-o-seo-prodvizhenii/
/zakazat-kompleksnoe-prodvizhenie-sajta/
/zerkalo-sajta-pereezd-sklejka-i-rasklejka-veb-resursa/
```

## Priority QA Areas

Check these first because they drive the site structure and SEO:

1. `/seo-uslugi/`
   - Service catalog landing page.
   - Should show child service cards from `build_manifest.json`.
   - Current generated check: 46 cards, 83 catalog links, one H1.

2. `/vse-o-seo-prodvizhenii/`
   - Main blog/archive area.
   - Has many nested archives and article pages.
   - Needs special QA for pagination/archive pages.

3. `/seo-wikipedia/`
   - Dictionary archive and 120+ glossary entries.
   - Important for `DefinedTerm` / dictionary-style schema decisions.

4. `/portfolio/`
   - Portfolio archive and case pages.
   - Some child pages are category-like portfolio groupings, not true cases.

5. `/faq/`
   - FAQ archive and question pages.
   - Only emit `FAQPage` schema where real question/answer pairs are reliably detected.

6. `/kontakty/`
   - Contact schema, forms, analytics goals, anti-spam, and business info.

## Useful Inspection Commands

Section counts:

```bash
cd /Users/deniskononov/mosseo-site-pipeline
.venv/bin/python - <<'PY'
import json
from collections import Counter
from pathlib import Path
manifest = json.loads(Path('site_pipeline/output/build_manifest.json').read_text())
for section, count in Counter(p['section'] or '(root)' for p in manifest).most_common():
    print(f'{section}: {count}')
PY
```

Top-level pages:

```bash
cd /Users/deniskononov/mosseo-site-pipeline
.venv/bin/python - <<'PY'
import json
from pathlib import Path
manifest = json.loads(Path('site_pipeline/output/build_manifest.json').read_text())
for page in sorted(manifest, key=lambda p: p['path']):
    depth = 0 if page['path'] == '/' else len(page['path'].strip('/').split('/'))
    if depth <= 1:
        print(page['path'], '|', page['h1'] or page['title'], '|', page['section'])
PY
```

Immediate children for a route:

```bash
cd /Users/deniskononov/mosseo-site-pipeline
PARENT=/seo-uslugi/ .venv/bin/python - <<'PY'
import json, os
from pathlib import Path
parent = os.environ['PARENT']
parent_depth = len(parent.strip('/').split('/')) if parent != '/' else 0
manifest = json.loads(Path('site_pipeline/output/build_manifest.json').read_text())
for page in sorted(manifest, key=lambda p: p['path']):
    if page['path'] == parent or not page['path'].startswith(parent):
        continue
    depth = len(page['path'].strip('/').split('/'))
    if depth == parent_depth + 1:
        print(page['path'], '|', page['h1'] or page['title'])
PY
```

Generated-page sanity check:

```bash
cd /Users/deniskononov/mosseo-site-pipeline/site
npm run build
```

## Notes

- Raw source data still contains the old brand in extracted titles/content.
  The generated site normalizes the brand at render time through
  `site/src/lib/brand.ts` and `site/src/data/loadPages.ts`.
- Do not hand-edit generated page JSON for structural changes. Update parser,
  manifest logic, layouts, or shared normalizers instead.
- The current archive layout can render child-page catalogs for section landing
  pages, which is especially important for `/seo-uslugi/`.
