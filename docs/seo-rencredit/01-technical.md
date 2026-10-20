# 01. Технический SEO живого сайта rencredit-online.ru

Дата: 2026-10-19 · Объект: живой `https://rencredit-online.ru/` (бренд «Мерка», сборка от 17.10.2026 20:54 GMT по `Last-Modified`) · Код: worktree `/Users/deniskononov/rencredit-pilot-wt` (ветка `feat/rencredit-metrika`), приложение `web/apps/rencredit` (далее `APP`), пакет `web/packages/core` (далее `CORE`).
Отправная точка: `docs/seo/01-technical.md` (finhelp-ru). Его находки F1–F3 (пустой SITE_URL, soft-404 донора, битые ссылки, `?lfid=`) к rencredit **не относятся**: здесь canonical абсолютные, донора нет, битых внутренних ссылок 0.

---

## Резюме

1. **Главная потеря: 101 старый URL `/credit/<slug>.html` отдаёт 404.** В Wayback Machine у них есть снимки с кодом 200, сделанные недавно: 51 URL снят в январе 2026, 40 в ноябре 2025. То есть до переезда они были живыми и, скорее всего, есть в индексе Яндекса. В WP-экспорт (`legacy/rencredit/REPORT.md`: «404 — 0», 37 постов из REST API) они не попали, поэтому в `map.json` и `.htaccess` для них нет правил. Тематика: 36 URL про рефинансирование в целом, 29 про рефинансирование ипотеки, 20 новостей, 10 про отказы и плохую КИ. Это ровно ядро тематики, ради которой домен ценен.
2. **Остальная миграция сделана хорошо.** 14 переписанных статей открываются по старому адресу с кодом 200, 23 снятых поста уходят 301 за один хоп. Теги, автор, фиды, пагинация и `?p=` закрыты 301, `wp-content`, `wp-includes` и `wp-json` отдают 410. http→https, www→без-www и добавление слэша работают. Исключения: `http://www.` даёт 2 хопа, а `/wp-admin/` и `/wp-login.php` отдают 200 (это заглушка Beget).
3. **Индексация чистая.** У 83/83 URL из sitemap ответ 200, canonical абсолютный и указывает сам на себя, стоит `index, follow`. Title и description нигде не дублируются. Страница 404 отдаёт настоящий код 404 и `noindex`. Ссылки `/go/` закрыты тремя способами: Disallow в robots, `noindex,nofollow` на самой странице и `rel="sponsored nofollow"` на 100% ссылок. Чего не хватает: `lastmod` в sitemap (0 из 83), `Clean-param` для Яндекса, IndexNow.
4. **Микроразметка собрана в обход `@pbn/core`, поэтому она беднее, чем позволяет код.** Если Article подключить через `article()`, а FinancialProduct через `financialProduct()`, на тех же данных появятся provider/ПСК/сумма/срок и publisher с логотипом. Что сейчас: у Article автор записан как `Person «Редакция»`, у publisher нет logo и url, нет image. У FinancialProduct на 33 обзорах есть только `name` и `description`. Хабы с 22 офферами (9 подборок займов плюс `/zaimy/`, `/karty/`, `/kredity/`) выводятся без ItemList. Organization не содержит `legalName` и `taxID`, а в футере нет оператора и ИНН.
5. **Скорость в бюджете, мобильная вёрстка без замечаний.** Главная весит 25,8 КБ (gzip) HTML и примерно 52 КБ gzip JS, из них GSAP+Flip 36 КБ, и только на главной. В DOM 2545 элементов. CSS 18,7 КБ gzip блокирует рендер. Лабораторные цифры: FCP и LCP 364 мс, CLS 0. На 375 px горизонтального скролла нет. PSI API не запустился (дневная квота исчерпана), поэтому замеры сделаны в Playwright без троттлинга.

---

## Методика

- `curl` к живому сайту: `robots.txt`, `sitemap-index.xml` → `sitemap-0.xml` (83 `<loc>`), коды ответов около 40 служебных и граничных URL (www/http, слэш, `index.html`, регистр, `?utm`, `/go/`, `/mfo/`, WP-пути), заголовки сжатия и кэша, вес HTML, CSS, JS и шрифтов.
- Python-скрипт скачал все 83 URL из sitemap и для каждого разобрал title, description, canonical, robots, h1, OG/Twitter, типы JSON-LD (ошибок парсинга 0), `/go/`-ссылки и их `rel`, внешние ссылки, `<img>` (размеры, lazy), inline-CSS/JS/SVG. Отдельно проверено, что каждая внутренняя ссылка ведёт на URL из sitemap.
- Wayback CDX (`web.archive.org/cdx/search/cdx?url=rencredit-online.ru*&collapse=urlkey`) дал 257 уникальных старых URL. Каждый проверен на живом сайте с прохождением цепочки редиректов (UA YandexBot). Для URL с ответом 404 найдена дата последнего снимка со статусом 200 (`url=rencredit-online.ru/credit/*&filter=statuscode:200`, 493 снимка).
- Playwright, viewport 375×812: замер Performance API (TTFB, FCP, LCP, CLS, DOM), горизонтальное переполнение, список загружаемых чанков на главной, `/zaimy/` и легаси-статье.
- Сверка с кодом: `APP/public/.htaccess`, `APP/astro.config.mjs`, `APP/src/layouts/BaseLayout.astro`, `APP/src/components/{ArticleView,Faq,Breadcrumbs,Catalog}.astro`, `APP/src/pages/{[dir]/[slug],novosti/[...slug],[guide],go/[offer],robots.txt}.*`, `CORE/src/{schema,seo}.ts`, `legacy/rencredit/{map.json,REPORT.md}`.

