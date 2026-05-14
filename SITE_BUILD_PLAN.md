# План сборки сайта из донорского контента

Анализ на примере **vsezaimyonline** (100 страниц), но применим для любого донора.

---

## ⚡ PBN-контекст (главное)

Это **не план одного качественного сайта**. Проект — **PBN-фабрика**:

- N сайтов в разных нишах из M доноров
- Цель — минимальное ручное время на каждый новый сайт
- Маржа: дешёвый деплой → больше сайтов → больше трафика
- Footprint: каждый сайт должен выглядеть индивидуально (анти-detection)

**Это меняет приоритеты:**

| | Один сайт (мой первый план) | PBN-фабрика (реальность) |
|---|---|---|
| Цель | Качество = 10/10 | Качество = 7/10 × N сайтов |
| Решение | Ручная допилка | Шаблон + параметры ниши |
| LLM-rewrite | Опционально | **Обязательно** (vs донорский дубликат) |
| Шаблоны | Идеальные | Универсальные на любую нишу |
| Структура | Под одну нишу | Конфиг ниши `niche_profile.json` |

### Целевые метрики PBN

| Метрика | Цель |
|---|---|
| Time-to-live для нового сайта | **< 30 минут** (от выбора донора до preview) |
| Ручных шагов в пайплайне | **0** (всё через `create_site.py --donor X --niche Y --site-id Z`) |
| Стоимость 1 сайта (Firecrawl+LLM) | **< $5** за 100-200 страниц |
| Уникальность контента vs донор | **80%+** (LLM-rewrite intro + title-cleanup) |
| Footprint-сигналы донор↔клон | **0 совпадений** (бренд, контакты, тема, structure permutation) |

### Что значит "хороший сайт" в PBN

**НЕ** ручная вылизка каждой страницы. **ДА**:
1. Шаблоны рендерят любой `page_type` × любую нишу без правок
2. Niche-profile конфигурирует фильтры/лейблы/секции — без хардкода
3. Уникализация vs донор автоматическая (intro-rewrite + title-cleanup + tokens)
4. Variation strategy: 2 сайта с того же донора получаются заметно разные

### Per-site vs One-time (классификация задач)

| Тип | Когда работает | Стоимость нового сайта |
|---|---|---|
| **Platform (one-time)** | Разработка единая | 0 после внедрения |
| **Niche profile (one-per-niche)** | Создаётся при добавлении ниши | 0 для существующих ниш |
| **Per-site config** | site.config.json + nav + brand | ~5 минут заполнения шаблона |
| **Per-site automation** | Crawl + LLM + build | 20-30 минут машинного времени |

**Из моего изначального плана:**

| Фаза | Тип | Комментарий |
|---|---|---|
| F1.1 section_labels | Niche profile (per niche) | Не глобальный! Зависит от ниши |
| F1.2–F1.5 структура | Platform (one-time) | ✅ масштабируется |
| F2 Related blocks | Platform (one-time) | ✅ механизм единый |
| F3 теги | Platform + niche dict | Словарь тегов per niche |
| F4 шаблоны | Platform (one-time) | ✅ универсальные |
| F5 LLM-rewrite | Per-site automation | **Критично для PBN — без него = duplicate content** |
| F6 Schema | Platform (one-time) | ✅ универсальные |

### Footprint diversity — что уже есть и что добавить

**Уже есть:**
- ✅ Бренд (name, name_full, aliases) — per site
- ✅ Контакты (phone, email, address) — per site
- ✅ Metrika ID — per site
- ✅ Темы (alpha/beta + предстоит gamma) — теперь 2 варианта
- ✅ Theme tokens (CSS variables) — на уровне темы

**Добавить для анти-detection:**
- ⏳ **Structure permutation**: один сайт показывает hub-страницы как listings, другой — как featured grid
- ⏳ **Nav order randomization**: на основе seed из site_id
- ⏳ **Section labels variation**: «Рейтинги» vs «ТОПы» vs «Лучшие» — case per niche profile
- ⏳ **Article meta variation**: один показывает дату, другой — author chip, третий — reading time

### Чего не хватает в инфраструктуре

