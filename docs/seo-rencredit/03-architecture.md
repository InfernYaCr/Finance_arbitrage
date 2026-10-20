# 03 — Архитектура и перелинковка: rencredit-online.ru («Мерка»)

Дата: 2026-10-19 · Код: worktree `/Users/deniskononov/rencredit-pilot-wt`, ветка `feat/rencredit-metrika`, приложение `web/apps/rencredit` (далее `${APP}`) · Линза: разделы и URL, хабы, меню и футер, крошки, блоки «похожие», ссылочный граф, глубина, сироты, автоперелинковка.

Метод: BFS-краул живого сайта от `/` (Python stdlib, 83 URL, все 200, совпадают с `sitemap-0.xml` 1:1). Ссылки разделены на шаблонные (`header.site-header`, `footer.site-footer`) и контентные (тело, aside, крошки). Плюс чтение кода компонентов и проверка клиентского фильтра витрины в Playwright. За основу взят отчёт finhelp `docs/seo/03-architecture.md` (модель «хаб → кластер → лист», анкоры, критерии готовности). Его находки про битые ссылки донора, `/zaim/*` и словарь к rencredit не относятся: здесь нет донорского HTML и 0 битых внутренних ссылок.

---

## Резюме

Сайт маленький и технически чистый: 83 индексируемых URL, глубина клика не больше 2 (52 URL на 1-м клике, 30 на 2-м), сирот нет, всё есть в sitemap. Проблема не в достижимости, а в том, **куда течёт вес и что видят пользователь и робот**:

1. **3 из 8 посадочных займов на клиенте показывают 0 предложений.** Это `/zaimy-bez-otkaza/`, `/zaimy-bez-foto/`, `/novye-mfo/`. Предфильтр (`no_refusal`, `no_photo`, `new`) есть у 0 из 22 МФО. Робот получает в HTML все 22 карточки, человек видит «пусто». `/zaimy-s-prosrochkami/` показывает 1 предложение. Все 8 подборок отдают в HTML одинаковые 22 карточки, такие же, как `/zaimy/` и главная, то есть 10 почти одинаковых листингов.
2. **Вес стекает в фиксированные «топ-3».** `bystrodengi`, `finmoll` и `mikroklad` получают по 37 контентных входящих: их тянут `CtaTop3` в каждой статье и «Похожие» в каждом обзоре МФО. Остальные 19 МФО получают по 10. У карт `akbars-115`, `ozon-kreditnaya-karta` и `uralsib-120` по 1 входящей (только каталог). У 4 переписанных легаси-статей тоже по 1 (только `/stati/`). Причина везде одна: `.slice(0, 3)` по приоритету или дате без ротации.
3. **Нет кластера «Рефинансирование».** 14 из 22 статей — про рефинансирование (единственная тематическая история домена). Под них нет посадочной: рубрика есть только как JS-кнопка на `/stati/`. Старая WP-рубрика `/credit/` ведёт 301 на общий `/stati/`.
4. **Хабы без контекстных связей.** `/zaimy/`, `/karty/` и `/kredity/` — это крошка и витрина, больше ничего: ни ссылок на подборки, ни статей, ни текста, ни FAQ. Обзоры МФО не ссылаются на подборки, хотя признаки совпадают (у 20 МФО есть `to_card`, а `/zaimy-na-kartu/` ни одной ссылки из обзоров не получает). У 8 новых статей, 8 подборок и 8 из 9 сервисных посадочных в теле 0 внутренних ссылок.
5. **Схема контента не готова к переиспользованию 30 статей finhelp.** `category` в `content.config.ts:66` знает только 6 кредитных рубрик. Статьи про ОСАГО, КАСКО, вклады, РКО, ипотеку и банкротство некуда отнести и нечем связать с `/osago/`, `/rko/` и т. п. 4–5 из них каннибализируют существующие страницы.

Целевая модель: **4 денежных хаба** (займы, кредиты, карты, страхование и сервисы) → **14 кластеров** (8 подборок займов, из них 3 нужно исправить, плюс новый `/refinansirovanie/` и 5 разделов страхования) → **листья** (33 обзора, статьи, новости). Связи строятся на сборке по правилам из §3 без ручного труда: подборки из `features` оффера, статьи из `category → hub`, «похожие» с детерминированной ротацией через уже существующий `pickVariant` (`${APP}/src/lib/cta.ts:107`).

---

## 1. Находки

### 1.1 URL-структура и разделы

