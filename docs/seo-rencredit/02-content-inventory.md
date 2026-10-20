# 02 — Инвентарь и качество контента: rencredit-online.ru («Мерка»)

Дата: 2026-10-19 · Ветка: `feat/rencredit-metrika` (worktree `/Users/deniskononov/rencredit-pilot-wt`) · Линза: контент, инвентарь и качество
`${APP}` = `/Users/deniskononov/rencredit-pilot-wt/web/apps/rencredit`

## Резюме

1. **В content collections 43 текстовых материала** плюс 83 карточки продуктов. Тексты: 22 статьи, 8 гайдов-посадочных, 4 новости (1 из них draft), 9 SEO-текстов страниц услуг. Карточки: 33 кредитных оффера (22 МФО, 7 карт, 4 кредита) и 50 некредитных услуг. Живой sitemap отдаёт 83 URL. Все 14 легаси-статей `/credit/<slug>.html` отвечают 200 и ставят canonical на себя.
2. **Наследие WP вычищено полностью.** Совпадение 5-грамм между новыми текстами и старым WP-контентом составляет 0,000–0,001 по всем 14 переписанным статьям. Чужих партнёрок (delen.ru) и картинок с lib.zaplata.ru в новом контенте нет, слово «Ренессанс» в текстах не встречается. Из 37 постов WP 14 переписаны на тех же URL, 23 уходят 301 на хабы (`public/.htaccess:169-214`).
3. **Критическая находка (подтверждена в браузере).** На 3 из 8 гайдов витрина после загрузки JS пустая: `/zaimy-bez-otkaza/`, `/zaimy-bez-foto/` и `/novye-mfo/` показывают «Под такие условия предложений нет», 0 из 22. На `/zaimy-s-prosrochkami/` показывается 1 карточка. Причина в данных: у офферов нет признаков `no_refusal`, `no_photo` и `new`, а `with_overdue` есть только у одного неверифицированного bystrodengi. Фильтр в `src/scripts/offers-ui.ts:29` требует совпадения по всем признакам, а `:80` подставляет признак гайда как обязательный фильтр. Для пользователя это пустая коммерческая страница, для поведенческих факторов — плохой сигнал.
4. **Каннибализация в кластере «рефинансирование».** Об общем рефинансировании 7 статей, и 5 из них отвечают на один и тот же вопрос «что это, как работает и выгодно ли». Хуже всего с `/stati/kak-rabotaet-refinansirovanie-kredita/`: это молодой URL (2026-08-14), который дублирует возрастной `/credit/refinansirovanie-kredita-chto-eto-znachit.html`. При этом на молодой URL ведут 12 внутренних ссылок, а на возрастной только 6, то есть ссылочный вес уходит на дубль.
5. **Интент bank-статей не совпадает с выдачей.** Статьи про Сбер, ВТБ и УБРиР сознательно не называют ставок («мы не приводим конкретных ставок»). А подсказки Яндекса по этим запросам — «условия 2026», «какой процент», «калькулятор», «для зарплатных клиентов». Статья `…s-plohoi-kreditnoi-istoriei-perechen-bankov` обещает в title «перечень банков», но в таблице перечислены типы кредиторов, а не банки.
6. **Два решения по редиректам стоят трафика.** Пост про повторное рефинансирование ипотеки уходит 301 на общую статью. Два поста про период охлаждения уходят на `/novosti/`. По обеим темам в подсказках Яндекса есть живой спрос: «сколько раз можно рефинансировать ипотеку», «период охлаждения по кредитам что это / закон». Эти URL лучше переписать или направить на новую статью, а не сливать в хаб.
7. **Тонкие страницы:**
   - 3 опубликованные новости по 131–144 слова без внутренних ссылок; в новости о самозапрете висит ссылка-обещание без самой ссылки.
   - Гайды по 393–439 слов, без источников, без даты, без перелинковки. В SSR у всех 8 гайдов одинаковый блок из 22 карточек: 5-граммный Jaccard между гайдами 0,34–0,37, с `/zaimy/` 0,44–0,46.
   - Обзоры офферов `/mfo/*`: в `<main>` 281–440 слов, например `/mfo/vivus/` — 281 слово при `verified: false`.
8. **Свежесть.** Ключевая ставка («14% на 13 октября 2026») захардкожена в `service-pages/vklady.mdx:19,50` и `debetovye-karty.mdx:65`. Заседание ЦБ 23.10.2026, после него эти места нужно обновить. Во всех 21 статье, где есть `updatedDate`, стоит одна дата — 2026-10-13. У гайдов поля даты в схеме нет вообще (`content.config.ts:83-96`).
9. **Наработки по finhelp переиспользовать можно, но выборочно.** 30 готовых статей лежат в `sites/finhelp-ru/editorial/`, они датированы 2026-10-19 и ещё не опубликованы. 9 из них пересекаются по интенту с уже существующими страницами rencredit, и отдельными статьями их публиковать нельзя (это даст каннибализацию). 14 закрывают гэпы. Тексты 1-в-1 переносить нельзя: внутри сети это дубль, и Яндекс выберет одну копию. Каждую тему закрепляем за одним сайтом. Карта — в разделе F8.

