# Архитектура краулера: Exa + Firecrawl

Пайплайн поиска доноров (Exa) и краулинга контента (Firecrawl) для сборки SEO-сайтов через Astro.

Читать перед реализацией B1–B5. Связанные файлы: `ROADMAP.md`, `RISKS.md`.

---

## Статус на 2026-05-13

Готово и проверено:

- `crawl_pages_fc.py` — Firecrawl backend: `--map-only`, cached map, base scrape без LLM, optional `--with-llm`, `--recrawl`.
- B1.3: `mosseo.ru`, `limit=30`, base + LLM smoke. QA без ошибок; предупреждения только `high_link_density` на плотных страницах.
- B1.4: `vsezaimyonline.ru`, `limit=30`, base scrape. QA: 27 ok, 3 warning, 0 errors.
- Astro умеет собирать альтернативный dataset через `CONTENT_OUTPUT_DIR`.
- `PUBLIC_LEGACY_BRAND_ALIASES` нормализует бренд донора, но не продуктовые бренды вроде банков/МФО.
- Exa smoke: `discover_donors.py --niche finance --num-results 5` вернул кандидатов; `qualify_donor.py --url https://vsezaimyonline.ru` дал `verdict=CRAWL`.

Текущий вывод: **отдельный backend crawler нужен, отдельный site build pipeline не нужен**.
Все источники приводятся к одному контракту `PageData + extracted`, а Astro выбирает dataset через `CONTENT_OUTPUT_DIR`.

---

## Общий флоу

```
[Exa — поиск]         [Квалификация]        [Firecrawl — краул]
      │                     │                       │
 50 кандидатов  →  score + highlights  →   map → filter → batch scrape
 по нише             + summary AI              ↓
                         │               JSON с LLM-экстракцией
                    SKIP / CRAWL              │
                                         Astro build
```

**Разделение ответственности:**
- **Exa** — находит и квалифицирует доноров без полного краула
- **Firecrawl** — структурированный краул: map URL → фильтрация → batch scrape + LLM
- **Astro** — один рендерер для любого нормализованного output (`CONTENT_OUTPUT_DIR`)

---

## Шаг 1 — Exa: поиск и квалификация доноров

### Двухфазный подход (экономия кредитов)

```json
// Фаза 1: дешёвая предквалификация через Search + highlights
POST https://api.exa.ai/search
{
  "query": "SEO агентство кейсы портфолио продвижение",
  "type": "auto",
  "numResults": 50,
  "excludeDomains": ["wikipedia.org", "youtube.com", "vk.com"],
  "contents": {
    "highlights": {
      "query": "услуги SEO кейсы клиенты",
      "numSentences": 3,
      "highlightsPerUrl": 2
    }
  }
}
```

```json
// Фаза 2: квалификация прошедшего кандидата через Contents + summary schema
POST https://api.exa.ai/contents
{
  "urls": ["https://donor-site.ru"],
  "summary": {
    "query": "Это content-rich donor? Верни CRAWL/SKIP, нишу, типы контента, crawl_value 0-100.",
    "schema": "QUALIFICATION_SCHEMA"
  },
  "text": {"maxCharacters": 3000},
  "maxAgeHours": 24
}
```

### Параметры поиска

| Параметр | Значение | Описание |
|---|---|---|
| `type` | `auto` / `neural` | `auto` для smoke, `neural` можно тестировать по нишам |
| `numResults` | 5 smoke, 30–50 production | кандидатов за один запрос |
| `contents.highlights` | query + 2–3 фрагмента | дешёвая предквалификация |
| `excludeDomains` | соцсети/маркетплейсы/каталоги | отсечь шум |
| `maxAgeHours` | 24 для qualify | баланс свежести и цены |

### Критерии квалификации (qualify_donor.py)

| Сигнал | Порог | Источник |
|---|---|---|
| highlights | непустые | search contents |
| `summary.verdict` | `CRAWL` | contents summary |
| `summary.crawl_value` | ≥ 60 / 100 | полезность как донора |
| `content_kinds` | article/rating/qa/pricing/comparison | типы страниц для Firecrawl |

### Расширение через find_similar

После нахождения хорошего донора — автоматический поиск похожих:

```python
exa.find_similar(
    url="https://лучший-донор.ru/",
    num_results=20,
    exclude_source_domain=True,
    category="company",
)
```

