# Research: Генерация страниц — SEO + GEO + AI SEO

> Как должны формироваться страницы PBN-фабрики для максимальной
> видимости в классическом поиске, AI-поиске и у LLM-агентов.

---

## 1. Что есть сейчас

### Данные из краулера (crawl_pages_fc.py)
```
page JSON:
  slug, title, h1, meta_description
  content_markdown, content_html
  links[], images[]
  faq_pairs[], key_points[], services[]
  pricing_tiers[], case_results[], cta_text
  page_type (LLM), word_count
```

### Что делает Astro сейчас
- 8 layout-типов (Home, Article, Service, Archive, FAQ, Portfolio, Dictionary, Contact)
- Schema.org: Organization, WebSite, Article, Service, BreadcrumbList, CollectionPage
- Breadcrumbs, canonical, meta-title/description
- PromoSlot (заглушка под CPA-ссылки)
- Меню: **хардкод** `nav.ts` — главная проблема

### Чего не хватает
- Динамическая навигация под каждый донор
- GEO-сигналы (структура для AI-поиска)
- E-E-A-T блоки (автор, дата, источник)
- Внутренняя перелинковка (related pages)
- Локальные сигналы (город, регион)
- FAQ как отдельный Schema.org блок на каждой странице
- Финансовые page_type (mfo_card, rating, calculator)
- Топик-кластеры (hub→spoke внутренние ссылки)

---

## 2. Три вектора оптимизации

### 2.1 Классический SEO (Яндекс / Google)

Яндекс 2025–2026: контент-качество и E-E-A-T важнее ссылочного.

**Что нужно на странице:**
- `<title>` = основной запрос + бренд, до 60 символов
- `<meta description>` = 130–160 символов, содержит запрос + CTA
- `<h1>` — один, точно под запрос
- `<h2–h4>` — структурированный контент, LSI-слова в подзаголовках
- Breadcrumbs — видимые + Schema.org BreadcrumbList
- Canonical — на себя, без параметров
- `datePublished` / `dateModified` — обязательно для статей
- `robots: index, follow` (или `noindex` для дублей)
- Internal links — минимум 3–5 релевантных ссылок на связанные страницы
- `hreflang="ru"` для рунета
- Image alt — описательный текст, не «image1.jpg»
- Page speed: Astro static = уже хорошо (LCP < 2.5s)
- Structured snippets: FAQ, HowTo, Product, Review — прямо влияют на расширенные сниппеты

**Что LLM-экстракция уже даёт:**
- `faq_pairs` → FAQPage Schema.org → расширенные сниппеты в Яндексе
- `key_points` → можно использовать как summary-блок
- `services` → ItemList Schema.org
- `pricing_tiers` → Product / Offer Schema.org

---

### 2.2 GEO — Generative Engine Optimization

GEO = оптимизация под AI-поиск: Perplexity, ChatGPT Search, Яндекс Нейро, Google AI Overview.

**Принцип:** AI-агенты ищут контент, который легко процитировать как авторитетный источник.

**Ключевые сигналы:**

| Сигнал | Описание | Реализация |
|---|---|---|
| Чёткие определения | «X — это...» в первом абзаце | Генерируем из key_points[0] |
| Структурированные списки | Нумерованные шаги, таблицы | Markdown → HTML уже есть |
| FAQ блок | Вопрос-ответ, явно разделённый | faq_pairs → FAQPage Schema |
| Авторство | Кто написал, когда | E-E-A-T блок (автор + дата) |
| Цитируемые данные | Статистика, цифры с источниками | Из контента донора |
| Краткий Summary | TL;DR в начале длинных статей | key_points → summary-блок |
| Ясная структура h1→h2→h3 | AI парсит через heading-иерархию | Уже есть в markdown |
| Чистый HTML без мусора | Без рекламных div, popups | Astro static = чисто |
| Семантически правильный HTML | `<article>`, `<section>`, `<aside>` | Нужно проверить layouts |

**Особенность Perplexity / ChatGPT Search:**
Эти системы индексируют через собственные краулеры. Они предпочитают:
- Явные `<h2>` с вопросами («Как получить займ без отказа?»)
- Короткие прямые ответы в первых 2–3 предложениях после h2
- Таблицы сравнения (особенно для финансов: МФО, банки)
- `speakable` Schema.org (для голосового поиска)

---

### 2.3 AI SEO — E-E-A-T и топик-кластеры

**E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness):**

Для PBN-сайтов это сложнее всего — анонимные сайты страдают.
Реалистичные решения:

| Сигнал | Реализация |
|---|---|
| Дата публикации / обновления | `datePublished` из краулера или `crawled_at` |
| «Проверено редакцией» | Генерируемый блок с датой проверки |
| Автор (псевдо) | Сгенерированный профиль автора по нише |
| Внешние ссылки на авторитеты | ЦБ РФ, Яндекс.Справка, Wikipedia |
| Физический адрес | Из contacts (уже есть) |
| Телефон + email | Из contacts (уже есть) |
| HTTPS | Beget → есть |
| Privacy Policy / Terms | Генерировать как static страницы |

