# 07. Яндекс, история домена и GEO: rencredit-online.ru

Дата: 2026-10-19 · Линза: Яндекс (Вебмастер, ИКС, IndexNow, переиндексация), история домена, Метрика, Алиса AI / Нейро.
Код: worktree `/Users/deniskononov/rencredit-pilot-wt` (ветка `feat/rencredit-metrika`), приложение `web/apps/rencredit`.
Исходная точка: `docs/seo/07-yandex-geo.md` (finhelp-ru). Общие факты оттуда про Алису AI, IndexNow, YandexAdditional, Турбо, llms.txt и фильтры здесь не повторяются, только применяются к rencredit. Выводы finhelp про копию донора и битые ссылки к rencredit не относятся.

---

## Резюме

1. **У домена нет «долгой истории», на которую рассчитывает `PROJECT_BRIEF.md` §4.** По WHOIS (TCI) домен `created: 2024-04-24` в BEGET-RU, то есть он **перерегистрирован после дропа**. Wayback показывает три разных жизни: 2019 — дорвей «Ренессанс Кредит — Личный кабинет онлайн вход», 2020-01 — заглушка REG.RU «Истёк срок регистрации домена», 2022 — снова «Ренессанс Кредит личный кабинет: вход, регистрация» (WordPress), 2024-04 — заглушка Beget «Домен не прилинкован», с 2024-08 — WordPress-блог «Все о рефинансировании кредита», с 2026-10-17 — Astro «Мерка». Непрерывная история у текущего владельца — около 2 лет 2 месяцев. **ИКС = 0**: `webmaster.yandex.ru/siteinfo` отдаёт `"sqi":0`, бейдж `yandex.ru/cycounter` показывает «—».
2. **Прошлое домена — выдача себя за банк.** В 2019 и 2022 годах на домене был дорвей «личный кабинет Ренессанс Кредит» с путями `/lk/`, `/reg/`, `/ios/`, `/podkluch/`. Для Яндекса это история брендового навигационного трафика банка и, возможно, отметки о фишинге или введении в заблуждение. Это усиливает риск по товарному знаку из `PROJECT_BRIEF.md` §4, а не ослабляет его.
3. **Миграция WP→Astro технически сделана хорошо.** Живой сайт (проверка curl 2026-10-19): 14 переписанных статей отвечают 200 на прежнем адресе `/credit/<slug>.html`, canonical совпадает. 23 поста, `?p=`, 159 тегов, фиды, `/author/`, `/page/N`, Yoast-карты отдают 301 одним прыжком. `/wp-*` и `xmlrpc` отдают 410. http и www ведут на https без www одним 301. Sitemap содержит 83 URL, `/go/` закрыт в robots.
4. **Потеряно 101 исторический URL.** Wayback CDX знает 138 уникальных `/credit/*.html`, из них **101 сейчас отдаёт 404**. Они отвечали 200 ещё в 2025-11 и 2026-01, но в WP-экспорт (37 постов, `legacy/rencredit/REPORT.md:8`) не попали: их удалили до экспорта. Состав: 29 про рефинансирование ипотеки, 23 общих про рефинансирование, 9 про рефинансирование в конкретных банках, 6 про отказы, 20 новостей и прочее. Среди них есть пост не по теме `metallicheskaya-setka-vidy-osobennosti-i-primenenie`: прошлый владелец, похоже, продавал публикации.
5. **Смена тематики сильная.** Было: блог про рефинансирование (2024–2026), до этого брендовый дорвей банка. Стало: агрегатор МФО. Title главной — «Займы онлайн на карту — сравнение условий МФО», H1 — «Займ онлайн: сравните 22 МФО». Для Яндекса это фактически новый сайт на старом хосте: прежние сигналы по запросам «рефинансирование» к МФО-страницам не перейдут. Google и Bing пока держат в индексе главную со старым WP-заголовком «Все о рефинансировании кредита».
6. **Яндекс-инфраструктура почти готова, но с пробелами.** Метрика `109623857` стоит на проде и грузится после согласия на cookie. Мета `yandex-verification` есть. Целей `reachGoal` нет ни одной, поэтому клики в CPA Метрика не видит. Скрипт `scripts/indexnow.mjs` есть, но у него два бага: URL без завершающего слэша и пропуск legacy-`.html`. Файла ключа в `public/` нет. В sitemap нет `lastmod`.
7. **Стратегический вывод.** Ценность домена (ИКС 0, перерегистрация в 2024, тонкий индекс, смена темы) ниже, чем предполагалось, а риск по ТЗ и брендовой истории выше. Если решение по §4 склоняется к переезду на нейтральный домен, **делать его надо сейчас**, пока сайту 2 дня и в него не вложены ссылки и ПФ. Каждый месяц на rencredit делает переезд дороже. Перед решением нужно за 1 день проверить Вебмастер: «Страницы в поиске», «Внешние ссылки», «Безопасность и нарушения».