## Метод и ограничения

- Метрики по каждому файлу посчитаны скриптом: слова тела без frontmatter и тегов, число H2/H3, FAQ во frontmatter, таблицы, внутренние ссылки `](/…)`, внешние `](http…)`, даты, `legacyUrl`. Цифры по словам приблизительные (±5%).
- Уникальность против WP: множества 5-грамм нового MDX против `content_text` из `legacy/rencredit/posts/<slug>.json`. Каннибализация по тексту: 4-граммный Jaccard попарно по 30 статьям и гайдам (максимум 0,055, то есть текстовых дублей нет). Каннибализация по интенту оценена вручную по title, H2 и подсказкам Яндекса.
- Живой сайт: `curl` по sitemap (83 URL), Playwright по `/zaimy-bez-otkaza/` и `/zaimy-s-prosrochkami/` (счётчик видимых карточек).
- Спрос: открытые подсказки Яндекса (`suggest.yandex.ru/suggest-ff.cgi`), 11 сидов. Частот Wordstat нет. Регион в подсказках — Ярославль (геолокация IP).
- Данных Вебмастера и Метрики нет. Поэтому неизвестно, есть ли у 23 редиректнутых постов внешние ссылки и трафик. Решения 410/301 ниже даны с этой оговоркой.
- Факты внутри текстов (номера законов, даты) здесь не перепроверялись построчно, это задача линзы фактчека. Попутно отмечены только расхождения, найденные по дороге.

## Находки

### F1. Пустые и почти пустые витрины гайдов (критично)

| Гайд | `feature` (file:line) | Офферов с признаком (из 22 МФО) | Видно после JS (живой сайт) |
|---|---|---:|---:|
| `/zaimy-bez-otkaza/` | `guides/zaimy-bez-otkaza.mdx:6` `no_refusal` | 0 | **0** (проверено Playwright: «Под такие условия предложений нет») |
| `/zaimy-bez-foto/` | `guides/zaimy-bez-foto.mdx:6` `no_photo` | 0 | **0** |
| `/novye-mfo/` | `guides/novye-mfo.mdx:6` `new` | 0 | **0** |
| `/zaimy-s-prosrochkami/` | `guides/zaimy-s-prosrochkami.mdx:6` `with_overdue` | 1 (bystrodengi, `verified: false`) | **1** (проверено) |
| `/zaimy-s-plohoj-ki/` | `bad_history` | 10 | 10 |
| `/zaimy-bez-procentov/` | `zero_percent` | 13 | 13 |
| `/dolgosrochnye-zaimy/` | `long_term` | 13 | 13 |
| `/zaimy-na-kartu/` | `to_card` | 20 | 20 |

Механика: `src/scripts/offers-ui.ts:80` (`if (preset) state.f.add(preset)`) и `:29` (`k.f.every(...)`). В SSR всегда выводятся все 22 карточки, поэтому робот видит заполненную страницу, а пользователь — пустую. Для «займы без отказа» это потеря самой денежной посадочной, в подсказках Яндекса у этого запроса 10 хвостов.

### F2. Кластер «рефинансирование»: кто кого ест

| Интент (подсказки Яндекса) | Сейчас отвечают | Вердикт |
|---|---|---|
| «рефинансирование кредита / что это / это» | `/credit/refinansirovanie-kredita-chto-eto-znachit.html` (1197 сл., возраст с 2025-09-16) **и** `/stati/kak-rabotaet-refinansirovanie-kredita/` (957 сл., 2026-08-14) | **Слить** `kak-rabotaet` в `chto-eto-znachit` (pillar), 301 со `/stati/…`, перевесить 12 ссылок |
| «как происходит / по шагам» | `kak-proishodit-…` (этапы) + разделы «Пошаговый порядок оформления» в `chto-eto` и «Как устроен процесс» / «Что делать пошагово» / «Пошаговый чек-лист» в `kak-rabotaet` | Оставить `kak-proishodit` единственным ответом; в pillar сократить до 3 строк со ссылкой |
| «выгодно ли / как посчитать выгоду» | `stoit-li-…` (title: «как посчитать выгоду») **и** `perekreditovanie-…` (title: «как посчитать выгоду») + раздел «Как посчитать выгоду» в `kak-rabotaet` | Развести: `stoit-li` — решение и расчёт; `perekreditovanie` — термин и снижение ставки (в т. ч. в своём банке), без второго примера расчёта |
| «помощь / агентство / брокер» | `kak-polychit-pomosh-…` (раздел «Кредитные брокеры: … сколько берут», «Как не попасть на мошенников») **и** `kak-rabotaet-agentstvo-…` («За что берут деньги и сколько», «Признаки мошенников»); Jaccard 0,055 — максимум по сайту | Развести: `pomosh` — бесплатные пути (банк, реструктуризация, каникулы, банкротство); `agentstvo` — посредники + брендовый хвост «ООО Агентство по рефинансированию кредитов и микрозаймов отзывы» (4 из 4 подсказок — бренд) |
| «с плохой КИ / с просрочками / в каком банке можно» | `…s-plohoi-kreditnoi-istoriei-perechen-bankov` | Обещание «перечень банков» не выполнено: таблица `:43-50` — типы кредиторов. Добавить датированный список банков с источниками или убрать «перечень» из title (URL не трогать) |

