# FEATURES_PLAN: фичи, механики и интеграции rencredit-online.ru («Мерка»)

Дата: 2026-10-19 · Роль: продакт-лид · Код: `/Users/deniskononov/rencredit-pilot-wt/web/apps/rencredit` (Astro 7.3.8, Tailwind 4, GSAP, MDX, `<ClientRouter />`), workspaces `web/packages/{core,motion}` · Хостинг: Beget shared, Apache + `.htaccess`, деплой `scripts/deploy-beget.sh` (ssh/ftp), CI `deploy-rencredit.yml` только `workflow_dispatch`, cron закомментирован. PHP на тарифе есть, но на docroot rencredit не проверен: `/go.php`, `/mail.php` → 404.

Основа плана: `features/current-state.md`, `brand-engagement.md`, `competitor-features.md`, `finhelp-adapt-1.md`, `finhelp-adapt-2.md`, `news-data-automation.md`, `oss-repos-astro7.md`, `refinance-legacy.md`, 30 deep-dive `features/dive-*.md`, 119 идей finhelp (`features/finhelp_ideas.json`).
SEO-аудит (`docs/seo-rencredit/01…10-*.md`) не дублируется. Где фича и SEO-пункт пересекаются, ниже дана явная ссылка: какой трек делает и в каком PR. `SEO_PLAN.md` пока нет, поэтому согласование идёт напрямую с рекомендациями в `0*.md`.

Проверено сегодня curl: `/` 200; `/refinansirovanie/`, `/rss.xml`, `/go.php`, `/klyuchevaya-stavka/`, `/proverka-mfo/` 404; `/feed/` 301 на главную. В `src/` 0 вызовов `reachGoal`. В `src/content/news` 4 файла, последняя публикация 01.10.2026.

---

## 0. Коротко

1. **Сначала измерять, потом строить.** Целей Метрики нет, `/go/` не передаёт место клика. Каждая фича ниже зависит от `window.fkGoal` и `?p=&s=` в `/go/` (1 день). Цели в Метрике нужно создать **до деплоя фичи, которая их шлёт**: задним числом они не считаются. Создать их можно в интерфейсе или через Management API. Реестр целей (§9.1) удобно завести одним заходом, но это не блокер спринта 0 (§12.1).
2. **Три общих модуля вместо десяти разовых.**
   - `web/scripts/sync-cbr.mjs` → `packages/core/src/data/cbr/*.json`: ставка, заседания, реестр МФО, ПСК, ренкинг жалоб.
   - `packages/core/src/finance.ts` + `node --test`: аннуитет, ПСК, рефинансирование, ПДН, займ.
   - `src/scripts/goals.ts`: цели.

   На них держатся 14 из 30 фич.
3. **Ядро продукта — рефинансирование и долговая нагрузка**, а не МФО. Это тематическое наследие домена (около 89 старых URL `/credit/*`), самые дорогие выплаты (Т-Банк 5 000 ₽, ББанкрот 18 750 ₽) и прямое следствие 07 R7 и 08 R4/R5. Цепочка: хаб → калькулятор → ПДН/«антиспираль» → «почему отказали» → плашка ключевой ставки.
4. **Доверие как фича.** Данные сверки уже лежат в `offer-sources/*.json` (315 полевых записей с цитатами и URL), но на сайте не видны. Бейдж реестра ЦБ, сноски-источники и тип МФК/МКК обойдутся в 3 дня без нового JS.
5. **Жёсткие даты:**
   - 23.10 — заседание ЦБ: убрать вписанную руками «ставку на 13 октября»;
   - 12.11 — истекает 30-дневный `checkedAt`;
   - 13–14.11 — новые пределы ПСК;
   - ~10.11 — пик спроса по налогу на вклады (уплата до 01.12);
   - 18.12 — следующее заседание ЦБ;
   - 01.01.2027 — заканчивается надзорное послабление ЦБ для МФК без ЕБС. Это письмо ЦБ, о котором известно из СМИ; сама норма для МФК действует с 01.03.2026, для МКК — с 01.03.2027 (dive-C6).
6. **Сначала гигиена.** Восемь найденных в dive-ах дефектов несут риск по 38-ФЗ и YMYL (§1.2). Они чинятся за 1–1,5 дня в спринте 0, раньше любых новых фич.

---

## 1. Что уже есть и что доработать

### 1.1 Инвентарь (что работает)

| Механика | Где | Состояние | Что доработать (фича плана) |
|---|---|---|---|
| Подборщик на главной (сумма/срок/КИ → 3 талона) | `home/HomeHero.astro`, `scripts/home-picker.ts`, `home-logic.ts` | хорошо, логика общая для SSR и клиента | баг freeDays (§1.2); квиз `/podbor/` переиспользует `home-logic` |
| Витрина МФО: фильтры, 4 сортировки, состояние в URL | `Showcase.astro`, `scripts/offers-ui.ts` | хорошо для МФО | `vertical-filters` для карт, кредитов, `/debetovye-karty/`, `/rko/` |
| `CompareTable` | главная, статичный топ-5 | без сортировки | «Примерить рядом» отложено (§4) |
| `Calculator.astro` + `initCalc()` | нигде не импортируется, бренд «ФИНКОМПАС» | мёртвый код | удалить в `refi-calc` (= 08 R15) |
| Поиск `<dialog>` + `/search.json` | `scripts/chrome.ts`, `pages/search.json.ts` | 72 записи, подстрока в заголовке | `search-pagefind` |
| CTA-слоты `data-cta`, `data-cta-slot` | `components/cta/*`, `lib/cta.ts` | разметка есть, обработчика нет | `cpa-click-goals` |
| `/go/<poolId>/` | `pages/go/[offer].astro` (meta refresh) | у всех `utm_medium=compare` | `cpa-click-goals`, затем `go-php-server-log` |
| Маскот + «Наверх» (`transition:persist`) | `Mascot.astro`, `@pbn/motion/mascot` | реплики только про займы | `contextual-cta-mascot` |
| ClientRouter + ручной `ym hit` | `BaseLayout.astro` | сделано правильно | не трогать (finhelp-идею 62 «убрать роутер» не брать) |
| Cookie-полоса, Метрика после согласия | `CookieBar.astro`, `BaseLayout.astro` | хорошо (152-ФЗ) | `fkGoal` шлёт только при `loaded` |
| Обзоры офферов `/mfo|karty|kredity/<slug>/` | `pages/[dir]/[slug].astro` | факты, плюсы и минусы, юрданные | бейдж ЦБ, источники, тип МФК/МКК, жалобы ЦБ, паспорт займа, калькулятор возврата |
| Сервисные лендинги (50 офферов, 9 страниц) | `services/ServiceLanding.astro` | карточки + FAQ | фильтры только на 2 из 9, `<Fact>` в FAQ |
| Статьи 22, гайды 8, новости 4, legacy `/credit/*.html` | `ArticleView.astro`, `novosti/`, `[guide].astro`, `credit/` | ок | мобильное оглавление, «Помогло?», RSS, «Последние изменения» |
| IndexNow | `scripts/indexnow.mjs` | только вручную, ключ-файла нет | `indexnow-automate` (PR SEO-трека, 07 R3 / 10 R7) |
| Скрипты проверок | `web/scripts/check-content.mjs`, `check-links.mjs`, `check-legacy.mjs`, `scripts/check.mjs` | `check-content` не подключён ни к CI, ни к деплою | 10 R2: без этого «сборка падает на неактивной МФО» ничем не обеспечено |
| Агенты `news-writer`, `ymyl-fact-checker`; skills `news-pipeline`, `ymyl-content`, `offer-placement` | `.claude/` | есть, но конвейера нет | `news-inbox-pipeline` |

Чего нет совсем: целей Метрики, живых данных ЦБ, калькуляторов, кроме подборщика, хабов рефинансирования и ключевой ставки, RSS, OG на страницу (одна `og/default.png`), обратной связи, личного слоя, серверного учёта кликов.

### 1.2 Дефекты, найденные в dive-ах (чинить в спринте 0, до новых фич)

| # | Дефект | Риск | Где | Источник |
|---|---|---|---|---|
| D1 | `overpay()/quote()` вычитают `freeDays` из срока. У like-money, srochnodengi, vash-kredit, credit7 и denga 0% действует только на займ сроком ≤ N дней целиком. Переплата на главной занижена до 2 раз (srochnodengi 15 000 ₽ / 14 дней = 1 680 ₽, а не 840 ₽) | ст. 5 38-ФЗ, недостоверная реклама | `home-logic.ts`, `@pbn/core offers.ts` (`overpayment`, `keyCondition`) | dive-C7 |
| D2 | `OfferLogo` получает `transition:name={undefined}`: авто-имена `astro-…-N` совпадают между страницами, при мягком переходе логотип одного оффера морфится в другой. Плюс около 116 КБ HTML на главной | визуальный баг, вес | `OfferLogo.astro` | dive-offerlogo |
| D3 | В трёх долговых статьях (`kak-ne-popast-v-dolgovuyu-yamu…`, `chto-budet-pri-prosrochke-zajma`, `samozapret-na-kredity`) из-за `offerKind: mfo` показываются витрина МФО, CtaPicker, CtaSticky и «Подобрать займ» | YMYL: подталкивание к спирали | `cta.ts`, `CtaSlot.astro:10`, `ArticleView.astro` | dive-debt-antispiral, этап 0 |
| D4 | В новостях стоят `CtaCallout` и `CtaNext` с призывом взять займ, `source` в схеме необязателен, источники вторичные (Интерфакс, Банки.ру) | запрет скилла `news-pipeline`, = 10 R11/R12 | `novosti/[...slug].astro`, `content.config.ts` | dive-news-inbox |
| D5 | Реплики маскота «покажу, кто одобрит» и «займ без процентов» | ст. 5 и ч. 3 ст. 28 38-ФЗ | `@pbn/motion/mascot` lines, `BaseLayout` | dive-contextual-cta |
| D6 | `/go/` для 12 снятых офферов отвечает 200, в том числе для двух МФО, исключённых из реестра (Скела Мани, Занимательные финансы) | реклама нелегального кредитора | `go/[offer].astro` `getStaticPaths` | dive-C2 |
| D7 | Данные: у `uralsib-120` `cbrLicense=30` вместо рег. № 2275; `ageMax=100` у 12 офферов выводится как «21–100 лет»; источники `dengi-srazu` (11 полей) отвечают 404; около 41 из 315 `quote` содержат комментарии редакции | доверие, будущие гейты упадут | `content/offers/*.json`, `data/offer-sources/*.json`, `format.ts` | dive-registry, dive-provenance |
| D8 | В skill `ymyl-content` предел переплаты 130%, правильно 100% (с 01.04.2026). Нет правил 01.10.2026 (ПСК 200%) и 01.04.2027 | контент-фабрика пишет устаревшее, = 06 P1 #8, 10 R1 | `.claude/skills/ymyl-content/SKILL.md` | dive-debt, dive-C1 |