```bash
# СЕЙЧАС (ручной процесс ~1 час на новый сайт):
1. crawl_pages_fc.py --source-domain X
2. build_content_index.py
3. mkdir sites/Z && vi site.config.json  ← вручную заполнить 20 полей
4. echo "[]" > affiliateLinks.json
5. echo "[]" > promoSlots.json
6. export_site.py --site-id Z
7. gen-env.sh Z && npm run build
8. Проверка nav, дубликатов, thin pages

# ЦЕЛЬ (один скрипт ~20 минут машинного времени):
create_site.py --donor X --niche finance --site-id Z --brand "Имя" \
  [--with-rewrite]  # автоматически:
   - читает niche_profile (finance.json) → секции, фильтры, лейблы
   - запускает crawl с правильными параметрами
   - генерирует site.config.json по шаблону ниши
   - запускает экспорт, билд, smoke-тест
   - регистрирует в registry
```

**Артефакты которых нет, но нужны:**

| Артефакт | Что в нём | Создаётся |
|---|---|---|
| `niches/finance.json` | sections, labels, tags_dict, rewrite_prompts, theme | 1 раз на нишу |
| `niches/seo.json` | то же для SEO-ниши | 1 раз |
| `niches/realestate.json` | то же для недвижки | 1 раз |
| `create_site.py` | оркестратор от донора до preview | 1 раз |
| `transform_titles.py` | очистка title по правилам ниши | 1 раз |
| `rewrite_intros.py` | LLM-уникализация первого параграфа | 1 раз |
| `extract_tags.py` | словарный + LLM-теггер per niche | 1 раз |

---

## 0. Что есть сейчас (факты, не теория)

**Структура донора (после `--include-sections`):**

| Раздел | Страниц | Avg chars | Роль |
|---|---|---|---|
| `/credit-cards/` | 16 | ~21k | хаб + listings |
| `/online-credit/` | 16 | ~33k | хаб + listings |
| `/debit-cards/` | 15 | ~17k | хаб + listings |
| `/ratings/` | 18 | ~16k | сквозные ТОПы |
| `/autocredit/` | 10 | ~21k | хаб + listings |
| `/qa/` | 6 | ~4k | FAQ-статьи |
| `/banks/` | 5 | ~7k | карточки банков |
| `/zalogi/` | 4 | ~10k | хаб + продукты |
| `/mortgage/` | 3 | ~17k | хаб |
| `/business/` | 5 | 279 | **всё thin → выкинуть** |
| `/terms/` | 1 | 1k | словарь (1 термин) |

**Связность:** в среднем 37 internal links/страница, но только 7 из них указывают на наши 100 страниц — донор ссылается на ~200 продуктовых карточек МФО, которых у нас нет.

**Проблемы:**

1. Title/H1/body — 1:1 с донором → Яндекс/Google сразу видят копию
2. 8 thin pages (`/business/*`, `/*/banki`) — заглушки
3. AMP-дубликат (`/ratings/luchshaya-ipoteka.html/amp/`)
4. Breadcrumbs показывают сырой slug (`ratings` вместо `Рейтинги`)
5. Title-суффикс донора (`— ВсеЗаймыОнлайн`) кое-где просочился
6. Cross-section linking слабый (кредитки ↔ дебетки ↔ рейтинги)
7. LLM-экстрактор не запускался — `services`, `pricing_tiers`, `cta_text` пустые

---

## 1. Целевая архитектура — Hub-and-Spoke

```
              [HOME] (pillar)
                 │
   ┌─────────────┼─────────────┬──────────┐
   │             │             │          │
[Кредитки]   [Кредиты]    [Дебетки]   [Автокредиты]  ← HUBS (pillar pages)
   │             │             │          │
   ├─ ТОП-10     ├─ Без отказа ├─ Без %   ├─ Без КАСКО
   ├─ С 18 лет   ├─ С 18 лет   ├─ С 16    ├─ С 18 лет
   ├─ Льготный   ├─ Без банка  ├─ Travel  ├─ Б/у
   └─ ...        └─ ...        └─ ...     └─ ...
                                              ↑
                                          SPOKES (listings)

              [Рейтинги]  ← cross-cutting cluster
                   │
              ссылается на все хабы
```

**Правило:** каждая spoke-страница ссылается на свой hub. Каждый hub ссылается на pillar (home). Рейтинги — горизонтальный cluster, ссылается на хабы.

---

## 2. Перелинковка — 4 типа