Внутренние ссылки на молодой дубль (все анкоры — «как работает рефинансирование кредита»): `articles/bank-otkrytie-…:46`, `kak-rabotaet-agentstvo-…:57`, `perekreditovanie-…:35`, `kak-proishodit-…:30`, `naskolko-vygodno-…:98`, `refinansirovanie-kredita-chto-eto-znachit:26`, `refinansirovanie-v-interprombanke-…:82`, `stoit-li-…:102`, `…s-plohoi-…:101`, `…dlia-ip-…:108`, `kak-sdelat-…-v-sberbanke:90`, `kak-polychit-pomosh-…:36`.

Хаба `/refinansirovanie/` нет, а в category enum (`content.config.ts:59`) категория есть. Офферы рефинансирования (Т-Банк 5000 ₽, Альфа 1750 ₽) живут только в `/kredity/`. По запросу «рефинансирование кредита» нет посадочной с витриной. Самый дешёвый выход — сделать витриной сам pillar на возрастном URL.

### F3. Интент bank-статей не совпадает с выдачей

Подсказки: «рефинансирование в втб какой процент / условия 2026 / калькулятор», «рефинансирование в сбербанке условия для зарплатных клиентов / процент / калькулятор». В выдаче агрегаторы с цифрами (bankiros: ВТБ от 7,7%, ПСК 17,9–40,9%, до 7 млн ₽, до 5 лет, обновлено 13.10.2026). Наши тексты пишут «мы не приводим конкретных ставок» (`kak-sdelat-…-v-sberbanke`, `na-kakih-…-v-vtb`, `ysloviia-…-ybrir`). С YMYL-перестраховкой это объяснимо, но страница отвечает «смотрите на сайте банка». Нужна датированная таблица «по данным сайта банка на ДД.ММ.ГГГГ» со ссылкой на первоисточник и плановым обновлением раз в квартал. Факты по РСХБ (приём заявок приостановлен), «Открытию» (вошёл в ВТБ / БМ-Банк) и Интерпромбанку (лицензия отозвана 16.04.2021) уже честные, их держим как есть.

### F4. Решения по 23 редиректнутым постам WP

| Группа | Пример (file:line `public/.htaccess`) | Сейчас | Предлагаю |
|---|---|---|---|
| Повторное рефинансирование ипотеки | `:188` `kak-polychit-povtornoe-refinansirovanie-ipoteki` (429 сл. в WP) | 301 → `chto-eto-znachit` (про ипотеку там нет) | **Переписать на прежнем URL**: «Сколько раз можно рефинансировать ипотеку» (подсказки: «сколько раз можно рефинансировать ипотеку / в сбербанке / в разных банках»). Монетизация — `/strahovanie-ipoteki/` (Cherehapa 50%, Т-Страхование 20%, Полис812 17,25%) |
| Период охлаждения (2 поста) | `:195` `pytin-podpisal-zakon-o-periode-ohlajdeniia…`, `:201` `sovfed-…-ohlajdeniia…` | 301 → `/novosti/` | Новая статья «Период охлаждения по кредитам» (9-ФЗ от 13.02.2025, с 01.09.2025: 4 ч для сумм 50–200 тыс. ₽, 48 ч для сумм выше 200 тыс. ₽; исключения — рефинансирование без увеличения долга и др.; сверить с первоисточником). 301 с обоих постов → на неё |
| Вклады | `:193` `pochta-bank-…-vkladov…` | → `/novosti/` | → `/vklady/` |
| Ипотечные/кредитные законы (6) | `:172,180,184,190,204,210` | → `/kredity/` | Оставить |
| Офтоп (13: золото ×4, иена, Турция, НБУ, Мосбиржа, «Самолёт», Роскосмос, АЕБ, ЦБ/юрлица ×2) | `:170,174,176,178,182,186,192,198,200,206,208,212,214` | → `/novosti/` | Если в Вебмастере нет внешних ссылок — 410; иначе оставить 301. Низкий приоритет |

### F5. Тонкие страницы и перелинковка