| Раздел | URL | Шаблон | Кол-во на live |
|---|---|---|---|
| Главная | `/` | `pages/index.astro` | 1 |
| Хабы продуктов | `/zaimy/`, `/karty/`, `/kredity/` | `components/Catalog.astro` | 3 |
| Подборки займов (guides) | `/<guide>/` на корне | `pages/[guide].astro` | 8 |
| Обзоры | `/mfo/<slug>/`, `/karty/<slug>/`, `/kredity/<slug>/` | `pages/[dir]/[slug].astro` (`REVIEW_DIR`, `lib/offers.ts:13`) | 22 + 7 + 4 |
| Хаб страхования и сервисы | `/strahovanie/`, `/osago/`, `/kasko/`, `/strahovanie-{ipoteki,puteshestvennikov,kvartiry}/`, `/debetovye-karty/`, `/vklady/`, `/rko/` | `components/services/ServiceLanding.astro` | 9 |
| Статьи новые | `/stati/<id>/` | `components/ArticleView.astro` | 8 |
| Статьи легаси (на старом URL) | `/credit/<slug>.html` | то же, `lib/content.ts:18-21` | 14 |
| Новости | `/novosti/`, `/novosti/<id>/` | `pages/novosti/*` | 1 + 3 (4-я — `draft`) |
| Служебные | `/o-proekte/`, `/politika-konfidencialnosti/` | | 2 |
| Офферные редиректы | `/go/<poolId>/` | `Disallow` в robots, вне sitemap | — |

Оценка:

- **Плюс:** легаси-статьи остаются на исходных `/credit/<slug>.html`. Для 37 старых постов WP сделан полный 301-маппинг (`public/.htaccess`, блок `LEGACY 301`, генерируется `legacy/rencredit/gen_htaccess.py`). Для 23 снятых или переехавших обзоров тоже есть 301. Это бережёт возраст и ссылки домена.
- **Минус:** подборки займов лежат на корне (`/zaimy-bez-otkaza/`), а не под `/zaimy/`. Само по себе для Яндекса это не проблема: иерархию задают крошки и ссылки. Но при появлении подборок по картам или кредитам корень станет общей свалкой (уже сейчас нужен `RESERVED_SLUGS` из 24 слагов, `lib/ui/site.ts:70-72`). **URL не трогаем**, иерархию задаём логическим родителем (см. R5).
- **Риск переезда (ТЗ «Ренессанс Кредит», PROJECT_BRIEF §4):** canonical легаси-статей берётся буквально из `legacyUrl` с хостом `https://rencredit-online.ru/...` (`lib/content.ts:24-26`, `LEGACY_RE` допускает любой хост). Если сайт переедет на нейтральный домен через 301, 14 canonical будут указывать на старый домен. Остальные URL относительные и строятся от `SITE_URL` (`astro.config.mjs`). Чинится одной строкой: canonical = `new URL('/credit/<slug>.html', Astro.site)`.

### 1.2 Глубина клика и распределение входящих (live, 2026-10-19)

- Глубина: 0 — 1 URL, 1 — 52, 2 — 30. Глубже нет. Недостижимых и сирот: **0**.
- Шаблон (шапка, мобильное меню, футер) даёт около 24 уникальных внутренних ссылок на каждой странице. Через него на 1-м клике оказываются все хабы, 8 подборок, 9 сервисных разделов, `/stati/` и `/novosti/`.
- Контентные входящие (без шапки и футера) по 81 странице: медиана 9. **У 9 страниц всего 1 входящая**, у 21 — не больше 5.

| Страница | Контентных входящих | Откуда | Почему |
|---|---|---|---|
| `/mfo/bystrodengi/`, `/mfo/finmoll/`, `/mfo/mikroklad/` | 37 | все статьи + все обзоры МФО | `topOffers()` (`lib/cta.ts:84-88`) и `similar` (`[dir]/[slug].astro:21`) всегда берут первые 3 по `priority` |
| `/stati/kak-proverit-mfo-v-reestre-cb/` | 34 | почти все страницы | жёстко зашит в `CtaNext.astro:12` |
| остальные 19 `/mfo/*` | 10 | главная, `/zaimy/`, 8 подборок (одинаковая витрина) | в «Похожие» не попадают никогда |
| `/karty/akbars-115/`, `/karty/ozon-kreditnaya-karta/`, `/karty/uralsib-120/` | **1** | только `/karty/` | `similar` = первые 3 карты |
| `/credit/bank-otkrytie-…html`, `/credit/kak-polychit-pomosh-v-refinansirovanii.html`, `/credit/refinansirovanie-v-interprombanke-…html`, `/credit/ysloviia-refinansirovaniia-kreditov-v-banke-ybrir.html` | **1** | только `/stati/` | «Читайте также» = 3 самые свежие той же рубрики (`ArticleView.astro:29`). Старые статьи туда не попадают |
| `/stati/kreditnaya-karta-ili-zajm/` | **1** | только `/stati/` | единственная в рубрике `karty` |
| `/stati/kak-rabotaet-refinansirovanie-kredita/`, `/credit/kak-sdelat-…-v-sberbanke.html`, `/credit/perekreditovanie-…html` | 14–15 | все статьи о рефинансировании | это и есть «3 самые свежие» |
| `/kredity/tbank-refinansirovanie/` и другие из топ-3 кредитов | 19 | `CtaTop3` в 15 кредитных статьях | при этом `/kredity/alfa-refinansirovanie/` получает 4, хотя тема ровно его |

Вывод: граф сам по себе связный, но **вес распределён шаблонными `slice(0,3)`, а не темой**. Для Яндекса это означает много страниц с минимальным внутренним спросом и анкорами только из одного источника.