---

## Что уже работает (не трогать)

| Проверка | Результат |
|---|---|
| `robots.txt` | `User-agent: * / Disallow: /go/ / Sitemap: …/sitemap-index.xml`; `APP/src/pages/robots.txt.ts:7-9` |
| Sitemap | индекс → `sitemap-0.xml`, 83 URL, все 200; без `/go/` и пустых сервисных посадочных (`astro.config.mjs:60-65`); `/sitemap.xml`, `/sitemap_index.xml`, `*-sitemap.xml` → 301 на индекс |
| Canonical / robots | 83/83 canonical абсолютный и равен себе; 83/83 `index, follow, max-image-preview:large`; `?utm_*` и `/index.html` отдают 200, но canonical указывает на чистый URL |
| Title / description | 0 дублей; h1 ровно один на всех 83 страницах; `lang="ru"`, viewport корректный |
| 404 | несуществующий URL → **404** + `noindex, nofollow`; `/ZAIMY/` → 404 (регистр не склеивается, это нормально) |
| `/go/<id>/` | Disallow; страница-редирект с `noindex,nofollow` + meta refresh + JS (`APP/src/pages/go/[offer].astro:33-48`); на 83 страницах 0 ссылок `/go/` без `sponsored`; `erid` и utm в целевом URL; `/go/` → 403, неизвестный id → 404 |
| Внешние ссылки | dofollow-ссылки ведут только на первоисточники (cbr.ru, consultant.ru, interfax.ru), рекламных dofollow нет |
| Легаси WP | 14 rewrite → 200 по старому адресу; 23 merge-поста → 301 (1 хоп); `/credit`, `/credit/page/N` → `/stati/`; `/tag/*` (159) → `/stati/` или `/kredity/`; `/author/*` → `/o-proekte/`; `/feed/`, `?feed=`, `?p=`, `?page_id=`, `?s=` → 301; `/privacy.html` → политика; `/credit/<slug>.html/` → без слэша; `wp-content` (68 URL из Wayback), `wp-includes` (23), `wp-json` (4) → **410** |
| Хост | `http://` → `https://` 301; `https://www.` → apex 301; `/stati` → `/stati/` 301 |
| Кэш / сжатие | HTML: `max-age=300, must-revalidate`; `/_astro/*`: `max-age=31536000, immutable`; gzip на HTML, CSS, JS |
| Mobile (375 px) | `scrollWidth = 375` на `/`, `/zaimy/` и легаси-статье; основной текст 17,5 px; таблица 343 px помещается; CLS 0 |
| Верификация | `yandex-verification` на 83/83; Метрика грузится только после согласия (`BaseLayout.astro:90-137`) |

---

## Находки

### F1. 101 бывшая статья `/credit/<slug>.html` отдаёт 404. Приоритет: CRITICAL для этого домена

Цифры. Из 257 URL, найденных в Wayback, на живом сайте 22 отдают 200, 34 отдают 301→200, 95 отдают 410 (служебные WP-пути, это правильно) и **106 отдают 404**. Из этих 106 ровно 101 имеют вид `/credit/*.html`. У всех 101 в архиве есть снимки со статусом 200, и по последнему такому снимку они делятся так:

| Последний снимок со статусом 200 | URL |
|---|---|
| 2026-01 | 51 |
| 2025-11 | 40 |
| 2025-08…10 | 10 |

Причина. `legacy/rencredit/REPORT.md` строился по WP REST API и sitemap, где было 37 постов. Ещё сотня постов была доступна по прямым URL, но в API и sitemap не попала. Поэтому `legacy/rencredit/map.json` (208 записей) о них не знает, и генератор `legacy/rencredit/gen_htaccess.py` правил для них не создаёт (блок `APP/public/.htaccess:59-270`). Общего правила на неизвестные `/credit/*.html` после блока 6 (`.htaccess:272-277`) тоже нет, и запрос уходит в `ErrorDocument 404` (`.htaccess:17`).

Почему это важно. Возраст домена и накопленные сигналы по запросам о рефинансировании — главный актив сайта (`PROJECT_BRIEF.md`). Эти 101 URL и есть то, что Яндекс знал о сайте: 65 из них про рефинансирование, включая 29 про ипотеку. Пока они отдают 404, Яндекс через 2–4 недели повторных обходов выкинет их из индекса, и ссылочный вес с них пропадёт.