---

## Методика

- `curl` живого сайта: статусы, заголовки, robots, sitemap, canonical, JSON-LD, Метрика. Cookie `beget=begetok` ставился, чтобы обойти JS-заглушку Beget на `/wp-admin/`.
- Wayback CDX API: `url=rencredit-online.ru&matchType=domain` (258 записей, 2018-02-13…2026-05-21), `collapse=digest` по главной, `id_`-снимки 2019, 2020, 2022, 2024, 2025, 2026 (заголовок, generator, текст). После этого прогон всех 156 исторических путей (кроме `/wp-*`) по живому сайту.
- WHOIS: `whois -h whois.tcinet.ru rencredit-online.ru`.
- ИКС: JSON страницы `webmaster.yandex.ru/siteinfo/?site=https://rencredit-online.ru` и бейдж `yandex.ru/cycounter`.
- Индекс: Яндекс (`site:`) отдал SmartCaptcha, обходить не стали. Exa и Firecrawl вернули 401. Bing ничего не вернул. WebSearch нашёл только главную со старым WP-заголовком. **Точного числа страниц в индексе Яндекса и Google нет**, его надо взять из Вебмастера и Search Console.
- Код: `astro.config.mjs`, `public/.htaccess`, `src/pages/robots.txt.ts`, `src/pages/credit/[slug].astro`, `src/layouts/BaseLayout.astro`, `src/lib/ui/site.ts`, `scripts/indexnow.mjs`, `legacy/rencredit/REPORT.md`, коммиты `c1e7dc6` и `c8f9439`.

---

## Находки

### D1. История домена: два дропа, брендовый дорвей, перерегистрация 2024 — CRITICAL (для стратегии)

| Период | Что было (Wayback / WHOIS) | Источник |
|---|---|---|
| 2018-02-13 | первая запись (`robots.txt`) | CDX |
| 2019-07-23 | «Ренессанс Кредит - Личный кабинет онлайн вход», меню «Заявка на кредит онлайн», «Кредит пенсионерам»… | `web.archive.org/web/20190723180953/http://rencredit-online.ru/` |
| 2020-01-03 | «Истёк срок регистрации домена rencredit-online.ru» (REG.RU) | `/web/20200103170302/` |
| 2022-03…2022-10 | «Ренессанс Кредит личный кабинет: вход, регистрация, взять кредит», WP, пути `/lk/ /reg/ /ios/ /podkluch/` | `/web/20220314163029/`, CDX 2022 |
| 2023-03 | нет ответа (`statuscode -`) | CDX |
| 2024-04-24 | **регистрация домена заново** (BEGET-RU, Private Person, paid-till 2027-04-24) | WHOIS TCI |
| 2024-04-25 | заглушка Beget «Домен не прилинкован ни к одной из директорий» | `/web/20240425061706/` |
| 2024-08-19 | WordPress 6.1.1, «Все о рефинансировании кредита» | `/web/20240819205943/` |
| 2025-02…2026-01 | WP, ≥138 постов `/credit/*.html` | CDX `credit/*` |
| 2026-04-21 | WP «Блог о рефинансировании кредита», на главной 27 ссылок `/credit/` | `/web/20260421202003/` |
| 2026-10-17 | Astro «Мерка» (`last-modified: Sat, 17 Oct 2026 20:54:19 GMT`) | живой сайт |