- **Новости:** 131–144 слова, 0 внутренних ссылок. `news/samozapret-na-kredity-zarabotal-s-1-marta-2025.md:16` заканчивается словами «читайте в нашем разборе», но ссылки на `/stati/samozapret-na-kredity/` нет. `publishDate` у новостей 2025-03-01 и 2026-04-01, хотя на домене тогда был WP с другим контентом. Дата публикации выдаёт себя за прошедшую — для YMYL-доверия честнее ставить фактическую (10.2026).
- **8 статей `/stati/`:** 0 внешних источников и 0 внутренних ссылок в теле, хотя `ymyl-content/SKILL.md` требует: «Нет источника, нет утверждения». Ирония — `kak-proverit-mfo-v-reestre-cb` без ссылки на сам реестр cbr.ru.
- **Гайды:** 0 ссылок, 0 источников (кроме 1 в `zaimy-bez-foto`), нет даты при датированных утверждениях («с 1 октября 2026», «с 1 апреля 2026»).
- **Обзоры офферов:** 281–440 слов в `<main>` (`/mfo/vivus/` 281, `/mfo/denga/` 440, `/karty/otp-120/` 385, `/kredity/tbank-refinansirovanie/` 403). 7 из 33 `verified: false`: bystrodengi, creddy, kviku, prostoy-vopros, smsfinance, tbank-drive, vivus. У smsfinance и vivus по 1 плюсу и 1 минусу.
- **Страницы услуг:** с источниками всё хорошо (1–8 внешних ссылок, 5–7 FAQ), но внутренних ссылок 0 везде, кроме `/strahovanie/` (4). Витрина `/strahovanie-kvartiry/` — 1 карточка, `/kasko/` — 2.

### F6. Свежесть

| Где | Что устареет | Триггер |
|---|---|---|
| `service-pages/vklady.mdx:19,50`, `debetovye-karty.mdx:65` | «ключевая ставка 14% на 13 октября 2026» | заседание ЦБ 23.10.2026 → правка 24.10 |
| `vklady.mdx:11`, `debetovye-karty.mdx:61` | необлагаемый лимит по НДФЛ от «максимальной ставки 16% в 2026» | пересчёт в январе 2027 |
| `news/mfo-limit-psk-200…`, гайды | «следующий этап 1 апреля 2027» | обновить в марте 2027 |
| `naskolko-vygodno-…-v-rosselhozbanke` | «на октябрь 2026 приём заявок приостановлен» | проверка ежемесячно |
| `.claude/skills/ymyl-content/SKILL.md` | «переплата ≤130%» — устарело, с 01.04.2026 действует 100% (сами тексты сайта корректны: `chto-takoe-psk…:60`, `chto-budet-pri-prosrochke…:33`) | поправить скилл, иначе следующий агент напишет 130% |

### F7. Офферы и услуги (summary)

- 33 оффера: у всех есть `summary` (101–212 знаков), `erid` и `cbrLicense`, у 0 есть `rating` (это правильно: выдуманных оценок нет). 26 верифицированы.
- Признаки МФО: `to_card` 20, `zero_percent` 13, `long_term` 13, `round_the_clock` 13, `bad_history` 10, `cash` 2, `with_overdue` 1. Признаков `no_refusal`, `no_photo` и `new` нет ни у одного оффера (отсюда F1).
- 50 услуг: debit 19, rko 13, osago 4, vklady 3, ипотечное 3, ВЗР 3, прочее 2, kasko 2, квартира 1. 46 верифицированы, у всех есть highlights, erid, summary.
- В пуле есть ББанкрот (18 750 ₽, approve), но на rencredit под него нет ни категории, ни контента. Гэп для `kak-polychit-pomosh` и `kak-ne-popast-v-dolgovuyu-yamu`.

### F8. Переиспользование статей finhelp (`sites/finhelp-ru/editorial/`, 30 шт.)

| Тип | Статьи finhelp | Что делать на rencredit |
|---|---|---|
| **Пересекаются с существующими → вливать факты в нашу страницу, отдельно не публиковать** (9) | `chto-budet-esli-ne-platit-mikrozajm` ↔ `/stati/chto-budet-pri-prosrochke-zajma/`; `kak-snyat-samozapret-na-kredit` ↔ `/stati/samozapret-na-kredity/`; `osago-onlajn-kak-oformit` ↔ `/osago/`; `strahovanie-kvartiry` ↔ `/strahovanie-kvartiry/`; `strahovanie-ipoteki-deshevle-chem-v-banke` ↔ `/strahovanie-ipoteki/`; `strahovka-dlya-vyezda-za-rubezh` ↔ `/strahovanie-puteshestvennikov/`; `raschetnyj-schet-dlya-ip` ↔ `/rko/`; `skolko-stoit-kasko` ↔ `/kasko/` (раздел «Сколько стоит»); `novye-pravila-mfo-2026` ↔ 3 новости (сделать на их основе один evergreen-хаб `/stati/`, новости слинковать) | расширить нашу страницу уникальными фактами и FAQ |
| **Закрывают гэп, монетизация есть в rencredit** (8) | `otkaz-ot-strahovki-po-kreditu` (кластер рефинансирования, Т-Банк/Альфа), `pochemu-mfo-otkazyvayut-v-zajme` (донор для `/zaimy-bez-otkaza/`), `kak-proverit-kreditnuyu-istoriyu-cherez-gosuslugi`, `kollektory-chto-mogut-po-zakonu`, `kbm-osago`, `120-dnej-bez-procentov-podvodnye-kamni` (otp-120, uralsib-120), `tinkoff-black-ili-alfa-karta` (debit), `nakopitelnyj-schet-ili-vklad` (`/vklady/`) | закрепить тему за ОДНИМ сайтом сети; на втором — переписать с нуля по фактам из `key_points`/`sources` (порог совпадения 5-грамм < 15%) |
| **Гэп, но монетизация под вопросом** (6) | `bankrotstvo-cherez-mfc`, `bankrotstvo-fizicheskih-lic-cherez-sud`, `posledstviya-bankrotstva` (ББанкрот есть в пуле, не подключён к сайту), `kredit-oformili-moshenniki-chto-delat`, `klyuchevaya-stavka-prognoz` (`/vklady/`), `chto-budet-esli-ne-platit-split` | P2, после решения по ББанкроту |
| **Вне профиля rencredit** (7) | ИИС-3, вычеты ×2, ИП/самозанятые ×3, семейная ипотека | не брать (тематика «кредиты и долги» на возрастном домене важнее широты) |