Пример: `/credit/refinansirovanie-kredita.html` имел статус 200 на снимке от 2025-11-08, а сейчас отдаёт 404.

Ещё 5 URL с 404 трогать не нужно: `/lk/`, `/ios/`, `/podkluch/`, `/reg/` (снимки 2022 года, похоже на старый сайт «личного кабинета», это риск товарного знака) и `/cdn-cgi/…`.

Исправление: группировка по целям приведена в Приложении A.
1. Добавить 101 запись в `legacy/rencredit/map.json` (`type: post`, `decision: merge301`, `target` по таблице) и перегенерировать блок `.htaccess` через `gen_htaccess.py`.
2. Как страховку поставить сразу после блока 6 (`.htaccess:277`) правило для любых несуществующих `/credit/*.html`:
   ```apache
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^credit/[^/]+\.html$ https://%{HTTP_HOST}/credit/refinansirovanie-kredita-chto-eto-znachit.html [R=301,L]
   ```
3. Для кластера «рефинансирование ипотеки» (29 URL) нет релевантной цели. Нужна одна новая статья-хаб на одном из старых адресов, например `/credit/chto-takoe-refinansirovanie-ipoteki.html`, по схеме rewrite из `map.json`. На неё же перевести 301 остальных ипотечных URL. Материалы можно взять из прошлых агентов: `finhelp_articles_reuse.tsv` → `semejnaya-ipoteka-2026` (ипотека, семейная программа), `klyuchevaya-stavka-prognoz` (для `stavka-refinansirovaniia-chto-eto` и `razmer-stavki-refinansirovaniia-v-2024-gody`), `chto-budet-esli-ne-platit-mikrozajm` и `pochemu-mfo-otkazyvayut-v-zajme` (для МФО-кластера). Тексты старых постов (заголовки и H2) можно достать из Wayback только как план. Контент там заимствованный, копировать его нельзя.

### F2. JSON-LD собран в обход `@pbn/core`: разметка беднее, чем умеет код. Приоритет: MEDIUM

| Страницы | Сейчас на живом сайте | Код | Что есть в `CORE/src/schema.ts` |
|---|---|---|---|
| 23 статьи (`/stati/*`, `/credit/*.html`) | `Article` без `url`, `mainEntityOfPage`, `image`, `inLanguage`; `author: {Person, "Редакция"}`; `publisher: {Organization, name}` без logo и url | `APP/src/components/ArticleView.astro:30-40` (37: Person; 38: publisher); дефолт автора задан в `APP/src/content.config.ts:54` | `article()` (`schema.ts:72-89`): url, mainEntityOfPage, inLanguage, author-Organization, publisher |
| 3 новости | `NewsArticle` без `publisher`, `image`, `url` | `APP/src/pages/novosti/[...slug].astro:19-27` | `newsArticle()` |
| 33 обзора `/mfo/*`, `/karty/*`, `/kredity/*` | `FinancialProduct` только с `name` и `description` | `APP/src/pages/[dir]/[slug].astro:35-41` | `financialProduct()` (`schema.ts:110-127`): LoanOrCredit/CreditCard, amount, loanTerm, interestRate, **annualPercentageRate (ПСК)**, **provider = юрлицо МФО** |
| 9 подборок + `/zaimy/` (22 оффера), `/karty/` (7), `/kredity/` (4) | ItemList нет (на подборках только FAQ + Breadcrumbs) | `APP/src/components/Catalog.astro:12`, `APP/src/pages/[guide].astro:27`: `jsonLd` не передаётся | `itemListProducts()` (`schema.ts:129-141`) |
| Сервисные (`/osago/`, `/rko/`, `/vklady/` …) | ItemList есть, но `item.url` ведёт на `/go/saleads-…/` (Disallow, редирект) | `ServiceLanding.astro:55` → `itemList()` | правка в `schema.ts:157` / `:115` |
| Главная | `Organization{name,url,logo}` без `legalName` и `taxID`; `WebSite` без `publisher` | `BaseLayout.astro:40-48` поддерживает `legalName`/`taxID`, но в прод-сборке пусты `PUBLIC_LEGAL_OWNER`/`PUBLIC_LEGAL_INN` (при этом `astro.config.mjs:34-37` предупреждает) | `organization()`, `website()` |

Отдельно о доверии (YMYL). В футере на всех 83 страницах нет оператора и ИНН, а слово «Ренессанс» не встречается ни на одной странице, то есть нет и дисклеймера о том, что сайт не связан с банком. Это нужно согласовать с `06-eeat-legal.md` и `PROJECT_BRIEF.md` §4. Технически всё решается заполнением env и одной строкой в `Footer.astro`.

