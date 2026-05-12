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

### B2 · Batch deploy

- [ ] **B2.1** `sites/` структура — `sites/site-NNN/.env` с брендом/FTP/аналитикой
- [ ] **B2.2** `build-all.sh` — итерируется по `sites/`, собирает и деплоит каждый
- [ ] **B2.3** `--dry-run` флаг — показывает что будет без деплоя

### B3 · Вариативность тем (footprint)

- [ ] **B3.1** Вынести токены в `site/src/styles/themes/alpha.css` (текущая тема)
- [ ] **B3.2** Тема Beta — другие цвета, шрифт, border-radius
- [ ] **B3.3** Тема Gamma — другая структура секций (1-колонка vs 2-колонки)
- [ ] **B3.4** `theme` в `.env` сайта — выбор темы при сборке

### B4 · Link config (исходящие ссылки)

- [ ] **B4.1** `links.json` — таблица: `site_id → money_url → анкор → страницы → rel`
- [ ] **B4.2** PromoSlot читает из `links.json`, не из хардкода
- [ ] **B4.3** `update-links.py --money-url X --anchor Y` — обновляет все сайты

### B5 · Автоматизация пайплайна (Exa + Firecrawl)

- [ ] **B5.1** `discover_donors.py` — Exa двухфазный поиск: highlights → qualify + find_similar
- [ ] **B5.2** `qualify_donor.py` — Exa get_contents + summary → CRAWL / SKIP вердикт
- [ ] **B5.3** Полный цикл: Exa → Firecrawl → qa_pages → Astro build без ручных шагов
- [ ] **B5.4** Playwright smoke-test после деплоя → отчёт OK/FAIL по каждому сайту

### B6 · Монетизация

- [ ] **B6.1** `/go/{offer}/` — `.htaccess` redirect-обёртка (Astro static не поддерживает `Astro.redirect`)
- [ ] **B6.2** PromoSlot ← `links.json` (CPA-ссылки из конфига)
- [ ] **B6.3** Цели Метрики на outbound `/go/` клики и форму
- [~] **B6.4** Форма: отправка работает, уведомления не настроены (Beget-субдомен без почты). Варианты: Telegram Bot API / Formspree / EmailJS / n8n webhook.
- [ ] **B6.5** Keitaro на VPS — только при стабильном трафике

Стратегия монетизации — `ARBITRAGE.md`.

### B7 · Мониторинг и ссылки

- [ ] **B7.1** 5–10 крауд-ссылок на сайт до индексации
- [ ] **B7.2** UptimeRobot — пинг каждого сайта каждые 5 минут
- [ ] **B7.3** Re-crawl донора раз в 1–2 месяца через `--recrawl` (changeTracking → только изменения)
- [ ] **B7.4** Алерт в Метрике при падении трафика > 30% за сутки

---

## Порядок реализации

```
A1–A4  ✅  B1.1 ✅  B0.1–B0.4 ✅  B1.2 ✅
                ↓
         B1.3 → B1.4 → B1.5 ✅
           параллельно:
           B6.4 (форма-уведомления)
           B6.1 → B6.3 (redirect + Метрика)
                ↓
         B2.1 → B2.2 (batch deploy)  ← следующий системный шаг
           параллельно:
           B7.1 (крауд-ссылки)
           B7.2 (UptimeRobot)
                ↓
         B3.1 → B3.4 (темы)
         B4.1 → B4.3 (link config)
                ↓
         B5.1 → B5.4 (полная автоматизация)
         B7.3 → B7.4 (re-crawl + алерты)
                ↓
         B6.5 (Keitaro — при стабильном трафике)
```

---

## Текущее состояние (2026-05-13)

- Трек A: завершён полностью
- B0 + B1.1–B1.5: готово
- Деплой `yourkedm.beget.tech`: работает, форма отправляет (уведомления pending B6.4)
- **Следующий шаг: B2.1** — `sites/` структура с env/content output для нескольких сайтов.
- Параллельно полезно взять **B6.4** (Telegram-уведомления формы), потому что Beget-субдомен без почты.