**Топик-кластеры (Topical Authority):**

Поисковики и AI оценивают сайт как эксперта, если он полностью покрывает тему.

```
Hub (pillar page):              /ratings/
  Spoke 1:                      /ratings/luchshie-zajmy/
  Spoke 2:                      /ratings/luchshie-banki/
  Spoke 3:                      /ratings/luchshee-refinansirovanie/

Hub:                            /terms/
  Spoke:                        /terms/bankassyurans/
  Spoke:                        /terms/overdraft/
  ...
```

Каждый spoke → внутренняя ссылка на hub.
Hub → список всех spokes.
Это уже частично есть через ArchiveLayout, нужно усилить.

---

## 3. Как должна формироваться структура страницы

### Универсальный шаблон (любой page_type)

```
┌─────────────────────────────────────┐
│ Breadcrumbs                         │  ← BreadcrumbList Schema
├─────────────────────────────────────┤
│ H1 (точный запрос)                  │
│ Meta: автор · дата · время чтения   │  ← E-E-A-T сигналы
├─────────────────────────────────────┤
│ Summary / Key Points (TL;DR)        │  ← из key_points[]
│ (только если word_count > 800)      │
├─────────────────────────────────────┤
│ Основной контент (markdown→HTML)    │  ← h2/h3 структура
│   + таблицы, списки                 │
├─────────────────────────────────────┤
│ FAQ секция (если faq_pairs > 0)     │  ← FAQPage Schema
├─────────────────────────────────────┤
│ PromoSlot / CTA                     │  ← CPA оффер из links.json
├─────────────────────────────────────┤
│ Related Pages (3–5 ссылок)          │  ← из той же секции
├─────────────────────────────────────┤
│ CTA Banner                          │
└─────────────────────────────────────┘
```

### Специфика по page_type

| page_type | Особые блоки | Schema.org |
|---|---|---|
| article / qa_article | Summary, FAQ, Related, Author | Article, FAQPage |
| service | Hero CTA, pricing_tiers, case_results | Service, Offer |
| mfo_card | Таблица условий, кнопка «Получить», рейтинг | FinancialProduct |
| rating | Таблица сравнения N позиций, критерии | ItemList |
| calculator | Интерактивный расчёт (JS) | HowTo |
| faq | Accordion, все faq_pairs | FAQPage |
| dictionary_article | Определение, примеры, ссылки на связанные | DefinedTerm |
| archive | Карточки дочерних страниц, описание секции | CollectionPage |
| home | Hero, stats, service grid, cases, FAQ | WebSite, Organization |
| contact | Форма + реквизиты | ContactPage, LocalBusiness |

### Новые Schema.org — нужно добавить

```typescript
// FAQPage — для каждой страницы с faq_pairs
{
  "@type": "FAQPage",
  "mainEntity": faq_pairs.map(({q, a}) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": a }
  }))
}

// FinancialProduct — для МФО/банк карточек
{
  "@type": "FinancialProduct",
  "name": title,
  "description": meta_description,
  "provider": { "@type": "Organization", "name": brand_name },
  "annualPercentageRate": rate  // из pricing_tiers
}

// ItemList — для рейтингов
{
  "@type": "ItemList",
  "itemListElement": items.map((item, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": item.name,
    "url": item.href
  }))
}

// speakable — для голосового поиска / AI
{
  "@type": "SpeakableSpecification",
  "cssSelector": [".page-summary", "h1", ".faq-answer"]
}
```

---

## 4. Как будет формироваться дизайн

### Текущая проблема
Один CSS (`global.css`) для всех сайтов. Нет визуального разнообразия — PBN-footprint заметен.

### Решение: donor_style_profile → theme tokens

**Шаг 1.** При краулинге извлекаем из донора:
```python
# style_extractor.py (будущий B3)
donor_style = {
  "primary_color": "#...",     # из CSS/inline styles
  "font_family": "...",        # из <link> Google Fonts
  "border_radius": "...",      # из buttons/cards
  "tone": "formal|friendly",   # из текста (LLM)
}
```

**Шаг 2.** `theme_generator.py` → `sites/<id>/theme.tokens.json`:
```json
{
  "color-accent": "oklch(62% 0.19 245)",
  "color-surface": "oklch(98% 0 0)",
  "font-heading": "'Inter', sans-serif",
  "radius-card": "12px",
  "radius-btn": "6px"
}
```

**Шаг 3.** Astro при сборке инжектирует токены как CSS custom properties.

**Три базовые темы (B3):**
- `alpha` — текущая тема (SEO-агентство: синий, строгий)
- `beta` — финансовая (зелёный, доверие, округлые)
- `gamma` — информационная (нейтральный, читабельный, широкий)

**Правило:** donor CSS никогда не копируется напрямую. Только токены.

---

## 5. Как будет формироваться навигация

### Источник данных
`build_manifest.json` → секции по количеству страниц → топ-N → nav.json

### generate_nav.py — алгоритм