Попутно, без отдельного спринта: `Calculator.astro` и `initCalc` удаляются в рамках `refi-calc`. Пустую подборку `/zaimy-bez-foto/` (пресет `no_photo`, 0 офферов) решают 03 R1 и `C6` вместе. В политике конфиденциальности (стр. 53) сказано, что данные «нам не передаются»; править её нужно до первой цели с параметрами.

---

## 2. Топ-10 «делать сейчас»

Отбор: вердикт `do_now`, score ≥ 7, зависимостей нет или они закрываются внутри топа. Не вошедшие `do_now` (жалобы ЦБ, Pagefind, маскот, C6, C1, IndexNow) стоят в начале второй волны или в спринте 0 (§3, §9).

| # | Фича | Score | Дни | Зачем сейчас |
|---|---|---|---|---|
| 1 | `cpa-click-goals`: цели + placement/subid в `/go/` | 9 | 1 | без него эффект остальных 29 фич не измерить |
| 2 | `offerlogo-vt-fix` | 8,5 | 0,5 | реальный визуальный баг и −40% HTML главной (по gzip только −14%, 25,0 → 21,5 КБ) |
| 3 | `facts-json-build-time`: `sync-cbr` → `facts.json` + `<Fact>` | 7 | 1 | заседание ЦБ 23.10, в двух лендингах ставка вписана руками |
| 4 | `cbr-registry-gate-badge` (+ строка МФК/МКК из C6) | 7 | 1,5 (+0,25) | YMYL-доверие, страховка от исключённых МФО |
| 5 | `provenance-display`: «Откуда цифры» | 8 | 1,5 | данные уже есть, 0 КБ JS |
| 6 | `refi-hub` `/refinansirovanie/` | 8 | 1,5 | 404 на ядре домена; цель для 301 из 01 #1 |
| 7 | `refi-calc` + `packages/core/finance.ts` | 8 | 2,5 | незанятая ниша: консолидация нескольких долгов с вердиктом |
| 8 | `debt-antispiral` (этап 0 в спринте 0) | 8 | 0,5 + 2,5 | YMYL-риск D3 и дорогая выплата за банкротство |
| 9 | `psk-checker` + `/predelnaya-psk/` | 7,5 | 2,5 | окно до публикации ЦБ 13–14.11 |
| 10 | `news-inbox-pipeline` (гигиена + inbox + «Последние изменения») | 7 | 2,5 | раздел новостей стоит; протокол дня заседания |

**Итого 17,75 дня чистой разработки по оценкам dive-ов.** Скидки за общие модули нет: `finance.ts`, `sync-cbr` и `goals.ts` в оценках уже посчитаны по одному разу. С ревью, юрсверкой и правками выходит 22–25 дней (§12.2).

### 2.1 `cpa-click-goals` — 1 день
- **MVP.** В inline-скрипт Метрики в `BaseLayout` добавить одну строку `window.fkGoal = (t, p) => loaded && ym(ID, 'reachGoal', t, p)`. Отдельный `define:vars` и вписанный id не нужны.
- Новый `src/scripts/goals.ts` (около 40 строк), подключается из `main.ts`. Делегированные `click` и `auxclick` на `document`. Слот определяется через `closest('[data-cta-slot], [data-showcase], [data-cta-sticky], section[id]')`: это один селектор-список, `closest` принимает один аргумент. sid — 12 hex. Лучше: `p` отдавать в `href` уже при сборке, а в JS оставить только `s` (§12.4). `href` переписывается в `/go/<id>/?p=<slot>&s=<sid>`, уходит цель `offer_go{offer, slot, page, sid}`. Дополнительно `mascot_open`, `mascot_pick`, `picker_all`; атрибут `data-goal` остаётся заделом под будущие цели.
- `/go/[offer].astro`: meta refresh переносится в `<noscript>`. Inline-скрипт дописывает `utm_content=p`, `utm_term=s` (если `s` нет, генерирует) и `utm_campaign` = раздел из referrer. `erid` не трогает.
- В политику — одно предложение.
- **Файлы:** `layouts/BaseLayout.astro`, `scripts/goals.ts` (new), `scripts/main.ts`, `pages/go/[offer].astro`, `pages/politika-konfidencialnosti.astro`, `web/scripts/check-links.mjs`.
- **Проверка:** в `dist/go/*` появляются `?p=&s=`; цели видны в `?_ym_debug=1`; агрегат приходит в `saleads_offers.py clicks`.
- **Согласование с SEO:** одна цель вместо трёх имён. В 07 R4 она называется `offer_click`, в 08 R1 — `go_click`; канон — **`offer_go`**, аудиты сослаться на этот план.
- **Ограничения:** выборка только по визитам с согласием на cookie; «открыть в новой вкладке» из контекстного меню мимо `click`. Независимый учёт даст `go-php` (волна 2).

### 2.2 `offerlogo-vt-fix` — 0,5 дня
- **MVP.** В `OfferLogo.astro` две ветки: `{morph ? <div transition:name=…> : <div>}`. Полная версия: в `OfferCard` по умолчанию `morph=false`. Статический `transition:name` остаётся только у `size=lg` на обзоре. Кликнутой карточке имя задаётся через `style.viewTransitionName` в `astro:before-preparation`, при переходе «назад» — в `astro:before-swap`.
- **Файлы:** `OfferLogo.astro`, `OfferCard.astro`, `BaseLayout.astro`, `web/scripts/check-content.mjs`. Регресс-проверка: в `dist` нет `view-transition-name: astro-` и нет дублей `logo-*`.
- **Эффект:** главная около 177 КБ вместо 293 КБ (gzip 25,0 → 21,5 КБ).

### 2.3 `facts-json-build-time` — 1 день (до 23.10)
- **MVP.** `web/scripts/sync-cbr.mjs` (около 50 строк только на блок `--rate`; все 5 блоков из §5.1 с zip/xlsx-парсером на stdlib займут 300–500 строк; без зависимостей, по образцу `sync-pool.mjs`) собирает:
  - `keyRate {value, since}` из SOAP `KeyRateXML`;
  - `nextMeeting` из `dkp/cal_mp`;
  - `taxFree` (1 млн × максимальная ставка на 1-е число месяцев).
- Предохранители: ставка в пределах 3–30%, в истории не меньше 20 строк, в календаре есть будущее заседание. Запись атомарная.
- `facts.override.json` нужен на день решения: API отдаёт новую ставку только с даты вступления в силу, около 26.10.
- Компонент `Fact.astro` передаётся в MDX через `<Content components={{Fact}}/>` в `ServiceLanding` и `ArticleView`. Токены `{{keyRate}}` подставляются в `Faq.astro`: это единственная точка вывода FAQ и JSON-LD.
- Из `vklady.mdx` и `debetovye-karty.mdx` убрать «На 13 октября 2026…».
- **Файлы:** `web/scripts/sync-cbr.mjs` (new), `packages/core/src/data/cbr/facts.json` (+ `facts.override.json`), `packages/core/src/index.ts` (subpath-экспорт), `components/Fact.astro`, `Faq.astro`, `services/ServiceLanding.astro`, `ArticleView.astro`, 2 MDX, `scripts/check.mjs`, `.claude/skills/news-pipeline/SKILL.md`.
- **check.mjs:** ошибка, если `nextMeeting` < сегодня; warning, если `fetchedAt` старше 7 дней; regex-запрет ставки, вписанной руками в `content/`. Это же закрывает 10 R1 (изменчивые лимиты в одном источнике).

### 2.4 `cbr-registry-gate-badge` (+ C6, тип организации) — 1,75 дня
- **MVP.** В `sync-cbr.mjs` добавляется блок `list_MFO.xlsx`: `unzip -p` / `zlib.inflateRawSync`, поиск листа и колонок по тексту, ≥ 500 строк, срез не старше 3 дней. Для банков — `EnumBIC` и `CreditInfoByIntCodeXML` со сверкой ОГРН. `RegNumToIntCode` не годится: по номеру 30 он возвращает ликвидированный банк.
- Результат: закоммиченный `cbr-registry.json` (`asOf` + записи только по нашим номерам).
- `check-content.mjs`: ошибка, если оффер не `active`, если не совпал ОГРН или если снимок старше 14 дней. Warning, если домена `officialUrl` нет в реестре (4 известных: denginadom, kotozaim, nebusfinance, vashcredite).
- `getOffers()` отбрасывает неактивные офферы — вторая линия защиты.
- `RegistryBadge.astro`. На обзоре: «В реестре Банка России: МКК, рег. №, с <даты> · данные ЦБ на <asOf>» со ссылкой на foinfo. На карточке — компактная версия без ссылки. В JSON-LD добавляется `provider`.
- Из C6: `orgType()` по `/МФК|МКК/` без `\b` (в JS `\b` не работает с кириллицей) и строка «Тип организации» в «Юридических данных» (4 МФК, 18 МКК).
- **Файлы:** `web/scripts/sync-cbr.mjs`, `packages/core/src/data/cbr/mfo-registry.json`, `web/scripts/check-content.mjs`, `lib/offers.ts`, `components/RegistryBadge.astro` (new), `pages/[dir]/[slug].astro`, `OfferCard.astro`, `content/offers/uralsib-120.json` + `offer-sources/uralsib-120.json` (D7), `.github/workflows/deploy-rencredit.yml`, `scripts/deploy-beget.sh`.
- **Предусловие:** 10 R2 (подключить `check-content` к `check.mjs` и деплою) и 10 R3 (перепроверка до 12.11). Иначе с 12.11 сборка упадёт на всех `verified`. Делать в одном PR с R2, `checkedAt` до перепроверки понизить до warning.

### 2.5 `provenance-display` — 1,5 дня
- **MVP** только для обзоров с `verified` (26 офферов):
  - строка «Проверено редакцией 13 октября 2026 по документам организации»;
  - нумерованные сноски у строк таблицы «Условия» и видимый список `<ol>` «Источники условий»: цитата, отдельно `note` редакции, ссылка через `encodeURI`;
  - номер в реестре ЦБ становится ссылкой.
