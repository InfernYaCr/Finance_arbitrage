# Migration Plan — Bridge → Registry Architecture

> Поэтапная миграция от текущего bridge-решения к целевой архитектуре.
> Каждый этап самодостаточен и не ломает предыдущий рабочий state.

---

## Принципы

- **Не ломать текущий рабочий сайт** на yourkedm.beget.tech
- **Каждый этап заканчивается работающей системой** (build + deploy проходят)
- **Legacy output/** остаётся нетронутым до E3
- **Bridge (CONTENT_OUTPUT_DIR)** используется до конца E2, потом уходит
- **Smoke artifacts** не коммитятся ни на каком этапе
- **SQLite с самого начала** — доноров точно будет больше пяти, JSON-промежуток пропускаем

---

## E0 · Подготовка (текущий момент)

**Статус:** ✅ готово к началу

Что есть:
- `crawl_pages_fc.py` работает (mosseo.ru + vsezaimyonline.ru smoke OK)
- `discover_donors.py` / `qualify_donor.py` smoke OK
- `CONTENT_OUTPUT_DIR` bridge работает (finance smoke build = 32 страницы)
- Один рабочий задеплоенный сайт: yourkedm.beget.tech

Что нужно до старта E1:
- [ ] Прочитать и согласовать `NEW_PIPELINE_ARCH.md`, `MIGRATION_PLAN.md`, `CLEANUP_PLAN.md`
- [ ] Убедиться что `npm run build` для mosseo датасета проходит чисто
- [ ] Убедиться что текущие тесты QA без ошибок

---

## E1 · sites/ структура и site.config.json (= B2.1)

**Цель:** изолировать конфиг каждого сайта в `sites/<id>/site.config.json`.

**Не трогаем:** registry, exporter, build-all — только конфиги.

### Шаги

1. Создать `sites/rostpoisk/site.config.json` из текущего `site/.env`
2. Обновить `Astro` так, чтобы читал `SITE_ID` env → `sites/<id>/site.config.json`
   - Альтернатива без рефактора: скрипт `gen-env.sh --site-id rostpoisk` → генерирует `site/.env` из site.config.json (проще!)
3. Создать `sites/finhelp-ru/site.config.json` для финансового сайта (draft, без deploy)
4. Smoke build для обоих site.config через `gen-env.sh`

**Проверка E1:**
```bash
./gen-env.sh rostpoisk && cd site && npm run build  # должно пройти
./gen-env.sh finhelp-ru && cd site && CONTENT_OUTPUT_DIR=../site_pipeline/output/finance_test npm run build
```

**Что не меняется:** Astro читает `site/.env` как раньше. Только добавляется source of truth для конфигов.

---

## E2 · SQLite Registry (сразу, без JSON-промежутка)

**Цель:** единая БД для доноров, краул-ранов, сайтов.
Доноров точно будет больше пяти — JSON-вариант пропускаем.

**Не трогаем:** crawlers внутри, qa_pages, Astro.

### Шаги

1. Создать `site_pipeline/registry.py` — тонкая обёртка над sqlite3:
   - `init_db(path)` — создаёт схему (из `NEW_PIPELINE_ARCH.md`)
   - `upsert_donor(...)`, `insert_crawl_run(...)`, `upsert_site_target(...)`
   - `get_pages_for_site(site_id)` — для exporter в E3
   - БД: `registry/registry.db` (в `.gitignore`)

2. Создать `registry_cli.py` — CLI для ручного управления:
   ```bash
   python registry_cli.py add-donor --url https://mosseo.ru --niche seo --verdict CRAWL
   python registry_cli.py add-donor --url https://vsezaimyonline.ru --niche finance --verdict CRAWL --score 0.82
   python registry_cli.py add-site --id rostpoisk --donor mosseo-ru
   python registry_cli.py add-site --id finhelp-ru --donor vsezaimyonline-ru
   python registry_cli.py list-donors
   python registry_cli.py list-sites
   ```

3. Интегрировать запись в `qualify_donor.py`:
   - После вердикта → `registry.upsert_donor(url, verdict, score, niche)`

4. Интегрировать запись в `crawl_pages_fc.py`:
   - После batch scrape → `registry.insert_crawl_run(donor_id, page_count, credit_cost, mode, output_dir)`

5. Добавить `registry/` в `.gitignore` (кроме `registry/.gitkeep`)

**Проверка E2:**
```bash
python registry_cli.py add-donor --url https://mosseo.ru --niche seo --verdict CRAWL
python registry_cli.py list-donors   # видим запись
python qualify_donor.py --url https://vsezaimyonline.ru  # авто-пишет в registry
python registry_cli.py list-donors   # видим обе записи
```

---

## E3 · Exporter (export_site.py) и pages в sites/

**Цель:** каждый сайт получает свой изолированный набор pages/ из пайплайна.

### Шаги

1. Создать `export_site.py --site-id <id>`:
   - Читает `registry.db` → `site_targets` → donor_id, donor output_dir
   - Берёт pages из последнего crawl_run для этого донора
   - Применяет brand alias замену (slug-уровень, не render-уровень)
   - Пишет `sites/<id>/pages/*.json` + `sites/<id>/build_manifest.json`

2. Обновить Astro: `SITE_ID` → `sites/<id>/pages/` как CONTENT_OUTPUT_DIR

3. **Удалить CONTENT_OUTPUT_DIR** как механизм выбора (заменить на SITE_ID)

4. `sites/*/pages/` добавить в `.gitignore` (генерированное)

**Проверка E3:**
```bash
python export_site.py --site-id rostpoisk
python export_site.py --site-id finhelp-ru
SITE_ID=rostpoisk cd site && npm run build
SITE_ID=finhelp-ru cd site && npm run build
```

**Что удаляется:** `CONTENT_OUTPUT_DIR` из loadPages.ts и из документации.

---

## E4 · build-all.sh (= B2.2)

**Цель:** один скрипт собирает и деплоит все сайты.

### Шаги

1. Создать `build-all.sh`:
```bash
#!/bin/bash
set -e
for SITE_ID in $(ls sites/); do
  echo "=== Building $SITE_ID ==="
  python export_site.py --site-id "$SITE_ID"
  SITE_ID="$SITE_ID" npm --prefix site run build
  SITE_ID="$SITE_ID" npm --prefix site run deploy
done
```

2. Добавить `--dry-run` флаг (показывает что будет без деплоя)
3. Добавить `--site-id` флаг (только один сайт)

**Проверка E4:**
```bash
./build-all.sh --dry-run   # выводит что будет
./build-all.sh --site-id rostpoisk  # деплоит только rostpoisk
```

---

## Порядок выполнения

```
E0 (подготовка, уже OK)
  ↓
E1 (sites/ + site.config.json)  ← СЛЕДУЮЩИЙ ШАГ = B2.1
  ↓
E2 (SQLite registry)            ← можно параллельно с E1
  ↓
E3 (exporter + SITE_ID)         ← требует E1 + E2
  ↓
E4 (build-all.sh)               ← требует E3
```

---

## Что не меняется до E3

- `crawl_pages_fc.py` и `crawl_pages.py` — без изменений
- `qa_pages.py` — без изменений
- `site_pipeline/output/` структура — без изменений
- `site/.env` — продолжает работать через `gen-env.sh` в E1–E2
- `loadPages.ts` — минимальные изменения (добавить SITE_ID поддержку в E3)
- `registry/registry.db` — в `.gitignore`, не коммитится; схема в `NEW_PIPELINE_ARCH.md`
