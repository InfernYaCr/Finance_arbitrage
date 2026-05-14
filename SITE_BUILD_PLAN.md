# План сборки сайта из донорского контента

Анализ на примере **vsezaimyonline** (100 страниц), но применим для любого донора.

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

## 7. Фазовый план реализации

### Фаза 1: чистая структура (быстрые победы, день работы)

- [ ] **F1.1** `section_labels.json` + breadcrumbs читают его
- [ ] **F1.2** `_SKIP_PATTERNS` → добавить `/amp`, `.html/amp`
- [ ] **F1.3** `build_content_index.py` → `--min-chars 500` (thin pages в excluded_pages.json)
- [ ] **F1.4** `generate_nav.py` → исключать страницы с `content_text_chars < 500`
- [ ] **F1.5** Title-cleanup: убрать остатки `— ВсеЗаймыОнлайн` через `brand.ts`

### Фаза 2: перелинковка (B3.4 — уже в roadmap)

- [ ] **F2.1** FTS5-индекс в `content_index.sqlite` (если ещё нет)
- [ ] **F2.2** `findRelated(currentPath, limit=5)` в `site/src/lib/related.ts`
- [ ] **F2.3** `<RelatedPages>` Astro компонент
- [ ] **F2.4** Встроить в `ArticleLayout`, `ServiceLayout`

### Фаза 3: тематические кластеры

- [ ] **F3.1** `extract_tags.py` — словарный + LLM-матч → `extracted.tags[]`
- [ ] **F3.2** Tag-archive pages — `/tag/{slug}/`
- [ ] **F3.3** Tag-cloud компонент на hub-pages

### Фаза 4: новые шаблоны

- [ ] **F4.1** `HubLayout.astro` — для `/{section}/` страниц с spokes
- [ ] **F4.2** `RatingLayout.astro` — table-of-products + article body
- [ ] **F4.3** routing.ts → mapper включает новые типы

### Фаза 5: адаптация контента

- [ ] **F5.1** `rewrite_intros.py` — LLM-rewrite первого параграфа (1 раз на страницу)
- [ ] **F5.2** `transform_titles.py` — нормализация title/H1 + подстановка `{year}`
- [ ] **F5.3** Динамический year через `siteConfig.currentYear`
- [ ] **F5.4** CTA-блок в `ArticleLayout` — auto-inject из PromoSlot

### Фаза 6: GEO + AI SEO

- [ ] **F6.1** `FinancialProduct` Schema для рейтингов (B3.6)
- [ ] **F6.2** `ItemList` Schema для hub-листингов
- [ ] **F6.3** speakable cssSelector для FAQ-секций (поверх существующего .article-summary)

---

## 8. Что НЕ делать (anti-patterns)

- ❌ **Не переписывать body LLM-ом целиком** — теряем фактологию, риск галлюцинаций, дорого
- ❌ **Не использовать донорский H1 как есть** — это самый явный duplicate-signal
- ❌ **Не клонировать donor CSS** — у нас своя тема, donor_style_profile только токены
- ❌ **Не индексировать thin pages** — выкидываем из nav и sitemap, но Astro-страницы могут оставаться (404-friendly)
- ❌ **Не делать tag-страницы без минимум 3 материалов** — пустые архивы вредят SEO

---

## 9. Метрики "хорошего сайта"

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
