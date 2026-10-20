# Open-source для rencredit-online.ru (Astro 7): что взять, что уже есть, что не брать

Дата: 2026-10-19 · Линза: oss-repos-astro7 · Основа: `docs/seo/features/oss-repos.md` (finhelp, Astro 4), перепроверено под стек rencredit.
Стек по коду: `astro ^7.3.8` (в node_modules 7.3.8, на npm уже 7.4.1), Tailwind 4.3, GSAP 3.15, MDX 8, `<ClientRouter />`, статика на Beget (деплой `scripts/deploy-beget.sh`, ssh/ftp, без удаления файлов на сервере). PHP-эндпоинтов на живом сайте сейчас нет: `/mail.php` → 404.
SEO-аудит (`docs/seo-rencredit/0*.md`) не дублирую. Соседние отчёты `finhelp-adapt-2.md` и `brand-engagement.md` уже описывают механику целей Метрики, `go.php`, Pagefind, OG и RSS. Здесь для каждой темы проверено одно: **какая библиотека жива, совместима с Astro 7 и действительно нужна**.

Как проверял: `npm view <pkg> version time.modified peerDependencies license` и `gh api repos/<repo>` 2026-10-19, `curl` по живому сайту, чтение кода в `/Users/deniskononov/rencredit-pilot-wt/web`.

---

## 0. Коротко

1. **Главное ограничение finhelp на rencredit снято.** На Astro 7 все свежие интеграции ставятся без откатов на старые ветки: `astro-og-canvas@0.13.2` (peer `^5…^7`), `astro-seo-schema@7.0.1` (`^7`), `astro-pagefind@2.0.1` (`^2…^7`), `astro-indexnow@2.3.10` (`^4…^7`), `astro-embed@0.14`. Исключение — `@orama/plugin-astro@3.1.18`: его peer `astro ^2.0.4`, и с Astro 7 `npm install` упадёт с ERESOLVE.
2. **Многое уже сделано без библиотек.** Есть:
   - view transitions (`ClientRouter`);
   - согласие на cookie и Метрика только после «да»;
   - `Disallow: /go/` в robots и фильтр `/go/` в sitemap;
   - JSON-LD-билдеры в `packages/core/src/schema.ts`;
   - сортировка и фильтры витрины в `offers.ts`;
   - скрипт IndexNow `scripts/indexnow.mjs`.

   Поэтому большая часть идей ниже — «довести» или «заменить на более точное», а не «подключить новое».
3. **Свежая находка (проверено на живом сайте).** `OfferLogo.astro` ставит `transition:name` на каждый логотип. Astro генерирует на каждый такой элемент отдельный `<style>` примерно на 2,4 КБ. На главной таких блоков 49, это 116 КБ из 273 КБ HTML (43%). На `/zaimy/` 199 упоминаний `data-astro-transition-scope`. В gzip это только −14% (25,0 → 21,5 КБ), но это 49 лишних style-элементов на разбор при каждом переходе ClientRouter. Подробнее в §1.
4. **Встроенный CSP Astro (`security.csp`, стабилен с 6.0) нам не подходит.** Документация прямо пишет, что `<ClientRouter />` с ним не поддерживается, а внешние скрипты (`mc.yandex.ru/metrika/tag.js`) нужно хешировать вручную. Оставить текущие заголовки в `.htaccess`.
5. **Fonts API (стабилен с Astro 6.0)** заменит ручной `@font-face "Onest Fallback"` с подобранными на глаз метриками Arial: даст автоматический fallback и preload. Небольшой, но бесплатный выигрыш по CLS и LCP.

---

## 1. Что проверено: таблица по линзе