Выводы:
- Утверждение «главная ценность — возраст и история домена» (`PROJECT_BRIEF.md` §4) **не подтверждается**. Реестровый возраст — 2,5 года, история у текущего владельца — с 2024-08. Сигналы 2019–2022 года принадлежали другим владельцам. Яндекс склеивает историю хоста, но после перерегистрации и смены темы старые сигналы не помогают, а брендовые могут мешать.
- История «личный кабинет банка» означает, что Яндекс мог годами связывать хост с навигационными запросами «ренессанс кредит личный кабинет». Сейчас на сайте нет ни одного упоминания «Ренессанс» (проверено `grep` по `src/` и по живой главной). Дисклеймер «не является сайтом банка или МФО» на главной есть. Это правильно, но домен в сниппете всё равно читается как банковский.
- Пост `metallicheskaya-setka-…` (тема — строительная сетка) на финансовом блоге — признак продажи публикаций. Ссылочный профиль домена может содержать спам. Нужна проверка в Вебмастере (Ссылки → Внешние).

### D2. ИКС и индекс — HIGH

| Метрика | Значение | Как получено |
|---|---|---|
| ИКС Яндекса | **0** | `siteinfo` JSON: `"achievements":[{"sqi":0,...}]`, бейдж cycounter «—» |
| Страниц в sitemap | 83 (`/mfo/` 22, `/credit/` 14, `/stati/` 9, `/karty/` 8, `/kredity/` 5, `/novosti/` 4, гайды и сервисные разделы) | `sitemap-0.xml` |
| `lastmod` в sitemap | 0 из 83 | `grep -c lastmod` |
| Индекс Яндекса | неизвестно: `site:` → SmartCaptcha | — |
| Индекс Google/Bing | главная со старым WP-тайтлом «Все о рефинансировании кредита» | WebSearch |

ИКС 0 у хоста с WP-контентом с 2024 года говорит о почти нулевой аудитории из поиска. Терять при смене движка и темы практически нечего. Но и «разгона» от домена ждать не стоит: позиции придётся набирать как у нового сайта, по YMYL-нише МФО с жёсткой конкуренцией (banki.ru, sravni.ru, vbr.ru).

### D3. Миграция WP→Astro: что сделано и что упущено — HIGH

Сделано (проверено на проде 2026-10-19):

| Проверка | Результат | Где в коде |
|---|---|---|
| 14 переписанных статей на старом URL | 200, canonical = `/credit/<slug>.html`, `datePublished` 2025-09-02 сохранена | `astro.config.mjs:16-31` (переименование в `.html`), `:64` (sitemap), `src/pages/credit/[slug].astro`, `.htaccess:276-277` |
| `/credit/<slug>.html/` → без слэша | 301 | `.htaccess:219` |
| 23 поста → хабы | 301 на `/novosti/`, `/kredity/`, `refinansirovanie-kredita-chto-eto-znachit.html` | `.htaccess:169-214` |
| `?p=` / `?page_id=` | 301 на новый адрес | `.htaccess:73-154` |
| 159 тегов | 301 на `/stati/` или `/kredity/` | `.htaccess:223-225` |
| `/wp-admin/`, `/wp-json/`, `/wp-login.php` | 410 | `.htaccess:267-268` |
| http, www | один 301 на `https://rencredit-online.ru/` | `.htaccess:42-48` |
| robots | `Disallow: /go/` + Sitemap | `src/pages/robots.txt.ts:9` |

Упущено:
- **101 исторический URL `/credit/*.html` отдаёт 404** (полный список — в приложении). Они были живыми в Wayback до 2025-11 и 2026-01, но в экспорт не попали. Скорее всего, к моменту миграции они уже были 404 и на WP, поэтому из индекса в основном выпали. Ценность остаётся только там, где есть внешние ссылки или остаточный индекс. 301 «всего подряд» на хаб Яндекс трактует как soft-404, поэтому 301 нужен только там, где есть близкая по смыслу цель.
- **Редиректы новостей на `/novosti/`** («золото дешевеет», «нацбанк Украины», «Турция», «Самолёт») ведут на нерелевантную страницу. Это soft-404, вес не передаётся. Лучше отдавать 410. Это уже отмечено в `02-content-inventory.md` п.6, здесь подтверждаем.
- `/lk/`, `/reg/`, `/ios/`, `/podkluch/` (дорвей «ЛК банка», 2022) отдают 404. Лучше **410**: явный сигнал «удалено навсегда», и брендовые ЛК-адреса не будут связаны ни с какой страницей нового сайта.

### D4. Смена тематики и движка: риски переиндексации — MEDIUM