Исправление (минимальный дифф):
- `ArticleView.astro:30-40`: заменить объект на `article({ site: Astro.site, path, headline, description, datePublished, dateModified, image: d.cover ?? '/og/default.png', publisher: { name: SITE.name, url: home, logo: …/icon-512.png } })`. В `schema.ts:83-84` publisher сделать inline-объектом с `logo` и `url`, а не `@id`. Ссылка на `@id` разрешается только на главной, где Organization реально выведена.
- `[dir]/[slug].astro:35-41`: заменить на `financialProduct(o, Astro.site, { description: desc })`. В `schema.ts:115` поставить `url` на канонический обзор (`/mfo/<id>/`, `/karty/<id>/` …) вместо `/go/`. То же в `schema.ts:157` для `itemList`: давать путь обзора или вовсе не выводить `url`.
- `Catalog.astro:12` и `[guide].astro:27`: передать `jsonLd={itemListProducts(h1, offers, Astro.site)}`.
- `novosti/[...slug].astro:19-27`: использовать `newsArticle()` (тогда появятся publisher, url и mainEntityOfPage).
- Прод-env: заполнить `PUBLIC_LEGAL_OWNER`, `PUBLIC_LEGAL_INN`, `PUBLIC_CONTACT_EMAIL` (они же нужны для 152-ФЗ).

### F3. Sitemap без `lastmod`, нет `Clean-param` и IndexNow. Приоритет: MEDIUM для Яндекса

- `lastmod` 0/83. У статей и новостей есть `updatedDate`/`publishDate`. В `astro.config.mjs:63-64` в `serialize` нужно проставлять `lastmod` из карты `slug → updatedDate`, которую строит тот же конфиг (по аналогии с `svcData`, `:41-44`). Для офферов брать дату правил МФО из `offers/*.json`. Яндекс использует `lastmod` при планировании переобхода.
- `robots.txt.ts:9`: добавить отдельную секцию для Яндекса.
  ```
  User-agent: Yandex
  Disallow: /go/
  Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&_openstat&from
  ```
  Сейчас `/zaimy/?utm_source=x` отдаёт 200. Canonical это спасает, но Яндекс всё равно тратит краулинговый бюджет на варианты с метками из Директа, Дзена и Telegram.
- IndexNow (Яндекс его поддерживает): положить файл с ключом в `public/<key>.txt` и после деплоя отправлять пинг со списком изменённых URL (`scripts/deploy-beget.sh`). Это ускорит переобход как раз 101 URL из F1, когда на них появятся 301.

### F4. Длинные title, бренд дописывается вслепую. Приоритет: LOW–MEDIUM

- 56/83 title длиннее 60 символов, 37/83 длиннее 70. Пример: `/credit/kak-rabotaet-agentstvo-po-refinansirovaniu.html` — 102 символа. Шаблон обзоров `X: условия, ставка, как получить — займ онлайн — Мерка` даёт два тире подряд и около 80 символов. 31/83 description длиннее 160 символов.
- `BaseLayout.astro:32` всегда приклеивает ` — Мерка`, хотя `CORE/src/seo.ts:12-17` `buildTitle()` убирает бренд, если тот не помещается. Исправление: `const fullTitle = rawTitle ? title : buildTitle(title, SITE.name, 70)`. Для Яндекса лимит 70 вместо 60. Сократить шаблон в `[dir]/[slug].astro:33`, например до `${o.name} — ${kindWord.toLowerCase()} онлайн: условия и ПСК`.

### F5. Одна og:image на весь сайт. Приоритет: LOW

На 83/83 страницах `og:image = /og/default.png`, `cover` не задан ни у одной статьи (`content.config.ts:56`). При шеринге в Telegram и VK все карточки выглядят одинаково. Исправление: генерировать OG по разделам (займы, карты, кредиты, страхование, статьи) скриптом `APP/scripts/gen-assets.mjs` и передавать `ogImage` из `Catalog`, `[guide]`, `ArticleView`.

### F6. Хостинг Beget перехватывает часть правил `.htaccess`. Приоритет: LOW

| URL | Факт | Ожидалось | Причина и исправление |
|---|---|---|---|
| `http://www.rencredit-online.ru/` | 301 → `https://www.` → 301 → apex (2 хопа) | 1 хоп (`.htaccess:41-43`) | http→https делает nginx Beget раньше Apache. Отключить в панели «Перенаправлять на HTTPS» и оставить `.htaccess` |
| `/wp-admin/`, `/wp-login.php` | **200**, 273 байта JS-заглушки `beget=begetok` | 410 (`.htaccess:267-268`) | защита WP-путей на уровне nginx Beget. Попросить поддержку отключить её для домена (WP больше нет) |
| `/mfo/` | 403 (`Options -Indexes`, нет index) | 301 | Добавить `RewriteRule ^mfo/?$ https://%{HTTP_HOST}/zaimy/ [R=301,L]`. Пользователи и боты отрезают URL до папки |
| `/index.html`, `/zaimy/index.html`, `/404.html` | 200 (дубли, у первых двух canonical чистый) | 301 | `RewriteRule ^(.*/)?index\.html$ https://%{HTTP_HOST}/$1 [R=301,L]` до блока 6 |
| Картинки | `max-age=2592000` (30 дней) | 7 дней (`.htaccess:311`) | nginx отдаёт статику сам, это безвредно |
| Сжатие | только gzip | brotli (`.htaccess` блок 8) | `mod_brotli` у Beget нет. Можно заранее сжать `.br` при сборке, но выигрыш около 15%, YAGNI |
| HSTS | нет (`.htaccess:34` закомментирован) | — | Включить `max-age=31536000` после месяца стабильного HTTPS |
| noindex-страницы | 404 и пустые сервисные отдают canonical | — | Не выводить `<link rel=canonical>`, когда `robotsNoindex` (`BaseLayout.astro:58`). Косметика |

