# New Pipeline Architecture

> Подготовительный документ перед B2+ рефакторингом.
> Не начинать миграцию без явного подтверждения пользователя.

---

## Текущая архитектура (as-is)

```
Donor site
  ↓
crawl_pages.py / crawl_pages_fc.py
  ↓
site_pipeline/output/pages/*.json   ← один набор на всё
  ↓
qa_pages.py
  ↓
build_content_index.py → build_manifest.json / content_index.sqlite
  ↓
Astro build (site/)
  CONTENT_OUTPUT_DIR → выбор датасета вручную через env
  ↓
FTP deploy → Beget
```

**Ограничения:**
- Один набор pages/*.json — нет изоляции между сайтами
- `CONTENT_OUTPUT_DIR` — bridge-решение, не масштабируется
- Нет реестра доноров, краул-ранов, build-ранов
- Нет версионирования контента
- Brand normalization только на уровне Astro render (loadPages.ts)
- Donor CSS/style нигде не фиксируется структурно
- Деплой не привязан к конкретному сайту — только один Beget аккаунт

---

## Целевая архитектура (to-be)

```
┌─────────────────────────────────────────────────┐
│  Discovery layer (Exa)                          │
│  discover_donors.py → qualify_donor.py          │
│  → donors registry                             │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Crawl layer (Firecrawl / legacy)               │
│  crawl_pages_fc.py --source-domain <donor>      │
│  → raw crawl artifacts (per donor, per run)     │
│  → normalized PageData + extracted              │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Registry (SQLite / JSON)                       │
│  donors           — url, verdict, niche, score  │
│  crawl_runs       — donor_id, date, credit_cost │
│  raw_pages        — per donor per crawl run     │
│  normalized_pages — PageData contract           │
│  extractions      — LLM extracted fields        │
│  style_profiles   — donor visual DNA            │
│  site_targets     — SITE_ID → donor + brand     │
│  build_runs       — SITE_ID, date, page_count   │
│  deploy_runs      — SITE_ID, ftp host, status   │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Exporter (per SITE_ID)                         │
│  export_site.py --site-id <id>                  │
│  → sites/<id>/pages/*.json (or pages.jsonl)     │
│  → sites/<id>/build_manifest.json               │
│  → sites/<id>/theme.tokens.json                 │
│  → sites/<id>/site.config.json                  │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Astro renderer (единый)                        │
│  site/ — один build pipeline                    │
│  SITE_ID → читает sites/<id>/ экспорт           │
│  brand normalization → loadPages.ts             │
│  donor_style_profile → theme tokens (B3)        │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Deploy (build-all.sh)                          │
│  итерация по sites/ → build → FTP Beget         │
│  Playwright smoke-test → OK/FAIL per site       │
└─────────────────────────────────────────────────┘
```

---

## Компоненты целевой архитектуры

### 1. Registry (SQLite v1)

Единая точка истины для всего пайплайна.

**Схема (draft):**

```sql
-- Доноры
CREATE TABLE donors (
  id          TEXT PRIMARY KEY,   -- slug: vsezaimyonline-ru
  url         TEXT NOT NULL,
  niche       TEXT,               -- finance, seo, legal, ...
  verdict     TEXT,               -- CRAWL | SKIP | PENDING
  score       REAL,               -- Exa qualify score
  page_count  INTEGER,
  crawled_at  TEXT,               -- ISO datetime
  notes       TEXT
);

-- Краул-раны
CREATE TABLE crawl_runs (
  id          TEXT PRIMARY KEY,
  donor_id    TEXT REFERENCES donors(id),
  started_at  TEXT,
  finished_at TEXT,
  page_count  INTEGER,
  credit_cost INTEGER,
  mode        TEXT,               -- base | llm | recrawl
  output_dir  TEXT
);

-- Нормализованные страницы
CREATE TABLE pages (
  id          TEXT PRIMARY KEY,   -- donor_id + slug
  donor_id    TEXT REFERENCES donors(id),
  crawl_run   TEXT REFERENCES crawl_runs(id),
  slug        TEXT,
  page_type   TEXT,
  title       TEXT,
  h1          TEXT,
  meta_desc   TEXT,
  content_md  TEXT,
  extracted   TEXT,               -- JSON blob (LLM fields)
  word_count  INTEGER,
  status      TEXT                -- ok | warn | error
);

-- Целевые сайты
CREATE TABLE site_targets (
  id              TEXT PRIMARY KEY,   -- rostpoisk, finhelp-ru, ...
  donor_id        TEXT REFERENCES donors(id),
  brand_name      TEXT,
  brand_name_full TEXT,
  beget_host      TEXT,
  beget_ftp_user  TEXT,
  theme           TEXT,               -- alpha | beta | gamma
  metrika_id      TEXT,
  created_at      TEXT
);

-- Build-раны
CREATE TABLE build_runs (
  id          TEXT PRIMARY KEY,
  site_id     TEXT REFERENCES site_targets(id),
  started_at  TEXT,
  finished_at TEXT,
  page_count  INTEGER,
  status      TEXT                -- ok | error
);
```

### 2. sites/ структура (B2.1)

```
sites/
  rostpoisk/              ← SITE_ID
    site.config.json      ← бренд, контакты, аналитика, FTP
    theme.tokens.json     ← CSS токены (опционально на B3)
    pages/                ← экспорт из registry (gitignored)
      *.json
    build_manifest.json   ← экспорт
  finhelp-ru/
    site.config.json
    pages/
    ...
```

**site.config.json (пример):**
```json
{
  "site_id": "rostpoisk",
  "donor_id": "mosseo-ru",
  "brand": {
    "name": "РостПоиск",
    "name_full": "РостПоиск — продвижение сайтов для бизнеса",
    "aliases": ["Мосео", "mosseo", "Мosseo"]
  },
  "contacts": {
    "phone": "+7 495 128-34-56",
    "phone_href": "+74951283456",
    "email": "lead@yourkedm.beget.tech",
    "address": "Москва, Пресненская набережная, 12",
    "worktime": "Пн-Пт, 10:00-19:00"
  },
  "analytics": {
    "metrika_id": "109164667",
    "gtag_id": ""
  },
  "deploy": {
    "beget_host": "yourkedm.beget.tech",
    "beget_ftp_user": "yourkedm_testseo",
    "beget_ftp_path": "/"
  },
  "theme": "alpha",
  "enable_editorial_posts": false
}
```

### 3. Exporter (export_site.py)

```
export_site.py --site-id rostpoisk
  → читает site_targets + pages из registry
  → применяет brand_aliases фильтр
  → пишет sites/rostpoisk/pages/*.json
  → пишет sites/rostpoisk/build_manifest.json
```

### 4. Build-all (build-all.sh)

```bash
for SITE_ID in sites/*/; do
  export_site.py --site-id "$SITE_ID"
  SITE_ID=$SITE_ID npm run build
  SITE_ID=$SITE_ID npm run deploy