- Тема сменилась с «рефинансирования» на «МФО и займы». Яндекс переоценивает сайт с нуля по новой семантике: сначала «Малоценные или маловостребованные» для части страниц, затем по мере появления ПФ — включение. Ожидаемый срок первичной переиндексации 83 URL при IndexNow и sitemap — 1–3 недели. Выход в топ по коммерческим МФО-запросам — месяцы, при ИКС 0 это реально только для длинного хвоста.
- **Сеть.** `05-keyword-gap.md` п.5 уже рекомендует сделать ядром rencredit рефинансирование, кредиты и карты, а не МФО, чтобы не пересекаться с finhelp-ru (аффилиат-фильтр). С точки зрения истории домена это ещё и **преемственность**: 14 сохранённых статей и 101 потерянный URL — про рефинансирование. Сместить главную и хабы к «кредиты и рефинансирование» значит использовать единственный тематический сигнал, который у домена есть. Сейчас главная целиком про МФО.
- Движок (WP → статика) Яндексу безразличен, если URL, canonical и контент стабильны. HTML главной весит 293 КБ без сжатия, это не критично для индексации, но стоит проверить в отчёте о скорости.

### D5. IndexNow, sitemap, Вебмастер — HIGH (дёшево)

- `scripts/indexnow.mjs` (корень worktree):
  - `:48` — берёт только `index.html`. Legacy-файлы `credit/<slug>.html`, которые переименовывает `astro.config.mjs:26`, **не отправляются**.
  - `:50` — `routeDir.replace(/\/$/, '')` срезает слэш, отправляются `https://rencredit-online.ru/zaimy`. При `trailingSlash: 'always'` (`astro.config.mjs:55`) это 301, и Яндекс тратит обход на редиректы.
  - В исключениях нет noindex-сервисных страниц, которые `astro.config.mjs:42-50` убирает из sitemap.
  - Файла ключа `<KEY>.txt` в `web/apps/rencredit/public/` нет, значит POST вернёт ошибку проверки ключа. Простейшее исправление — брать список URL из `dist/sitemap-0.xml` вместо обхода `dist`. Тогда все три бага исчезают разом.
- `astro.config.mjs:64` (`serialize`): `lastmod` не ставится. Даты в контенте есть (`dateModified` в JSON-LD статей). Достаточно добавить `lastmod` из frontmatter для статей и новостей. Для витрин `lastmod` лучше не ставить совсем, чем ставить `today`.
- Вебмастер: подтверждение мета-тегом `a4cd787f70f90b84` стоит в `BaseLayout.astro:65`. Нужно проверить, что сайт добавлен и подтверждён, затем отправить sitemap, задать регион «Россия» и привязать счётчик Метрики.

### D6. Метрика (ветка `feat/rencredit-metrika`) — MEDIUM

- `c1e7dc6`: публичные ID в `.env.production`. `c8f9439`: при `PUBLIC_NOINDEX=true` счётчик не ставится (`src/lib/ui/site.ts:13`). На проде `ym(109623857)` есть, на тестовом поддомене нет. Логика правильная.
- `BaseLayout.astro:90-118`: счётчик грузится только после согласия на cookie, Вебвизор выключен, на переходах ClientRouter вызывается `hit`. Следствие: в Метрике будет только доля посетителей, давших согласие. Это нормально для 152-ФЗ, но абсолютные цифры трафика брать из Вебмастера («Поисковые запросы»), а не из Метрики.
- **Целей нет** (`grep reachGoal src/` → 0, совпадает с `features/current-state.md:26`). `/go/[offer].astro` — отдельный HTML без счётчика с meta-refresh. `trackLinks` внутреннюю ссылку `/go/…` не ловит. Итог: CTR витрин и вклад страниц в CPA не измеряются.
- Нет `<noscript>`-пикселя. При opt-in так и должно быть.

### D7. Алиса AI / Нейро и GEO для rencredit — MEDIUM

