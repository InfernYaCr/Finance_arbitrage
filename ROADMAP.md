# Roadmap — PBN-фабрика на базе mosseo-site-pipeline

Два параллельных трека:
- **Трек A** — улучшение UI текущего сайта (доводим до продакшн-качества)
- **Трек B** — инфраструктура PBN-фабрики (масштабирование на N сайтов и ниш)

Статусы: `[ ]` не начато · `[x]` готово · `[~]` в работе

---

## Трек A — UI сайта (ЗАВЕРШЁН)

- [x] A1.1 Footer · A1.2 ServiceLayout archive · A1.3 ArchiveLayout
- [x] A2.1 Homepage services · A2.2 Homepage USP · A2.3 ArticleLayout sidebar
- [x] A3.1 Header burger · A3.2 Global mobile · A3.3 Per-layout mobile
- [x] A4.1 FAQ accordion · A4.2 Portfolio metrics · A4.3 Pricing cards · A4.4 404 · A4.5 "О компании"

---

## Трек B — PBN-инфраструктура

### B0 · Фундамент ✅

- [x] **B0.1** Уникальный `PUBLIC_METRIKA_ID` на каждый сайт
- [x] **B0.2** Уникальные контакты через env-переменные
- [x] **B0.3** Уникальный бренд: `PUBLIC_SITE_NAME`, `PUBLIC_SITE_NAME_FULL`
- [x] **B0.4** Форма → `mail.php` на Beget (PHP lint + deploy прошли)

Деплой `yourkedm.beget.tech` (2026-05-12): B0 guard, FTP, Яндекс.Вебмастер — ок. Детали в `HANDOFF.md`.

### B1 · Multi-donor pipeline (приоритет #1)

- [x] **B1.1** Убрать хардкод mosseo.ru → параметр `--source-domain`
- [x] **B1.2** `crawl_pages_fc.py` — Firecrawl Python SDK: map→filter→batch scrape + LLM-экстракция
- [x] **B1.3** Тест на mosseo.ru: Firecrawl map/base/LLM, QA без ошибок, Astro build
- [x] **B1.4** Финансовый донор `vsezaimyonline.ru`: map/base crawl, QA, finance content build
- [x] **B1.5** Exa smoke: `discover_donors.py` + `qualify_donor.py` минимально проверены на finance
- [x] **B1.6** `--smart-actions` флаг: retry thin pages (<300 chars) через scroll+wait browser actions
- [x] **B1.7** `--include-sections` флаг: фильтр URL по первому сегменту пути после map

> Архитектура пайплайна, схемы запросов, стоимость — `CRAWLER_ARCH.md`.

### B2 · Multi-site инфраструктура [~]

- [x] **B2.0** `sites/<id>/site.config.json` + `gen-env.sh` + `preview.sh` — переключение сайтов
- [x] **B2.1** SQLite registry (`registry.py` + `registry_cli.py`) — доноры, краул-раны, сайты
- [x] **B2.2** `export_site.py --site-id` — изолированный экспорт контента по SITE_ID
- [x] **B2.3** `build-all.sh` — итерируется по `sites/`, собирает и деплоит каждый; `--preview` запускает локальный сервер на :4321
- [x] **B2.4** `--dry-run` флаг для build-all.sh

> Детали миграции — `MIGRATION_PLAN.md`. Архитектура registry — `NEW_PIPELINE_ARCH.md`.

### B3 · Страницы: SEO + GEO + AI SEO

> Полный research — `PAGE_GENERATION_RESEARCH.md`.

- [x] **B3.1** Динамическая навигация: `generate_nav.py` + `loadNav.ts` (убрать хардкод `nav.ts`)
- [x] **B3.2** `FAQPage` Schema.org для всех страниц с `faq_pairs`
- [x] **B3.3** Summary-блок из `key_points[]` + `speakable` Schema (GEO-сигнал)
- [ ] **B3.4** Related Pages блок (3–5 ссылок через `content_index.sqlite` FTS)
- [x] **B3.5** `datePublished` / `dateModified` из краулера на всех страницах
- [ ] **B3.6** `FinancialProduct` / `ItemList` Schema для финансовых page_type
- [ ] **B3.7** Расширить LLM-схему: `summary`, `entities`, `data_points`, `target_query`