- Сноски строятся из `rows`, поэтому цитата о ставке не появляется там, где нет строки ПСК (ч. 3 ст. 28 38-ФЗ).
- **Чистка данных до релиза (D7):** около 41 `quote` с комментариями вынести в `note`; `dengi-srazu` пересверить или снять `verified`; `ageMax=100` выводить как «от N лет».
- Новый `web/scripts/check-sources.mjs`: 404/410 — ошибка, 401/403/таймаут — warning (антибот Т-Банка и Совкомбанка). По `/go/` и CPA-URL не ходить: каждый запрос считается кликом в Saleads.
- **Файлы:** `lib/offers.ts`, `pages/[dir]/[slug].astro`, `lib/format.ts`, `styles/global.css`, `data/offer-sources/*.json`, `web/scripts/check-sources.mjs` (new).
- **Не делаем:** popover, бейдж на карточках, «N дней назад» (на статике устаревает), журнал `history[]` до первой пересверки.
- **Связь с SEO:** из блока ссылка на `/metodologiya/` (06 P1 #9), страницу делает EEAT-трек.

### 2.6 `refi-hub` — 1,5 дня
- **MVP.** Статическая страница `src/pages/refinansirovanie/index.astro`, не guide: у guide в шаблоне крошка «Займы», а все guides попадают в меню займов. На странице:
  - маршрутизатор из 7 нативных `<details name>` с якорями, без JS; каждый сценарий ведёт на одну из 15 статей;
  - `OfferCard` Т-Банка и Альфы (не `CompareTable`: там колонки МФО);
  - таблица «что можно рефинансировать»;
  - чек-лист документов с `@media print` (это R6 из `refinance-legacy`);
  - список статей, SEO-текст и FAQ из `service-pages/refinansirovanie.mdx`.
- Мини-калькулятор хаба — это виджет `refi-calc` (§2.7), отдельный не пишем.
- В `cta.ts` CTA категории ведёт на `/refinansirovanie/`. В `site.ts` — `RESERVED_SLUGS` и подменю «Кредиты». На `/kredity/` — ссылка на хаб.
- **Файлы:** `pages/refinansirovanie/index.astro` (new), `content/service-pages/refinansirovanie.mdx` (new), `lib/cta.ts`, `lib/ui/site.ts`, `pages/kredity/index.astro`, `styles/global.css`.
- **Согласование с SEO:**
  - 03 R3 предлагает guide `kind: credit`. Делаем страницу: по данным dive-а guide ломает крошки и меню. Цели R3 (H1, текст, FAQ, витрина, блок статей) выполнены.
  - 301 со старых `/credit/*` решает 01 #1 / 07 R5, хаб — их целевая страница.
  - «Т-Банк или Альфа» (08 A8) — статья контент-трека, хаб на неё ссылается.
- Без плашки ставки до появления `<Fact>`: ставку руками не вписывать.

### 2.7 `refi-calc` + общий `finance.ts` — 2,5 дня
- **MVP.** Модуль `packages/core/src/finance.ts` на чистых функциях: `annuity`, `psk` (бисекция), `refi → {gain, payback, trap, cause}`, `pskCategory`. Тест `node --test` на эталонах:
  - 10 845,72 и 66 780,29;
  - два долга при 21,9% на 36 мес. → +21 464,71 ₽;
  - те же долги на 60 мес. → −104 864,02 ₽ («ловушка срока»);
  - страховка 45 тыс. в теле → −22 035,14 ₽.
- `psk-cbr.json` с `asOf`: 6 чисел ЦБ, позже их пишет `sync-cbr`.
- `RefiCalc.astro`, около 3 КБ gz:
  - 1–5 долгов, новое предложение с комиссией и страховкой («в тело», «отдельно», «нет»);
  - CSS-бары «было/стало», светофор с причиной, ПСК рядом со среднерыночной и предельной;
  - состояние в `#hash` с clamp, вывод через `textContent`;
  - под результатом `OfferCard` Т-Банка и Альфы, отфильтрованные по сумме.
- Страница `/refinansirovanie/kalkulyator/` (= 08 A2) с SSR-дефолтами; вставка в 5–6 MDX, не во все 16.
- Импорт только `@pbn/core/finance`: barrel тянет `pool.json` на 67 КБ.
- `Calculator.astro` и `initCalc` удалить (08 R15). Цели `refi_calc_input`, `refi_calc_result{verdict, amount_bucket}`.
- **Файлы:** `packages/core/src/finance.ts`, `finance.test.ts`, `data/cbr/psk-cbr.json`, `components/RefiCalc.astro`, `pages/refinansirovanie/kalkulyator.astro`, `ArticleView.astro`, `lib/cta.ts`, удалить `Calculator.astro`, правка `scripts/offers-ui.ts`, 5 MDX статей о рефинансировании, `web/package.json` (скрипт `test`).
- **Не в MVP:** долги МФО (Т-Банк их не рефинансирует), подсказка «ставка ЦБ 23.10». Офферы с предельной ПСК не сравниваем: с пределом сравнивается только ПСК пользователя.

### 2.8 `debt-antispiral` — 0,5 дня (этап 0) + 2,5 дня
- **Этап 0 (спринт 0, закрывает D3).** Категория `dolgi` в enum `content.config.ts` (решение владельца). В `cta.ts` — COPY и CATEGORY_KIND, исключение в `CtaSlot.astro:10`; в `ArticleView` для `dolgi` нет офферов, CtaNext и CtaSticky. Три статьи переводятся в `dolgi`.
- **MVP:**
  - `debt-rules.json` (`source`, `asOf`, `verified`);
  - в `finance.ts` функции `pdn()/pdnZone()` по порогам МПЛ (>50 и >80%) с учётом лимитов кредиток;
  - `PdnCheck.astro` (около 1,5 КБ JS);
  - `/dolgi/` с навигатором на 5 вопросов да/нет; без JS показываются все листы: каникулы, реструктуризация, МФЦ, суд, рефинансирование, снижение ПДН.
- Перенос из finhelp 4 статей (`bankrotstvo-cherez-mfc`, `bankrotstvo-fizicheskih-lic-cherez-sud`, `posledstviya-bankrotstva`, `kollektory-chto-mogut-po-zakonu`) с чисткой битых ссылок. В finhelp эти тексты больше не публиковать: дубль в сети (02 F8, 10 R9).
- **Файлы:** `content.config.ts`, `lib/cta.ts`, `cta/CtaSlot.astro`, `ArticleView.astro`, `lib/ui/site.ts`, `Footer.astro`, `data/debt-rules.json`, `packages/core/src/finance.ts`, `components/PdnCheck.astro`, `pages/dolgi/index.astro`, 3 + 4 MDX, `.claude/skills/ymyl-content/SKILL.md` (D8).
- **Блокеры:**
  - пороги каникул (ст. 6.1-2 353-ФЗ) и МФЦ (ст. 223.2 127-ФЗ) сверить на consultant.ru или pravo.gov.ru;
  - правило ПДН по кредиткам (5% от max(долг, 30% лимита)) сверить с 6579-У;
  - ББанкрот (18 750 ₽) не выводить до получения `legalName` в Saleads и юрпроверки (= 08 R14).

### 2.9 `psk-checker` — 2,5 дня (выпустить до 12.11, пересобрать после 13–14.11)
- **MVP.** Блок `sync-cbr` ПСК пишет `psk_limits.json` из xlsx ЦБ, к нему ручной `psk_categories.json`. `psk.ts` в `packages/core`: бисекция, `findCategory`, `verdict`, `limitRule` по дате; assert на 5 векторов.
- `/proverka-psk/`:
  - 3 режима ввода, SSR-пример, `#hash`;
  - вердикт по шкале «средняя / предельная»;
  - флаги: 0,8%/день, переплата 100%, «договор ≠ расчёт», «ПСК > 200%» (с вопросом о числе дорогих займов);
  - блок «Что делать»; под результатом только Деньги Сразу и ФинТерра (pskMax ≤ 200) и рефинансирование. Деньги Сразу — **только после пересверки** (D7: 11 источников отвечают 404). Если пользователь ответил «2+ дорогих займа», МФО не показываем совсем (правило §6.2).
- `/predelnaya-psk/` — таблицы ЦБ IV кв. 2026. `PskCheck` встраивается в `chto-takoe-psk`.
- `check-content.mjs` берёт лимиты из JSON вместо `z.number().max(292)` и проверяет `pskMin` (сейчас 4 warning: denga, like-money, srochnodengi, vash-kredit — сверить вручную).
- **Файлы:** `web/scripts/sync-cbr.mjs` (блок ПСК), `packages/core/src/data/cbr/psk_limits.json`, `psk_categories.json`, `packages/core/src/psk.ts` (или раздел `finance.ts`), `psk.check.mjs`, `pages/proverka-psk.astro`, `pages/predelnaya-psk.astro`, `components/PskCheck.astro`, `lib/ui/site.ts`, `check-content.mjs`, `articles/chto-takoe-psk-i-kak-ee-schitat.mdx`, `news/mfo-limit-psk-200-s-1-oktyabrya-2026.md`.
- **Отвергнуто:** строгий `superRefine` по категории (падает на 17 из 18 МФО, потому что pskMax — максимум по бренду) и бейдж «не выше предела ЦБ».
- **Блокер:** до публикации флага 200% сверить 545-ФЗ на pravo.gov.ru (этапы 01.10.2026 и 01.04.2027).

### 2.10 `news-inbox-pipeline` — 2,5 дня
- **Полдня гигиены (спринт 0, закрывает D4):**
  - `source` и `sourceName` обязательны в схеме;
  - в `novosti/[...slug].astro` убрать CTA, оставить одну нейтральную ссылку;
  - JSON-LD через `newsArticle()` из `@pbn/core` + `isBasedOn`;
  - Интерфакс и Банки.ру заменить первоисточниками;
  - сверить фразу про 100% в `mfo-limit-psk-200`.

  Это одновременно 10 R11/R12 и 01 #4 для новостей.
- **День на inbox.** `scripts/news_inbox.py` на stdlib: 8 официальных фидов, ключевые слова, стоп-лист (ОФЗ, РЕПО, аукционы), `seen.txt`, `inbox.json`, `--test`. launchd запускает его в 09:00 и 18:00, в 09:15 scheduled task Claude отбирает 0–2 темы → `news-writer` → `ymyl-fact-checker` → `draft: true`.
- **День на «Последние изменения».** Поле `category` в news и компонент `RecentChanges.astro` без JS в `Catalog`, `[guide]` и `ArticleView`.
- **Файлы:** `scripts/news_inbox.py` (new), `.claude/skills/news-pipeline/SKILL.md`, `content.config.ts`, `pages/novosti/[...slug].astro`, `components/RecentChanges.astro` (new), `Catalog.astro`, `[guide].astro`, `ArticleView.astro`, 3 новости.
- **Реализм:** 1–2 сильные новости в неделю; узкое место — вычитка человеком по 10–15 минут. Ключи Exa и Firecrawl у агента отвечают 401, `news-writer` работает на WebSearch и WebFetch.

---

## 3. Вторая волна

Порядок — по сроку и зависимостям, а не только по score. **Жирным** — `do_now`, не вошедшие в топ-10.

| Фича | Вердикт / score | Дни | Когда и почему | Зависит от |
|---|---|---|---|---|
| **`indexnow-automate`** | do_now / 7 | 0,5 | спринт 0, **одним PR с SEO-треком** (07 R3, 10 R7): URL из `dist/sitemap-0.xml`, sha1-diff, guard от noindex и тестового хоста, вызов из `deploy-beget.sh` при `MODE=deploy`. Пункт D5 в 07 про «срезанный слэш» ложный, исправить там | ключ-файл, боевой деплой |
| `key-rate-hub` `/klyuchevaya-stavka/` + KeyRatePulse + налог на вклады `#nalog` | do_next / 7 | 2,5 | **спринт 1, до ~10.11**: окно налога за 2025 год закрывается 01.12. SVG-история на сборке, 0 КБ JS для графика, около 1,5 КБ на калькулятор налога. Текст finhelp не копировать (сетевой дубль, бренд «ФинПомощь») | `facts.json` (+history, +taxFree по годам), `finance.ts` |
| **`cbr-complaints-ranking`** | do_now / 7 | 1,5 | спринт 2, после решения владельца: у 4 партнёров высокий индикатор (prostoy-vopros, berezhnyy/dengi-na-dom, ligamfo, denga). Показывать у всех офферов или ни у кого: выборочная подача — риск 38-ФЗ. Хаб `/mfo/zhaloby-v-cb/`, крошки на `/zaimy/` | бизнес-решение, `sync-cbr` (блок ренкинга) |
| **`C6-biometrics-ebs`** (хаб-статья) | do_now / 7 | 2 | спринт 3, до 01.01.2027: статья `/stati/zaimy-i-biometriya/` с таблицей дат и таймером, переписать `zaimy-bez-foto.mdx`, убрать пресет `no_photo` (вместе с 03 R1). Фильтр «без биометрии» отвергнут (§4) | сверка 41-ФЗ / 115-ФЗ |
| **`C1-loan-passport`** | do_now / 7 | 2,5 | спринт 1–2, **вместе с перепроверкой до 12.11** (10 R3): новые поля `receive/repay/prolongation/penalty/identification/documents` в `offer-sources`, блок «Как получить и вернуть займ» + FAQ, 10 офферов / 7 комплектов документов | перепроверка, D8 |
| **`search-pagefind`** | do_now / 6,5 | 0,5 + 1 | спринт 3. Шаг 1 без зависимостей: новости и 50 сервисов в `search.json`, синонимы `search-synonyms.ts`, токены по началу слова, ARIA, цели `search_query/search_empty`. Шаг 2: Pagefind в `astro:build:done`, `data-pagefind-body` только без noindex, `data-pagefind-ignore` на витринах и условиях | `fkGoal`; npm install делает человек |
| **`contextual-cta-mascot`** | do_now / 7 | 1,5 | спринт 3 (реплики D5 — в спринте 0): `Topic` в `cta.ts`, CTA шапки и маскот по разделу, приветствие не тратится на скрытом маскоте, `stickyCta` в статьях. Перед правкой Playwright 375/768/1440 | цели `hdr_cta`, тексты согласовать (38-ФЗ) |
| `go-php-server-log` | do_next / 6 | 1,5 | спринт 3: сначала smoke PHP на docroot, потом rewrite в `.htaccess`. `data-astro-prefetch="false"` на CTA **до** включения rewrite, иначе hover-prefetch накрутит клики Saleads. Лог CSV вне docroot без IP. `saleads_offers.py reconcile` | `cpa-click-goals`, PHP smoke |
| `page-feedback-mobile-toc` | do_next / 6 | 1,5 | спринт 3: `<details>` с оглавлением на мобиле, scroll-spy (класс `is-active` уже есть в CSS, но не ставится), `Helpful.astro` с позами маскота. `report.php` в v2 (нет контактного email) | `fkGoal` |
| `C7-offer-page-calculator` | do_next / 6 | 1 | спринт 3: `ReturnCalc.astro` на 17 обзорах МФО; льгота считается консервативно, срок ≤ 365 | **D1 исправлен** |
| `return-channels-rss-og` (часть 1) | do_next / 6 | 0,75 | спринт 4: `rss.xml.ts` без зависимостей, 301 `/feed/` и `?feed=rss2` → `/rss.xml`, `ShareBar` (navigator.share, TG, VK, копировать) | — |
| `refusal-ki-wizard` | do_next / 6,5 | 2 | спринт 4: одна форма, `refusal-rules.ts` с `diagnose()`, `bki.json` (6 БКИ из госреестра), статья с `legacyUrl` для старого URL отказов (сейчас 404), порт 3 статей finhelp | хаб рефинансирования |
| `moya-merka-personal-layer` | do_next / 6 | 2 | спринт 4: `client-store.ts` (`mk:v1`, try/catch), ReturnPrompt «Как прошло в X?», понижение офферов того же юрлица, «Недавно смотрели», кнопка «Забыть». `/primerka/` в MVP не входит | `cpa-click-goals`, правка политики, очередь нижних плашек |
| `vertical-filters` | do_next / 6 | 2 | спринт 4: чип только если 0 < n < total; у карт сортировки «дольше без %» и «ниже ПСК»; фильтр только на `/debetovye-karty/` и `/rko/`; `svc-filter.ts`; Clean-param `f/sort/view` (с SEO 01 #6) | `fkGoal` |
| `calc-pages-credit-loan-deposit` | do_next / 6 | 3 | спринт 4–5: `/zaimy/kalkulyator/` (просрочка, потолок 100%, `.ics`) и `/kredity/kalkulyator/` (= 08 A3, досрочка `#dosrochno`). Вклад — later | `finance.ts`, D1, статья `dosrochnoe-pogashenie` снята с draft |
| `monthly-changes-calendar` | do_next / 5 | 1,5 | первый выпуск 20–25.12 («с 1 января 2027»). Ноябрьский не делать. Коллекция `changes.json`, `/kalendar-izmenenij/` + `.ics` (webcal) | `news-inbox`, `ics.ts` из calc-pages |
| `proverka-mfo-blacklist` | do_next / 6,5 | 2,5 | спринт 5: шарды `public/data/trust/*` из `black-list-json` + реестра, страница `/proverka-mfo/`, `check-trust.mjs` с 10 кейсами. Спрос ниже заявленного, топ держит cbr.ru | `sync-cbr` (реестр) |
| `C2-repay-and-removed-mfo` (A + C) | do_next / 6 | 2,5 | спринт 5, **после решения по домену** (06 P0 #1, 07 R2): `/mfo/[slug]/kak-pogasit/` для 8 МФО со спросом; `/zakrytye-mfo/` из исключений `list_MFO.xlsx`. Фикс `/go/` снятых офферов (D6) — в спринте 0 | C1-данные `repay`, `sync-cbr` |
| `snimem-merku-quiz` `/podbor/` | do_next / 6 | 2 | спринт 5: дерево 3–4 шагов, ветка «2+ займов открыто» → без МФО. Ветку займов квиз почти не улучшает (у 22 МФО 3 разные ставки) | рефи-хаб, `PdnCheck`, цели |
| `return-channels-rss-og` (часть 2) | do_next | 1,5–2 | когда новостей 2+ в неделю: OG на страницу (sharp + Onest TTF или `astro-og-canvas`), `announce.php` на cron Beget → Telegram + MAX | поток новостей, PHP, решение по домену для Дзена |
| `rum-web-vitals` | later / 4 | 1 | по триггеру: ≥ 100 визитов в сутки, выкладка `go.php` или решение по GSAP. Нулевой шаг — ключ PSI/CrUX | PHP smoke |

---

## 4. Отвергнутое и почему

| Что | Почему нет | Вернуться, если |
|---|---|---|
| Страницы статуса 12 снятых МФО вместо 301 (C2-B) | трафика на этих URL не было (офферы сняты 13.10, сайт запущен 17.10), риск самозванства | — |
| «Примерить рядом» `/primerka/` (C4, E7-часть) | у 22 МФО 3 разные ставки, `approvalPct=0`: сравнивать нечего | в пуле появятся различимые офферы |
| «Мерка-балл», рейтинг МФО (C5) | без опубликованной методики и журнала изменений — риск 38-ФЗ («лучший») | после `/metodologiya/` и первой пересверки |
| «Одобрение высокое / 94%», шансы одобрения в квизе и мастере | данных по заявкам нет, это маркетинг МФО и риск 38-ФЗ | — |
| Публичный агрегат «N из M помогло» | нужен токен Метрики в CI, малая выборка, на МФО выглядит как `aggregateRating` | — |
| Фильтр «можно без биометрии сейчас» (C6) | до 01.01.2027 без ЕБС де-факто выдают все, с 01.03.2027 ЕБС нужна всем | — |
| Строгий `superRefine` pskMax по категории ЦБ, бейдж «не выше предела» | падает на 17 из 18 МФО (pskMax — максимум по бренду) | ПСК по продуктам, а не по брендам |
| Ноябрьский выпуск «Что изменится с 1-го» и ежемесячный ритм | к 01.11 изменений, закреплённых актами, нет; реальный хвост — 4–6 дат в год | — |
| 52 еженедельные новости по чёрному списку | тонкий автоконтент; вместо них ежемесячный дайджест `draft: true` | — |
| Перепечатка СМИ, лента чужих новостей, автопостинг без ревью | авторское право (Интерфакс), «малоценный контент», YMYL | — |
| Курсы валют, `/kurs-valyut/`, PHP-патчер данных | колдунщик Яндекса, нет связи с CPA, размывание бренда | появятся валютные вклады или карты |
| Платёжная форма «оплатить займ», анкета с ПД, подбор с регистрацией | платёжный агент, оператор ПД, статус финплатформы | — |
| Городские страницы займов, pSEO-матрицы X vs Y без спроса | шаблонные страницы, риск дорвея (это SEO-трек) | спрос в Wordstat |
| UGC-отзывы, комментарии (remark42), опросы, «истории читателей» | без трафика и модерации получается фейковый или пустой social proof | 1–2 тыс. визитов в сутки |
| AI-ассистент, разбор договора | галлюцинации в YMYL, LLM-шлюз | — |
| Email-рассылки, web push, MAX-бот как продукт | нет трафика, контур 152-ФЗ и ст. 18 38-ФЗ | после RSS и каналов |
| A/B (GrowthBook, Varioqub) | меньше 1 тыс. визитов в сутки; закладка — placement/subid | трафик |
| Калькулятор вклада отдельной страницей | налог уже в `#nalog` хаба ставки, в выдаче одни банки | — |
| Шеринг результата калькулятора как картинки, лид-гейт «email за результат» | хватает `#hash`-ссылки; гейт портит ПФ | — |
| Тёмная тема | бренд на светлом шафране, ценность низкая | — |
| Убрать ClientRouter (finhelp-идея 62) | у rencredit роутер работает правильно (`ym hit`, consent, persist маскота) | INP > 200 мс по RUM |
| ФССП-проверка | API 410, только deep-link | — |
| Копирование текстов finhelp (ключевая ставка, банкротство) с сохранением в finhelp | сетевой дубль (02 F8, 10 R9): переносить с закреплением темы за rencredit | — |
| Библиотеки — см. §7 «не брать» | | |

---

## 5. Новости и живые данные — архитектура

### 5.1 Схема

```
(локально / launchd на Mac владельца; cbr.ru из GitHub Actions не проверен)

web/scripts/sync-cbr.mjs  (Node stdlib, 0 зависимостей, паттерн sync-pool.mjs)
  ├─ --rate      KeyRateXML (SOAP) + dkp/cal_mp  → cbr/facts.json {keyRate, history[], nextMeeting, taxFree{2024,2025,2026}}
  ├─ --registry  list_MFO.xlsx (+ EnumBIC/CreditInfoByIntCodeXML для банков) → cbr/mfo-registry.json (наши номера + asOf)
  ├─ --psk       statistics/bank_sector/psk/*_mfo.xlsx, *_ko.xlsx → cbr/psk_limits.json
  ├─ --complaints microfinance/rankings_mfo/ (HTML table.data) → cbr/complaints.json (+ дословная оговорка ЦБ)
  └─ --trust     black-list-json + list_MFO.xlsx → public/data/trust/* (шарды, gitignored) + trust-meta.json (коммит)
     каждый блок: валидация (границы, ≥N строк, свежесть) → tmp → rename; при сбое падает, прошлое значение остаётся
     facts.override.json — ручная правка на день решения ЦБ
          ↓  коммит JSON (каждое изменение цифры видно в git diff — это YMYL-ревью)
web/packages/core/src/data/cbr/*.json   ← общий для сети (finhelp и др.)
          ↓
Astro build: <Fact k="keyRate"/>, {{keyRate}} в FAQ, RegistryBadge, CbrComplaints, PskCheck, KeyRatePulse
check-content.mjs / check.mjs: гейты (оффер active, ОГРН, pskMin vs предел, nextMeeting ≥ сегодня, fetchedAt ≤ 7 дн.)

scripts/news_inbox.py  (Python stdlib, как site_pipeline)
  8 официальных фидов: cbr eventrss + RssPress, Минфин mod=news (CC BY 4.0), government.ru, ФНС, consultant fd/hotdocs
  → dedup seen.txt → keyword + стоп-лист → inbox.json
          ↓ scheduled task Claude 09:15
news-writer → content/news/YYYY-MM-DD-slug.md (draft:true, source обязателен) → ymyl-fact-checker → человек снимает draft
          ↓
deploy-beget.sh --build → indexnow.mjs (только изменённые URL) → rss.xml → (позже) announce.php → Telegram + MAX
```

Решения:
- **Один `sync-cbr.mjs`**, а не три скрипта (`sync-cbr`, `sync-cbr-complaints`, `sync-psk`, как предлагали dive-ы). Общий zip/xlsx-парсер и общие предохранители. Каждый блок запускается флагом, поэтому падение одного источника не блокирует остальные.
- **Данные ЦБ лежат в `packages/core/src/data/cbr/`**, а не в `apps/rencredit/src/data/` (dive-ы расходились). Это сетевой актив. Связь «наш оффер ↔ запись ЦБ» строится при сборке в `lib/offers.ts`.
- **Node для данных сборки, Python для inbox.** Inbox — инструмент агента вне сборки, рядом с `site_pipeline`. `fetch_facts.py` из `news-data-automation.md` заменён на `sync-cbr.mjs`, чтобы не держать два парсера ЦБ.
- **Без клиентского JS для цифр.** Ставка меняется 8 раз в год, ПСК — раз в квартал. Цифры должны быть в HTML для Яндекса.
- **Без новых npm-зависимостей:** RSS около 30 строк по образцу `search.json.ts`, `.ics` около 30 строк по RFC 5545.

### 5.2 Регламент

| Когда (МСК) | Что | Человек |
|---|---|---|
| ежедневно 09:00, 18:00 | `news_inbox.py` → `inbox.json` (0–5 кандидатов) | — |
| ежедневно 09:15 | агент отбирает 0–2 темы → черновики | вычитка 10–15 мин |
| пн 06:00 | `sync-cbr --registry --trust`, при diff коммит в ветку | merge |
| **день заседания ЦБ** (23.10, 18.12.2026; 12.02, 19.03, 30.04.2027…) | 13:30 релиз → `facts.override.json` → `sync-cbr --rate` → черновик новости → fact-check → `deploy-beget.sh --build` → IndexNow. Цель — выкладка до 15:00, иначе вечером без гонки | на связи 13:30–14:45 |
| ~13–15.11, ~15.02, ~15.05, ~15.08 | `sync-cbr --psk`: сборка предупреждает по `pskMin` выше предела | правка офферов |
| раз в год, по пресс-релизу ЦБ (первый ренкинг вышел 13.07.2026, следующий ожидается ~07.2027) | `sync-cbr --complaints` | просмотр |
| ежемесячно (рабочий день до 25-го) | дайджест чёрного списка `draft: true` | просмотр |
| 20–25.12, затем перед 01.03 / 01.04 / 01.10 | выпуск «Что изменится с 1-го» + строки в `changes.json` | сверка актов на pravo.gov.ru |
| каждые 30 дней по офферу (ротация 2–3 в день) | перепроверка `offer-sources` (10 R3), заодно поля паспорта C1 | редакция |

Автодеплоя нет, и это осознанно. Статика устаревает между деплоями, поэтому на каждом блоке с живыми данными стоит дата «данные ЦБ на …». Ежедневная пересборка через cron на Beget — после 10 R10 (отложенная публикация) и решения по домену.

### 5.3 23.10.2026 — первый боевой прогон (до хаба)
До 22.10 нужны `facts.json`, `<Fact>` в `vklady.mdx`/`debetovye-karty.mdx`/FAQ и шаблон новости «ЦБ сохранил/изменил ставку». Хаб `/klyuchevaya-stavka/` к этой дате не успеть, поэтому новость ссылается на `/vklady/` и статьи рефинансирования. Прогноз в тексте не даём.

---

## 6. Механики вокруг рефинансирования

### 6.1 Воронка

```
Вход: 14 статей refinansirovanie (+ 301 со старых /credit/* по 01 #1)  ·  /kredity/  ·  KeyRatePulse
        ↓
/refinansirovanie/ (хаб, 7 сценариев <details>, без JS)
   ├─ «Есть 1–5 кредитов/кредиток»  → /refinansirovanie/kalkulyator/ (RefiCalc: выгода, окупаемость, «ловушка срока», ПСК vs ЦБ)
   │                                    → OfferCard Т-Банк (5 000 ₽) / Альфа (1 750 ₽), фильтр по сумме, AdMark, ПСК
   ├─ «Платёж > половины дохода»    → PdnCheck (ПДН, зоны МПЛ >50/>80%) → /dolgi/ навигатор
   │                                    → каникулы / реструктуризация / МФЦ / суд / снизить ПДН  (без офферов МФО)
   │                                    → (после юрпроверки) ББанкрот 18 750 ₽
   ├─ «Отказали»                    → RefusalWizard (diagnose → stop/fix/ok; при stop без МФО) → КИ бесплатно, самозапрет
   ├─ «Долги в МФО»                 → /dolgi/ + статьи (Т-Банк МФО не рефинансирует — не обещать)
   ├─ «Ставка ЦБ — ждать или сейчас?» → /klyuchevaya-stavka/ (факты, без прогнозов)
   ├─ «Т-Банк или Альфа»            → статья 08 A8 (контент-трек)
   └─ «Ипотека»                     → статья-хаб 01 #2 (контент-трек; калькулятор R9 — later)
Чек-лист документов: на хабе, @media print (цель doc_print)
```

### 6.2 Что из `refinance-legacy.md` (R1–R11) куда попало

| R | Механика | Статус в плане |
|---|---|---|
| R1 | калькулятор консолидации | топ-10 #7 |
| R2 | хаб с маршрутизатором | топ-10 #6 |
| R3 | ПДН + «антиспираль» | топ-10 #8 |
| R4 | план погашения: лавина / снежный ком + `.ics` | later: после данных `refi_calc_*`; `.ics` переиспользуется из calc-pages |
| R5 | «почему отказали в рефинансировании» | волна 2 (`refusal-ki-wizard`) |
| R6 | чек-лист документов, шаблоны заявлений | чек-лист — внутри хаба; шаблоны заявлений в БКИ — later |
| R7 | навигатор «рефинансирование / каникулы / банкротство» | внутри `/dolgi/` (#8) |
| R8 | «ставка рефинансирования ЦБ сегодня» | `key-rate-hub` + KeyRatePulse (волна 2, спринт 1); старые URL `stavka-refinansirovaniia-*` решает SEO (07: 410 или справка) |
| R9 | рефинансирование ипотеки | статья (01 #2); калькулятор — later, ипотечных офферов нет |
| R10 | сценарные посадочные с предзаполненным калькулятором | later: `#hash` калькулятора это позволяет, посадочные по Wordstat — SEO-трек |
| R11 | сравнение программ банков с датой сверки | позже, при ≥ 4 офферах рефинансирования (сейчас 2) |

Правила для всех R:
- один `finance.ts` и один набор эталонов;
- пороги в JSON с `source/asOf`, на экране дата;
- дисклеймер «расчёт ориентировочный»;
- без «одобрят» и «спишем долги»;
- уязвимой аудитории (ПДН > 80%, 2+ займа, просрочка) займы МФО не показываются;
- бренд «Ренессанс» нигде не используется (06, 10 R18).

---

## 7. Библиотеки

### 7.1 Брать

| Что | Ссылка | Лицензия | Зачем | Когда |
|---|---|---|---|---|
| Pagefind 1.5.2 (Node API) | https://github.com/Pagefind/pagefind | MIT | полнотекстовый поиск с русским стеммингом, индекс в `astro:build:done` | волна 2, шаг 2 поиска. `astro-pagefind` не нужен |
| web-vitals 6.2.3 | https://github.com/GoogleChrome/web-vitals | Apache-2.0 | RUM LCP/INP/CLS, `reportSoftNavs` | по триггеру (later) |
| schema-dts 2.1.0 (devDependency) | https://github.com/google/schema-dts | Apache-2.0 | типы для `@pbn/core schema.ts` | вместе с 01 #4 (SEO-трек), не блокер фич |
| sharp (явно в `package.json`) + шрифт Onest TTF | https://github.com/lovell/sharp; Onest — https://fonts.google.com/specimen/Onest (woff2 уже в `@fontsource-variable/onest`, TTF положить в репо) | Apache-2.0 / OFL-1.1 | OG-картинки на страницу (уже используется в `gen-assets.mjs`, но не объявлен) | волна 2, каналы, часть 2 |
| astro-og-canvas 0.13.2 (альтернатива) | https://github.com/delucis/astro-og-canvas | MIT (npm) | OG с точной типографикой, peer Astro ^7 | только если sharp+SVG не устроит |
| GSAP + Flip (уже стоят) | https://gsap.com | стандартная лицензия GSAP (бесплатна) | анимации калькуляторов, `flipUpdate` в фильтрах | — |

Внешние API (без ключей, кроме Saleads):

| Источник | Что берём |
|---|---|
| ЦБ, SOAP `DailyInfo.asmx` (`KeyRateXML`) | ключевая ставка и её история |
| ЦБ, `dkp/cal_mp` | календарь заседаний |
| ЦБ, `list_MFO.xlsx` | реестр МФО |
| ЦБ, `CreditOrgInfo.asmx` | данные банков |
| ЦБ, `statistics/bank_sector/psk/` | среднерыночная и предельная ПСК |
| ЦБ, `microfinance/rankings_mfo/` | ренкинг жалоб |
| ЦБ, `inside/warning-list/black-list-json` | чёрный список |
| ЦБ, RSS `eventrss` / `RssPress` | официальные новости |
| Минфин (CC BY 4.0), government.ru, consultant.ru fd, pravo.gov.ru | новости и сверка реквизитов актов |
| Яндекс IndexNow, Метрика `reachGoal` | индексация и цели |
| Saleads `GET /api/v1/click` | сверка кликов |
| Telegram Bot API, MAX `platform-api2.max.ru` | постинг (позже) |

### 7.2 Не брать

| Что | Почему |
|---|---|
| `@orama/plugin-astro` 3.1.18 | peer `astro ^2.0.4`, `npm install` падает с ERESOLVE |
| `astro-indexnow` 2.3.10 | пингует на этапе build, то есть до выкладки и на тестовом поддомене |
| `@astrojs/partytown` | Метрика и так async и после согласия; ломает связку с ClientRouter |
| `security.csp` Astro | несовместим с ClientRouter |
| `astro-seo-schema`, `astro-seo`, `astro-compress` | дублируют `jsonLdGraph`, `compressHTML` и gzip |
| `@astrojs/rss` | для ~30 записей хватает 30 строк эндпоинта |
| npm `ics` | генератор по RFC 5545 — около 30 строк |
| RSSHub (AGPL, Node-сервер) | не встанет на shared-хостинг |
| uPlot (нет релизов 1,5 года), frappe-charts v2 (RC), Chart.js | хватит CSS-баров и SVG на сборке |
| tablesort | `sortProducts()` уже есть в `@pbn/core` |
| GrowthBook, Umami, Plausible, Matomo | трафика нет; Plausible требует ClickHouse; Umami — только на VPS для всей сети |
| lychee и другие линк-чекеры по `/go/` и CPA-URL | каждый запрос — клик в Saleads, риск фрод-флага |
| `cbrapi` (pandas), `apimoex` | тяжело или вне фокуса; хватает stdlib |

Обновление `astro` 7.3.8 → 7.4.1 — отдельной задачей: у `@astrojs/mdx` 8.1 новый peer. В фичи не смешивать.

---

## 8. Матрица влияния

Шкала 0–3. «ПФ» — поведенческие факторы и вовлечение. «Мон.» — CPA-доход или его измеримость. «Риск↓» — снижение юридического и YMYL-риска.

| Фича | SEO | ПФ | Мон. | Риск↓ | Дни | Ключевая зависимость |
|---|---|---|---|---|---|---|
| Гигиена D1–D8 | 1 | 1 | 1 | **3** | 1,5 | — |
| cpa-click-goals | 0 | 0 | **3** | 0 | 1 | цели в Метрике |
| offerlogo-vt-fix | 1 | 2 | 0 | 0 | 0,5 | — |
| facts-json | 1 | 0 | 0 | **3** | 1 | — |
| registry-gate + МФК/МКК | 1 | 1 | 1 | **3** | 1,75 | 10 R2/R3 |
| provenance-display | 2 | 1 | 1 | **3** | 1,5 | чистка данных |
| refi-hub | **3** | 2 | **3** | 1 | 1,5 | — |
| refi-calc + finance.ts | 2 | **3** | **3** | 1 | 2,5 | — |
| debt-antispiral | 2 | **3** | 2 | **3** | 3 | enum `dolgi`, юрсверка |
| psk-checker | 2 | 2 | 1 | 2 | 2,5 | сверка 545-ФЗ |
| news-inbox | 2 | 1 | 0 | 2 | 2,5 | вычитка человеком |
| indexnow | 2 | 0 | 0 | 0 | 0,5 | SEO-PR |
| key-rate-hub | **3** | 2 | 1 | 1 | 2,5 | facts.json |
| cbr-complaints | 2 | 1 | −1…0 | 2 | 1,5 | бизнес-решение |
| C6 биометрия | 2 | 1 | 1 | 2 | 2 | сверка закона |
| C1 паспорт займа | 2 | 2 | 1 | 2 | 2,5 | перепроверка |
| search-pagefind | 0 | 2 | 1 | 0 | 1,5 | npm (человек) |
| contextual-cta-mascot | 0 | 2 | 2 | 1 | 1,5 | цели |
| go-php | 0 | 0 | **3** | 0 | 1,5 | PHP smoke |
| page-feedback-toc | 1 | 2 | 0 | 1 | 1,5 | цели |
| C7 калькулятор на обзоре | 0 | 2 | 2 | 1 | 1 | D1 |
| refusal-ki-wizard | 2 | 2 | 1 | 1 | 2 | хаб |
| moya-merka | 0 | 2 | 2 | 0 | 2 | цели, политика |
| vertical-filters | 0 | 2 | 2 | 0 | 2 | — |
| calc-pages | 2 | 2 | 2 | 1 | 3 | finance.ts |
| monthly-changes | 1 | 1 | 0 | 1 | 1,5 | news |
| proverka-mfo | 1 | 1 | 1 | 2 | 2,5 | sync-cbr |
| C2 погашение + закрытые МФО | 2 | 1 | 1 | 1 | 2,5 | решение по домену |
| quiz `/podbor/` | 0 | 2 | 2 | 0 | 2 | хаб, PdnCheck |
| RSS + share / OG + каналы | 1 | 1 | 0 | 0 | 0,75 / 2 | поток новостей |
| RUM | 0 | 0 | 0 | 0 | 1 | трафик |

Вывод: лучшее соотношение «эффект на день» у гигиены, целей, facts и связки рефинансирования (хаб, калькулятор, «антиспираль»). Хуже всего — RUM, квиз и каналы до появления трафика и потока новостей.

---

## 9. Спринты

Два потока. **Разработка** — агент или разработчик, с ревью человеком. **Редакция и данные** — перепроверка офферов, тексты, юрсверка. Даты рабочие.

### 9.1 Спринт 0 — 20–22.10 (до заседания ЦБ 23.10), 3 рабочих дня (вт–чт) при объёме 4,5 дня, урезанный вариант в §12.1
Разработка:
1. `cpa-click-goals` (1 д).
2. `offerlogo-vt-fix` (0,5 д).
3. `facts-json` (1 д) + шаблон новости о решении ЦБ.
4. Гигиена (1,5 д): D1 freeDays на главной, D3 этап 0 `dolgi`, D4 новости, D5 реплики маскота, D6 `/go/` снятых офферов, D7 `uralsib` и `ageMax`.
5. `indexnow-automate` в PR SEO-трека (0,5 д).

Владелец, один раз (цели задним числом не считаются):
- создать в Метрике 109623857 весь реестр целей: `offer_go`, `mascot_open`, `mascot_pick`, `picker_all`, `hdr_cta`, `search_query`, `search_empty`, `refi_calc_input`, `refi_calc_result`, `pdn_result`, `nav_leaf`, `doc_print`, `psk_check`, `page_helpful`, `page_helpful_reason`, `refusal_diag`, `mfo_answer`, `quiz_finish`, `share`, `ics_download`, `calc_result`, `recent_changes_click` (22 из лимита 200);
- решить enum `dolgi` и правку политики конфиденциальности.

Редакция:
- D8 (130% → 100% в `ymyl-content`);
- старт ротации перепроверки офферов: 2–3 в день, срок 12.11;
- `dengi-srazu`.

23.10: протокол дня заседания (§5.2).

### 9.2 Спринт 1 — 26.10–06.11, ~9 дней
- Блок доверия: `cbr-registry-gate-badge` + МФК/МКК + `provenance-display` (3,25 д), одним PR с 10 R2. Подключить `check-content` к `check.mjs` и деплою.
- `refi-hub` (1,5 д).
- `finance.ts` + `refi-calc` (2,5 д).
- `key-rate-hub` + `#nalog` (2,5 д), выпустить до 10.11.

Редакция: перепроверка, поля паспорта C1 по 10 офферам, юрсверка порогов для `debt-rules.json`.

### 9.3 Спринт 2 — 09.11–20.11, ~9,5 дня
- `psk-checker` + `/predelnaya-psk/` (2,5 д): выпуск 12.11, пересборка после публикации ЦБ 13–14.11.
- `debt-antispiral` MVP (2,5 д) + перенос 4 статей finhelp.
- `news-inbox-pipeline`: inbox и «Последние изменения» (2 д).
- `C1-loan-passport`, код (1 д; данные собраны в спринте 1).
- `cbr-complaints-ranking` (1,5 д), если решение владельца принято; иначе сдвигается.

### 9.4 Спринт 3 — 23.11–04.12, ~9 дней
- `C6` хаб-статья + `zaimy-bez-foto` (2 д).
- `search-pagefind`, шаги 1–2 (1,5 д).
- `contextual-cta-mascot` (1,5 д).
- `page-feedback-mobile-toc` (1,5 д).
- `go-php-server-log` (1,5 д): smoke PHP → prefetch-off → rewrite.
- `C7` (1 д).

### 9.5 Спринт 4 — 07.12–18.12, ~9 дней (+ заседание ЦБ 18.12)
- RSS + ShareBar (0,75 д).
- `refusal-ki-wizard` (2 д).
- `moya-merka-personal-layer` (2 д).
- `vertical-filters` (2 д).
- `calc-pages`, часть «займ» (1,5 д).

Редакция: первый выпуск «Что изменится с 1 января 2027» (20–25.12) + `monthly-changes-calendar` (1,5 д разработки, можно в начале спринта 5).

### 9.6 Спринт 5 — январь 2027
- `calc-pages`, часть «кредит / досрочка» (1,5 д).
- `proverka-mfo-blacklist` (2,5 д).
- `C2` A + C (2,5 д), только после решения по домену.
- `snimem-merku-quiz` (2 д).
- OG + `announce.php` (2 д), если новостей 2+ в неделю.
- `rum-web-vitals` по триггеру.

Ретро после спринта 2: по `offer_go{slot}` и `refi_calc_*` пересобрать приоритеты волны 2. Например, если калькулятор не даёт кликов, квиз и C7 откладываются.

---

## 10. Риски

| Риск | Вероятность / вред | Что делаем |
|---|---|---|
| **Решение по домену** (06 P0 #1, 07 R2: переезд на нейтральный домен в ближайшие 2–4 недели) | высокая / высокий для сроков волны 2 (§12.3) | решение — задача владельца в спринте 1; всё сетевое пишем в `packages/core`; данные в JSON; фичи без привязки к домену. Брендовые страницы «как погасить в <МФО>» (C2), Дзен и каналы — только после решения |
| Трафика почти нет (ИКС 0, новый движок с 17.10) | факт / эффект не виден месяцами | цели ставим сразу; базовые значения снимаем до каждого деплоя; ретро по данным, а не по ощущениям |
| 38-ФЗ: реплики, «0%», выборочная подача жалоб, ПСК без цитаты | средняя / высокий | `AdMark` + erid на каждой CTA (06 P0 #5–6); жалобы — у всех офферов; льгота считается консервативно (D1); тексты маскота и квиза согласовывает владелец |
| YMYL: ошибка в формуле или пороге | средняя / высокий | эталоны `node --test`; пороги с `source/asOf/verified`; дисклеймер; юрсверка 545-ФЗ, 41-ФЗ/115-ФЗ, 353-ФЗ ст. 6.1-2, 127-ФЗ ст. 223.2, 6579-У до публикации |
| Устаревание статики без автодеплоя | высокая / средний | дата «данные на …» на каждом блоке; warning сборки по `fetchedAt` и `asOf`; регламент §5.2; ручной деплой в дни ЦБ |
| cbr.ru недоступен с GitHub-раннеров | неизвестно | sync только локально, JSON коммитится, `sync || true` в CI |
| Вёрстка ЦБ (cal_mp, ренкинг, ссылки на xlsx) меняется | средняя | скрипт падает громко, прошлое значение остаётся |
| `check-content` в CI уронит сборку 12.11 (`checkedAt` 30 дней) | высокая, если не перепроверить | ротация перепроверки с 20.10; до неё `checkedAt` — warning |
| Выборка Метрики смещена (только с согласием) | факт | `utm_content/utm_term` в Saleads не зависят от cookie; `go.php` даёт серверный учёт |
| Prefetch ClientRouter накручивает клики после `go.php` | высокая при rewrite | `data-astro-prefetch="false"` на CTA до rewrite; `Sec-Purpose: prefetch` → 204 |
| PHP не исполняется на docroot | неизвестно | smoke в два шага до rewrite; статический `/go/` остаётся фолбэком |
| Узкое место — человек (вычитка новостей, решения, юрсверка) | высокая | 1–2 новости в неделю, а не 5; черновики не копятся (лимит 5 непросмотренных) |
| Партнёры с плохим ренкингом ЦБ уронят CTR | средняя | осознанное бизнес-решение; честность важнее для YMYL и доверия |
| Каннибализация и сетевые дубли при переносе finhelp | средняя | закрепить тему за сайтом; `check-overlap.mjs` (10 R9) |
| Конфликт параллельных агентов в одних файлах (`[dir]/[slug].astro`, `ArticleView`, `cta.ts`, `BaseLayout`) | высокая | один PR на блок; блок доверия — один PR; SEO-правки JSON-LD (01 #4) и provenance в `[dir]/[slug]` — последовательно |

---

## 11. Что переиспользовать в других сайтах сети

| Модуль | Где живёт | Для finhelp-ru (Astro 4) и новых сайтов |
|---|---|---|
| `finance.ts` (аннуитет, ПСК, рефинансирование, ПДН, займ с просрочкой) + эталоны | `packages/core/src/finance.ts` | чистый TS без Astro — работает как есть; калькуляторы finhelp перевести на него |
| Данные ЦБ: `facts.json`, `psk_limits.json`, `mfo-registry`, `complaints.json`, trust-шарды | `packages/core/src/data/cbr/`, `web/scripts/sync-cbr.mjs` | один sync на сеть; каждый сайт берёт JSON при сборке |
| `<Fact>` + токены `{{keyRate}}` в FAQ | компонент + хелпер в core | портировать компонент (Astro 4 совместим по синтаксису) |
| `goals.ts` + однострочный `fkGoal` после согласия; реестр целей §9.1 | `apps/*/src/scripts` | копия ~40 строк + одинаковые имена целей, чтобы сравнивать сайты |
| `/go/` с `?p=&s=` → utm и `go.php.ts` из `outboundUrl()` | эндпоинт сборки | у finhelp уже есть dive go-php — объединить в один генератор в core |
| `RegistryBadge`, сноски «Откуда цифры», `check-sources.mjs`, гейт реестра в `check-content` | компоненты + скрипты | формат `offer-sources` общий; гейт — в каждую сборку сети |
| `news_inbox.py` + skill `news-pipeline` + `RecentChanges` | `scripts/`, `.claude/skills/` | один inbox на сеть, тема распределяется на один сайт (без дублей) |
| `rss.xml.ts`, `ShareBar`, `ics.ts`, `announce.php` | эндпоинты и компоненты | без зависимостей, переносятся копированием |
| `indexnow.mjs` (sitemap-diff, guards) | `scripts/` | общий для всех Beget-сайтов |
| Pagefind-интеграция + `search-synonyms.ts` | `astro.config` хук | словарь синонимов финансовой тематики общий |
| `OfferLogo` без авто-имён view transitions | `apps/*` | правило «`transition:name` только при морфе» — в skill `site-design` |
| Хабы `/refinansirovanie/`, `/dolgi/`, `/klyuchevaya-stavka/` | шаблоны страниц | **один хаб на тему на всю сеть**: тексты и структура для тех же запросов не переиспользуются (аффилиат-фильтр, §12.4 п. 6), тема закрепляется за одним сайтом |
| Правила 38-ФЗ и YMYL из dive-ов (льгота, ПСК рядом со ставкой, без «одобрят», жалобы у всех) | `.claude/skills/ymyl-content`, `offer-placement` | единый источник правил для всех агентов сети |

Принцип: логика, данные и проверки — в `packages/core` и `web/scripts` (общие). Страницы, тексты и бренд — в `apps/<site>` (уникальные).

---

## 12. Ревью: пробелы и правки

Ревью скептика от 2026-10-19. Сверено с кодом worktree (`astro.config.mjs`, `go/[offer].astro`, `robots.txt.ts`, `OfferCard.astro`, `cta/*`, `@pbn/core`, `node_modules/astro/dist/prefetch`), с `pool.json`, с dive-ами и календарём ЦБ. Явные ошибки в §0, §2, §2.1, §2.3, §2.9, §5.2 и §9.1 исправлены прямо в тексте. Ниже то, что требует решения.

### 12.1 Сроки: спринт 0 не помещается

- 20–22.10 — это **3 рабочих дня** (вт–чт), а в спринте 4,5 дня разработки (1 + 0,5 + 1 + 1,5 + 0,5) и задачи владельца. Перегруз около 50%.
- К 23.10 жёстко нужно только одно: убрать вписанную руками «ставку на 13 октября». Для этого хватает правки двух MDX (15 минут) и ручного `facts.json` с `<Fact>`. Конвейер `sync-cbr` к заседанию не нужен: в день решения ставка всё равно идёт через `facts.override.json` (API отдаёт новое значение только с 26.10).
- Срочность целей Метрики завышена. При ИКС 0 и почти нулевом трафике за первые недели набирать нечего, поэтому «без целей ничего не измерить» на горизонте спринта 0 — не блокер. Цели дешёвые и их стоит сделать, но не раньше юр-гигиены.

**Спринт 0 в новой редакции (3 дня):**
1. Гигиена: D1, D3 этап 0, D5, D6 (1–1,5 д). Это 38-ФЗ, сюда же удаление `Calculator.astro`: это мёртвый код, 5 минут, ждать `refi-calc` незачем.
2. Ставка: правка 2 MDX + ручной `facts.json` + `Fact.astro` (0,5 д). `sync-cbr --rate` перенести в спринт 1.
3. `cpa-click-goals` (1 д).
4. Перенести в спринт 1: `offerlogo-vt-fix` (визуальный баг, юр-риска нет), D4 новости (CTA снять сразу, остальное потом), D7, `indexnow-automate`. IndexNow при ИКС 0 и решении по домену через 2–4 недели может уйти на другой хост.

### 12.2 Оценки занижены систематически

Оценки dive-ов — это время на код агентом. Ревью человеком, юрсверка и правки по ревью в них не входят, а узкое место плана — один владелец (§10).

| Где | В плане | Реалистично | Почему |
|---|---|---|---|
| `sync-cbr.mjs` (5 блоков) | «~50 строк», размазан по фичам | 2–3 дня на всё | SOAP, HTML `cal_mp`, два xlsx (zip через `inflateRawSync` + sharedStrings + поиск колонок по тексту), HTML ренкинга, JSON чёрного списка; у каждого свои предохранители и тест на снимке |
| `refi-calc` | 2,5 | 3,5–4 | 1–5 долгов, 3 режима страховки, бисекция ПСК, `#hash`, страница, вставка в 5 MDX, a11y, эталоны |
| `psk-checker` | 2,5 | 3,5 | 3 режима ввода, таблица режимов по датам, xlsx ЦБ, пересборка после 13–14.11. MVP — **один режим** (сумма/срок/к возврату), остальные во v2 |
| `debt-antispiral` MVP | 2,5 | 3 + ожидание юрсверки | 3 закона и 6579-У сверяются до публикации, иначе страница не выходит |
| `news-inbox` | 2,5 | 2,5 + 15 мин/день человека | ок, но `launchd` на Mac владельца: при спящем ноутбуке прогон пропадает. Это допустимо, только надо знать |
| Спринт 1 (26.10–06.11) | 9,75 д работы | 9 рабочих дней (04.11 — выходной) | перегруз при нулевом буфере. `key-rate-hub` с дедлайном 10.11 сдвигается на 09–10.11 или выходит без `#nalog` |
| Топ-10 | 15–16 д | 22–25 д | см. исправленную строку «Итого» в §2 |

Правило на все спринты: заполнять спринт на **70%** (6–6,5 дня из 9), остальное оставлять на ревью и правки. По этой мерке план в §9 растягивается примерно на полтора спринта: волна 2 заканчивается в феврале 2027, а не в январе.

**Что срезать, чтобы вернуть буфер:**
- `moya-merka-personal-layer` (2 д) и `snimem-merku-quiz` (2 д) перевести в later по триггеру ≥ 300 визитов в сутки. Без трафика ReturnPrompt и ветки квиза не на чем проверять, а нижних плашек и так три (§3).
- `vertical-filters` на `/debetovye-karty/` и `/rko/`: 05 советует отдать ниши страхования и РКО finhelp, поэтому вкладываться сюда сейчас — против развода ниш. Оставить только чипы карт.
- `psk-checker`: один режим ввода в MVP (−1 д).
- `go-php-server-log`: делать только после того, как в Saleads появятся реальные клики, чтобы было что сверять. До этого хватит `utm_content` в Saleads.

### 12.3 Решение по домену — главный пропуск

06 (§4 R2) рекомендует переезд на нейтральный домен **сейчас**, 07 R2 — решить за 2–4 недели. План (§10) считает, что домен затрагивает только C2, Дзен и каналы. На деле решение бьёт по ядру плана:
- §0.3 обосновывает «ядро — рефинансирование» наследием домена (старые `/credit/*`). При переезде это наследие переносится только через 301 и склейку Яндекса, которую никто не гарантирует, а 06 предлагает снять 301 через 6–12 месяцев. Ядро всё равно верно, но по другой причине: развод ниш с finhelp (05 п. 5). Обоснование надо поменять, иначе переезд выглядит как отмена ядра.
- При переезде меняются: площадка в Saleads (новый домен добавить и дождаться одобрения, иначе клики с него могут не засчитать), `utm_source` (берётся из `Astro.site` — ок), ключ IndexNow, Вебмастер, счётчик Метрики (или его настройки), ОРД-площадка, 301 в `.htaccess`.
- **Правка плана:** решение по домену — задача владельца **в спринте 1, до** `indexnow-automate` и до хабов. При переезде заложить 1,5–2 дня на операции в спринт 1–2 и сдвинуть волну 2.

### 12.4 Юридические риски, которых в плане нет или мало

1. **erid и собственные креативы (38-ФЗ ст. 18.1).** 06 P0 #6 переносит `erid` прямо в `href` (`/go/<id>/?erid=…`). При этом `goals.ts` по §2.1 переписывает `href` на клике. Если перезаписывать строкой, erid потеряется. Переписывать нужно только через `URL.searchParams.set` и с регресс-проверкой в `check-links.mjs`. Отдельно: карточки на хабе, под калькуляторами и в квизе — это **наши** тексты (ставка, ПСК, кнопка), а не креатив Saleads. Нужно письменно уточнить у Saleads, покрывает ли выданный erid такие карточки или каждой форме размещения нужен свой токен и отчётность в ОРД. Это блокер новых мест размещения (хаб, refi-calc, psk-checker, квиз), а не только 06.
2. **Офферы под «плохим» вердиктом.** В `refi-calc` при вердикте «ловушка срока» или «невыгодно» карточки Т-Банка и Альфы не показывать: иначе калькулятор говорит «невыгодно» и тут же предлагает оформить. То же в `psk-checker` при флагах. Правило §6.2 про уязвимую аудиторию дополнить: «нет офферов при отрицательном вердикте».
3. **C2 «Как погасить займ в <МФО>».** Помимо решения по домену нужны: никаких реквизитов для оплаты и форм, плашка «не официальный сайт <МФО>» в первом экране, ссылки только на официальный сайт из реестра. Иначе страница выглядит как сайт-двойник, а это ровно риск самозванства, из-за которого отвергнут C2-B.
4. **Ренкинг жалоб.** План ставит `sync --complaints` ежемесячно, а ренкинг ЦБ годовой: первый выпуск 13.07.2026 (dive-cbr-complaints). В §5.2 исправлено. Оговорку ЦБ брать дословно со страницы — это уже в dive, держать.
5. **Перенос 4 статей finhelp в `/dolgi/`.** Это черновики `sites/finhelp-ru/editorial/*.json`, они не в git и, судя по всему, не опубликованы. Переносить можно, но 05 п. 7 прямо говорит «как фактуру и бриф, а не текст». Сетевой след для аффилиат-фильтра даёт и текст, и одинаковая структура. Правка: переписать под голос «Мерки», убрать «ФинПомощь» и перепроверить через `ymyl-content` после D8.
6. **Аффилиат-фильтр от общих модулей (§11).** Одинаковые калькуляторы, бейджи, JSON-LD и хабы с общей структурой на сайтах сети, которые бьют в одни запросы, — это улика для аффилиат-фильтра Яндекса не меньше, чем текст. Логику в `packages/core` держать общей можно, но **один хаб на тему на всю сеть** (`/refinansirovanie/`, `/dolgi/`, `/klyuchevaya-stavka/` — только rencredit), а вёрстку и тексты блоков на других сайтах делать разными. В §11 строку про хабы ужесточить: «структура не переиспользуется для тех же запросов».
7. **`/proverka-psk/` и ст. 6.2.** Исключение «до 15 дней и до 10 тыс. ₽» взято из сноски xlsx ЦБ. Перед выпуском сверить с текстом 353-ФЗ, как и 545-ФЗ.

### 12.5 Скорость и сборка

- **Prefetch уже включён на всех ссылках.** С `<ClientRouter />` у Astro `prefetchAll: true`, стратегия `hover` (проверено в `node_modules/astro/dist/prefetch`), а `target="_blank"` от prefetch не защищает. Сейчас это безвредно: префетчится статический `/go/` с meta refresh. Но `data-astro-prefetch="false"` на всех CTA нужен **в `cpa-click-goals`**, а не перед `go-php`: иначе с ростом трафика каждый hover будет тянуть лишний HTML. Это одна строка в `OfferCard`, `CtaTop3` и `CtaZero`.
- **Гейты не должны блокировать срочный деплой.** `check-content` (реестр старше 14 дней — ошибка, `nextMeeting` < сегодня — ошибка) уронит выкладку в день заседания ЦБ, если `--registry` не прогнали в понедельник. Нужен один флаг `ALLOW_STALE=1` в `deploy-beget.sh`, который понижает свежесть до warning. Порог реестра ставить в 21 день, а не 14: на еженедельный прогон с Mac нельзя рассчитывать.
- **`check-sources.mjs` не ставить в деплой.** Внешние сайты МФО и банков нестабильны (антибот, таймауты), а 404 у чужого сайта не должен блокировать выкладку. Запускать по расписанию раз в неделю или руками при перепроверке.
- **Бюджет HTML на обзоре оффера.** На `[dir]/[slug]` по плану добавляются бейдж ЦБ, сноски, паспорт C1, жалобы, `ReturnCalc` и FAQ. После `offerlogo-vt-fix` (−116 КБ на главной) легко набрать столько же на обзорах. В `check-content` нужен порог, например gzip HTML ≤ 30 КБ на страницу, по той же схеме, что регресс-проверка `transition:name`. Список «Источники условий» свернуть в `<details>`.
- **Pagefind.** Загружать UI и wasm только при открытии `<dialog>` поиска, не на каждой странице. Индекс пересоздаётся на каждой сборке, это +несколько секунд — приемлемо.
- **Скрипты и ClientRouter.** У каждого нового клиентского модуля (RefiCalc, PdnCheck, PskCheck, ReturnCalc, фильтры, scroll-spy) инициализация на `astro:page-load` должна быть идемпотентной, без двойных обработчиков после мягкого перехода. `goals.ts` с делегированием на `document` подключать один раз из модуля, не из inline-скрипта. Это пункт DoD (§12.6), а не забота каждой фичи по отдельности.
- **GSAP в калькуляторах не нужен.** Бары «было/стало» — CSS `transform`. GSAP только там, где он уже грузится.

### 12.6 Определение готовности (в плане отсутствует)

Для каждой фичи с UI, одной строкой в PR:
1. Скриншоты 320 / 768 / 1440 (Playwright), без горизонтального скролла.
2. Клавиатура и a11y: `<label>` у полей, результат калькулятора в `aria-live="polite"`, видимый фокус, `prefers-reduced-motion`.
3. Работает после мягкого перехода ClientRouter туда и обратно.
4. Без JS видно осмысленное содержимое (SSR-дефолт).
5. `npm run check` + `check-content` зелёные; размер HTML и JS в бюджете.
6. Тексты с цифрами и CTA прошли `ymyl-content`, а для калькуляторов есть эталон в `node --test`.

### 12.7 Мелкие ошибки и неточности

| Где | Было | Правка |
|---|---|---|
| §0 п. 5 | «01.01.2027 — ЕБС для МФК» как норма | исправлено: это конец послабления ЦБ (письмо, известно из СМИ); норма для МФК с 01.03.2026, для МКК с 01.03.2027 |
| §0 п. 1 | цели нужно завести «весь реестр один раз в спринте 0» | исправлено: до деплоя соответствующей фичи, можно через Management API |
| §2, строка 2 | «−40% HTML главной» | исправлено: −40% по сырому HTML, по gzip −14% (3,5 КБ). Фича нужна из-за бага морфа, а не из-за веса |
| §2, «Итого» | 15–16 дней с «экономией на общих модулях» | исправлено: экономии нет, 17,75 д чистого кода, 22–25 с ревью |
| §2.1 | `closest('a', 'b', …)` с несколькими аргументами | исправлено на один селектор-список. Плюс предложение: `p` ставить в `href` на сборке (`offerHref(o, slot)`), в JS добавлять только `s`. Тогда placement доходит до Saleads без согласия на cookie, без JS и при «открыть в новой вкладке», и ограничение из §2.1 снимается |
| §2.1, проверка | «агрегат приходит в `saleads_offers.py clicks`» | `cmd_clicks` сейчас печатает сырые `utm_marks`, группировки по `utm_content` нет. Нужна правка на 10–15 строк, +0,25 д |
| §2.3 | `sync-cbr` «около 50 строк» | исправлено: 50 строк — только `--rate`, все блоки — 300–500 |
| §2.9 | Деньги Сразу под результатом | исправлено: только после пересверки D7; при «2+ дорогих займа» МФО не показываем |
| §5.2 | ренкинг жалоб ежемесячно | исправлено: раз в год, по пресс-релизу ЦБ |
| §5.2 | даты заседаний 2027 (12.02, 19.03, 30.04) | 23.10 и 18.12.2026 подтверждены календарём ЦБ. Даты 2027 не проверены, сверить по `cbr.ru/dkp/cal_mp/`, как только ЦБ опубликует график |
| §9.1 | «~4 дня» | исправлено: 3 рабочих дня, урезанный состав в §12.1 |
| §1.1 | `Calculator.astro` удалить «в рамках `refi-calc`» | удалить в спринте 0: мёртвый код, импортов нет |
| §10 | риск домена «средний вред» | вред высокий для сроков волны 2 (§12.3), решение — в спринте 1 |
| §2.8 | «перенос 4 статей finhelp с чисткой битых ссылок» | переписать как фактуру (05 п. 7), убрать бренд «ФинПомощь» (§12.4 п. 5) |

### 12.8 Что подтвердилось

- `/go/` закрыт в `robots.txt` (`Disallow: /go/`), страница `noindex,nofollow`, CTA с `rel="sponsored nofollow noopener" target="_blank"`, поэтому ClientRouter их не перехватывает.
- Офферы рефинансирования и банкротства в `pool.json` в статусе `approve`: 5 000 ₽, 1 750 ₽ и 18 750 ₽. Ставка плана на эту воронку денежно обоснована.
- `@pbn/core` экспортирует `"./*": "./src/*"`, так что импорт `@pbn/core/finance` без barrel и `pool.json` работает как задумано.
- `reachGoal` в `src/` — 0 вызовов, это подтверждено.
- `sharp` используется в `apps/rencredit/scripts/gen-assets.mjs` через транзитивную зависимость Astro, поэтому пункт «объявить явно» верный.