### F7. Скорость. Приоритет: LOW, в пределах бюджета

PSI API без ключа вернул `Quota exceeded … Queries per day`. Цифры ниже — сетевые веса и лабораторный замер Playwright (375×812, без троттлинга сети и CPU).

| Ресурс | raw | gzip | Где |
|---|---|---|---|
| HTML главной | 287 КБ | 25,8 КБ | `/`; DOM **2545** элементов, 130 inline `<svg>`, 49 `<style>` (113 КБ, все уникальные) |
| HTML подборок | 124–143 КБ | ~13 КБ | 22 карточки офферов |
| HTML статьи | 65–73 КБ | ~15 КБ | DOM 682 |
| CSS `BaseLayout.*.css` | 83 КБ | 18,7 КБ | render-blocking, один файл на все страницы |
| JS базовый | — | ~13 КБ | ClientRouter 1,7 + BaseLayout 5,0 + client 4,3 + src 1,7 + format 0,4 |
| JS главной дополнительно | — | ~39 КБ | HomeHero 3,1 + **gsap 27,1 + Flip 9,2** (на статьях GSAP не грузится, проверено по network) |
| Шрифт Onest Variable | — | 15,9 КБ кириллица + 33,8 КБ латиница + latin-ext | `font-display: swap`, preload нет |

Замер на главной: TTFB 198 мс, FCP 364 мс, LCP 364 мс (элемент `p.hp-sentence`, текст), CLS 0. Все `<img>` с `width`/`height`, `loading="lazy"`, `decoding="async"`, картинки только свои (`/logos/*`).

По бюджету из `rules/web/performance.md` (лендинг < 150 КБ JS, < 30 КБ CSS) запас есть. Риск один: INP и TBT на слабых Android из-за 2545 узлов DOM и инициализации GSAP+Flip на главной. Что можно сделать, если CrUX или Метрика покажут проблему:
- грузить `gsap`/`Flip` динамическим `import()` по IntersectionObserver или первому взаимодействию в `HomeHero`;
- добавить `content-visibility: auto` для списков карточек ниже первого экрана;
- `<link rel="preload" as="font" type="font/woff2" crossorigin>` только для `onest-cyrillic-wght-normal`.

Пока это не нужно: сначала мерить, потом оптимизировать.

### F8. Мелочи

- `search.json` (9 КБ) открыт для обхода. Это не HTML, в индекс не попадёт, трогать не нужно.
- RSS для `/novosti/` нет (`/rss.xml` → 404). Для Дзена и агрегаторов полезно, когда новостей будет 10 и больше.
- Не техника, но заметно при обходе: три статьи пересекаются по интенту «что такое рефинансирование» (`/stati/kak-rabotaet-refinansirovanie-kredita/`, `/credit/refinansirovanie-kredita-chto-eto-znachit.html`, `/credit/kak-proishodit-refinansirovanie-kredita-chto-nyjno-znat.html`). Если на одну из них уйдут 43 редиректа из F1, нужно развести интенты (см. `02`/`05`).

---

## Рекомендации (по приоритету)