| Тема | Пакет / репо | Версия, свежесть | ★ / лицензия | Astro 7 | Что на rencredit сейчас | Вердикт |
|---|---|---|---|---|---|---|
| Поиск | [Pagefind/pagefind](https://github.com/Pagefind/pagefind) `pagefind@1.5.2` | npm 2026-04-12, push 2026-10-19 | 5 519 / MIT | CLI, от Astro не зависит | `search.json`: 72 записи (подборки, разделы, обзоры, статьи), только подстрока в заголовке. Собрано 228 HTML-страниц | **Брать CLI** |
| Поиск | [shishkin/astro-pagefind](https://github.com/shishkin/astro-pagefind) `2.0.1` | 2026-07-03 | 567 / MIT | да | — | Не нужен, CLI проще |
| Поиск | [oramasearch/orama](https://github.com/oramasearch/orama) `@orama/orama@3.1.18`, `@orama/plugin-astro@3.1.18` | 2026-07-27 | 10 579 / Apache-2.0 (у репо NOASSERTION) | **плагин: peer `^2.0.4`** | — | Не брать: индекс в одном JSON, peer сломан |
| Типы JSON-LD | [google/schema-dts](https://github.com/google/schema-dts) `2.1.0` | 2026-10-02 | 1 251 / Apache-2.0 | только типы | `schema.ts` возвращает голый `object` | **Брать как devDependency** |
| JSON-LD | [codiume/orbit](https://github.com/codiume/orbit) `astro-seo-schema@7.0.1` | 2026-10-14 | 622 / MIT | да (`^7`) | Свой `jsonLdGraph` + вставка в `BaseLayout` | Не нужен, дублирует |
| IndexNow | `scripts/indexnow.mjs` (свой) | — | — | — | Скрипт есть. Ключ-файла `public/<key>.txt` нет. `deploy-beget.sh` его не вызывает. CI-workflow — черновик, `workflow_dispatch` | **Довести** |
| IndexNow | [velohost/astro-indexnow](https://github.com/velohost/astro-indexnow) `2.3.10` | 2026-07-08 | 15 / MIT | да | — | Не брать: пингует при каждой сборке, включая тестовый поддомен |
| RUM | [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals) `6.2.3` | 2026-10-05 | 8 649 / Apache-2.0 | — | Нет | **Брать** |
| Третьи скрипты | [QwikDev/partytown](https://github.com/QwikDev/partytown) `@astrojs/partytown@2.1.8` | 2026-09-22 | 13 796 / MIT | да | Метрика грузится async и только после согласия | Не брать (§3) |
| View transitions | встроено (`astro:transitions`) | 7.x | — | — | `ClientRouter`, `transition:persist` маскота, `transition:name` на всех логотипах | **Чинить раздутие** |
| Шрифты | встроенный Fonts API (`fonts`, `optimizedFallbacks`) | с 6.0 | — | да | `@fontsource-variable/onest/wght.css` (7 сабсетов) + ручной fallback на Arial | **Перейти** |
| CSP | встроенный `security.csp` | с 6.0 | — | **несовместим с ClientRouter** | Заголовки безопасности в `.htaccess` без CSP | Не брать |
| OG-картинки | [delucis/astro-og-canvas](https://github.com/delucis/astro-og-canvas) `0.13.2` (canvaskit-wasm) | 2026-09-15 | 288 / npm MIT (на GitHub файл лицензии не распознан) | да | Одна `og/default.png` из `scripts/gen-assets.mjs` (sharp, системный Arial) | Брать, если нужны OG на каждую страницу |
| OG-картинки | [vercel/satori](https://github.com/vercel/satori) `0.63.0` + `@resvg/resvg-js@2.6.2` | 2026-10-19 / 2026-01 | 14 110 / MPL-2.0 | — | — | Альтернатива с JSX-разметкой |
| Графики | [ChartsCSS/charts.css](https://github.com/ChartsCSS/charts.css) `1.2.0` | npm 2025-07, push 2026-04 | 6 584 / MIT | чистый CSS | Графиков нет | Только если графиков станет много |
| Графики | [leeoniya/uPlot](https://github.com/leeoniya/uPlot) `1.6.32` | **npm 2025-03** | 10 570 / MIT | — | — | Релизов нет полтора года |
| Графики | [frappe/charts](https://github.com/frappe/charts) `1.6.2` | 2.0.0-rc31 вышел 2026-10-19 | 15 088 / MIT | — | — | Ветка v2 ещё в RC, ждать |
| Таблицы | [tristen/tablesort](https://github.com/tristen/tablesort) `5.7.1` | 2026-04-15 | 1 145 / MIT | — | `CompareTable` статичная (топ-5). `sortProducts()` уже есть в `@pbn/core` | Не нужен |
| A/B | [growthbook/growthbook](https://github.com/growthbook/growthbook) `@growthbook/growthbook@1.8.0` | 2026-09-29 | 8 509 / SDK MIT | — | Нет | Позже (§6) |
| A/B | Varioqub (эксперименты Яндекс Метрики) | справка 200 | бесплатно | — | Нет | Вариант на один-два теста, работает только у давших согласие |
| Аналитика | [umami-software/umami](https://github.com/umami-software/umami) | 2026-10-17 | 39 460 / MIT | — | Только Метрика | Только на VPS и для всей сетки (§9) |
| Аналитика | [plausible/analytics](https://github.com/plausible/analytics), [matomo-org/matomo](https://github.com/matomo-org/matomo) | 2026-10-19 | 29 551 AGPL / 21 960 GPL | — | — | Не брать: Plausible требует ClickHouse, A/B в Matomo платный |
| Сжатие | [PlayForm/Compress](https://github.com/PlayForm/Compress) `astro-compress@2.4.3` | 2026-08-07 | 665 / в npm «SEE LICENSE» | — | `compressHTML` по умолчанию, gzip у nginx | Не нужен |
| Изображения | `astro:assets` | — | — | — | Логотипы — SVG (820 КБ на 130+ файлов), иллюстрации 28 КБ, растровых картинок контента нет | Оптимизировать нечего |
| Префетч | встроено (`prefetch`, `experimental.clientPrerender`) | — | — | — | С ClientRouter префетч по hover включён по умолчанию | Уже работает |

Живость внешних эндпоинтов на 2026-10-19:
- `yandex.com/indexnow` отвечает 202 на тестовый ping;
- `pagefind.app/docs/multilingual` указывает для `ru` и UI, и стемминг;
- `chartscss.org` отвечает 200;
- справка Varioqub отвечает 200.

PageSpeed Insights API не дал данных: дневная квота анонимного ключа исчерпана. Лабораторной базы LCP/INP нет, это ещё одна причина для RUM в §5.

---

## 2. Идеи (по приоритету)

### O1. Убрать раздутие HTML от `transition:name` на логотипах. Impact medium, effort S
- **Сейчас.** `src/components/OfferLogo.astro:8` — `transition:name={name}` на каждой плитке. Astro добавляет на каждый экземпляр `<style>` с `view-transition-name` и четырьмя `@keyframes`-обёртками в `@layer astro`. На главной так получается 49 блоков и 116 КБ (43% HTML).
- **Решение (лестница: нативная платформа).** Переход «логотип в списке → логотип в шапке обзора» нужен только одному элементу. Варианты:
  - (а) оставить `transition:name` только у `size="lg"` (шапка обзора) и у карточки, по которой кликнули: перед навигацией выставлять `style.viewTransitionName` в обработчике `astro:before-preparation`;
  - (б) задавать `style="view-transition-name:logo-<id>"` вручную и добавить одно глобальное правило `::view-transition-group(*)` с длительностью 180 мс.

  Оба варианта — несколько строк, без зависимостей.
- **Проверка.** `curl -s / | grep -c data-astro-transition-scope` ≤ 2. HTML главной ≤ 160 КБ.
- **Риск.** В браузерах без нативного View Transitions (fallback ClientRouter) морфинг логотипа пропадёт. Это косметика.

### O2. Полнотекстовый поиск на Pagefind 1.5.2 вместо заголовков в `search.json`. Impact medium-high, effort S
- **Сейчас.** `src/scripts/chrome.ts:55-95`: `fetch('/search.json')` и `includes()` по заголовку. В индексе 72 записи на 228 страниц. Новости и тексты статей не ищутся.
- **Решение.**
  - `pagefind --site dist` отдельной командой после `astro build`. Именно после: хук `legacyHtmlFiles` переименовывает `credit/<slug>/index.html` → `credit/<slug>.html`, и Pagefind должен увидеть уже итоговые пути.
  - `data-pagefind-body` на `<main>` в `ArticleView`, обзоре, подборках и новостях. Тогда страницы `/go/*` без атрибута в индекс не попадут.
  - `data-pagefind-meta="k:Статья"` вместо поля `k`.
  - В существующем `<dialog data-search>` заменить источник: `const pf = await import(/* @vite-ignore */ '/pagefind/pagefind.js')`, затем `pf.search(q)`. `search.json` оставить фолбэком.
- **Почему не Orama и не MiniSearch.** У Orama плагин с peer `astro ^2`, а весь индекс лежит одним JSON. Pagefind бьёт индекс на чанки и умеет русский стемминг.
- **Пересечение.** Механика целей «пустой поиск» описана в `finhelp-adapt-2.md` §8. Отсюда только библиотека и два гоча:
  - нужен `@vite-ignore`;
  - деплой без `--delete` будет копить старые хеш-чанки `/pagefind/` на сервере. Они безвредны, но раз в квартал их стоит чистить.
- **Переиспользование.** Статьи, перенесённые из finhelp (`finhelp_articles_reuse.tsv`), попадут в поиск автоматически, отдельной работы не нужно.

### O3. Довести IndexNow до автоматики. Impact high, effort S
- **Сейчас.** `scripts/indexnow.mjs` написан (эндпоинт Яндекса, весь dist или список URL), но:
  - ключ-файла `web/apps/rencredit/public/<KEY>.txt` нет;
  - `deploy-beget.sh` скрипт не вызывает (`grep indexnow` пустой);
  - CI `deploy-rencredit.yml` — черновик с ручным запуском.
- **Решение.**
  1. Положить ключ-файл.
  2. В конце `deploy-beget.sh` (не при `--dry-run`/`--check` и не при `PUBLIC_NOINDEX=true`) вызвать `node scripts/indexnow.mjs`.
  3. Отправлять только изменённые страницы: `rsync --itemize-changes` или сравнение `sha1` HTML с прошлым деплоем в `dist/.indexnow-hashes.json`. При 228 страницах можно и весь список, лимит Яндекса — 10 000 URL на запрос.
- **Почему не `astro-indexnow`.** Интеграция стреляет на каждой сборке, в том числе локальной и noindex-поддомена.

### O4. Типизировать JSON-LD через `schema-dts`. Impact low-medium, effort S
- **Сейчас.** `packages/core/src/schema.ts` (168 строк) возвращает `object`. Опечатку в `annualPercentageRate`/`loanTerm` или неверный вложенный тип `LoanOrCredit`/`CreditCard`/`FAQPage` компилятор не поймает. Ловить её будет только валидатор Яндекса уже после выкладки.
- **Решение.** `schema-dts` в devDependencies `@pbn/core`, возвращаемые типы `WithContext<LoanOrCredit>`, `ItemList` и т. п. Рантайм не меняется, нулевой вес в бандле.
- **Почему не `astro-seo-schema@7`.** Он сделан поверх того же `schema-dts`, а свой билдер уже есть.
- Для YMYL ошибка в разметке ставки — это риск «вводящей в заблуждение» информации. Дешёвая страховка.

### O5. RUM Core Web Vitals: `web-vitals` → Метрика + серверный маячок. Impact medium, effort S
- **Сейчас.** Нет ни одной цифры о реальных LCP/INP/CLS. PSI недоступен по квоте, CrUX для небольшого RU-сайта, скорее всего, пуст. При этом на сайте GSAP, FLIP витрины, маскот и ClientRouter, а именно они бьют по INP на слабых Android.
- **Решение.** `web-vitals@6.2.3`, только `onLCP`/`onINP`/`onCLS`, около 2 КБ в brotli, ленивый `import()` после `load`. Дальше два канала:
  - с согласием: `ym(id,'params',{cwv:{lcp,inp,cls,path}})`;
  - без согласия: `navigator.sendBeacon('/v.php', …)` с полями `metric, value, path, device(mobile|desktop)`. Без IP и UA. `v.php` — около 15 строк с `flock` в CSV вне docroot.

  PHP-эндпоинт ставится по той же схеме, что `go.php` из `finhelp-adapt-2.md` §1. Сначала прогнать smoke-тест, что PHP вообще исполняется на новом docroot (`/mail.php` сейчас 404, PHP-файлов в dist нет).
- **Зачем.** Это единственный способ узнать, бьёт ли ClientRouter с GSAP по ПФ. Без этих данных решения по Partytown и view transitions принимаются вслепую.

### O6. A/B на статике по паттерну consent, без SaaS. Impact medium, effort M
- **Механика.**
  - Inline-скрипт в `<head>` (рядом с consent-скриптом `BaseLayout.astro:90`) берёт вариант из `localStorage['fk-ab']` или назначает его через `crypto.getRandomValues` и ставит `html[data-ab="b"]`.
  - На `astro:after-swap` вариант восстанавливается: это уже готовый паттерн для `data-consent`.
  - Оба варианта рендерятся в HTML, лишний скрывается CSS-правилом `html[data-ab=b] .ab-a{display:none}`. Мигания и CLS нет.
- **Атрибуция.**
  - В Метрику — `params({ab:{exp:'cta1',v}})`, только с согласием.
  - Всегда — вариант в `utm_content` при переходе через `/go/`. Сверка идёт по статистике Saleads, это работает и без Метрики.
  - Зависит от O-атрибуции в `finhelp-adapt-2.md` §1.
- **Библиотеки.**
  - Varioqub (бесплатно, Яндекс) годится для одного-двух визуальных тестов, но видит только тех, кто дал согласие.
  - `@growthbook/growthbook@1.8.0` (SDK MIT, без сервера, фичи из JSON) — когда одновременно идёт больше трёх экспериментов.
- **Первые тесты.** Текст CTA «Получить» против «Оформить на сайте МФО». Позиция `CompareTable` выше или ниже витрины. Маскот с репликой против маскота без неё.
- **Риск.** Мало трафика: при паре сотен кликов в неделю различие в 10% не доказать. Тест длится от 4 недель, решение принимается по EPC, а не по CTR.

### O7. Fonts API вместо ручного fallback. Impact low-medium, effort S
- **Сейчас.** `global.css:2` импортирует `@fontsource-variable/onest/wght.css`: 7 `@font-face`, из них vietnamese, math и symbols не нужны. Fallback сделан вручную: `local("Arial")`, `size-adjust:103%`, метрики на глаз. Preload шрифта нет.
- **Решение.** `fonts: [{ provider: fontProviders.fontsource(), name: 'Onest', cssVariable: '--font-sans', subsets: ['cyrillic','latin'], weights: ['100 900'] }]` и `<Font cssVariable="--font-sans" preload />` в `BaseLayout`. Fallback-метрики Astro посчитает из реального файла (`optimizedFallbacks: true` по умолчанию). Пакет `@fontsource-variable/onest` после этого можно удалить.
- **Проверка.** Нет запросов к `onest-vietnamese*`. На медленном 3G нет сдвига hero (Playwright-скриншот 320/375).
- **Риск.** Нужна пересборка и проверка Tailwind 4 `@theme` на совместимость с `--font-sans`. Есть раздел «Register fonts in Tailwind» в docs.astro.build/en/guides/fonts.

### O8. OG-картинка на каждую страницу. Impact medium, effort M
- **Сейчас.** Одна `og/default.png` из `scripts/gen-assets.mjs`. Там sharp, а текст рендерит librsvg системным Arial. На Ubuntu в CI Arial нет: кириллица уйдёт в DejaVu, это «плавающий» результат.
- **Решение (лестница).**
  1. **Без новых зависимостей.** Перенести шаблон из `gen-assets.mjs` в хук `astro:build:done` (рядом с `legacyHtmlFiles`) и рисовать по одному PNG на статью, обзор и подборку: h1, раздел, знак Мерки. Нужно явно объявить `sharp` в зависимостях: сейчас он только `optionalDependencies` у astro. Шрифт Onest TTF (OFL) установить в систему CI.
  2. **Если нужен точный текст с переносами.** `astro-og-canvas@0.13.2`: peer `^7` подходит, принимает `fonts: ['./src/fonts/Onest.ttf']`. Woff2 из fontsource ему не подойдёт, нужен TTF.
- **Пересечение.** Каналы распространения (Telegram, VK, Дзен) — в `brand-engagement.md` E9 и `finhelp-adapt-2.md` §11. Моя часть — выбор генератора и гоча со шрифтом.
- **Оценка.** Около 120 картинок по ~40 КБ = ~5 МБ к dist (сейчас 7,5 МБ). Деплой идёт без `--delete`, только новые файлы.

### O9. Графики и сортировка в калькуляторах и сравнениях без библиотек. Impact medium, effort S–M
- **Контекст.** Движок калькуляторов и страницы `/kalkulyator/` описаны в `finhelp-adapt-2.md` §3–4. 14 из 22 статей — про рефинансирование, а MDX позволяет вставить интерактив прямо в текст.
- **Библиотеки.** Ни одна не нужна:
  - график «тело/проценты по месяцам» и «было/стало при рефинансировании» — это `<table>` с CSS-барами (`inline-size: calc(var(--v) * 1%)`) или inline SVG на 20–30 строк. Таблица под графиком доступна скринридерам и видна роботу;
  - `Charts.css` (MIT, чистый CSS) имеет смысл, только если типов графиков станет больше трёх;
  - uPlot — релизов нет с 2025-03;
  - frappe-charts — v2 в RC;
  - Chart.js — около 70 КБ gz, для двух графиков избыточен.
- **Сортировка `CompareTable`.** Кнопки в `<th>` с `aria-sort` плюс уже существующий `sortProducts()` из `@pbn/core`. Строки переставлять тем же GSAP Flip, что и витрину (`packages/motion/src/flip.ts`). `tablesort` не нужен.
- **ПФ.** Сортировка и перетаскивание ползунка — реальные взаимодействия, их видно в карте кликов Метрики. Цели — по паттерну E1 из `brand-engagement.md`.

### O10. Cookieless self-hosted счётчик для сетки (позже). Impact medium, effort L
- **Проблема.** Метрика стартует только после согласия, поэтому всех, кто не нажал «да», сайт не видит совсем.
- **Варианты.**
  - Umami v3 (MIT, 39k★, push 2026-10-17): без cookie, IP хешируется с солью. Но нужен Node и Postgres, а на shared Beget они не поднимаются. Ставить на RU-VPS один инстанс на всю PBN-сетку.
  - Plausible: AGPL, ClickHouse.
  - Matomo: на shared встанет, но A/B платный, а на shared упрётся в лимиты MySQL и cron.
- **Риск 152-ФЗ.** Хранение только в РФ (ст. 18 ч. 5). Позиция РКН по хешу IP не определена. До юридической проверки лучше обойтись серверными логами `go.php` и `v.php` (O5): они закрывают главное, клики и CWV, без ПДн.

---

## 3. Чего не делать (и почему именно на этом стеке)

- **`security.csp` Astro.** Несовместим с `<ClientRouter />`, это прямо сказано в docs. Внешний `tag.js` Метрики требует ручных хешей.
- **Partytown для Метрики.** Метрика и так async и после согласия. ClientRouter перезапускает скрипты при swap, ручные `ym('hit')` висят на `astro:page-load`. Вынос в worker ломает эту связку ради выигрыша, которого никто не измерял. Вернуться к вопросу после O5, если TBT/INP от `tag.js` окажется заметным.
- **`@orama/plugin-astro`.** Peer `astro ^2.0.4`, install на Astro 7 падает.
- **`astro-indexnow`.** Пингует на каждой сборке, включая noindex-поддомен.
- **`astro-seo-schema`, `astro-seo`, `astro-compress`.** Дублируют уже сделанное: `BaseLayout`, `jsonLdGraph`, `compressHTML` и gzip nginx (главная 25 КБ в gzip). У `astro-compress` в npm лицензия «SEE LICENSE IN LICENSE», на GitHub CC0.
- **`astro:assets` ради оптимизации картинок.** Растровых изображений контента нет: логотипы SVG, OG генерируются отдельно.
- **Линк-чекеры (lychee и т. п.) по `/go/` и CPA-URL.** Каждая проверка — это клик в трекере Saleads, накрутка и риск фрод-флага. Внутренние ссылки уже проверяет `web/scripts/check-links.mjs`. Внешних ссылок в контенте около 25 (interfax, cbr, consultant), отдельный инструмент для них не нужен.
- **Обновлять зависимости бездумно.** `astro` 7.3.8 → 7.4.1 — минорное обновление, но у `@astrojs/mdx@8.1.0` новый peer `@astrojs/markdown-satteri ^0.4.0`. Обновлять отдельной задачей с `astro check` и сборкой.

---

## 4. Порядок внедрения

1. O1 (раздутие view transitions) и O3 (IndexNow). Полдня, без новых зависимостей.
2. O2 (Pagefind) и O4 (schema-dts). Две devDependency, около дня.
3. O5 (RUM) вместе с `go.php` из `finhelp-adapt-2.md` §1. Нужен первый PHP-эндпоинт, сначала smoke-тест PHP на новом docroot.
4. O7 (Fonts API), O9 (графики и сортировка) — вместе со страницами калькуляторов.
5. O6 (A/B) — после того как заработает атрибуция кликов по `placement`.
6. O8 (OG на страницу) — вместе с каналами возврата.
7. O10 — только как решение на всю сетку и после юридической проверки.

## Источники (проверены 2026-10-19)

- Astro Configuration Reference: `security.csp` (Added in 6.0, ClientRouter не поддерживается), `fonts`/`optimizedFallbacks` (6.0), `prefetch` — https://docs.astro.build/en/reference/configuration-reference/
- Astro Fonts guide — https://docs.astro.build/en/guides/fonts/ · Prefetch и clientPrerender — https://docs.astro.build/en/guides/prefetch/
- Pagefind, языки и стемминг (`ru`: UI и стемминг есть) — https://pagefind.app/docs/multilingual/
- Яндекс IndexNow — https://yandex.ru/support/webmaster/indexing-options/index-now.html (эндпоинт `yandex.com/indexnow` → 202)
- Varioqub — https://yandex.ru/support/varioqub/ru/
- Репозитории и пакеты: ссылки в таблице §1. Звёзды, push и лицензии — `gh api repos/...`, версии и peer — `npm view` (2026-10-19).
- Живой сайт: `curl https://rencredit-online.ru/` (273 КБ HTML, 49 transition-style, 49 ссылок `/go/`), `/search.json` (72 записи), `/robots.txt`, `/mail.php` (404).