### B4 · Вариативность тем (footprint)

- [x] **B4.1** Вынести CSS-токены в `site/src/styles/themes/alpha.css` (текущая тема)
- [x] **B4.2** Тема Beta — финансовая ниша (teal-акцент, Inter, finhelp-ru)
- [ ] **B4.3** Тема Gamma — информационная (нейтральный, широкий)
- [x] **B4.4** `theme` в `site.config.json` → `PUBLIC_THEME` → `data-theme` на `<html>`
- [ ] **B4.5** `style_extractor.py` — donor_style_profile из CSS донора → theme tokens

### B5 · Link config (исходящие ссылки / монетизация)

- [x] **B5.1** `affiliateLinks.json` per-site в `sites/<id>/`, копируется в `site/src/data/` при экспорте
- [x] **B5.2** PromoSlot генерирует HTML из `link_ids`+UTM через `resolveSlotHtml()` если `html` пустой
- [x] **B5.3** `/go/{offer}/` — статические Astro-страницы с meta refresh + JS redirect
- [ ] **B5.4** Цели Метрики на outbound `/go/` клики и форму
- [ ] **B5.5** Форма: уведомления отложены до готовности дизайна сайта. Варианты: Telegram Bot API / Formspree / n8n webhook.
- [ ] **B5.6** Keitaro на VPS — только при стабильном трафике

> Стратегия монетизации — `ARBITRAGE.md`.

### B6 · Автоматизация пайплайна

- [ ] **B6.1** `discover_donors.py` — Exa двухфазный поиск доноров по нише
- [ ] **B6.2** `qualify_donor.py` → авто-запись в SQLite registry (CRAWL / SKIP)
- [ ] **B6.3** Полный цикл: Exa → Firecrawl → qa → export → build без ручных шагов
- [ ] **B6.4** Playwright smoke-test после деплоя → отчёт OK/FAIL по каждому сайту

### B7 · Мониторинг

- [ ] **B7.1** 5–10 крауд-ссылок на сайт до индексации
- [ ] **B7.2** UptimeRobot — пинг каждого сайта каждые 5 минут
- [ ] **B7.3** Re-crawl донора раз в 1–2 месяца через `--recrawl`
- [ ] **B7.4** Алерт в Метрике при падении трафика > 30% за сутки

---

## Трек F — PBN-фабрика (SITE_BUILD_PLAN.md)

> Цель: новый сайт за < 30 минут от `create_site.py` до preview.
> Полный план — `SITE_BUILD_PLAN.md`.

### F1 · Platform cleanup (одноразово, масштабируется)

- [ ] **F1.1** `crawl_pages_fc.py`: добавить `/amp(?:/|$)` и `\.html/amp` в `_SKIP_PATTERNS`
- [ ] **F1.2** `crawl_pages_fc.py`: `_normalize_path()` — strip `.html` суффикс из slug
- [ ] **F1.3** `build_content_index.py`: флаг `--min-chars 500` — фильтровать thin pages из индекса
- [ ] **F1.4** `generate_nav.py`: исключать thin pages (`content_text_chars < 500`) из nav
- [ ] **F1.5** `brand.ts`: дополнительный strip алиасов донора с суффиксами (`.ru`, `.com`)

### F2 · Niche profiles

- [ ] **F2.1** `niches/finance.json` — sections, labels, variants, tags_dict, brand_voice_prompt
- [ ] **F2.2** `niches/seo.json` — аналогично для SEO-ниши
- [ ] **F2.3** `niche_profile.py` — загрузчик/валидатор niche profile (Pydantic)

### F3 · create_site.py (оркестратор)

- [ ] **F3.1** Базовый CLI: `create_site.py --donor X --niche Y --site-id Z --brand "Имя"`
- [ ] **F3.2** Генерация `site.config.json` по шаблону ниши (nav seed, theme, aliases)
- [ ] **F3.3** Авто-запуск crawl → export → build → smoke-test
- [ ] **F3.4** Регистрация сайта в SQLite registry
- [ ] **F3.5** `--with-rewrite` флаг — запускает LLM-rewrite после краула

### F4 · LLM-rewrite + variation (КРИТИЧНО для PBN)