| # | Что | Impact | Effort | Где |
|---|---|---|---|---|
| 1 | 301 для 101 исчезнувшей статьи `/credit/*.html` по тематическим целям + страховочное правило для любых `/credit/*.html` | high | S | `legacy/rencredit/map.json` → `gen_htaccess.py` → `APP/public/.htaccess` после `:277`; Приложение A |
| 2 | Одна статья-хаб «рефинансирование ипотеки» на старом URL (rewrite), на неё 29 ипотечных 301; использовать `semejnaya-ipoteka-2026` из finhelp | high | M | `src/content/articles/*.mdx` с `legacyUrl`, `map.json` |
| 3 | Заполнить `PUBLIC_LEGAL_OWNER/INN/CONTACT_EMAIL` в прод-env; оператор и ИНН в футере; дисклеймер «не связан с АО «Ренессанс Кредит»» | high | S | env деплоя, `Footer.astro`, `BaseLayout.astro:45-46` |
| 4 | Перевести JSON-LD на `@pbn/core`: `article()`, `newsArticle()`, `financialProduct()` (provider/ПСК), `itemListProducts()` на 12 хабах; `url` на обзор вместо `/go/` | medium | S | `ArticleView.astro:30-40`, `novosti/[...slug].astro:19-27`, `[dir]/[slug].astro:35-41`, `Catalog.astro:12`, `[guide].astro:27`, `CORE/src/schema.ts:83-84,115,157` |
| 5 | `lastmod` в sitemap из `updatedDate` | medium | S | `astro.config.mjs:60-65` |
| 6 | `Clean-param` для Яндекса | medium | S | `APP/src/pages/robots.txt.ts:9` |
| 7 | IndexNow: ключ и пинг после деплоя (сначала по URL из п.1) | medium | S | `public/<key>.txt`, `scripts/deploy-beget.sh` |
| 8 | `buildTitle(…, 70)` вместо слепого « — Мерка»; короче шаблон обзоров | low | S | `BaseLayout.astro:32`, `[dir]/[slug].astro:33` |
| 9 | `/mfo/` → `/zaimy/`, `*/index.html` → каталог (301) | low | S | `APP/public/.htaccess` блок 5 |
| 10 | Beget: отключить панельный http→https и WP-заглушку (`/wp-admin` → 410) | low | S | панель и поддержка Beget |
| 11 | OG-картинки по разделам | low | M | `APP/scripts/gen-assets.mjs`, `ogImage` в layout-ах |
| 12 | GSAP по требованию, `content-visibility`, preload кириллицы — только если CrUX или Метрика покажут INP > 200 мс | low | M | `HomeHero`, `global.css`, `BaseLayout.astro` head |
| 13 | HSTS после месяца стабильного HTTPS | low | S | `.htaccess:34` |

---

## Приложение A. 101 старый URL с 404 и предлагаемые цели 301

Источник: Wayback CDX, у всех URL снимки со статусом 200 в 2025-08…2026-01, сейчас 404. Все адреса имеют вид `/credit/<slug>.html`. Цели — существующие страницы сайта. Группировка сделана эвристически по ключевым словам слага; перед генерацией `.htaccess` её стоит бегло вычитать. Ипотечные URL из первой группы после появления хаба (рек. 2) перенаправить на него.

**→ `/credit/refinansirovanie-kredita-chto-eto-znachit.html`** (43): `chto-nyjno-znat-pered-tem-kak-sdelat-refinansirovanie-kredita`, `chto-takoe-refinansirovanie-ipoteki`, `kak-i-gde-proizvesti-refinansirovanie-avtokredita`, `kak-polychit-refinansirovanie-ipoteki-v-rosbanke`, `kak-polychit-refinansirovanie-kreditov-v-raiffaizenbanke`, `kak-rabotaet-kalkyliator-refinansirovaniia-ipoteki`, `kak-refinansirovat-ipotechnyi-dolg`, `kak-refinansirovat-kredit-pod-zalog-nedvijimosti`, `kak-sdelat-refinansirovanie-kredita-ili-ipoteki`, `kak-sdelat-refinansirovaniia-ipoteki-s-materinskim-kapitalom-v-2024-gody`, `kak-snizit-procent-po-kredity-v-2024-gody`, `kakie-rashody-mogyt-vozniknyt-pri-refinansirovanii-ipotechnogo-kredita`, `kyda-obratitsia-dlia-oformleniia-refinansirovaniia-avtokredita`, `mojno-li-refinansirovat-ipoteky-v-slychae-rojdeniia-pervogo-rebenka`, `mojno-li-refinansirovat-kredit-s-pomoshu-selskoi-ipoteki`, `mojno-li-refinansirovat-po-programme-semeinaia-ipoteka-kredit-oformlennyi-na-apartamenty`, `mojno-li-sdelat-refinansirovanie-yje-imeusheisia-ipoteki-za-schet-lgotnoi-ipoteki-dlia-it-specialistov`, `mojno-li-vziat-obychnyu-ipoteky-a-potom-refinansirovat-po-semeinoi-ipoteke`, `na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-gazprombanke`, `obzor-programm-refinansirovaniia-2023-goda`, `osobennosti-refinansirovaniia-voennoi-ipoteki-v-2024-gody`, `otvety-na-voprosy-zaemshikov-pro-refinansirovanie`, `plusy-i-minysy-refinansirovaniia`, `popyliarnye-voprosy-o-lgotnyh-ipotechnyh-programmah`, `popyliarnye-voprosy-o-programme-dalnevostochnaia-ipoteka`, `razmer-stavki-refinansirovaniia-v-2024-gody`, `refinansirovanie-ili-restryktyrizaciia-chto-vybrat-dlia-ymensheniia-plateja-po-kredity`, `refinansirovanie-ipoteki-drygih-bankov-lychshie-predlojeniia-2024-goda`, `refinansirovanie-ipoteki-v-chem-vygoda-i-kak-ee-rasschitat`, `refinansirovanie-kredita`, `refinansirovanie-kredita-dlia-pensionerov-lychshie-predlojeniia-bankov-v-2024-gody`, `refinansirovanie-kreditov-drygih-bankov-gde-polychit-bez-problem`, `refinansirovanie-kreditov-drygih-bankov-na-vygodnyh-ysloviiah-v-2024-gody`, `refinansirovanie-kreditov-pod-zalog-nedvijimosti-kak-pravilno-oformit-sdelky`, `refinansirovanie-kreditov-v-promsviazbanke-dlia-fizicheskih-lic`, `refinansirovanie-kreditov-v-raznyh-sityaciiah-podborka-statei-ot-mbk`, `stavka-refinansirovaniia-chto-eto`, `v-kakih-bankah-oformliaut-refinansirovanie`, `v-kakom-banke-vygodno-oformliat-refinansirovanie-ipoteki`, `vozmojno-li-posle-refinansirovaniia-ipoteki-polychit-nalogovyi-vychet`, `vozmojno-li-povtorno-provesti-refinansirovanie`, `ysloviia-refinansirovaniia-ipoteki-v-gazprombanke`, `ysloviia-refinansirovaniia-v-banke-vozrojdenie`