Риск: finhelp и rencredit входят в одну сеть. Одинаковые тексты на двух доменах — сетевой след и выбор Яндексом одной копии. Поэтому `editorial/*.json` используем как бриф и фактическую базу, а не как текст.

## Таблица по каждому материалу

Обозначения вердиктов: **KEEP** — оставить как есть; **EXPAND** — дописать; **FIX** — точечная правка; **MERGE→** — слить в целевую страницу с 301; **REWRITE** — переписать на том же URL; **NEW** — создать.

### Статьи (`${APP}/src/content/articles`, 22)

| URL | Слов | H2 | FAQ | Ссылки вн./внеш. | Дата (pub → upd) | Интент / проблема | Вердикт |
|---|---:|---:|---:|---|---|---|---|
| `/credit/refinansirovanie-kredita-chto-eto-znachit.html` | 1197 | 10 | 5 | 8/1 | 2025-09-16 → 10-13 | «рефинансирование что это» — главный head кластера | **EXPAND** в pillar: принять контент `kak-rabotaet`, витрина Т-Банк/Альфа, короткие разделы «ипотека», «микрозаймы» со ссылками |
| `/stati/kak-rabotaet-refinansirovanie-kredita/` | 957 | 13 | 5 | 0/0 | 2026-08-14 → 10-13 | дубль pillar + `kak-proishodit` + `stoit-li`; внутри повторяются «Что делать пошагово» и «Пошаговый чек-лист» | **MERGE→** `chto-eto-znachit` (301), перевесить 12 ссылок |
| `/credit/kak-proishodit-refinansirovanie-kredita-chto-nyjno-znat.html` | 1009 | 7 | 5 | 6/0 | 2025-09-21 → 10-13 | «по шагам», уникальные «сроки этапов» и «период перекрытия» | **KEEP** (единственный ответ на «как происходит») |
| `/credit/stoit-li-ispolzovat-refinansirovanie-kredita.html` | 997 | 8 | 5 | 5/1 | 2025-10-04 → 10-13 | «выгодно ли», формула и 2 примера | **FIX**: стать единственным «калькуляторным» ответом; встроить калькулятор переплаты |
| `/credit/perekreditovanie-kredita-pod-menshii-procent.html` | 1006 | 7 | 5 | 5/0 | 2026-01-19 → 10-13 | title-дубль «как посчитать выгоду» со `stoit-li` | **FIX**: title → «Перекредитование под меньший процент: в своём банке и в другом»; убрать второй расчёт, сослаться на `stoit-li` |
| `/credit/kak-polychit-pomosh-v-refinansirovanii.html` | 1055 | 8 | 5 | 7/0 | 2025-09-02 → 10-13 | пересекается с `agentstvo` (брокеры, мошенники) | **FIX**: фокус на бесплатных путях (реструктуризация, каникулы, банкротство через МФЦ); блок про брокеров заменить ссылкой |
| `/credit/kak-rabotaet-agentstvo-po-refinansirovaniu.html` | 1024 | 8 | 5 | 6/0 | 2025-09-29 → 10-13 | Яндекс: 4/4 подсказки — бренд «ООО Агентство по рефинансированию кредитов и микрозаймов» | **EXPAND**: раздел «как проверить конкретное агентство» (ЕГРЮЛ, суды, реестры), без оценок компании без источника |
| `/credit/kak-sdelat-refinansirovanie-kreditov-v-sberbanke.html` | 1013 | 8 | 5 | 7/0 | 2026-06-01 → 10-13 | ищут «процент / условия 2026 / зарплатным»; цифр нет | **EXPAND**: датированная таблица условий со ссылкой на sberbank.ru, обновление раз в квартал |
| `/credit/na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-vtb.html` | 989 | 9 | 5 | 5/0 | 2025-11-19 → 10-13 | то же («какой процент», «калькулятор») | **EXPAND** (как Сбер) |
| `/credit/ysloviia-refinansirovaniia-kreditov-v-banke-ybrir.html` | 1045 | 10 | 5 | 5/0 | 2025-12-29 → 10-13 | то же | **EXPAND** (как Сбер), низкий спрос — после Сбера и ВТБ |
| `/credit/naskolko-vygodno-refinansirovanie-v-rosselhozbanke.html` | 1076 | 9 | 5 | 5/0 | 2026-01-10 → 10-13 | программа приостановлена (по rshb.ru) | **KEEP** + ежемесячная проверка статуса; альтернативы → витрина |
| `/credit/bank-otkrytie-…-refinansirovanie-kreditov-i-ipoteki.html` | 1067 | 9 | 5 | 5/1 | 2025-12-16 → 10-13 | банк растворён в ВТБ: «что делать заёмщику» | **KEEP** |
| `/credit/refinansirovanie-v-interprombanke-…html` | 1008 | 8 | 5 | 8/2 | 2025-12-05 → 10-13 | лицензия отозвана 16.04.2021 | **KEEP** (держит возраст URL, вкладываться не нужно) |
| `/credit/refinansirovanie-kreditov-dlia-ip-i-uridicheskih-lic-…html` | 991 | 9 | 5 | 4/0 | 2025-08-24 → 10-13 | B2B, офферов-кредитов нет | **FIX**: ссылки на `/rko/` (13 услуг) |
| `/credit/refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov.html` | 1191 | 9 | 5 | 8/0 | 2026-01-01 → 10-13 | «перечень банков» обещан, не дан (`:43-50`) | **EXPAND**: список банков с опубликованными требованиями (с датой и источником) либо убрать «перечень» из title |
| `/stati/chto-budet-pri-prosrochke-zajma/` | 1001 | 13 | 5 | 0/0 | 2026-09-26 → 10-13 | сильный инфо-запрос; пересекается с finhelp `chto-budet-esli-ne-platit-mikrozajm` | **EXPAND**: источники (230-ФЗ, 353-ФЗ), ссылки на `/kredity/`, `kak-ne-popast…`; влить хронологию из finhelp |
| `/stati/chto-takoe-psk-i-kak-ee-schitat/` | 958 | 13 | 5 | 0/0 | 2026-08-30 → 10-13 | ок, корректно про 100% (`:60`) | **FIX**: ссылки на consultant/cbr, калькулятор |
| `/stati/kak-ne-popast-v-dolgovuyu-yamu-s-mikrozajmami/` | 892 | 11 | 5 | 0/0 | 2026-09-05 → 10-13 | ок | **FIX**: ссылки в кластер рефинансирования и на банкротство |
| `/stati/kak-proverit-mfo-v-reestre-cb/` | 919 | 14 | 5 | 0/0 | 2026-09-19 → 10-13 | статья про реестр без ссылки на реестр | **FIX**: ссылка на cbr.ru (реестр МФО), на `/mfo/*` |
| `/stati/kak-uluchshit-kreditnuyu-istoriyu/` | 905 | 15 | 5 | 0/0 | 2026-08-22 → 10-13 | ок | **FIX**: ссылки на `…s-plohoi-…`, источники |
| `/stati/kreditnaya-karta-ili-zajm/` | 880 | 13 | 5 | 0/0 | 2026-09-12 → — | нет `updatedDate` | **FIX**: дата, ссылки на `/karty/`, `/zaimy/` |
| `/stati/samozapret-na-kredity/` | 917 | 15 | 5 | 0/0 | 2026-10-03 → 10-13 | ок; finhelp `kak-snyat-samozapret` — каннибал | **FIX**: влить факты про снятие, источники (31-ФЗ, 41-ФЗ — сверить) |