### 1.3 Посадочные займов (guides): пусто для пользователя, дубль для робота

- `[guide].astro:30` передаёт в `Showcase` все МФО и `preset={feature}`. Фильтрует только клиентский JS (`src/scripts/offers-ui.ts:80`: `if (preset) state.f.add(preset)`). В HTML на всех 8 подборках одинаковые 22 карточки (`data-count-out>22`).
- Распределение `features` по 22 МФО: `to_card` 20, `long_term` 13, `round_the_clock` 13, `zero_percent` 13, `bad_history` 10, `cash` 2, `with_overdue` 1, **`no_refusal` 0, `no_photo` 0, `new` 0**.
- Playwright на live: `/zaimy-bez-otkaza/`, `/zaimy-bez-foto/` и `/novye-mfo/` → `count=0`, показан пустой блок «Сбросить фильтры». `/zaimy-s-prosrochkami/` → 1. `/zaimy-s-plohoj-ki/` → 10, `/zaimy-bez-procentov/` → 13.
- Последствия: (а) пользователь из поиска по «займ без отказа» видит пустую страницу, а это плохой поведенческий сигнал на коммерческом YMYL-запросе; (б) содержимое для робота и для человека расходится; (в) 10 листингов с одинаковым набором карточек размывают релевантность. Отличаются только H1 и SEO-текст.

### 1.4 Хабы `/zaimy/`, `/karty/`, `/kredity/`, `/strahovanie/`

- `Catalog.astro:12-15` — это крошка и `Showcase`, больше ничего. Контентные исходящие: `/zaimy/` → 22 обзора, `/karty/` → 7, `/kredity/` → 4. **Ни одной ссылки на подборки, статьи, соседние хабы.** Нет SEO-текста и FAQ: это главный денежный URL займов без единого абзаца.
- `/karty/` пишет в lead «Дебетовые карты — в разделе «Дебетовые карты»» обычной строкой (`karty/index.astro:4`), ссылки нет. Хотя в шапке «Карты» объединяет кредитные и дебетовые.
- `/kredity/` с H1 «Кредиты наличными» содержит 2 оффера рефинансирования (`alfa-refinansirovanie`, `tbank-refinansirovanie`), но не ссылается ни на одну из 14 статей про рефинансирование.
- `/strahovanie/` и сервисные разделы (`ServiceLanding.astro`) сделаны лучше всех: плитки видов, блок «Другие разделы» (`:46-50`), текст и FAQ из `service-pages/*.mdx`, `noindex` для пустых. Но статей по этим темам нет, и подключить их некуда (см. 1.8). В теле 8 из 9 `service-pages/*.mdx` 0 внутренних ссылок. Исключение — `strahovanie.mdx` с 4 ссылками.
- Главная: в контенте есть 22 обзора МФО, плитки страхования, дебетовых карт, вкладов и РКО (`index.astro:20-25`). **`/karty/`, `/kredity/` и подборки в теле главной не упоминаются**, на них ведёт только шапка.

### 1.5 Меню, футер, крошки

- Шапка (`lib/ui/site.ts:46-67` + `Header.astro:11-13`): «Займы» (подменю — все 8 подборок) · «Карты» (кредитные, дебетовые) · «Кредиты» · «Страхование» (6) · «Ещё» (вклады, РКО, статьи, новости). На мобиле то же в `<details>`, поэтому каждая ссылка шапки встречается в HTML дважды.
  - `Header.astro:11` кладёт в подменю «Займы» **все** guides без фильтра по `kind`. Схема разрешает guide с `kind: card|credit` (`content.config.ts:89`), и новая подборка `/refinansirovanie/` попала бы в «Займы».
  - Рефинансирования в меню нет, хотя это ядро контента домена.
  - Кнопка «Подобрать займ» → `/#calc` стоит на всех страницах, включая ОСАГО и вклады. Для навигации не критично.
- Футер (`Footer.astro:41-75`): «Займы» = `guides.slice(0, 6)`, поэтому `/dolgosrochnye-zaimy/` и `/novye-mfo/` в футер не попадают. «Карты и кредиты» — 2 ссылки. «Читать» — `/stati/`, `/novosti/`. Брендов МФО и рубрик статей нет. Это нормально: футер не должен быть свалкой.
- Крошки (`Breadcrumbs.astro`, BreadcrumbList JSON-LD есть, последний элемент не ссылка, как и рекомендует Яндекс):
  - статья: `Главная › Статьи › <title>` (`ArticleView.astro:44`). Рубрики нет, денежного родителя нет;
  - подборка: `Главная › Займы › <navLabel>` — `Займы` зашито (`[guide].astro:28`), для guide другого `kind` будет неверно;
  - обзор: `Главная › Карты › <name>` (`[dir]/[slug].astro:32`), а H1 хаба «Кредитные карты» и крошка хаба «Кредитные карты». Подписи одного URL в BreadcrumbList расходятся;
  - `/debetovye-karty/`, `/vklady/`, `/rko/` идут от корня (`ServiceLanding.astro:39-43`), хотя в меню дебетовые карты лежат под «Карты».