**→ `/novosti/`** (20): `brysnika-s-sovkombankom-pervoi-v-rossii-zapystila-ipoteky-so-snijennoi-stavkoi-849`, `cb-ne-bydet-prodlevat-mery-podderjki-bankov-zavershaushih-deistvie-v-2024-gody`, `cb-povysil-ojidaniia-po-rosty-potrebkreditovaniia-v-2024-gody-do-15-18`, `docent-gorbynova-esli-bank-yrezal-vam-kreditnyi-limit-proverte-nalichie-dolga`, `gosdyma-priniala-v-i-chtenii-zakonoproekt-o-periode-ohlajdeniia-po-potrebkreditam`, `gosdyma-vo-ii-chtenii-razreshaet-cb-limitirovat-vydachy-ipoteki-i-avtokreditov-fizlicam`, `grigorenko-grajdane-smogyt-samozapretit-oformlenie-kredita-cherez-gosyslygi`, `nabiyllina-kreditnaia-aktivnost-v-pervye-nedeli-dekabria-ostavalas-sderjannoi`, `naimenee-popyliarnoi-ipotechnoi-programmoi-v-2024-gody-stala-dalnevostochnaia-ipoteka`, `nbki-dolia-zaemshikov-moloje-30-let-v-stryktyre-vydachi-potrebitelskih-kreditov-sokratilas`, `nbki-kolichestvo-vydannyh-v-rossii-avtokreditov-v-oktiabre-sokratilos-na-35`, `nbki-srednii-razmer-potrebkredita-v-sentiabre-snizilsia-do-160-tysiach-ryblei`, `novak-moratorii-do-2028-goda-na-vyplaty-dividendov-rysgidro-obsyjdaetsia`, `polyianova-mikropredpriiatiia-smogyt-brat-kredity-bez-ogranicheniia-na-plavaushyu-stavky`, `pytin-podpisal-zakon-o-bessrochnom-mehanizme-zontichnyh-porychitelstv-dlia-msp`, `pytin-porychil-vlastiam-otslejivat-dinamiky-korporativnogo-kreditovaniia-v-rossii`, `pytin-prizval-obespechivat-rost-korporativnogo-kreditnogo-portfelia`, `rbk-nachislennye-rossiianam-procenty-po-kreditam-prevysili-600-milliardov-ryblei`, `ria-novosti-rossiiane-v-2024-g-chashe-vsego-brali-kredity-na-remont-i-pokypky-avto`, `za-2024-god-nornikel-sokratil-chistyu-pribyl-po-rsby-na-57-do-123-mlrd-ryb`

**→ `/credit/refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov.html`** (10): `gde-oformit-refinansirovanie-kreditov-s-prosrochkoi`, `kyda-obrashatsia-za-refinansirovaniem-esli-kredit-s-zadoljennostu`, `osnovnye-prichiny-pochemy-bank-ne-refinansiryet-kredit-daje-pod-zalog`, `otkazali-v-refinansirovanii-osnovnye-prichiny`, `pochemy-bank-otkazyvaet-v-refinansirovanii-posle-restryktyrizacii`, `prichiny-otkaza-v-refinansirovanii-kotorye-skryvaut-banki`, `razreshat-li-v-banke-refinansirovat-mikrozaim-s-prosrochkami`, `refinansirovanie-ipoteki-s-plohoi-ki-v-kakih-bankah-odobriat`, `refinansirovanie-s-plohoi-kreditnoi-istoriei-predlojeniia-bankov`, `top-6-prichin-pochemy-banki-otkazyvaut-v-refinansirovanii`