```python
1. Загрузить build_manifest.json
2. Сгруппировать страницы по section
3. Отфильтровать: убрать секции с < MIN_PAGES (default: 2)
4. Для каждой секции найти archive-страницу (page_type=archive или самый короткий slug)
5. Humanize slug → label (словарь + транслитерация)
6. Топ-N секций → основные пункты меню
7. Для dropdown: страницы внутри секции с page_type in [service, article, rating]
8. Записать sites/<id>/nav.auto.json
9. Если sites/<id>/nav.json существует — не перезаписывать (ручной override)
```

### Humanize словарь (финансы)
```python
HUMANIZE = {
  "ratings": "Рейтинги",
  "banks": "Банки",
  "qa": "Вопросы и ответы",
  "terms": "Словарь",
  "mortgage": "Ипотека",
  "autocredit": "Автокредит",
  "sbp": "СБП",
  # SEO:
  "seo-uslugi": "Услуги",
  "portfolio": "Портфолио",
  "faq": "FAQ",
  "stoimost-uslug": "Стоимость",
}
```

### Astro изменение
`nav.ts` → только типы (NavItem, NavColumn)
`loadNav.ts` → читает `sites/<SITE_ID>/nav.json` через SITE_ID env

---

## 6. Внутренняя перелинковка (Related Pages)

Сейчас: ноль автоматической перелинковки.

### Алгоритм (на уровне экспортера / build)

```
Для каждой страницы:
  1. Взять section → найти 3–5 других страниц в той же section
  2. Взять ключевые слова из title/h1 → поиск по content_index
  3. Результат → related_pages[] в page JSON
  4. ArticleLayout, ServiceLayout рендерят блок "Читайте также"
```

Реализация: `content_index.sqlite` уже есть → FTS по title/h1.

---

## 7. Приоритет реализации

### Что даёт максимум при минимуме усилий

| Задача | Усилие | Выхлоп SEO | Выхлоп GEO |
|---|---|---|---|
| FAQPage Schema для всех faq_pairs | малое | ★★★★ | ★★★★★ |
| Динамическая nav из nav.json | среднее | ★★ | ★ |
| Summary-блок из key_points | малое | ★★★ | ★★★★ |
| Related pages (3 ссылки) | среднее | ★★★★ | ★★★ |
| datePublished / dateModified | малое | ★★★★ | ★★★ |
| FinancialProduct Schema (финансы) | среднее | ★★★ | ★★★★ |
| ItemList Schema (рейтинги) | малое | ★★★★ | ★★★★ |
| speakable Schema | малое | ★★ | ★★★★★ |
| Темы alpha/beta/gamma | большое | ★ | ★ |
| E-E-A-T автор-блок | среднее | ★★★ | ★★★ |
| generate_nav.py | среднее | ★★ | ★ |

### Рекомендуемый порядок

```
Сейчас (разблокирует preview):
  → generate_nav.py + loadNav.ts   (динамическое меню)

Следующие (до полного краулинга финансового донора):
  → FAQPage Schema для faq_pairs   (нулевые усилия, макс эффект)
  → Summary-блок из key_points
  → datePublished/Modified

При полном краулинге (--with-llm):
  → FinancialProduct Schema
  → ItemList Schema (ratings)
  → Related pages из content_index

B3 (отдельный этап):
  → theme tokens + 3 темы
  → donor_style_profile
  → E-E-A-T автор-блок
```

---

## 8. Что нужно в LLM-экстракции для GEO

Текущая схема достаточная, но нужно добавить:

```python
PAGE_EXTRACTION_SCHEMA = {
  # Существующие поля ...

  # Новые для GEO:
  "summary": {
    "type": "string",
    "description": "2-3 предложения TL;DR для AI-цитирования"
  },
  "entities": {
    "type": "array",
    "items": {"type": "string"},
    "description": "Ключевые сущности: названия МФО, банков, продуктов"
  },
  "data_points": {
    "type": "array",
    "items": {"type": "string"},
    "description": "Конкретные цифры и факты: ставки, сроки, лимиты"
  },
  "target_query": {
    "type": "string",
    "description": "Основной поисковый запрос, под который написана страница"
  }
}
```

`summary` + `data_points` → speakable Schema + Summary-блок → AI-поиск цитирует нас.

---

## Итого: что строим

```
Краулер (crawl_pages_fc.py --with-llm)
  → page JSON с: faq_pairs, key_points, summary, entities, data_points, target_query
  ↓
generate_nav.py
  → sites/<id>/nav.json  (авто + ручной override)
  ↓
export_site.py (E3)
  → related_pages[] через content_index FTS
  → sites/<id>/pages/*.json с полным набором полей
  ↓
Astro build
  → loadNav.ts → динамическое меню
  → FAQPage Schema на каждой странице с faq_pairs
  → Summary блок из key_points
  → Related Pages блок
  → FinancialProduct / ItemList / speakable по page_type
  → Theme tokens из sites/<id>/theme.tokens.json
  ↓
Статичный сайт: SEO + GEO + E-E-A-T + топик-кластер
```