### 1.6 Блоки «похожие» и CTA-перелинковка — что откуда берётся

| Шаблон | Блок | Логика (file:line) | Проблема |
|---|---|---|---|
| Статья | «Читайте также» | та же рубрика, затем дата; `slice(0,3)` (`ArticleView.astro:29`) | всегда 3 самые свежие; ни одной подборки или обзора |
| Статья | `CtaTop3` | `topOffers(kind, 3)` по `priority` (`ArticleView.astro:27,59`) | одни и те же 3 обзора на всех статьях одного kind |
| Статья | `CtaSlot` / `CtaCallout` | текст и URL зависят от рубрики (`lib/cta.ts:17-25`, `CtaSlot.astro:11`) | единственный путь «статья → подборка», и только для `kreditnaya-istoriya` (→ `/zaimy-s-plohoj-ki/`) и `zaimy-zero` |
| Статья, подборка, новость | `CtaNext` | `KIND_URL` + `/#calc` + `kak-proverit-mfo-v-reestre-cb` (`CtaNext.astro:12-18`) | одна и та же статья с 34 входящими |
| Подборка | «Другие подборки» | все остальные guides (`[guide].astro:24,43`) | ок, но только guide↔guide |
| Обзор | «Похожие предложения» | тот же kind, `slice(0,3)` (`[dir]/[slug].astro:21,111`) | без ротации; нет ссылок на подборки по `features` и на статьи |
| Сервисный раздел | «Другие разделы» | все `SERVICE_LINKS` (`ServiceLanding.astro:46-50`) | ок; нет статей |
| Новость | `CtaCallout zaimy` + `CtaNext mfo` | захардкожено (`novosti/[...slug].astro:41-42`) | новость о самозапрете не ссылается на статью о самозапрете |
| `/stati/` | рубрики | `<button data-cat>` (`stati/index.astro:21-26`) | рубрики не являются URL, робот их не видит |

Контекстные ссылки в теле (`grep '](/'` по `src/content`): 14 легаси-статей содержат 4–8 ручных ссылок на соседние статьи и `/kredity/`. **8 новых статей, 8 подборок, 3 новости и 8 из 9 сервисных текстов — 0.** Ни одна контекстная ссылка не ведёт на обзор (`/mfo/*`, `/karty/*`, `/kredity/*`).

Анкоры: карточка `PostCard` оборачивает в `<a>` рубрику, заголовок и описание, поэтому анкор выглядит как «ЗаймыКак проверить МФО в реестре Банка РоссииПошаговая прове…». В витрине на каждый обзор ведёт ссылка с одинаковым анкором «Обзор и условия» (22 × 10 листингов). Обе мелочи, но выравнивать их дёшево.

### 1.7 Легаси-редиректы с точки зрения архитектуры

- `^credit/?$` → `/stati/` (`.htaccess`, блок «Отдельные страницы»). Старая рубрика по сути была про рефинансирование, поэтому после R3 правильная цель — `/refinansirovanie/`.
- 22 старых новостных поста ведут 301 на `/novosti/` или `/kredity/`. Тексты были чужие, поэтому редирект на хаб — допустимый компромисс. Яндекс может считать такие 301 «нерелевантными» и не передать вес, но терять там почти нечего.
- `kak-polychit-povtornoe-refinansirovanie-ipoteki.html` → `refinansirovanie-kredita-chto-eto-znachit.html`. Это отдельный интент (рефинансирование ипотеки). Кандидат на переписывание на исходном URL, как сделано с 14 другими (через `legacyUrl`).

### 1.8 Переиспользование 30 статей finhelp (`finhelp_articles_reuse.tsv`) — архитектурные последствия

Схема `articles.category` = `zaimy | kredity | karty | refinansirovanie | kreditnaya-istoriya | fingramotnost` (`content.config.ts:66`). `CATEGORY_KIND` (`lib/cta.ts:11-13`) переводит рубрику только в `mfo | card | credit`, а `CtaTop3` умеет показывать только `Offer`, не `Service`. Распределение 30 статей:

| Целевой хаб/кластер | Статьи finhelp (slug) | Есть рубрика? | Конфликт |
|---|---|---|---|
| `/osago/`, `/kasko/` | `kbm-osago`, `osago-onlajn-kak-oformit`, `skolko-stoit-kasko` | нет | `osago-onlajn-kak-oformit` ≈ интент `/osago/`: **вливать в `service-pages/osago.mdx`, а не отдельной статьёй** |
| `/strahovanie-ipoteki/`, `/strahovanie-kvartiry/`, `/strahovanie-puteshestvennikov/` | `strahovanie-ipoteki-deshevle-chem-v-banke`, `strahovanie-kvartiry`, `strahovka-dlya-vyezda-za-rubezh` | нет | `strahovanie-kvartiry` — тот же запрос, что `/strahovanie-kvartiry/` → **слить** |
| `/rko/` | `raschetnyj-schet-dlya-ip`, `ip-ili-samozanyatyj`, `kak-otkryt-ip-cherez-gosuslugi`, `limit-dohoda-samozanyatogo` | нет | `raschetnyj-schet-dlya-ip` ≈ H1 `/rko/` → слить или переориентировать на «как выбрать» |
| `/vklady/`, `/debetovye-karty/` | `nakopitelnyj-schet-ili-vklad`, `klyuchevaya-stavka-prognoz`, `iis-3-kak-otkryt`, `tinkoff-black-ili-alfa-karta` | нет | — |
| `/karty/` | `120-dnej-bez-procentov-podvodnye-kamni`, `chto-budet-esli-ne-platit-split` | `karty` | — |
| `/kredity/`, `/refinansirovanie/` | `otkaz-ot-strahovki-po-kreditu`, `semejnaya-ipoteka-2026`, `vychet-za-kvartiru` | `kredity` (ипотека без хаба) | — |
| `/zaimy/` + подборки | `pochemu-mfo-otkazyvayut-v-zajme` (→ `/zaimy-bez-otkaza/`), `novye-pravila-mfo-2026`, `chto-budet-esli-ne-platit-mikrozajm` | `zaimy` | `chto-budet-esli-ne-platit-mikrozajm` ≈ `stati/chto-budet-pri-prosrochke-zajma` → **слить**. `novye-pravila-mfo-2026` пересекается с новостью `mfo-limit-psk-200-…` → статья-обзор + ссылка на новость |
| Долги / КИ / финграмотность | `bankrotstvo-cherez-mfc`, `bankrotstvo-fizicheskih-lic-cherez-sud`, `posledstviya-bankrotstva`, `kollektory-chto-mogut-po-zakonu`, `kak-proverit-kreditnuyu-istoriyu-cherez-gosuslugi`, `kak-snyat-samozapret-na-kredit`, `kredit-oformili-moshenniki-chto-delat`, `socialnyj-nalogovyj-vychet-2026` | частично (`kreditnaya-istoriya`, `fingramotnost`) | оффера на банкротство в пуле rencredit нет, поэтому денежный выход идёт через `/zaimy-s-prosrochkami/` или `/kredity/` |

Итог: около 15 из 30 статей сейчас физически некуда поставить. Без расширения схемы они упадут в `fingramotnost` и получат CTA «Подобрать займ» на странице про ОСАГО: и мусорная перелинковка, и YMYL-риск.

---

## 2. Силовая модель: хаб → кластер → лист

URL не меняем. Иерархию задаёт **логический родитель**: одна таблица «категория → хаб» в `lib/ui/site.ts`. Она управляет крошками, блоками ссылок и CTA.

### 2.1 Уровни

| L1 хаб | L2 кластеры | L3 листья | Текущее → цель |
|---|---|---|---|
| **`/zaimy/` Займы** (22 МФО) | 8 подборок: без процентов, с плохой КИ, на карту, долгосрочные — **рабочие**; без отказа, без фото, новые МФО, с просрочками — **чинить данные или сливать** (R1) | 22 `/mfo/*`; статьи `zaimy`, `kreditnaya-istoriya`, долги | хаб без текста → хаб с текстом, блоком подборок и 6 статьями |
| **`/kredity/` Кредиты** (4) | **`/refinansirovanie/` (новый guide `kind: credit`)**; дальше — ипотека, если появятся офферы | 4 `/kredity/*`; 14 легаси `/credit/*.html` + `kak-rabotaet-refinansirovanie-kredita` | 0 кластеров → 1 кластер с 15 статьями |
| **`/karty/` Кредитные карты** (7) + `/debetovye-karty/` (19) | позже: «120 дней без %», «карты с кешбэком», только когда будет ≥5 офферов на кластер | 7 `/karty/*`; статьи `karty` | связь `/karty/` ↔ `/debetovye-karty/` в контенте |
| **`/strahovanie/`** + `/vklady/`, `/rko/` | `/osago/`, `/kasko/`, `/strahovanie-ipoteki/`, `/strahovanie-puteshestvennikov/`, `/strahovanie-kvartiry/` | 50 сервисов (только `/go/`, без обзоров); статьи finhelp по страхованию, вкладам, РКО | статьи появятся после R6 |
| Инфо-слой | `/stati/` (+ рубрики-URL при >40 статей), `/novosti/` | статьи, новости | доноры веса для L1–L2 |

### 2.2 Направление веса

1. **Вниз:** хаб → все свои кластеры (блок «Подборки» на `/zaimy/`, ссылка на `/refinansirovanie/` на `/kredity/`). Кластер → все листья (витрина уже это делает).
2. **Вверх:** лист → кластер → хаб через крошки по логическому родителю: `Главная › Кредиты › Рефинансирование › <статья>`, `Главная › Займы › <обзор МФО>`.
3. **Вбок с ротацией:** «Похожие» и «Читайте также» — окно из 3 элементов, смещённое `pickVariant(slug, N)` (`lib/cta.ts:107`), внутри того же кластера. Каждый лист получает ≥3 входящих вместо 0–1.
4. **Инфо → деньги:** каждая статья → свой кластер (1 ссылка в первом экране или callout) + 1–3 обзора офферов, упомянутых в тексте + хаб (крошка).
5. **Деньги → инфо:** каждый кластер и хаб → до 6 статей своей рубрики. Каждый обзор → 2 статьи рубрики своего kind + подборки по его `features`.
6. **Не качать служебное:** `kak-proverit-mfo-v-reestre-cb` (34 входящих) — хорошая trust-страница, ей хватит 10–15. Освободившиеся места в `CtaNext` отдать кластеру.

