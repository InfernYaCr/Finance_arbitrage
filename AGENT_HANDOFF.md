# Agent Handoff — Mosseo Site Pipeline

> Точка входа для свежего агента. Прочитай этот файл первым, затем `HANDOFF.md`
> (хронологический лог) и `LAUNCH_PLAN.md` (план запуска). Дата снимка: **2026-06-08**.

## 1. Что это за проект

PBN/контент-фабрика под финансовую нишу РФ. Каждый сайт зарабатывает сам через
CPA (не ссылочный PBN): органический SEO → `/go/<offer>/` → CPA-сеть Saleads → выплата.

- `site_pipeline/` — Python: краулит донора, нормализует контент в `pages/*.json`.
- `site/` — единый Astro-рендерер; собирает выбранный датасет в статический сайт.
- `sites/<name>/` — конфиг + данные конкретного сайта (контент, офферы, навигация).

**Активный сайт:** `sites/finhelp-ru/` (финансы). Деплой-хост: http://yourkedm.beget.tech/
**Текущая ветка:** `codex/pbn-factory` (работать на топик-ветке, не в main).

## 2. Текущее состояние (что готово)

| Область | Статус |
|---|---|
| Краулер Crawl4AI (замена Firecrawl) | ✅ `crawl_pages_c4ai.py`, `.venv311`, smoke ок |
| Saleads API клиент | ✅ `saleads_offers.py` (offers/connect/export) |
| Офферы финансы+страхование (РФ) | ✅ 160 коннекторов подключено (100 live + 60 на модерации) |
| `affiliateLinks.json` (finhelp-ru) | ✅ 101 оффер, тег `vertical`, все live/enabled |
| `affiliate_pool.json` (мастер) | ✅ 189 коннекторов, vertical + status |
| Полный краул донора vsezaimyonline.ru | ⏳ пока ~30 стр, нужно 300+ |
| `promoSlots.json` + дизайн под офферы | ⏳ после краула (LAUNCH_PLAN раздел 23) |
| 60 `wait`-коннекторов | ⏳ ждут модерации Saleads → потом re-export |

## 3. Окружения Python (важно — их два)

```bash
. .venv/bin/activate        # Python 3.9 — весь пайплайн + Firecrawl + saleads_offers.py
.venv311/bin/python …       # Python 3.11 — только Crawl4AI (crawl_pages_c4ai.py)
```

## 4. Ключевые команды

### Офферы Saleads (токен в `site/.env` → `SALEADS_API_KEY`)
```bash
. .venv/bin/activate
python site_pipeline/saleads_offers.py connect-missing --dry-run   # просмотр недостающих
python site_pipeline/saleads_offers.py connect-missing             # создать коннекторы (идемпотентно)
python site_pipeline/saleads_offers.py export-pool                 # → sites/affiliate_pool.json
python site_pipeline/saleads_offers.py export-links --site-relevant \
   --out sites/finhelp-ru/affiliateLinks.json                      # per-site финансы/страхование
python site_pipeline/saleads_offers.py financial --top 30          # обзор по выплате
python site_pipeline/saleads_offers.py clicks                      # клики/конверсии
```

### Краул донора (Crawl4AI)
```bash
.venv311/bin/python site_pipeline/crawl_pages_c4ai.py \
  --source-domain vsezaimyonline.ru --limit 500 --with-llm \
  --include-sections banks,credits,loans,cards,mortgage,autocredit,qa,ratings,terms
```

### Сборка / проверка / деплой Astro
```bash
cd site
npm run build && npm run check
npm run preview -- --host 127.0.0.1 --port 4321   # локальный просмотр
npm run check:b0 && npm run deploy:dry && npm run deploy   # деплой на Beget
```

## 5. Подводные камни (не наступить повторно)

- **Saleads API хост** — `saleads.pro` (НЕ `my.saleads.pro`: 302-редирект срезает авторизацию). Токен как GET-параметр `?token=`.
- **`short_url` Saleads багует** — отдаёт один кэш на все коннекторы. Использовать полный `urls[0].url`.
- **Rate-limit Saleads** — 429 после ~27 быстрых запросов. В `connect-missing` зашиты паузы 2с / back-off 8с.
- **Токен светился в чате** — перевыпустить в ЛК.
- **Не редактировать `pages/*.json` руками** под дизайн/контакты/бренд — нормализация на рендере (`loadPages.ts`).
- **Не инжектить `content_html` через `set:html`** для contact/home — ломает layout вложенными `.container`.
- **HR-офферы банков** («Альфа Банк … HR») НЕ на финсайт — отсекаются `_JOBS_RE` в `saleads_offers.py`.
- **Не трогать** `site/scripts/download-images.sh`, `site/scripts/ru-images.txt` — legacy-media хелперы (править только в задаче про изображения).

## 6. Классификация офферов (как делятся по сайтам)

Мастер-пул `sites/affiliate_pool.json` (все 189) → фильтр по `vertical` → per-site
`affiliateLinks.json`. Вертикали: `mfo / card / insurance / business / credit /
mortgage / investment / debt_relief / finance` + исключаемые `jobs / other`.
Маппинг vertical → раздел сайта — в LAUNCH_PLAN разделе 23.2.

## 7. Что делать дальше (приоритет)

1. **Полный краул** `vsezaimyonline.ru` через Crawl4AI (≥300 стр) → QA → `pages/*.json`.
2. После краула: **`promoSlots.json`** для finhelp-ru (раздел→офферы по `vertical`) + **дизайн под офферы** (LAUNCH_PLAN раздел 23).
3. Дождаться модерации 60 `wait`-коннекторов → `export-pool` + `export-links` заново.
4. B7.1 крауд-ссылки, B7.2 UptimeRobot, второй сайт (HR/страхование) через `create_site.py`.

## 8. Карта документов

| Файл | О чём |
|---|---|
| `AGENT_HANDOFF.md` | **этот файл** — снимок состояния, точка входа |
| `AGENTS.md` | гайд для агентов: архитектура, карта файлов/layout'ов, критические правила, MCP |
| `HANDOFF.md` | хронологический лог изменений (новое сверху) |
| `LAUNCH_PLAN.md` | план запуска: каналы, SEO, Saleads (разд. 21), краулер (22), дизайн (23) |
| `ROADMAP.md` | фазовый план A+B треков |
| `CRAWLER_ARCH.md` | архитектура донор-краула |
| `NEW_PIPELINE_ARCH.md` | целевая архитектура: registry, sites/, exporter |
| `ARBITRAGE.md` | монетизация (CPA, PromoSlot) |
| `LAUNCH_CHECKLIST.md` | чеклист деплоя/SEO/форм/аналитики на сайт |
| `CLAUDE.md` | инструкции проекта + карта кода (entry points, layouts) |