### Гайды (`${APP}/src/content/guides`, 8)

| URL | Слов | FAQ | Офферы видно | Интент / проблема | Вердикт |
|---|---:|---:|---:|---|---|
| `/zaimy-na-kartu/` | 420 | 5 | 20 | почти совпадает с `/zaimy/` (20 из 22) | **EXPAND** до 900–1200 слов: зачисление, СБП, чужая карта, сроки |
| `/zaimy-bez-procentov/` | 439 | 5 | 13 | «в чём подвох 0%» — окно по формату (см. finhelp 04 §1) | **EXPAND** |
| `/dolgosrochnye-zaimy/` | 415 | 5 | 13 | ок | **EXPAND**: installment-займы, ПСК на длинном сроке |
| `/zaimy-s-plohoj-ki/` | 421 | 5 | 10 | подсказки: «с плохой КИ и просрочками» — один интент с `prosrochki` | **EXPAND**, принять `prosrochki` |
| `/zaimy-s-prosrochkami/` | 402 | 5 | **1** | дубль интента; 1 неверифицированная карточка | **MERGE→** `/zaimy-s-plohoj-ki/` (301) |
| `/zaimy-bez-otkaza/` | 429 | 5 | **0** | head-запрос, витрина пустая | **FIX (P0)**: витрину для этой страницы — по сортировке `approvalPct`, а не по признаку; влить `pochemu-mfo-otkazyvayut` из finhelp |
| `/zaimy-bez-foto/` | 415 | 5 | **0** | список МФО без селфи — данных нет | **FIX**: проставить `no_photo` по сверенным условиям (≥3 оффера), иначе noindex до появления данных |
| `/novye-mfo/` | 393 | 5 | **0** | «новые МФО 2026 список» — нужен датированный список | **FIX**: `new` по дате входа в реестр ЦБ ≤12 мес. либо noindex/слить в `/zaimy/` |