### Тип 1: Структурная (breadcrumbs + nav)
Уже есть, но breadcrumbs нужны человеческие лейблы. Делаем словарь `section_labels.json`:

```json
{
  "ratings": "Рейтинги",
  "credit-cards": "Кредитные карты",
  "online-credit": "Кредиты онлайн",
  "debit-cards": "Дебетовые карты",
  "autocredit": "Автокредиты",
  "qa": "Вопросы",
  "mortgage": "Ипотека",
  "zalogi": "Под залог",
  "banks": "Банки",
  "terms": "Словарь"
}
```

### Тип 2: Related Pages (B3.4)
Под каждой статьёй блок «Похожие материалы» — 3-5 ссылок. Источник — `content_index.sqlite` FTS5 по `content_text` с приоритетом same-section.

Логика выбора:
1. **Same section, ближайшие по cosine TF-IDF** — 3 ссылки
2. **Cross-section по shared key_points/services** — 2 ссылки

Реализация: новый компонент `<RelatedPages>` с пропом `currentPath`, грузит индекс на этапе билда.

### Тип 3: Contextual (in-body) — на старте не критично
Парсить body, находить упоминания терминов и подменять на ссылки. Очень мощно, но требует словаря терминов (см. пункт 5).

### Тип 4: Hub-aggregator listings
На hub-странице (`/credit-cards/`) — карточная сетка spoke-страниц. Сейчас рендерится прозой из донорского текста. Заменить на структурный компонент `<HubListing pages={spokesOfThisHub}>`:

```
| Заголовок spoke | Краткий ангаж (extract из meta_description или первый параграф) |
```

---

## 3. Адаптация контента — 4 уровня

Цель: уйти от 1:1 с донором, но не переписывать всё руками. Делаем послойную трансформацию.

### Уровень A: Brand & metadata (есть)
Алиасы донора заменены, brand-suffix стрипается. ✅

### Уровень B: Title/H1 нормализация (B-NEW)
Доходим до правил:
- Убрать год если он в title донора и дублируется в H1
- Дедуплицировать `— ВсеЗаймыОнлайн` остатки
- Привести к единому шаблону: `{topic} {modifier?}` без воды
- Подставить свой year (`{year}`) из siteConfig

Реализация: `transform_titles.py` post-crawl + правила в `extraction_rules.py`.

### Уровень C: Intro paragraph rewriting (B-NEW)
Первый параграф — самое заметное место. Делаем LLM-rewrite (1 раз на страницу) через Firecrawl `jsonOptions.prompt` или отдельный OpenAI-вызов:

```python
prompt = """
Перепиши первый параграф статьи. Сохрани смысл, цифры, факты.
Измени структуру предложений, замени синонимы, но НЕ выдумывай новые факты.
Длина: 100-180 слов.
"""
```

Бюджет: ~$0.002/страница × 100 = $0.20. Дёшево.

### Уровень D: CTA + Summary injection (B-NEW)
- Добавить нативный CTA-блок в конце каждой spoke (`Подать заявку` → `/go/{offer}/`)
- Подставить `summary` из `key_points[]` (B3.3 уже сделано, проверить покрытие)
- Добавить TL;DR-блок наверху (3-5 буллетов)

---

## 4. Шаблоны

Используемые сейчас:
- `ArticleLayout` — основной (rating, article, qa_article, dictionary)
- `HomeLayout` — главная

**Нужно добавить:**

| Шаблон | Когда | Что внутри |
|---|---|---|
| `HubLayout` | path = `/{section}/` и есть spokes | hero + list of spokes + cross-link to other hubs |
| `RatingLayout` | page_type=`rating` | structured top-N table из `pricing_tiers` + Article body |
| `ProductCardLayout` | path = `/banks/{slug}/{product}/` | sticky params + apply button + reviews |
| `DictionaryLayout` | section=`terms` | определение + see-also + related articles |
| `CalculatorLayout` | page_type=`calculator` | (на будущее) форма расчёта + статья |

`RatingLayout` особенно важен — `/ratings/` это ~20% всех страниц.

---

## 5. Топик-кластеры (Word & Semantic clusters)

Из анализа title/H1 видны кластеры:

| Кластер | Страниц | Доп.термины |
|---|---|---|
| Кредитные карты | 16 | льготный период, кешбек, без отказа |
| Кредиты онлайн | 16 | без посещения банка, 100% одобрение |
| Дебетовые карты | 15 | без %, для путешествий, для пенсионеров |
| Кешбек | 10 | ЖКХ, ремонт, продукты, такси |
| Автокредиты | 10 | без КАСКО, без справок, с 18 лет |
| Банки | разное | СБП, партнёры, ипотека, мили |

**Что делаем:**
1. Tag каждую страницу набором тематических тегов (на основе title + key_points)
2. Tags → tag pages (новые архивы) — `/tag/{slug}/`
3. На каждой spoke показываем 3 связанных по тегу

Реализация: `extract_tags.py` — простой словарный матч + LLM на спорные.

---

## 6. URL-нормализация (быстрая победа)

Из бэкап-краула 100 страниц есть мусор:
- `/ratings/luchshaya-ipoteka.html/amp/` — выкинуть в filter_urls
- `*.html` суффиксы в slug (если есть) — нормализовать в `_normalize_path`
- `/business/*` thin — исключить через QA-фильтр `min_content_chars` в `build_content_index.py`

Реализация: добавить в `_SKIP_PATTERNS` крауля паттерн `/amp(?:/|$)` + порог `MIN_CHARS_FOR_BUILD = 500` в индексаторе.

---

## 7. Фазовый план реализации (PBN-приоритизированный)

**Принцип приоритизации:** сначала platform-задачи (один раз, работают для всех сайтов), потом per-site automation (без них новые сайты = duplicate content). Niche-profile появляется как только касаемся первого niche-specific артефакта.

### Фаза 1: Platform-чистка (универсальный пайплайн, 1 день)

Универсальные правила фильтрации и URL-нормализации. Применяются ко всем сайтам.

- [ ] **F1.1** `_SKIP_PATTERNS` крауля → `/amp(?:/|$)`, `\.html/amp`, `\.html$` — выкинуть AMP и legacy `.html`
- [ ] **F1.2** `_normalize_path` → стрипает `.html` из любого slug
- [ ] **F1.3** `build_content_index.py` → флаг `--min-chars 500` (default), thin → `excluded_pages.json`
- [ ] **F1.4** `generate_nav.py` → читает `excluded_pages` и не включает thin в nav
- [ ] **F1.5** `brand.ts` → дополнительный strip остатков donor-suffix через aliases из siteConfig

### Фаза 2: Niche profiles (фундамент масштабирования)

Без этого каждый новый сайт = ручная настройка. **Это самая важная фаза для PBN.**

- [ ] **F2.1** `niches/` директория + JSON-схема `niche_profile.json`:
  ```json
  {
    "niche_id": "finance",
    "default_theme": "beta",
    "include_sections": ["ratings", "credit-cards", "online-credit", "..."],
    "section_labels": { "ratings": "Рейтинги", "...": "..." },
    "section_label_variants": [
      { "ratings": "Рейтинги", "...": "..." },
      { "ratings": "ТОПы", "...": "..." },
      { "ratings": "Лучшие", "...": "..." }
    ],
    "tags_dict": { "льготный_период": ["льготный период", "льготка", "беспроцентный"] },
    "brand_voice_prompt": "Стиль: финансовый журналист, факты + цифры, без воды",
    "rewrite_examples": [ ... ],
    "site_id_pattern": "{theme}-{niche}-{n}"
  }
  ```
- [ ] **F2.2** `niches/finance.json` — финансовая ниша (на основе анализа vsezaimyonline)
- [ ] **F2.3** `niches/seo.json` — SEO-ниша (на основе анализа mosseo)
- [ ] **F2.4** Crawler читает `--niche finance` → `include_sections` из профиля автоматически
- [ ] **F2.5** `gen-env.sh` поддерживает `--niche-labels-from finance` → подставляет лейблы из ниши

### Фаза 3: `create_site.py` оркестратор

Один скрипт от донора до preview. Цель — **time-to-live < 30 минут**.