Общие правила — в `docs/seo/07-yandex-geo.md` Y6. Применительно к rencredit:
- Алиса AI берёт источники из высоко ранжирующихся страниц, а SoV в Вебмастере считается только по запросам, где сайт уже в топе. При ИКС 0 реальные кандидаты — свежие информационные страницы с цифрами и первоисточником, по которым у агрегаторов нет точного ответа: `/novosti/mfo-limit-psk-200-s-1-oktyabrya-2026/`, `/novosti/predelnaya-pereplata-po-mikrozajmam-100-s-1-aprelya-2026/`, `/stati/samozapret-na-kredity/`, `/stati/chto-takoe-psk-i-kak-ee-schitat/`, `/stati/kak-proverit-mfo-v-reestre-cb/`. Формат «ответ в первом предложении + число + ссылка на cbr.ru» обязателен.
- **Проблема сущности.** В AI-ответе сайт цитируется по домену. Organization в JSON-LD называется «Мерка», а домен — `rencredit-online.ru`. Модели и пользователи видят «rencredit» рядом с советом про МФО, и это и путаница с банком, и слабая связка «бренд ↔ домен». Нейтральный домен вида `<бренд>.ru` решает обе проблемы.
- `robots.txt` (`robots.txt.ts:9`): блока `YandexAdditional` нет. По умолчанию использование контента в ответах разрешено. Явный `User-agent: YandexAdditional` / `Allow: /` с дублированием `Disallow: /go/` защитит политику от случайной поломки.
- Проверить живьём выдачу Нейро и Алисы по сайту не удалось: SmartCaptcha. Нужен ручной прогон 10 запросов из браузера или отчёт «Видимость в Алисе AI» через 2–3 недели после индексации.

### D8. Товарный знак и Яндекс — HIGH (решение за владельцем)

- Связка «домен `rencredit` + брендовая история ЛК банка + офферы конкурентов-МФО» — это и юридический риск (ТЗ «Ренессанс Кредит», `PROJECT_BRIEF.md` §4), и поисковый: жалоба правообладателя в Яндекс или Роскомнадзор, ручная проверка асессором, «вводит в заблуждение».
- Аргумент «жалко терять историю» по фактам D1–D2 слабый. Сайт на новом движке живёт с 2026-10-17, ИКС 0. Переезд сейчас стоит: 301 всех URL 1:1, «Переезд сайта» в Вебмастере, Change of Address в Search Console, Метрика с новым доменом. Через полгода, после закупки ссылок и набора ПФ, он будет стоить потери части накопленного.

---

## Приоритизированные рекомендации

| # | Рекомендация | Impact | Effort | Детали |
|---|---|---|---|---|
| R1 | Снять данные Вебмастера и GSC до решения по домену: «Страницы в поиске», «Исключённые», «Внешние ссылки» (в т.ч. на 404), «Безопасность и нарушения», «Поисковые запросы» за всё время | high | S | Без этого нет оценки индекса (Яндекс `site:` за капчей). Итог: число URL в индексе, ссылки на 101 потерянный URL, наличие фишинговых и брендовых отметок |
| R2 | Принять решение по §4 **в ближайшие 2–4 недели**: либо нейтральный домен через 301 1:1 + «Переезд сайта», либо остаться с жёсткими ограничениями (без «Ренессанс» в семантике, дисклеймер, 410 на брендовые ЛК-пути) | high | M | Факты D1, D2, D8: ценность домена низкая, риск выше заявленного. Чем позже переезд, тем дороже |
| R3 | Исправить `scripts/indexnow.mjs`: URL из `dist/sitemap-0.xml` (со слэшем, с `.html`, без noindex), положить `public/<KEY>.txt`, запускать после каждого деплоя | high | S | `indexnow.mjs:48,50`. Первый прогон — все 83 URL одним POST на `yandex.com/indexnow` |
| R4 | Цели Метрики: `reachGoal('offer_click', {poolId, slot, page})` на клик `a[href^="/go/"]` + цели калькулятора и FAQ. Привязать счётчик 109623857 к Вебмастеру | high | S | `BaseLayout.astro:90-118`. Подробнее — `features/current-state.md` §2.1 |
| R5 | 101 потерянный URL: 301 только при наличии ссылок или показов (данные R1) на близкую цель. Без ссылок оставить 404. Новости и офф-топ — 410. ЛК-дорвей `/lk/ /reg/ /ios/ /podkluch/` — 410 | medium | S | Карта групп — в приложении. Генерировать через `legacy/rencredit/map.json` → `gen_htaccess.py`, руками `.htaccess` не править (`.htaccess:61`) |
| R6 | Нерелевантные 301 новостей на `/novosti/` (золото, иена, Турция, Нацбанк Украины, Самолёт, Норникель) заменить на 410 | medium | S | `.htaccess:169-214`, через `map.json` |
| R7 | Сместить главную и хабы к теме «кредиты и рефинансирование» (тематическая преемственность домена), МФО сделать вторичным разделом. Открыть хаб «рефинансирование ипотеки» — по нему 29 исторических URL | high | M | Согласовано с `05-keyword-gap.md` п.5 (сеть: МФО — ядро finhelp). Переиспользовать статьи finhelp по `finhelp_articles_reuse.tsv` только с переписыванием |
| R8 | `lastmod` в sitemap из frontmatter (`updatedAt`/`dateModified`) для статей, новостей и legacy. Для витрин без `lastmod` | medium | S | `astro.config.mjs:64` (`serialize`) |
| R9 | robots: явный `User-agent: YandexAdditional` + `Allow: /` + `Disallow: /go/`. Для Яндекса — `Clean-param: utm_source&utm_medium&utm_campaign&erid` | low | S | `src/pages/robots.txt.ts:9` |
| R10 | GEO-упаковка 5 страниц-кандидатов в Алису AI (D7): ответ первым, число, дата, ссылка на cbr.ru/consultant.ru, H2-вопросы | medium | S | Шаблон — `docs/seo/07-yandex-geo.md`, «Шаблон идеальной статьи». Через 3 недели проверить SoV в Вебмастере |
| R11 | Вебмастер: регион «Россия», sitemap, «Переобход» для 14 legacy и 9 `/stati/` в пределах квоты; GSC: Inspect URL главной, чтобы сменился старый WP-сниппет | medium | S | Сейчас в Google и Bing главная висит со старым тайтлом |
| R12 | Реквизиты оператора (ИНН, юрлицо, e-mail) в футере и на `/o-proekte/`: на проде их нет | medium | S | `astro.config.mjs:37-40` предупреждает при сборке. Для YMYL-доверия Яндекса и 152-ФЗ |