### Новости (`${APP}/src/content/news`, 4)

| URL | Слов | Источник | Проблема | Вердикт |
|---|---:|---|---|---|
| `/novosti/mfo-limit-psk-200-s-1-oktyabrya-2026/` | 144 | Интерфакс | 0 ссылок; тема evergreen («сколько займов можно одновременно») | **EXPAND** + ссылка на будущий хаб «Правила МФО 2026–2027» |
| `/novosti/predelnaya-pereplata-po-mikrozajmam-100-s-1-aprelya-2026/` | 131 | Интерфакс | `publishDate` 2026-04-01 задним числом | **FIX**: честная дата, ссылка на `chto-takoe-psk` |
| `/novosti/samozapret-na-kredity-zarabotal-s-1-marta-2025/` | 143 | Банки.ру | `:16` «читайте в нашем разборе» без ссылки; дата 2025-03-01 задним числом | **FIX**: ссылка на `/stati/samozapret-na-kredity/`, честная дата |
| `stavka-0-8-procenta-i-limit-130-s-iyulya-2023` (draft) | 81 | ЦБ | исторический факт, не собирается | **KEEP draft** либо удалить; не публиковать |

### Страницы услуг (`${APP}/src/content/service-pages`, 9)

| URL | Слов | FAQ | Внеш. ист. | Карточек | Вердикт |
|---|---:|---:|---:|---:|---|
| `/debetovye-karty/` | 1072 | 6 | 5 | 19 | **FIX**: ключевая ставка `:65` после 23.10; добавить внутренние ссылки |
| `/vklady/` | 997 | 6 | 5 | 3 | **FIX**: `:19,50` ключевая ставка; влить `nakopitelnyj-schet-ili-vklad` |
| `/rko/` | 928 | 7 | 8 | 13 | **KEEP** + раздел из `raschetnyj-schet-dlya-ip` |
| `/osago/` | 867 | 6 | 3 | 4 | **EXPAND**: КБМ (из finhelp `kbm-osago`, переписать) |
| `/strahovanie-kvartiry/` | 853 | 6 | 7 | **1** | **KEEP**; витрина тонкая — подключить ПАРИ (wait) после одобрения |
| `/kasko/` | 820 | 6 | 2 | 2 | **EXPAND**: раздел «Сколько стоит КАСКО» |
| `/strahovanie-ipoteki/` | 778 | 6 | 3 | 3 | **EXPAND** + ссылка из будущей статьи о рефинансировании ипотеки |
| `/strahovanie-puteshestvennikov/` | 723 | 8 | 1 | 3 | **FIX**: источники (требования к визе) |
| `/strahovanie/` | 531 | 5 | 3 | хаб | **KEEP** (хаб, 4 внутренние ссылки — норма) |

### Обзоры офферов (33 URL `/mfo/*`, `/karty/*`, `/kredity/*`)

| Группа | Кол-во | Проблема | Вердикт |
|---|---:|---|---|
| verified, 3 плюса и 3 минуса | 26 | 380–440 слов, шаблон | **EXPAND** топ-10 по `priority`/выплате: досрочное погашение, продление, отзывы только с источником |
| `verified: false` | 7 (bystrodengi, creddy, kviku, prostoy-vopros, smsfinance, tbank-drive, vivus) | 281 слово (`/mfo/vivus/`), 1/1 плюс-минус | **FIX**: верифицировать или noindex до сверки |

### Легаси-посты WP без переписывания (23) — см. F4

## Приоритизированные рекомендации