### 2.3 Анкоры

| Тип | Шаблон | Пример |
|---|---|---|
| хаб (меню, крошка) | короткий родовой | «Займы», «Кредиты», «Кредитные карты» |
| кластер | родовой + признак, точное вхождение запроса | «займы на карту», «рефинансирование кредита» |
| обзор | бренд + интент, 3 варианта с ротацией | «Деньга», «займ в Деньге», «условия Деньги» |
| статья | заголовок или его ядро | «как улучшить кредитную историю» |
| карточка `PostCard` | только заголовок в `<a>`, рубрика и описание вне ссылки | — |

Запреты: «подробнее», «тут», «Обзор и условия» как единственный анкор на обзор. Один точный анкор на URL — не больше чем с ~30% ссылающихся страниц. В анкорах и URL нет «Ренессанс» и «Ренессанс Кредит» (PROJECT_BRIEF §4).

---

## 3. Правила автоперелинковки для новых статей

Механизм — сборка Astro, без внешних скриптов и без ручных JSON. Минимальные изменения схемы:

- `articles.category` расширить сервисными категориями: `osago | kasko | strahovanie | vklady | debetovye-karty | rko | dolgi | ipoteka` (`content.config.ts:66`).
- Добавить одну таблицу `CATEGORY_HUB: Record<category, { hub: string; label: string; cluster?: string }>` в `lib/ui/site.ts`. Например, `refinansirovanie → { hub: '/kredity/', cluster: '/refinansirovanie/' }`, `osago → { hub: '/strahovanie/', cluster: '/osago/' }`. Для сервисных категорий переиспользовать `SERVICE_META[c].href`.
- Необязательное поле `guide?: string` (id подборки) — ручная привязка к кластеру, если тема уже рубрики (например, `pochemu-mfo-otkazyvayut-v-zajme → zaimy-bez-otkaza`).

Правила для каждой статьи:

1. **Крошки:** `Главная › <hub label> › <cluster label> › <title>`. Для `/credit/*.html` то же самое: URL не меняется, меняется только навигация.
2. **Выход (out), цель 8–12 контентных ссылок:**
   - 1 на кластер — первым экраном (`CtaCallout` или `CtaSlot n=1` берёт `href` из `CATEGORY_HUB`, а не из `COPY`, `lib/cta.ts:17-25`);
   - 1–3 на обзоры офферов: **первое упоминание `offer.name` в тексте автоматически линкуется на `reviewHref`** (remark-плагин по словарю имён из коллекции `offers`; не в заголовках, не внутри ссылок, не больше 1 раза на бренд и не больше 5 на статью). Для сервисов, у которых нет обзоров, бренд не линкуем;
   - 2–4 контекстные на соседние статьи и подборки — пишет автор по `ymyl-content` (14 легаси-статей показывают, что 4–8 ссылок — нормальная плотность);
   - для сервисных категорий вместо `CtaTop3` (только `Offer`) — top-3 `ServiceCard` той же `category` (`getServices({ category })`, `lib/services.ts:84`).
3. **Вход (in), минимум 4 к моменту публикации:**
   - `/stati/` (уже есть);
   - кластер и хаб: блок «Статьи по теме» — до 6 статей рубрики, свежие плюс ротация (R4);
   - 2 соседние статьи через «Читайте также» с ротацией по `pickVariant`, чтобы новая статья гарантированно попала в выборку хотя бы 2 соседей (окно сдвигается по индексу в отсортированном списке рубрики: `i±1`, кольцом);
   - обзоры офферов, упомянутых в статье: блок «Статьи» на обзоре (до 2 по рубрике).
4. **Новости:** CTA и «что дальше» — по `tags` или рубрике, а не всегда `zaimy` (`novosti/[...slug].astro:41-42`). Новость о самозапрете → статья `samozapret-na-kredity`.
5. **Анти-каннибализация (до записи файла):** если `target_query` статьи совпадает с H1 или запросом посадочной (`service-pages/*`, guide, хаб), статья не создаётся, текст вливается в тело посадочной. Для finhelp-набора это `osago-onlajn-kak-oformit`, `strahovanie-kvartiry`, `raschetnyj-schet-dlya-ip`, `chto-budet-esli-ne-platit-mikrozajm` (§1.8).
6. **Проверка на сборке** (расширить агента `.claude/agents/seo-auditor.md`, п. 6, или сделать скрипт по `dist`):
   - у каждой индексируемой страницы ≥3 контентных входящих (без шапки и футера);
   - 0 ссылок на `noindex`-страницы (пустые `ServiceLanding`) и на пути вне `dist`;
   - ни у одного обзора контентных входящих не больше чем в 3 раза выше медианы своего kind (сейчас 37 при медиане 10);
   - анкор ≠ «подробнее» и «Обзор и условия» как единственный вариант.