- [ ] **F4.1** `rewrite_intros.py` — gpt-4o-mini, rewrite первого параграфа каждой статьи
- [ ] **F4.2** `cleanup_titles.py` — strip donor-brand из h1/title (regex + LLM fallback)
- [ ] **F4.3** Nav order permutation — детерминированное перемешивание по `seed=site_id`
- [ ] **F4.4** Article meta variation — показывать дату / автора / reading time по профилю сайта

### F5 · Related pages (B3.4)

- [ ] **F5.1** `content_index.sqlite` FTS5 — поиск похожих страниц по title+body
- [ ] **F5.2** `RelatedPages.astro` — компонент: 3–5 ссылок, встраивается в ArticleLayout
- [ ] **F5.3** Exclude same-page, exclude thin pages из related

### F6 · Templates (универсальные под любую нишу)

- [ ] **F6.1** `ListingLayout` — новый page_type `listing`: hub-страницы с карточками дочерних
- [ ] **F6.2** `HomeLayout`: hub-секции из `niche_profile.sections` вместо хардкода
- [ ] **F6.3** `ArchiveLayout`: поддержка `niche_profile.labels` для заголовков категорий
- [ ] **F6.4** Тема Gamma (`gamma.css`) — информационная ниша (нейтральный, широкий)

### F7 · Tags (niche-aware)

- [ ] **F7.1** Автотеггинг страниц из `niche_profile.tags_dict` при экспорте
- [ ] **F7.2** Теговые архивы `/теги/<tag>/` — Astro static pages
- [ ] **F7.3** Тег-облако в Sidebar/Footer

### F8 · Schema (B3.6 + расширение)

- [ ] **F8.1** `FinancialProduct` / `LoanOrCredit` Schema для финансовых страниц
- [ ] **F8.2** `ItemList` Schema для листинг/архив страниц
- [ ] **F8.3** Расширить LLM-схему краулера: `summary`, `entities`, `data_points`, `target_query`

### F9 · Footprint diversity

- [ ] **F9.1** CSS token jitter: ±2px border-radius, ±5% spacing — per site seed
- [ ] **F9.2** Meta description variation: 2 шаблона на выбор per niche profile
- [ ] **F9.3** `style_extractor.py` — donor CSS → theme tokens (B4.5)
- [ ] **F9.4** Section label variation: «Рейтинги» / «ТОПы» / «Лучшие» из niche profile

---

## Порядок реализации

```
B0 ✅  B1 ✅  B2 ✅  B3.1–3.3+3.5 ✅  B4.1–4.2–4.4 ✅  B5.1–5.3 ✅
                         ↓
           F1 (platform cleanup)          ← ТЕКУЩИЙ ПРИОРИТЕТ
           F2 (niche profiles: finance + seo)
                         ↓
           F5 (Related Pages, B3.4)
           F3 (create_site.py оркестратор)
                         ↓
           F4 (LLM-rewrite — критично для PBN)
           F6 (templates: ListingLayout, gamma theme)
                         ↓
           F7 (tags)  F8 (Schema B3.6+)  F9 (footprint)
                         ↓
           B5.4–5.5 (Метрика + форма)
           B6.1–6.4 (полная автоматизация)
           B7.1–7.4 (мониторинг)
                         ↓
           B5.6 (Keitaro — при стабильном трафике)
```

---

## Текущее состояние (2026-05-14)

- Трек A: завершён ✅
- B0 + B1 (1.1–1.7): crawler с LLM, smart-actions, include-sections — готово ✅
- B2.0–B2.4: multi-site инфра полностью готова ✅
- B3.1–B3.3 + B3.5: навигация, FAQPage, Summary+speakable, даты — готово ✅
- B4.1–B4.2–B4.4: темы alpha/beta, переключение через `theme` — готово ✅
- B5.1–B5.3: per-site affiliate, resolveSlotHtml, /go/ редиректы — готово ✅
- `vsezaimyonline` тест-краул: 100 страниц, QA ок, build ок ✅
- `SITE_BUILD_PLAN.md` (6946c37): PBN-архитектура с 9 фазами F1–F9 зафиксирована
- Деплой `yourkedm.beget.tech`: работает, форма отправляет (уведомления B5.5 отложены)
- **Текущая ветка**: `codex/pbn-factory`
- **Следующий шаг: F1** (platform cleanup) → F2 (niche profiles) → F5 (Related Pages)