| # | Рекомендация | Impact | Effort | Детали |
|---|---|---|---|---|
| 1 | Починить пустые витрины 3 гайдов | high | S | `/zaimy-bez-otkaza/` — сортировка по `approvalPct` вместо фильтра; `no_photo`/`new` — проставить по сверенным данным или noindex. Заодно рендерить в SSR только подходящие карточки (уходит 34–46% общего текста между гайдами) |
| 2 | Слить `/stati/kak-rabotaet-refinansirovanie-kredita/` в возрастной pillar | high | S | 301 + 12 ссылок (список в F2) на `/credit/refinansirovanie-kredita-chto-eto-znachit.html`; витрина рефинансирования на pillar |
| 3 | Переписать `/credit/kak-polychit-povtornoe-refinansirovanie-ipoteki.html` вместо 301 | high | M | спрос «сколько раз можно рефинансировать ипотеку»; убрать правило `.htaccess:188`; монетизация через страхование ипотеки |
| 4 | Статья «Период охлаждения по кредитам» + 301 двух легаси-постов на неё | high | M | `.htaccess:195,201`; 9-ФЗ от 13.02.2025 (сверить по первоисточнику) |
| 5 | Цифры в bank-статьях (Сбер, ВТБ, УБРиР) | medium | M | датированная таблица «по данным сайта банка на …» + ссылка; ежеквартальный refresh |
| 6 | Развести пары-каннибалы `stoit-li`/`perekreditovanie` и `pomosh`/`agentstvo` | medium | S | title и фокус по F2; без смены URL |
| 7 | Источники и перелинковка в 8 статьях `/stati/`, 8 гайдах, 3 новостях | medium | S | `ymyl-content` требует источник; починить ссылку `news/samozapret…:16` |
| 8 | Обновить ключевую ставку 24.10.2026 | medium | S | `vklady.mdx:19,50`, `debetovye-karty.mdx:65`; добавить `updatedDate` гайдам (поле в схеме) |
| 9 | Слить `/zaimy-s-prosrochkami/` в `/zaimy-s-plohoj-ki/` | medium | S | 1 оффер, один интент по подсказкам |
| 10 | Переиспользовать finhelp editorial по карте F8 | medium | M | 9 вливать в существующие страницы, 8 гэпов закрепить за одним сайтом и переписать (совпадение 5-грамм < 15%) |
| 11 | Честные `publishDate` у новостей | low | S | фактическая дата публикации на домене |
| 12 | Офтоп-посты WP: 410 вместо 301 на `/novosti/` | low | S | только после проверки внешних ссылок в Вебмастере; `pochta-bank` → `/vklady/` |
| 13 | Поправить `ymyl-content/SKILL.md`: 130% → 100% с 01.04.2026 | low | S | иначе следующий агент-писатель внесёт устаревший лимит |
| 14 | Гэп «рефинансирование микрозаймов» | low | M | сильные подсказки («с просрочками», «онлайн»), но высокий YMYL-риск («без отказа») и нет прямого оффера — после п.1–6 |

## Источники

Код и данные:
- `${APP}/src/content/{articles,guides,news,service-pages,offers,services}/*` — метрики посчитаны скриптом (scratchpad сессии)
- `${APP}/src/content.config.ts:59,83-96,133-142`
- `${APP}/src/scripts/offers-ui.ts:29,80`; `${APP}/src/components/Showcase.astro:20,28`
- `${APP}/src/pages/credit/[slug].astro`, `${APP}/src/pages/stati/[...slug].astro`, `${APP}/src/pages/[guide].astro`
- `${APP}/public/.htaccess:169-219` (301 легаси-постов)
- `/Users/deniskononov/rencredit-pilot-wt/legacy/rencredit/REPORT.md`, `legacy/rencredit/posts/*.json`, `map.json`
- `/Users/deniskononov/rencredit-pilot-wt/.claude/skills/ymyl-content/SKILL.md`
- `/Users/deniskononov/rencredit-pilot-wt/sites/affiliate_pool.json`
- `docs/seo-rencredit/{rencredit_content_inventory.tsv,rencredit_dist_paths.txt,finhelp_articles_reuse.tsv}`
- `/Users/deniskononov/mosseo-site-pipeline/sites/finhelp-ru/editorial/*.json`
- `/Users/deniskononov/mosseo-site-pipeline/docs/seo/04-competitors.md` (§1, §5, §8), `05-keyword-gap.md`

Живой сайт (2026-10-19):
- https://rencredit-online.ru/sitemap-0.xml (83 URL)
- https://rencredit-online.ru/zaimy-bez-otkaza/ (Playwright: 0 из 22 видимых), https://rencredit-online.ru/zaimy-s-prosrochkami/ (1 из 22)
- https://rencredit-online.ru/credit/kak-polychit-povtornoe-refinansirovanie-ipoteki.html → 301 на `chto-eto-znachit`
- https://rencredit-online.ru/mfo/vivus/, /mfo/denga/, /karty/otp-120/, /kredity/tbank-refinansirovanie/ (слов в `<main>`)

Спрос и выдача:
- Подсказки Яндекса: https://suggest.yandex.ru/suggest-ff.cgi — сиды «рефинансирование кредита», «рефинансирование в втб», «рефинансирование в сбербанке», «рефинансирование ипотеки», «сколько раз можно рефинансировать», «период охлаждения по кредитам», «агентство по рефинансированию», «рефинансирование микрозаймов», «рефинансирование с плохой кредитной», «займы без отказа»
- [bankiros.ru — ВТБ рефинансирование](https://bankiros.ru/bank/vtb/kredity-refinansirovanie/murmansk) (ставка от 7,7%, ПСК 17,9–40,9%, обновлено 13.10.2026)
- Период охлаждения: [skillbox.ru/media](https://skillbox.ru/media/money/v-rossii-vveli-period-ohlazhdeniya-dlya-kreditov-rasskazyvaem-glavnoe-o-zakone/), [buh.ru](https://buh.ru/articles/period-okhlazhdeniya-po-kreditam-kak-poluchit-dengi-v-2025-godu.html), [spmag.ru](https://spmag.ru/amp/news/period-ohlazhdeniya-dlya-kreditov-s-1-sentyabrya-chto-nuzhno-znat-zaemshiku) — вторичные, перед публикацией сверить 9-ФЗ на publication.pravo.gov.ru
