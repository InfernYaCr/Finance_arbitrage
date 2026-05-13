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

> Архитектура пайплайна, схемы запросов, стоимость — `CRAWLER_ARCH.md`.

### B2 · Multi-site инфраструктура [~]

- [x] **B2.0** `sites/<id>/site.config.json` + `gen-env.sh` + `preview.sh` — переключение сайтов
- [x] **B2.1** SQLite registry (`registry.py` + `registry_cli.py`) — доноры, краул-раны, сайты
- [x] **B2.2** `export_site.py --site-id` — изолированный экспорт контента по SITE_ID
- [ ] **B2.3** `build-all.sh` — итерируется по `sites/`, собирает и деплоит каждый
- [ ] **B2.4** `--dry-run` флаг для build-all.sh

> Детали миграции — `MIGRATION_PLAN.md`. Архитектура registry — `NEW_PIPELINE_ARCH.md`.

### B3 · Страницы: SEO + GEO + AI SEO

> Полный research — `PAGE_GENERATION_RESEARCH.md`.

- [ ] **B3.1** Динамическая навигация: `generate_nav.py` + `loadNav.ts` (убрать хардкод `nav.ts`)
- [ ] **B3.2** `FAQPage` Schema.org для всех страниц с `faq_pairs` (макс эффект, мин усилий)
- [ ] **B3.3** Summary-блок из `key_points[]` + `speakable` Schema (GEO-сигнал)
- [ ] **B3.4** Related Pages блок (3–5 ссылок через `content_index.sqlite` FTS)
- [ ] **B3.5** `datePublished` / `dateModified` из краулера на всех страницах
- [ ] **B3.6** `FinancialProduct` / `ItemList` Schema для финансовых page_type
- [ ] **B3.7** Расширить LLM-схему: `summary`, `entities`, `data_points`, `target_query`

### B4 · Вариативность тем (footprint)

- [ ] **B4.1** Вынести CSS-токены в `site/src/styles/themes/alpha.css` (текущая тема)
- [ ] **B4.2** Тема Beta — другие цвета, шрифт, border-radius (финансовая ниша)
- [ ] **B4.3** Тема Gamma — информационная (нейтральный, широкий)
- [ ] **B4.4** `theme` в `site.config.json` — выбор темы при сборке
- [ ] **B4.5** `style_extractor.py` — donor_style_profile из CSS донора → theme tokens

### B5 · Link config (исходящие ссылки / монетизация)

- [ ] **B5.1** `links.json` — таблица: `site_id → money_url → анкор → страницы → rel`
- [ ] **B5.2** PromoSlot читает из `links.json`, не из хардкода
- [ ] **B5.3** `/go/{offer}/` — `.htaccess` redirect-обёртка
- [ ] **B5.4** Цели Метрики на outbound `/go/` клики и форму
- [~] **B5.5** Форма: отправка работает, уведомления pending. Варианты: Telegram Bot API / Formspree / n8n webhook.
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

## Порядок реализации

```
B0 ✅  B1 ✅  B2.0 ✅
           ↓
     B2.1 (SQLite registry)        ← следующий шаг
     B2.2 (export_site.py)
     B2.3 (build-all.sh)
           ↓
     B3.1 (динамическая навигация)
     B3.2–B3.5 (SEO/GEO schemas)
     B3.6–B3.7 (финансовые типы + LLM-схема)
       параллельно:
       B5.5 (форма-уведомления Telegram)
           ↓
     B4.1–B4.5 (темы + donor_style_profile)
     B5.1–B5.4 (link config + монетизация)
           ↓
     B6.1–B6.4 (полная автоматизация)
     B7.1–B7.4 (мониторинг)
           ↓
     B5.6 (Keitaro — при стабильном трафике)
```

---

## Текущее состояние (2026-05-13)

- Трек A: завершён ✅
- B0 + B1 (1.1–1.5): завершён ✅
- B2.0: `sites/`, `gen-env.sh`, `preview.sh` — готово ✅
- Деплой `yourkedm.beget.tech`: работает, форма отправляет (уведомления pending B5.5)
- **Следующий шаг: B2.1** — SQLite registry (`registry.py` + `registry_cli.py`)