### Домены для исключения

```python
EXCLUDE_DOMAINS = [
    "wikipedia.org", "youtube.com", "vk.com", "ok.ru",
    "facebook.com", "instagram.com", "twitter.com", "x.com",
    "hh.ru", "avito.ru", "ozon.ru", "wildberries.ru",
    "vc.ru", "habr.com", "2gis.ru", "yell.ru", "zoon.ru",
]
```

### Стоимость Exa

- 1 000 запросов/мес бесплатно
- $7 за 1 000 search (highlights дешевле text)
- $1 за 1 000 get_contents
- 10 ниш × 3 запроса × 30 results ≈ **~$6–8/мес**
- Грант $1 000 доступен на dashboard.exa.ai

---

## Шаг 2 — Firecrawl: трёхэтапный краул

### Флоу одного донора

```
map_url(base_url, limit=3000)
    ↓  ~1 кредит
filter_urls()          # убрать пагинацию, params, теги, дубли
    ↓
batch_scrape_urls(     # форматы: markdown + html + links + json
    filtered_urls,
    json_options=LLM_SCHEMA,
    only_main_content=True,
    location={country: "RU"},
)
    ↓
write JSON per page    → output/pages/*.json
```

### Форматы в batch scrape

| Формат | Кредитов/стр | Что даёт |
|---|---|---|
| `markdown` + `html` + `links` | **1** | основной контент, внутренние ссылки |
| `json` (LLM schema) | **+4** | page_type, services, faq_pairs, pricing, case_results |
| `changeTracking` | **0** | diff для режима --recrawl |

**Режимы:**
- Первичный краул: markdown + html + links + json → **5 кредитов/стр**
- Re-crawl (B7.3): добавить changeTracking, пропускать страницы со status=`same`

### LLM-схема извлечения

```json
{
  "page_type": "home|service|article|faq|case|pricing|archive|contact|other",
  "services": ["..."],
  "faq_pairs": [{"q": "...", "a": "..."}],
  "pricing_tiers": [{"name": "...", "price": "...", "features": ["..."]}],
  "case_results": ["до: X → после: Y"],
  "key_points": ["..."],
  "cta_text": "..."
}
```

Это поле `extracted` в итоговом JSON. Astro layouts могут использовать его для богатого рендеринга без ручного парсинга.

### Фильтрация URL (filter_urls)

Отбрасываем:
- `/page/N/`, `?page=N` — пагинация
- `?any_param=value` — query-параметры (UTM, фильтры, сортировка)
- `/tag/`, `/category/` (если не нужны)
- `/feed/`, `/wp-`, `/admin`
- Файлы: `.jpg`, `.pdf`, `.css`, `.js` и др.

### Стоимость Firecrawl

| Тариф | Цена | Кредиты/мес | Доноров (5 кред/стр × 300 стр) |
|---|---|---|---|
| Free | $0 | 1 000 | ~3 тестовых |
| Hobby | $16/мес | 5 000 | ~16 |
| Standard | $83/мес | 100 000 | ~333 |

---

## Расширенный JSON-формат страниц

Совместим с `crawl_pages.py` (qa_pages.py и Astro не ломаются). Новые поля:

```json
{
  "id": "page-id--hash",
  "seed": { "url", "path", "section", "depth", "title", "meta_description", "h1", ... },
  "fetch": { "status_code", "final_url", "content_source": "firecrawl" },
  "meta": {
    "html_title", "html_meta_description", "canonical", "body_class",
    "language": "ru",
    "robots": "follow, index",
    "og_image": "https://..."
  },
  "content_html": "...",
  "content_text": "...",
  "links": ["https://..."],
  "images": ["https://..."],
  "quality": { "content_text_chars", "links_count", "images_count", ... },
  "extracted": {
    "page_type": "service",
    "services": ["SEO-аудит", "Продвижение"],
    "faq_pairs": [],
    "pricing_tiers": [],
    "case_results": [],
    "key_points": ["..."],
    "cta_text": "Получить консультацию"
  },
  "change_tracking": {              // только в --recrawl режиме
    "change_status": "changed",
    "visibility": "visible",
    "previous_scrape_at": "2026-04-01T..."
  }
}
```

---

## Скрипты