---

## Приложение: 101 исторический URL с ответом 404 (группы и цели)

Префикс у всех — `/credit/`, суффикс — `.html`. Цель — только если R1 покажет ссылки или показы, иначе 404 или 410.

| Группа | N | Предлагаемая цель | Слаги (сокращённо) |
|---|---|---|---|
| Рефинансирование ипотеки | 29 | новый хаб «рефинансирование ипотеки» (R7). До его появления оставить 404 | chto-takoe-refinansirovanie-ipoteki, dokymenty-dlia-refinansirovaniia-ipoteki, refinansirovanie-ipoteki-v-sberbanke-…, …-v-alfa-banke-…, …-v-gazprombanke, voennoi-ipoteki, semeinaia-ipoteka (×3), dalnevostochnaia, nalogovyi-vychet, kalkyliator, materinskim-kapitalom, … |
| Рефинансирование общее | 23 | `refinansirovanie-kredita-chto-eto-znachit.html`. «плюсы/минусы», «когда выгодно» → `stoit-li-ispolzovat-refinansirovanie-kredita.html`. «с плохой КИ» → `refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov.html`. «снизить процент» → `perekreditovanie-kredita-pod-menshii-procent.html` | refinansirovanie-kredita, plusy-i-minysy-refinansirovaniia, kogda-vygodno-…-kreditnye-kanikyly, refinansirovanie-ili-restryktyrizaciia-…, …-dlia-pensionerov-…, vozmojno-li-povtorno-provesti-refinansirovanie, … |
| Банки | 9 | Сбер ×2, «Сбер-ВТБ» → `kak-sdelat-refinansirovanie-kreditov-v-sberbanke.html`. Альфа → `/kredity/alfa-refinansirovanie/`. Тинькофф → `/kredity/tbank-refinansirovanie/`. Остальные (Райффайзен, Росбанк, ПСБ, Газпромбанк, Возрождение) — 404 | kak-oformit-refinansirovanie-kredita-v-sberbanke, refinansirovanie-sberbank-vtb, refinansirovanie-v-alfa-banke-…, kak-proishodit-refinansirovanie-kreditov-v-tinkoff-banke, … |
| Отказы | 6 | `refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov.html` или новая статья «почему отказывают в рефинансировании» | otkazali-v-refinansirovanii-osnovnye-prichiny, top-6-prichin-…, sberbank-otkazal-…, … |
| Кредитные карты | 4 | `/karty/` (или будущая статья) | kak-provesti-refinansirovanie-kreditki, top-9-predlojenii-…-2023-gody, refinansirovanie-kreditnoi-karty-tinkoff, … |
| Автокредит | 2 | 404 | kak-i-gde-proizvesti-refinansirovanie-avtokredita, kyda-obratitsia-… |
| МФО | 2 | `/stati/kak-ne-popast-v-dolgovuyu-yamu-s-mikrozajmami/` | kak-proizvesti-refinansirovanie-mikrozaimov-mfo, razreshat-li-v-banke-refinansirovat-mikrozaim-s-prosrochkami |
| Ставка рефинансирования (= ключевая ЦБ) | 2 | 410, либо новая справочная статья, если есть спрос | stavka-refinansirovaniia-chto-eto, razmer-stavki-refinansirovaniia-v-2024-gody |
| Документы | 1 | `kak-sdelat-refinansirovanie-kreditov-v-sberbanke.html` | kakie-nyjny-dokymenty-dlia-refinansirovaniia-v-sberbanke |
| Новости 2024–2025 | 20 | **410** (самозапрет → `/stati/samozapret-na-kredity/`, период охлаждения → по `02-content-inventory.md` п.6) | nbki-… ×3, pytin-… ×3, gosdyma-… ×2, cb-… ×2, nabiyllina-…, rbk-…, ria-novosti-…, novak-…, za-2024-god-nornikel-…, grigorenko-…-samozapretit-… |
| Прочее | 3 | `bystrye-kredity-kratkosrochnye-zajmy` → `/zaimy/`. `metallicheskaya-setka-…`, `vidy-bankovskih-prodyktov` → 410 | — |

