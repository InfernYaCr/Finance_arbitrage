# Обзор проекта и план развития (для ревью)

Дата: 2026-10-13. Ветка: `codex/pbn-factory`.

Короткий документ, чтобы быстро понять, что здесь есть, где лежат офферы и что
мы собираемся делать дальше. Подробные рабочие заметки — в
[AGENT_HANDOFF.md](AGENT_HANDOFF.md) и [HANDOFF.md](HANDOFF.md).

---

## 1. Что это

Фабрика финансовых контент-сайтов (сетка под CPA-арбитраж):

1. **Донор** — существующий сайт ниши (займы, кредиты, карты, страхование).
2. **Пайплайн (Python)** краулит донора, чистит и нормализует контент в JSON.
3. **Рендерер (Astro)** собирает из JSON статический сайт под свой бренд.
4. На страницы встраиваются **CPA-офферы** (сеть Saleads).
5. Деплой — статика по FTP на хостинг Beget.

Модель заработка: каждый сайт сам зарабатывает на CPA-офферах. Ссылочная
перелинковка между сайтами сети пока не делалась.

## 2. Что в репозитории

| Часть | Где | Объём | Состояние |
|---|---|---|---|
| Пайплайн: краулеры, QA, индекс, экспорт | [site_pipeline/](site_pipeline/), [create_site.py](create_site.py), [export_site.py](export_site.py) | ~7000 строк Python | работает |
| Клиент CPA-сети Saleads | [site_pipeline/saleads_offers.py](site_pipeline/saleads_offers.py) | 536 строк | работает |
| Данные сайтов (контент + конфиги + офферы) | [sites/](sites/) | 3 сайта | finhelp-ru собран (2921 стр.) |
| Рендерер сайта (Astro 4, свой CSS) | [site/](site/) | ~7500 строк | работает, но устарел (см. §5) |
| Деплой / генерация env | [site/scripts/deploy.sh](site/scripts/deploy.sh), [gen-env.sh](gen-env.sh) | — | работает |

Ключевые файлы рендерера:

- [site/src/data/loadPages.ts](site/src/data/loadPages.ts) — загрузка JSON и
  нормализация: замена бренда донора, вычистка чужих контактов, хлебных крошек,
  путей к картинкам.
- [site/src/lib/brand.ts](site/src/lib/brand.ts) — замена брендов донора
  (названия банков/МФО не трогает).
- [site/src/lib/affiliate.ts](site/src/lib/affiliate.ts) — выбор офферов для страницы.
- [site/src/lib/schema.ts](site/src/lib/schema.ts) — JSON-LD разметка.

Связь пайплайна и рендерера — только через файлы в `sites/<site>/`:
`pages/*.json`, `build_manifest.json`, `site.config.json`,
`affiliateLinks.json`, `promoSlots.json`. Поэтому рендерер можно заменить, не
трогая Python.

## 3. Где лежат офферы

Все офферы — сеть **Saleads**. Ссылки вида `https://my.saleads.pro/s/<uuid>`.

### 3.1. Мастер-реестр — [sites/affiliate_pool.json](sites/affiliate_pool.json)

Все подключённые офферы аккаунта: **189 шт.** — 129 одобрены (`approve`),
60 на модерации (`wait`).

По вертикалям: МФО 54, карты 38, страхование 31, бизнес 20, прочее 13,
работа 12, кредиты 7, инвестиции 6.

```json
{
  "id": "saleads-b87534e0",
  "label": "hh (регистрация нового клиента-работодателя)",
  "href": "https://my.saleads.pro/s/88edd170-...",
  "network": "saleads",
  "vertical": "business",
  "offer_uuid": "b87534e0-...",
  "connector_uuid": "88ec92f0-...",
  "payout": "7500₽",
  "status": "approve",
  "enabled": true
}
```

### 3.2. Офферы конкретного сайта — `sites/<site>/affiliateLinks.json`

Пример: [sites/finhelp-ru/affiliateLinks.json](sites/finhelp-ru/affiliateLinks.json) —
**101 оффер** (МФО 31, карты 27, страхование 17, бизнес 12, инвестиции 5,
кредиты 4, финансы 3, ипотека 1). Отличие от реестра — добавлены `rel` и `utm`:

```json
{
  "id": "saleads-28cba850",
  "label": "ОТП Банк - Кредитная карта 120 дней без %",
  "href": "https://my.saleads.pro/s/83788e60-...",
  "rel": "sponsored nofollow",
  "utm": { "source": "site", "medium": "cpa", "campaign": "card" },
  "vertical": "card",
  "payout": "4500₽",
  "enabled": true
}
```

У `vsezaimyonline` и `rostpoisk` офферы ещё не выгружены.

### 3.3. Где офферы показываются — `sites/<site>/promoSlots.json`

Слот = место на странице + список `link_ids` из `affiliateLinks.json` + фильтр
по разделам (`sections`) или конкретным URL (`paths`).
Сейчас в [sites/finhelp-ru/promoSlots.json](sites/finhelp-ru/promoSlots.json)
один общий слот на 4 оффера для всех статей — разбивки по разделам ещё нет.

### 3.4. Как это рендерится

- [site/src/components/PromoSlot.astro](site/src/components/PromoSlot.astro) —
  блок офферов внизу страницы (`placement="article_footer"`), вставлен в
  `ArticleLayout`, `FaqLayout`, `ServiceLayout`.
- [site/src/pages/go/[offer].astro](site/src/pages/go/[offer].astro) — редирект
  `/go/<id>/` → ссылка Saleads с UTM (клиентский, `meta refresh`).