```
site_pipeline/
├── crawl_pages_fc.py   # [READY] Firecrawl: map→filter→batch scrape + optional LLM
├── discover_donors.py  # [SMOKE READY] Exa: поиск кандидатов по нишам
├── qualify_donor.py    # [SMOKE READY] Exa: квалификация одного URL
├── crawl_pages.py      # [EXISTS] оригинальный краулер (WP REST + requests)
├── qa_pages.py         # [EXISTS] QA результатов краула
└── common.py           # [EXISTS] общие утилиты
```

### crawl_pages_fc.py — CLI

```bash
# Первичный краул
python site_pipeline/crawl_pages_fc.py \
  --source-domain donor.ru \
  --limit 300 \
  --output-dir site_pipeline/output/pages

# Re-crawl с детектом изменений (B7.3)
python site_pipeline/crawl_pages_fc.py \
  --source-domain donor.ru --recrawl
```

### discover_donors.py — CLI

```bash
python site_pipeline/discover_donors.py \
  --niche finance \
  --num-results 5 \
  --out site_pipeline/output/exa_finance_smoke.json
```

Выход: кандидаты с `title`, `url`, `domain`, `highlights`, `highlight_scores`, `qualified_for_review`.

### qualify_donor.py — CLI

```bash
python site_pipeline/qualify_donor.py \
  --url https://vsezaimyonline.ru \
  --out site_pipeline/output/qualify_vsezaimyonline.json
```

Выход: `summary.verdict` (`CRAWL` / `SKIP`), `crawl_value`, `content_kinds`, `skip_reasons`.

---

## Ниши и запросы для Exa

```python
NICHES = {
    "seo_agency": {
        "queries": [
            "SEO agency Russia promotion services cases portfolio",
            "SEO-агентство продвижение сайтов кейсы клиентов",
        ],
        "cpa_fit": ["хостинг", "курсы по маркетингу", "SaaS для бизнеса"],
    },
    "legal": {
        "queries": [
            "law firm Russia civil corporate legal consulting",
            "юридическое бюро консультации судебная защита",
        ],
        "cpa_fit": ["юридические онлайн-сервисы", "финансы для бизнеса"],
    },
    "medical": {
        "queries": [
            "private clinic Russia diagnostics treatment specialists",
            "частная медицинская клиника врачи диагностика",
        ],
        "cpa_fit": ["страховые офферы", "медтехника", "аптеки"],
    },
    "auto": {
        "queries": [
            "car service repair station Russia articles tips",
            "автосервис ремонт автомобилей советы статьи",
        ],
        "cpa_fit": ["автозапчасти", "автострахование", "каршеринг"],
    },
    "finance": {
        "queries": [
            "financial advisor Russia investment personal finance",
            "финансовый консультант инвестиции личные финансы",
        ],
        "cpa_fit": ["Т-Партнёры", "кредиты", "карты", "инвестиции"],
    },
}
```

**Правило из RISKS.md (B1 🔴):** нишу выбираем под доступные CPA-офферы, не наоборот.

---

## Зависимости

```bash
# site_pipeline/requirements.txt
firecrawl-py>=1.0.0
# Exa smoke uses requests; no exa-py dependency yet.
```

```bash
# site/.env
FIRECRAWL_API_KEY=fc-...
EXA_API_KEY=...
```

---

## Риски

| Риск | Митигация |
|---|---|
| LLM extraction (+4 кред/стр) | Запускать json-формат выборочно или только для первых N страниц |
| Exa RU-индекс неполный | Гибридные запросы EN+RU + category="company" |
| Firecrawl 24h retention | Сохранять JSON сразу после batch scrape |
| JS-контент | Firecrawl рендерит по умолчанию, actions для edge cases |
| filter_urls слишком агрессивный | Логировать отброшенные URL, тестировать на mosseo.ru |

---

## Порядок реализации

```
B1.2 → crawl_pages_fc.py       ГОТОВО — map→filter→batch + optional LLM schema
B1.3 → тест на mosseo.ru       ГОТОВО — QA/build без ошибок
B1.4 → finance donor crawl     ГОТОВО — vsezaimyonline.ru QA/build
B1.5 → Exa smoke               ГОТОВО — discover + qualify minimal path
B2   → sites/ + build-all      следующий системный шаг
B5.1 → полный Exa→Firecrawl    позже: автоматизация без ручных шагов
B7.3 → --recrawl режим         changeTracking для инкрементальных обновлений
```