**→ `/credit/kak-proishodit-refinansirovanie-kredita-chto-nyjno-znat.html`** (9): `dokymenty-dlia-refinansirovaniia-ipoteki`, `gde-polychit-refinansirovanie-kredita-bez-spravki-o-dohodah`, `kogda-bank-razreshaet-obrashatsia-za-refinansirovaniem`, `kogda-rabotaet-refinansirovanie`, `kogda-vygodno-oformliat-refinansirovanie-a-kogda-kreditnye-kanikyly`, `odobriat-li-refinansirovanie-v-banke-esli-net-spravki-o-dohodah`, `procedyra-refinansirovaniia-ipoteki-v-raiffaizenbanke`, `refinansirovanie-kreditov-drygih-bankov-v-rosbanke-ysloviia-i-procedyra`, `spisok-dokymentov-dlia-refinansirovaniia-kredita-i-ipoteki`

**→ `/credit/kak-sdelat-refinansirovanie-kreditov-v-sberbanke.html`** (5): `kak-oformit-refinansirovanie-kredita-v-sberbanke`, `kakie-nyjny-dokymenty-dlia-refinansirovaniia-v-sberbanke`, `refinansirovanie-ipoteki-v-sberbanke-chto-nyjno-znat`, `refinansirovanie-sberbank-vtb`, `sberbank-otkazal-v-refinansirovanii-prichiny-kak-ispravit-sityaciu`

**→ `/karty/`** (3): `kak-i-gde-polychit-refinansirovanie-kreditnoi-karty`, `kak-provesti-refinansirovanie-kreditki`, `top-9-predlojenii-po-refinansirovaniu-kreditnyh-kart-v-2023-gody`

**→ `/kredity/tbank-refinansirovanie/`** (3): `kak-proishodit-refinansirovanie-kreditov-v-tinkoff-banke`, `preimyshestva-refinansirovaniia-ipoteki-v-tinkoff-banke`, `refinansirovanie-kreditnoi-karty-tinkoff`

**→ `/kredity/alfa-refinansirovanie/`** (2): `refinansirovanie-ipoteki-v-alfa-banke-v-2024-gody`, `refinansirovanie-v-alfa-banke-ysloviia-i-poriadok-oformleniia`

**→ `/zaimy/`** (1): `bystrye-kredity-kratkosrochnye-zajmy`

**→ `/credit/na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-vtb.html`** (1): `kak-oformit-refinansirovanie-ipoteki-v-vtb`

**→ `/stati/kak-ne-popast-v-dolgovuyu-yamu-s-mikrozajmami/`** (1): `kak-proizvesti-refinansirovanie-mikrozaimov-mfo`

**→ `410`** (1): `metallicheskaya-setka-vidy-osobennosti-i-primenenie`

**→ `/credit/naskolko-vygodno-refinansirovanie-v-rosselhozbanke.html`** (1): `poriadok-i-ysloviia-refinansirovaniia-ipoteki-v-rosselhozbanke`

**→ `/`** (1): `vidy-bankovskih-prodyktov`

Не редиректить (оставить 404/410): `/lk/`, `/ios/`, `/podkluch/`, `/reg/` (снимки 2022 года, «личный кабинет» на старом сайте, риск ТЗ), `/cdn-cgi/scripts/…/email-decode.min.js`.

---

## Источники

- Живой сайт (curl, 2026-10-19 15:31–16:05 GMT): `https://rencredit-online.ru/robots.txt`, `/sitemap-index.xml`, `/sitemap-0.xml`, 83 URL из sitemap, около 40 граничных URL, `/_astro/*.{css,js,woff2}`.
- Wayback Machine CDX API: `https://web.archive.org/cdx/search/cdx?url=rencredit-online.ru*&output=txt&fl=original,statuscode,timestamp,mimetype&collapse=urlkey` (257 URL) и `…url=rencredit-online.ru/credit/*&filter=statuscode:200` (493 снимка).
- PageSpeed Insights API v5: `runPagespeed?url=…&strategy=mobile` → `Quota exceeded for quota metric 'Queries' … per day` (без ключа не запустился); вместо него Playwright Performance API.
- Код: `rencredit-pilot-wt/web/apps/rencredit/{astro.config.mjs, public/.htaccess, src/layouts/BaseLayout.astro, src/components/{ArticleView,Catalog,Faq,Breadcrumbs}.astro, src/pages/{[dir]/[slug].astro, novosti/[...slug].astro, [guide].astro, go/[offer].astro, robots.txt.ts}, src/content.config.ts}`, `web/packages/core/src/{schema.ts, seo.ts}`, `legacy/rencredit/{map.json, REPORT.md}`.
- Переиспользование статей: `docs/seo-rencredit/finhelp_articles_reuse.tsv` (30 готовых статей finhelp).
- Справка по Яндексу: директива `Clean-param` и `lastmod` в Sitemap — Яндекс.Вебмастер, раздел «Помощь → robots.txt / Sitemap»; IndexNow — yandex.ru/support/webmaster/indexnow.