### 3.5. Как обновить офферы

```bash
. .venv/bin/activate
python site_pipeline/saleads_offers.py connect-missing --dry-run   # что ещё не подключено
python site_pipeline/saleads_offers.py connect-missing             # подключить (идемпотентно)
python site_pipeline/saleads_offers.py export-pool                 # → sites/affiliate_pool.json
python site_pipeline/saleads_offers.py export-links --site-relevant \
  --out sites/finhelp-ru/affiliateLinks.json                       # офферы для сайта
```

Токен Saleads берётся из `site/.env` (`SALEADS_API_KEY`), в репозитории его нет.

## 4. Новый сайт: rencredit-online.ru

Есть свой WordPress-сайт https://rencredit-online.ru/ — хотим перенести его в
этот пайплайн и сделать финансовым CPA-сайтом.

Что на нём сейчас:

- WordPress 6.1.1, тема OceanWP, Yoast SEO. REST API открыт.
- 37 постов + 2 страницы, одна рубрика. URL вида `/credit/<slug>.html`.
- ~17 длинных статей про рефинансирование, ~20 коротких новостей.
- Займов / МФО / карт нет — этот контент нужно писать.
- Контент похож на заимствованный, картинки грузятся с чужого домена,
  в текстах 20 чужих партнёрских ссылок (delen.ru) — при переносе вычистить.
- Главная ценность — возраст и история домена, а не тексты.

**Риск:** «Ренессанс Кредит» — зарегистрированный товарный знак банка. Домен с
`rencredit` + офферы МФО/кредитов конкурентов = риск претензии/суда за домен и
санкций Яндекса (YMYL). Минимум: дисклеймер «не является сайтом банка»,
нейтральное название, никаких офферов «Ренессанс». Альтернатива — переезд на
нейтральный домен через 301 + «Переезд сайта» в Вебмастере. Решение не принято.

## 5. План: переезд рендерера на AstroWind

[AstroWind](https://github.com/onwidget/astrowind) — популярный шаблон на
Astro 7 + Tailwind v4.

**Почему:** наш `site/` на Astro 4.16 (отстаёт на 3 мажорные версии), шапка,
главная и шаблоны свёрстаны вручную. У AstroWind из коробки ~20 готовых блоков
(Hero, Features, Steps, Pricing, FAQs, CTA, BlogLatestPosts), блог с
пагинацией/рубриками/тегами, оптимизация картинок, сжатие, sitemap, RSS.
Плюс популярный шаблон хуже «склеивает» сайты сети, чем свой уникальный.

**Принцип:** сайт пишем заново, данные и логику сохраняем.

| Что | Действие |
|---|---|
| Python-пайплайн и `sites/` | не трогаем |
| `loadPages.ts`, `brand.ts`, `affiliate.ts`, `schema.ts`, `/go/` (~1200 строк) | переносим как есть — там исправления, найденные на практике |
| Шаблоны, Header/Footer, главная, CSS-темы (~6300 строк) | пишем заново на блоках AstroWind |
| sitemap, RSS, robots, SEO-head | берём из AstroWind |

Фазы (в отдельной папке `site-aw/`, старый `site/` живёт до конца переезда):

0. **Заготовка** (0,5 дня) — клон AstroWind, сборка проходит.
1. **Данные** (1–1,5 дня) — свой content loader для `pages/*.json` с нашей
   нормализацией; `config.yaml` генерируется из `site.config.json`.
   Проверка: число страниц = `build_manifest`, донорских брендов в `dist/` нет.
2. **URL** (0,5 дня) — старые адреса сохраняем, 301 через `.htaccess`
   (у каждого сайта свой). Проверка: все старые URL дают 200/301/410.
3. **Офферы** (1 день) — `PromoSlot`/`OfferCard` на Tailwind, `/go/` +
   `noindex`. Проверка: у всех `link_ids` есть пара, блоки видны.
4. **Шаблоны и разметка** (1–1,5 дня) — главная из блоков AstroWind,
   JSON-LD в Metadata. Проверка: валидатор Яндекса, Lighthouse ≥ 90.
5. **Различия сайтов** (0,5 дня) — у каждого сайта свои цвета/шрифты/набор
   блоков. Проверка: HTML и CSS двух сайтов заметно отличаются.
6. **Пилот rencredit** (1 день) — контент через REST API, тестовый поддомен
   с `noindex`, затем переключение домена и мониторинг 2–4 недели.
7. **Перевод сети** (2–3 дня, позже) — finhelp-ru на `site-aw/`, затем удалить `site/`.

Итого ~5–7 дней до пилота + 2–3 дня на перевод сети.

## 6. Известные проблемы

- Офферы не разложены по разделам — один общий слот.
- Страницы `/go/` открыты для индексации (нет `noindex` и `Disallow`).
- `redirects.json` не превращается в 301 на хостинге.
- Импортёра WordPress как отдельного шага нет (есть WP-ветка в
  [site_pipeline/crawl_pages.py](site_pipeline/crawl_pages.py)).
- Файл подтверждения Яндекса лежит в общем `site/public/` и уходит на все
  сайты — прямой признак связи сайтов сети.
- 60 офферов ждут модерации Saleads; после одобрения — повторный экспорт.

## 7. Вопросы к тебе

1. AstroWind или остаться на своём рендерере и просто обновить Astro?
2. Домен `rencredit-online.ru`: оставлять с дисклеймером или переезжать?
3. Перелинковка между сайтами сети: нужна или держим сайты независимыми?