- [ ] **F3.1** `create_site.py --donor X --niche Y --site-id Z --brand "Имя" [--brand-suffix ...] [--limit 100] [--with-rewrite]`
- [ ] **F3.2** Под капотом:
  1. Регистрирует донора (если ещё нет)
  2. `crawl_pages_fc.py` с правильными `--include-sections` из niche
  3. `build_content_index.py --min-chars 500`
  4. Генерирует `sites/Z/site.config.json` из шаблона ниши + переданные параметры
  5. (опц.) `rewrite_intros.py` если `--with-rewrite`
  6. `export_site.py --site-id Z`
  7. `gen-env.sh Z && build`
  8. smoke-check 5-10 URL через preview
- [ ] **F3.3** Variation seed: `site_id` → hash → выбор `section_label_variants[i]` → каждый клон выглядит чуть иначе
- [ ] **F3.4** Запись в registry (сайт, донор, niche, run_id, статус)

### Фаза 4: Уникализация контента (per-site automation)

**Без этого PBN не существует — Яндекс/Google поймают за copy-paste.**

- [ ] **F4.1** `transform_titles.py` — правила из ниши:
  - Strip donor-suffix (универсально)
  - Замена `{year}` placeholder'ов
  - Per-niche regex чистка (например, `\bна май 2026\b` → `в 2026 году`)
- [ ] **F4.2** `rewrite_intros.py` — LLM-rewrite первого параграфа
  - Использует `brand_voice_prompt` из niche profile
  - Кеш в `intro_cache/{donor_id}/{page_id}.json` — переиспользуется при ре-краузале
  - Бюджет: ~$0.002/страница, OpenAI gpt-4o-mini
- [ ] **F4.3** `--with-rewrite` флаг в `create_site.py` запускает обе трансформации
- [ ] **F4.4** Структурная вариация: `siteConfig.layout_variant` (1/2/3) → выбор `ArticleLayoutVariant1/2/3`
  - Variant 1: meta = дата + читать N минут
  - Variant 2: meta = author chip + дата
  - Variant 3: meta = только дата, sidebar справа

### Фаза 5: Перелинковка (B3.4 в roadmap — universal)

Работает на любой нише. После F1-F4 даёт +5-8 internal links/страница.

- [ ] **F5.1** FTS5-индекс в `content_index.sqlite` per site
- [ ] **F5.2** `findRelated(currentPath, limit=5)` в `site/src/lib/related.ts`
- [ ] **F5.3** `<RelatedPages>` Astro компонент
- [ ] **F5.4** Встраивание в `ArticleLayout`, `ServiceLayout`

### Фаза 6: Шаблоны (universal)

Один раз — для всех ниш. `RatingLayout` не специфичен для финансов — он работает для любого `page_type=rating`.

- [ ] **F6.1** `HubLayout.astro` — `/{section}/` index-страницы с listing-сеткой spoke'ов
- [ ] **F6.2** `RatingLayout.astro` — top-N table из `pricing_tiers` + body
- [ ] **F6.3** `routing.ts` → mapper с новыми типами
- [ ] **F6.4** Section-labels из niche profile в breadcrumbs, hub headers, nav

### Фаза 7: Теги и тематические кластеры

Universal механизм, словарь тегов per niche.

- [ ] **F7.1** `extract_tags.py` — словарный матч из `niche.tags_dict` + LLM на спорные
- [ ] **F7.2** Tag-archive pages — `/tag/{slug}/` (только если ≥3 материала)
- [ ] **F7.3** Tag-cloud на hub-pages

### Фаза 8: GEO + AI SEO Schema (universal)

- [ ] **F8.1** `FinancialProduct` Schema для рейтингов (B3.6, niche=finance only)
- [ ] **F8.2** `ItemList` Schema для hub-листингов (universal)
- [ ] **F8.3** speakable cssSelector расширить на FAQ-секции

### Фаза 9: Footprint diversity (anti-detection)

Финальный слой. После F1-F8 каждый клон уже сильно отличается, но добавляем:

- [ ] **F9.1** Nav order permutation на основе `hash(site_id)` — порядок секций разный
- [ ] **F9.2** Subtle CSS-token variations внутри одной темы: `border-radius`, `--space-section` jitter ±10%
- [ ] **F9.3** Article meta variation (см. F4.4)
- [ ] **F9.4** Random featured-section на главной — разные секции выделены на разных клонах

---

## 7.1 Скорость деплоя нового сайта — целевой путь

После F1-F4 (Platform + Niche + Orchestrator + Rewrite) новый сайт делается одной командой:

```bash
# Финансовый клон vsezaimyonline.ru, тема beta, бренд "ФинКарта":
create_site.py \
  --donor vsezaimyonline.ru \
  --niche finance \
  --site-id finkarta-ru \
  --brand "ФинКарта" \
  --limit 200 \
  --with-rewrite

# → 30 минут машинного времени:
#   ~5 мин crawl (200 страниц)
#   ~3 мин index + export
#   ~10 мин LLM rewrite intros (~$0.40)
#   ~5 мин build + smoke
#   ~5 мин: подставить контакты + metrika ID вручную
```

После этого: deploy через `build-all.sh` на любой Beget-хост.

---

## 8. Что НЕ делать (anti-patterns)

- ❌ **Не переписывать body LLM-ом целиком** — теряем фактологию, риск галлюцинаций, дорого
- ❌ **Не использовать донорский H1 как есть** — это самый явный duplicate-signal
- ❌ **Не клонировать donor CSS** — у нас своя тема, donor_style_profile только токены
- ❌ **Не индексировать thin pages** — выкидываем из nav и sitemap, но Astro-страницы могут оставаться (404-friendly)
- ❌ **Не делать tag-страницы без минимум 3 материалов** — пустые архивы вредят SEO

---

## 9. Метрики "хорошего сайта" (per-site)

После всех фаз должно быть:

| Метрика | Цель |
|---|---|
| Уникальность title (vs донор) | 90%+ |
| Уникальность intro (vs донор) | 80%+ |
| Avg internal links на страницу | 8-15 (сейчас 7) |
| Покрытие related блоком | 100% spokes |
| Покрытие FAQ Schema | 70%+ (сейчас 69%) |
| Hub-pages с structured spokes | 100% |
| Thin pages в индексе | 0 (сейчас 8) |
| Breadcrumb с человеческим лейблом | 100% |

## 9.1 Метрики PBN-фабрики (system-wide)

Применяются ко всей сетке, не к одному сайту:

| Метрика | Цель | Как мерить |
|---|---|---|
| Time-to-live (donor → preview) | < 30 минут | timestamp начало/конец `create_site.py` |
| Manual steps на 1 сайт | ≤ 3 (контакты, metrika, домен) | список оставшихся ручных полей |
| Cost per site (Firecrawl + LLM) | < $5 на 200 страниц | logged в `registry.crawl_runs.credit_cost` + LLM tokens |
| Footprint similarity между сайтами одной ниши | < 30% по hash слепкам HTML | сравнение `dist/` слепков |
| Шаблоны переиспользования | 100% (никаких per-site layout правок) | grep `if (site_id ==` в site/ → должно быть 0 |
| Niche profiles | ≥ 3 (finance, seo, info) | `ls niches/*.json` |

---

## 10. Сводный анализ: что меняется vs изначальный план

**Расширения для PBN-контекста:**

| Было в v1 | Стало в v2 (PBN) |
|---|---|
| F1.1 глобальный `section_labels.json` | F2.1 niche profiles + variants (вариативность лейблов) |
| LLM-rewrite "опциональный" | F4.2 **критичный** для PBN — без него = duplicate |
| Шаблоны "под одну нишу" | F6 универсальные шаблоны, niche только параметры |
| Нет orchestrator'а | F3 `create_site.py` — single command новый сайт |
| Нет variation strategy | F4.4 + F9 footprint diversity layer |
| Нет cost-tracking | F3.4 регистрация в registry с credit/LLM cost |

**Что в v1 было правильно и осталось:**
- Анализ структуры донора и hub-and-spoke — независим от PBN
- 4 типа перелинковки — универсальный механизм
- Anti-patterns (не клонировать body) — критичны и для одного, и для N сайтов
- Метрики качества (per-site) — нужны в обоих контекстах

**Рекомендация по порядку:**

```
F1 (universal cleanup) → F2 (niche profiles) → F3 (orchestrator)
              ↓
F4 (rewrite + variation) → F5 (related, =B3.4 из roadmap)
              ↓
F6 (templates) → F7 (tags) → F8 (schema) → F9 (footprint)
```

**Первый запуск после F1-F4:** делаем 2 финансовых клона из vsezaimyonline (`finhelp-ru` + `finkarta-ru`) — проверяем что они **выглядят и читаются по-разному**, нет повторов в title и intro, time-to-live ≤ 30 мин.