---

## 4. Приоритизированные рекомендации

| # | Рекомендация | Impact | Effort | Детали |
|---|---|---|---|---|
| R1 | **Починить 3 пустые подборки и задвоение листингов** | high | S | (а) Данные: проставить `no_refusal`, `no_photo`, `new` в `offers/*.json` там, где это подтверждается источником (skill `offer-placement`). Если подтвердить нечем — **сменить `feature`** у guide (`/zaimy-bez-otkaza/` → предфильтр по `approvalPct ≥ N`, это поле уже есть в схеме) или временно `noindex`, пока не появятся ≥3 оффера. (б) Рендер: фильтровать `offers` по `preset` на сервере в `[guide].astro:23-30` (совпавшие — первыми, остальные — под заголовком «Другие предложения»). Тогда HTML и экран совпадают, а 8 листингов перестают быть копиями `/zaimy/`. |
| R2 | **Ротация «Похожих» и «Читайте также»** | high | S | `[dir]/[slug].astro:21` и `ArticleView.astro:29`: вместо `slice(0,3)` — окно ±1–2 вокруг текущей позиции в списке kind/рубрики, кольцом. Цель: у 3 карт и 4 легаси-статей станет ≥3 входящих вместо 1, «топ-3» МФО — около 15 вместо 37. `CtaTop3` в статьях оставить по `priority` (это деньги), но смещать 3-ю позицию по `pickVariant(slug, 6)` — компромисс между CPA и распределением веса. |
| R3 | **Кластер `/refinansirovanie/`** | high | M | Новый guide `kind: credit` (H1 «Рефинансирование кредитов», SEO-текст, FAQ). Витрина: `alfa-refinansirovanie`, `tbank-refinansirovanie`. Блок 15 статей рубрики. Пункт в шапке под «Кредиты». 301 `^credit/?$` → `/refinansirovanie/` (сейчас → `/stati/`). Предусловия: `Header.astro:11` и `Footer.astro:45` фильтруют guides по `kind === 'mfo'`, крошка `[guide].astro:28` берётся из `KIND_URL[kind]`, `calloutCat` (`:25`) уже учитывает `credit`. Это единственная тема, где у домена есть история, поэтому вклад кластера максимальный. |
| R4 | **Хабы `/zaimy/`, `/karty/`, `/kredity/` — полноценные L1** | high | M | В `Catalog.astro` добавить: блок «Подборки» (ссылки на guides своего kind; для `/kredity/` — на `/refinansirovanie/`), «Статьи по теме» (6 по `CATEGORY_HUB`), SEO-текст и FAQ (по образцу `service-pages/*.mdx` + `getServicePage`, то есть коллекция `hub-pages` или поля в той же `servicePages`). На `/karty/` сделать lead со ссылкой на `/debetovye-karty/` и обратно. На главной добавить плитки `/karty/` и `/kredity/` в `moreServices` (`index.astro:20-25`). |
| R5 | **Крошки по логическому родителю** | medium | S | Таблица `CATEGORY_HUB` (§3) → `ArticleView.astro:44` выдаёт `Главная › Кредиты › Рефинансирование › …`. Выровнять подписи (`Карты` vs `Кредитные карты`, `[dir]/[slug].astro:32`). `/debetovye-karty/` → `Главная › Карты › Дебетовые карты`. Не больше 4 уровней (рекомендация Яндекса). |
| R6 | **Расширить схему статей под сервисные темы до переноса 30 статей finhelp** | high | S | `content.config.ts:66` + `CATEGORY_HUB` + ветка CTA для `Service` (top-3 `ServiceCard` по `category`). Без этого ~15 из 30 переиспользуемых статей не получают корректного хаба, CTA и крошек. Заодно ввести правило анти-каннибализации (§3 п. 5): 4 статьи слить с посадочными. |
| R7 | **Обзоры ↔ подборки по `features`** | medium | S | В `[dir]/[slug].astro` добавить блок «Входит в подборки»: guides, у которых `feature ∈ offer.features` (данные уже есть, контент писать не нужно). `/zaimy-na-kartu/` получит до 20 входящих, `/zaimy-bez-procentov/` и `/dolgosrochnye-zaimy/` — по 13. Плюс 2 статьи рубрики своего kind. |
| R8 | **Автолинковка брендов и контекстные ссылки** | medium | M | Remark-плагин: первое упоминание `offer.name` → `reviewHref` (лимиты §3 п. 2). Новым статьям, подборкам и сервисным текстам добавить 3–5 ручных контекстных ссылок (сейчас 0 у 27 документов) — это задача `ymyl-content` или редактора при следующем проходе. |
| R9 | **Рубрики статей как URL** | low | M | Пока статей 22, `/stati/` с JS-чипами (`stati/index.astro:21-26`) хватает (глубина 2). При >40 статьях (после переноса finhelp — 45–50) нужны `/stati/<category>/` как статические страницы. Либо рубрики-хабы заменяются кластерами из R3/R4, тогда `/stati/<category>/` не нужны. Решить до переноса. |
| R10 | **Canonical легаси-статей от `Astro.site`, а не из `legacyUrl`** | medium | S | `lib/content.ts:24-26`: путь брать из `legacySlug`, хост — из `SITE_URL`. Снимает риск при переезде на нейтральный домен (ТЗ «Ренессанс Кредит»): все 83 URL станут переносимыми одним 301 по хосту. |
| R11 | **Новости: CTA и ссылки по теме** | low | S | `novosti/[...slug].astro:41-42`: рубрика или `tags` → `CATEGORY_HUB`. Связь новость ↔ статья по общему тегу (самозапрет, ПСК, предельная переплата). |
| R12 | **Анкоры карточек** | low | S | `PostCard`: в `<a>` только заголовок. В витрине «Обзор и условия» → «Обзор <name>». |
| R13 | **Вернуть `kak-polychit-povtornoe-refinansirovanie-ipoteki.html`** | low | M | Переписать на исходном URL через `legacyUrl` (как 14 других), убрать 301 из `.htaccess` (генерируется `gen_htaccess.py` из `map.json`). Это +1 лист кластера R3 с сохранённой историей URL. |