Полный список слагов воспроизводится командой: `curl "https://web.archive.org/cdx/search/cdx?url=rencredit-online.ru/credit/*&output=txt&fl=original&collapse=urlkey"` и прогоном по живому сайту.

---

## Источники

Первичные данные (2026-10-19):
- WHOIS TCI: `whois -h whois.tcinet.ru rencredit-online.ru` → `created: 2024-04-24T15:17:43Z`, `registrar: BEGET-RU`
- Wayback CDX: https://web.archive.org/cdx/search/cdx?url=rencredit-online.ru&matchType=domain ; снимки https://web.archive.org/web/20190723180953/http://rencredit-online.ru/ , /web/20200103170302/ , /web/20220314163029/ , /web/20240425061706/ , /web/20240819205943/ , /web/20260421202003/
- ИКС: https://webmaster.yandex.ru/siteinfo/?site=https://rencredit-online.ru (`"sqi":0`), https://yandex.ru/cycounter?rencredit-online.ru
- Живой сайт: https://rencredit-online.ru/robots.txt , /sitemap-index.xml , /sitemap-0.xml

Яндекс и GEO (проверены в `docs/seo/07-yandex-geo.md`, раздел «Источники»):
- IndexNow API — https://yandex.ru/support/webmaster/ru/indexnow/reference
- Алиса AI и SoV — https://yandex.ru/support/webmaster/ru/alice.md , https://yandex.ru/support/webmaster/ru/service/alice-answers.md
- Роботы Яндекса (YandexAdditional) — https://yandex.ru/support/webmaster/ru/robot-workings/check-yandex-robots
- ИКС — https://yandex.ru/support/webmaster/tic.html
- Малоценные страницы — https://yandex.ru/support/webmaster/site-indexing/low-demand.html
- Дроп-домены: риски истории — https://timeweb.com/ru/community/articles/drop-domen-ot-a-do-ya-chto-eto-zachem-i-kak-ego-kupit , https://www.reg.ru/blog/drop-domen/amp/

Внутренние:
- `/Users/deniskononov/rencredit-pilot-wt/PROJECT_BRIEF.md` §4, `legacy/rencredit/REPORT.md:7-10,56-59`
- `web/apps/rencredit/astro.config.mjs:16-31,37-40,42-50,55,60-65`; `public/.htaccess:42-48,59-270,276-277`; `src/pages/robots.txt.ts:9`; `src/layouts/BaseLayout.astro:65,90-118`; `src/lib/ui/site.ts:13`; `scripts/indexnow.mjs:48,50`
- `docs/seo-rencredit/02-content-inventory.md` п.6, `05-keyword-gap.md` п.5–6, `features/current-state.md` §2.1