done
```

### 5. Style pipeline (B3, future)

```
donor CSS/HTML → style_extractor.py
  → palette (oklch tokens)
  → typography (font-family, size scale)
  → border-radius, shadow, spacing rhythm
  → donor_style_profile JSON
  ↓
theme_generator.py --profile donor_style_profile.json --base alpha
  → sites/<id>/theme.tokens.json
  ↓
Astro build → injects theme tokens
```

Donor CSS **никогда** не копируется напрямую в Astro layouts.

---

## Сравнение вариантов

| Критерий | Текущее | Bridge (CONTENT_OUTPUT_DIR) | Целевое (Registry) |
|---|---|---|---|
| Изоляция сайтов | ❌ один pages/ | ⚠️ разные dir | ✅ SITE_ID |
| Реестр доноров | ❌ нет | ❌ нет | ✅ SQLite |
| History краулов | ❌ нет | ❌ нет | ✅ crawl_runs |
| Brand управление | ⚠️ loadPages.ts | ⚠️ loadPages.ts | ✅ site.config.json |
| Style profile | ❌ нет | ❌ нет | ✅ future B3 |
| Multi-site deploy | ❌ вручную | ❌ вручную | ✅ build-all.sh |
| Masштабирование | ❌ 1 сайт | ⚠️ ручной env | ✅ N сайтов |
| Сложность сейчас | ✅ простое | ✅ простое | ⚠️ выше |

---

## Риски

| Риск | Вероятность | Митигация |
|---|---|---|
| Ломаем текущий mosseo build | высокая при спешке | мигрировать поэтапно, не удалять старый output/ |
| SQLite overhead для малых объёмов | средняя | v1 можно сделать как JSON registry |
| export_site.py усложняет пайплайн | средняя | сделать тонким — только копирует, не трансформирует |
| Firecrawl кредиты кончатся на тестах | высокая | тест с --limit 30, без --with-llm |
| Drift между registry и pages/ | средняя | pages/ только из экспорта, не хранить вручную |

---

## Не входит в v1 целевой архитектуры

- Keitaro / трафик-арбитраж
- Telegram уведомления формы (отдельный B6.4)
- Playwright smoke-test (B5.4, после build-all)
- Style extractor (B3, после multi-site работает)