Порядок: **R1 → R2 → R6 → R3 → R4 → R7 → R5 → R10 → R8 → R11 → R9 → R12 → R13**. R1, R2, R6 и R7 — около дня работы. Они убирают пустые посадочные (главный риск для поведенческих факторов) и выравнивают граф до переноса статей finhelp.

### Критерии готовности (проверка по live-краулу, тот же скрипт)

- 0 подборок, где на экране пользователя меньше 3 предложений при индексируемой странице (сейчас 4: три с 0 и одна с 1).
- Индексируемых страниц с ≤2 контентными входящими: 0 (сейчас 10).
- Максимум входящих у обзора / медиана kind — не больше 3 (сейчас 37 / 10).
- У каждой статьи есть крошка с хабом и ≥1 ссылка на кластер или подборку и ≥1 на обзор (сейчас крошки с хабом нет ни у одной).
- Глубина клика ≤3 для 100% URL после переноса статей finhelp (сейчас ≤2 для 83 URL).

---

## 5. Источники

Внешние:
- Яндекс — Структура сайта: меню на всех страницах, хлебные крошки, перелинковка: https://yandex.ru/adv/edu/webmaster/webmaster-optimization/kakoy-dolzhna-byt-struktura-sayta
- Яндекс — Хлебные крошки (под меню или H1, последний элемент без ссылки, 3–4 уровня): https://yandex.ru/adv/edu/materials/chto-takoe-hlebnye-kroshki-i-dlya-chego-nuzhny
- Блог Яндекса для вебмастеров — смена структуры сайта (вебинар): https://webmaster.yandex.ru/blog/smena-struktury-ili-dizayna-sayta-opublikovana-videozapis-vebinara
- Яндекс Вебмастер — Быстрые ссылки (строятся по навигации и внутренним ссылкам): https://yandex.ru/support/webmaster/search-appearance/navigation.html
- Google Search Central — Link best practices (crawlable `<a href>`, описательные анкоры): https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Google Search Central — BreadcrumbList: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

Внутренние данные:
- Live-краул https://rencredit-online.ru/ (2026-10-19): 83 URL, `sitemap-0.xml`, `robots.txt`. Playwright-проверка счётчика витрины на 6 подборках.
- Код `${APP}` = `/Users/deniskononov/rencredit-pilot-wt/web/apps/rencredit`: `src/lib/content.ts`, `src/lib/cta.ts`, `src/lib/offers.ts`, `src/lib/services.ts`, `src/lib/ui/site.ts`, `src/content.config.ts`, `src/components/{ArticleView,Breadcrumbs,Header,Footer,Catalog,Showcase}.astro`, `src/components/cta/{CtaNext,CtaCallout,CtaSlot,CtaH2,CtaTop3}.astro`, `src/components/services/ServiceLanding.astro`, `src/pages/{[guide],index}.astro`, `src/pages/[dir]/[slug].astro`, `src/pages/stati/index.astro`, `src/pages/novosti/[...slug].astro`, `src/scripts/offers-ui.ts`, `public/.htaccess`, `astro.config.mjs`.
- `src/content/{articles,guides,news,offers,services,service-pages}` (frontmatter, `features`, внутренние ссылки в телах).
- `/Users/deniskononov/rencredit-pilot-wt/PROJECT_BRIEF.md` §4 (риск ТЗ).
- `/Users/deniskononov/mosseo-site-pipeline/docs/seo/03-architecture.md` (модель finhelp, взяты §2–3 как каркас).
- `docs/seo-rencredit/finhelp_articles_reuse.tsv` (30 статей к переносу), `rencredit_dist_paths.txt`.
