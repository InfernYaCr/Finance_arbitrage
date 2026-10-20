# 04 — Конкуренты и выдача (rencredit-online.ru / «Мерка»)

Дата: 2026-10-19 · Линза: «Конкуренты и выдача» · Автор: старший SEO-аналитик (агент)
Объект: https://rencredit-online.ru/ (Astro, бренд «Мерка», 83 URL в `sitemap-0.xml`, 33 кредитных и 50 некредитных офферов)
Стартовая точка: `docs/seo/04-competitors.md` (finhelp-ru). Выводы оттуда про дубль донора, балласт оффер-карточек и битые ссылки к rencredit **не относятся**. Ниже то, что переносится, и то, что нужно добавить именно для этого домена.

---

## Резюме

1. **«Возраст домена» сильно переоценён.** По whois домен зарегистрирован **2024-04-24** (`created: 2024-04-24T15:17:43Z`, регистратор BEGET-RU). Раньше он принадлежал другому владельцу: в Wayback за 2019–2022 там висит клон банка с title «Ренессанс Кредит - Личный кабинет онлайн вход» и «Ренессанс Кредит личный кабинет: вход, регистрация, взять кредит», пути `/lk/`, `/ios/`, `/podkluch/`, `/reg/`. В 2023-м и до апреля 2024-го снимков нет, то есть домен успел освободиться. Реальная тематическая история у текущего владельца — около 2,5 лет WP-контента про рефинансирование (2024-04 → 2026-10). Ссылочное и поведенческое наследие 2018–2022 годов при этом брендовое: «личный кабинет Ренессанс».
2. **Брендовую выдачу полностью держат банк и T1-агрегаторы.** У каждого крупного агрегатора есть свой хаб `/bank/rencredit/*` с гео-матрицей: myfin, bankiros, brobank, sravni, finuslugi, 1000bankov, vbr. Малому сайту места там нет, и лезть туда не нужно.
3. **Название домена буквально совпадает с брендовым запросом.** `rencredit-online` = «ренессанс кредит онлайн», а в подсказках Яндекса это 10 из 10 навигационных хвостов («…онлайн заявка на кредит наличными», «…онлайн личный кабинет»). Брендовый трафик возможен, но конвертировать его нельзя. В правилах CPA-оффера самого Ренессанс Банка (Pampadu) прямо сказано: «Запрещено использование доменов похожих на домен rencredit.ru», а запросы с «rencredit / ренессанс / ренкредит» считаются брендовым трафиком. Нарушение = списание заработка и отключение. Товарный знак №394151 принадлежит КБ «Ренессанс Кредит» (ООО) и действует до 11.08.2028.
4. **Сильная тематическая сторона домена — рефинансирование, а не МФО.** Информационный хвост по рефинансированию («рефинансирование или реструктуризация», «рефинансирование кредитки выгодно ли», «рефинансирование микрозаймов в банке») держат финмедиа и журналы банков (journal.sovcombank.ru, media.halvacard.ru, vtb.ru/articles, kurs.alfabank.ru, finance.rambler.ru). В топ там пролезают и слабые сайты (finance.kz, asofrayle.org, tenchat.ru), так что окно есть. Head-запросы («рефинансирование кредита», «лучшие предложения») заняты гео-матрицами bankiros, finuslugi, sravni и 1000bankov.
5. **Монетизация не совпадает с тематикой домена.** Под рефинансирование всего 2 оффера (`alfa-refinansirovanie`, `tbank-refinansirovanie`), под МФО — 22. Но МФО-head в выдаче — это паразиты vc.ru (в индексе WebSearch 9 из 9 по «займ на карту … октябрь 2026») плюс T1, так что малому сайту там ловить нечего. Мост «рефинансирование → кредит наличными, кредитка с льготным периодом» монетизируется лучше, чем прямой МФО-трафик.
6. **При миграции потеряно 101 легаси-URL.** В Wayback есть 145 уникальных адресов `/credit/*.html`. Сейчас 14 из них отдают 200, 30 — 301, а **101 — 404**, и ни одного из этих 101 нет в `legacy/rencredit/map.json` (208 записей, собран из REST-экспорта 37 постов). Минимум 52 из этих 101 ещё отдавали 200 в снимках января–марта 2026, а 75 — по теме рефинансирования. Это и есть накопленная «история», которую сайт выбросил.
7. **Позиции в Яндексе не подтверждены.** Firecrawl и Exa вернули 401, Яндекс отдаёт 302 на антибот (обходить не стал), WebSearch — это US-индекс. В нём rencredit-online.ru не нашёлся ни по одному из 15 запросов, даже по точному `"rencredit-online"`. Реальные данные даст только Вебмастер «Поисковые запросы» с разбивкой бренд/небренд (R1).

---

## 0. Методика и ограничения

| Источник | Что сделано | Статус |
|---|---|---|
| `curl` живого сайта | `/`, `/robots.txt`, `sitemap-index.xml` → `sitemap-0.xml` (83 `<loc>`), `/o-proekte/`, статусы легаси-URL | ок |
| whois (`whois.tcinet.ru`) | дата регистрации, регистратор | ок |
| Wayback CDX + снимки | `web.archive.org/cdx/search/cdx?url=rencredit-online.ru/*`, снимки 2019-07-23, 2021-12-20, 2022-03-14, 2025-02-14, 2026-01-23 | ок (один раз ответил 429, повторный запрос прошёл) |
| Подсказки Яндекса | `suggest.yandex.ru/suggest-ff.cgi`, `lr=213`, 6 брендовых сидов | ок |
| WebSearch | 15 запросов (бренд + небренд) | US-индекс: показывает присутствие, а не позиции в Яндексе |
| Firecrawl search, Exa search | — | **401**, ключи невалидны (как и в finhelp-отчёте) |
| Выдача Яндекса | один `curl` → 302 на антибот | не обходил |
| WebFetch | pampadu.ru (правила оффера Ренессанс Банка) | ок |

---

## 1. Домен: что на самом деле значит «возраст»

| Период | Что было на домене | Доказательство |
|---|---|---|
| 2018-02 | домен существует | Wayback: `rencredit-online.ru/robots.txt` 200 (20180213) |
| 2019-07 → 2022-10 | **клон банка**: «Ренессанс Кредит - Личный кабинет онлайн вход», меню «Заявка на кредит онлайн», «Вклад — Ренессанс Доходный», пути `/lk/`, `/ios/`, `/podkluch/`, `/reg/`, Cloudflare | снимки 20190723, 20211220, 20220314, 20221004 |
| 2023 → 2024-04 | пауза: в CDX статус «-», снимков страниц нет | CDX 20230307, 20240425 |
| **2024-04-24** | **новая регистрация** (текущий владелец) | whois `created: 2024-04-24T15:17:43Z`, `paid-till: 2027-04-24` |
| 2024 → 2026-10 | WP + OceanWP, «Все о рефинансировании кредита», `/credit/<slug>.html`, новости и заимствованные тексты | снимки 20250214, 20260123; `PROJECT_BRIEF.md:125-144` |
| 2026-10 | Astro, «Мерка», 83 URL | `last-modified: Sat, 17 Oct 2026` |

**Выводы**
- Тезис «главная ценность — возраст» (`PROJECT_BRIEF.md:137`) нужно понизить. Для Яндекса это сайт, у которого сменился владелец, с ~2,5 годами тематики «рефинансирование». Внешние ссылки 2019–2022 годов с высокой вероятностью вели на брендовые страницы «личный кабинет Ренессанс» и с брендовыми анкорами. Такое наследие **усиливает** ассоциацию домена с банком, а не помогает сайту.
- Старые брендовые пути `/lk/`, `/ios/`, `/podkluch/`, `/reg/` сейчас отдают 404. **Так и оставить**: перенаправлять брендовые ссылки на коммерческие страницы нельзя.

---

## 2. Брендовая выдача «ренессанс кредит …»

### 2.1 Спрос (подсказки Яндекса, lr=213)

| Сид | Хвосты (топ-10) | Интент |
|---|---|---|
| `ренессанс кредит` | банк, официальный сайт, личный кабинет ×3, горячая линия ×2, кредитная карта, телефон | навигационный |
| `ренессанс кредит онлайн` | онлайн заявка на кредит наличными / на карту / на карту сбербанка / без справок и поручителей / на кредитную карту, личный кабинет, онлайн банк | навигационно-транзакционный, **точно совпадает с именем домена** |
| `rencredit` | ru официальный сайт, **что это за банк ×2**, интернет банк личный кабинет, личный кабинет войти | навигация + проверка «официальный ли это» |
| `рен кредит` / `ренкредит` | официальный сайт ×4, личный кабинет ×3 | навигационный |
| `ренессанс онлайн` | онлайн банк, личный кабинет, вход, **онлайн агент**, «осгоп для такси… ренессанс» (это страховая) | навигационный, путаница с «Ренессанс Страхование» |
| `rencredit online` | подсказок нет | латинский спрос близок к нулю |
| `рефинансирование ренессанс` | 10 из 10 брендовых хвостов (см. `05-keyword-gap.md:26`) | транзакционный брендовый |

### 2.2 Кто ранжируется (WebSearch; в Яндексе сайт банка rencredit.ru почти наверняка №1 — не подтверждено)

| Запрос | Домены и URL | Формат |
|---|---|---|
| рефинансирование ренессанс кредит | ru.myfin.by/bank/rencredit/refinansirovanie-kredita · brobank.ru/credit-rencredit-refin/ (+ /faq/) · finuslugi.ru/banki/renessans_kredit/potrebitelskie_kredity/teg_refinansirovanie/reg_saratovskaja_oblast/saratov · bankiros.ru/bank/rencredit/kredity-refinansirovanie/doneck · sravni.ru/bank/renessans-kredit/kredity/refinansirovanie-s-prosrochkami/ · pampadu.ru (CPA-оффер) | банк-хаб агрегатора × продукт × город |
| кредит ренессанс онлайн | vbr.ru/otvety/…/kreditnaya-karta-renessans-kredit--mojno-li-oformit-seicas-onlain-/ · ru.myfin.by/bank/rencredit/kredit-onlain-na-kartu, /onlain-kredit · brobank.ru/banki/rencredit/credits · bankiros.ru/bank/rencredit/kredity-online-zayavka/{kursk,bavli,tver…} · finuslugi (Майкоп, Люберцы) · apps.apple.com/app/id1083085558 | гео-матрица «онлайн-заявка» |
| ренессанс кредит личный кабинет | bankiros.ru/wiki/term/wikf-renessans-kredit-voyti-v-lichnyiy-kabinet · brobank.ru/banki/rencredit/lichniy-kabinet/ · 1000bankov.ru/bank/3354/lichniy-kabinet/ (интерстишл «Вы переходите на сайт rencredit.ru») | how-to «как войти» — **именно этот запрос таргетировал прежний владелец домена** |
| ренессанс банк рефинансирование отзывы 2026 | 1000bankov.ru/bank/3354/kredit-nalichnymi-renessans/ · bankiros (Чебоксары, Донецк, Хебда) · myfin · finuslugi | отзывы + продукт |
| ренессанс кредитная карта 145 дней | finuslugi.ru/kreditnye_karty/renessans_kredit_145_dnej_bez_procentov · sravni.ru/karty/bank/renessans-kredit/region/{aprelevka,batajsk,…} (8 гео-URL) | продукт + гео |
| `"rencredit-online"` | нашего домена нет; есть en.wikipedia Renaissance_Credit, affilitizer anketa.rencredit.ru | — |

**Паттерн.** Т1 закрывают бренд программно: `/bank/<bank>/<product>/<city>`. Тысячи URL на трасте домена, ПСК-диапазоны расходятся между площадками (рефинансирование: 13,7–29,8% на finuslugi против 9,9–42,9% на bankiros), дат обновления нет. Сайт банка и T1 полностью закрывают навигационный интент. Малый сайт с брендом в домене может получить только **случайные показы** по «ренессанс кредит онлайн заявка», причём с отказом пользователя (он искал банк). Это плохие поведенческие сигналы, а не трафик.

### 2.3 Риск и трафик: матрица решений

| Фактор | Факт | Последствие |
|---|---|---|
| Товарный знак | №394151, КБ «Ренессанс Кредит» (ООО), до 11.08.2028 (companies.rbc.ru/trademark/394151/) | домен «сходен до степени смешения». Суды по доменам в большинстве случаев встают на сторону правообладателя (обзор: habr.com/en/post/180235) |
| История домена | 2019–2022 — клон «личного кабинета» банка | у банка/антифрода домен, вероятно, уже на заметке; в Яндексе могут сохраниться фишинговые/жалобные метки — проверить в Вебмастере «Безопасность и нарушения» |
| CPA самого банка | Pampadu «Ренессанс Банк ПК Выдача»: 12 000 ₽ за выдачу, но **запрещены домены, похожие на rencredit.ru**, брендовый контекст и брендовые запросы (в списке: ренессанс, ренесанс, renessans, renaissance, rencredit, ренкредит) | монетизировать бренд нельзя ни напрямую, ни через этот оффер |
| «Ренессанс Жизнь» в пуле | 2 оффера в `sites/affiliate_pool.json` (insurance, `saleads-69444db0` approve, `saleads-e8004440` wait); в `services/*.json` rencredit их нет (grep проверен) | **держать вне rencredit**: другая компания, но то же слово «Ренессанс» на домене rencredit усиливает путаницу |
| Текущая гигиена | title главной «… \| Мерка», слова «Ренессанс» на главной нет; `/o-proekte/`: «Сайт не является сайтом банка или МФО…»; на главной: «Мерка не является МФО или банком» | хорошо, но нет явной фразы «не связан с КБ «Ренессанс Кредит»» (компромисс разобран в R3) |
| Брендовый трафик | спрос большой, но навигационный («официальный сайт», «личный кабинет», «что это за банк») | ценность ≈0: нет конверсии и есть риск. Цель — **не ранжироваться** по бренду |

---

## 3. Небрендовая выдача: где пролезает небольшой сайт

Обозначения: T1 — финплатформы, T2 — финмедиа и журналы банков, Пар — vc.ru/dtf, Сл — слабые/малые сайты в топе (индикатор окна).

| # | Запрос | Кто в выдаче (WebSearch) | Есть ли Сл | Наше покрытие | Шанс |
|---|---|---|---|---|---|
| 1 | рефинансирование кредитов других банков лучшие предложения (октябрь 2026) | T1: bankiros.ru/credits/refinansirovanie (+?page=2, гео /respublika-bashkortostan-oktyabrskiy), finuslugi «teg_20_luchshih_programm_refinansirovaniya/reg_*», 1000bankov.ru/refinans/ipotek/, sravni.ru/text/kogda-luchshe-refinansirovat-kredit-v-oktyabre-2026-goda/ (ежемесячная статья) | нет | `/kredity/` (2 оффера рефинансирования), 14 легаси-статей | ≈0 по head |
| 2 | рефинансирование с плохой КИ какие банки одобряют | T1: sravni /kredity/refinansirovanie-s-plohoy-ki (34 предложения, 21 банк), bankiros, finuslugi navigator, brobank; vbr otvety | **да**: finance.kz, asofrayle.org | `/credit/refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov.html` | низкий-средний |
| 3 | рефинансирование или реструктуризация что выбрать | T2: finance.rambler.ru ×2, journal.sovcombank.ru, media.halvacard.ru, kurs.alfabank.ru; T1: myfin terminy | **да**: tenchat.ru, finance.kz | частично (`refinansirovanie-kredita-chto-eto-znachit` — «отличие от реструктуризации»); отдельный легаси-URL `refinansirovanie-ili-restryktyrizaciia-…` сейчас 404 | **средний-высокий** |
| 4 | рефинансирование кредитной карты другого банка выгодно ли | T2: journal.sovcombank.ru ×2, finance.rambler.ru, vtb.ru/articles, media.halvacard.ru; brobank; vbr | **да**: asofrayle.org/?p=210264, kapital.kz | нет (легаси `kak-provesti-refinansirovanie-kreditki.html` и `kak-i-gde-polychit-refinansirovanie-kreditnoi-karty.html` → 404) | **высокий** — мост на 7 кредиток (`/karty/`) |
| 5 | рефинансирование микрозаймов МФО в банке можно ли | pravoved.ru ×2, vbr otvety, ppt.ru, finance.rambler.ru, bankiros news | **да**: finance.kz | нет (легаси `kak-proizvesti-refinansirovanie-mikrozaimov-mfo.html`, `razreshat-li-v-banke-refinansirovat-mikrozaim-s-prosrochkami.html` → 404) | **высокий** — связывает 22 МФО и 2 рефинансирования |
| 6 | рефинансирование в {банк} (Интерпромбанк, УБРиР, РСХБ…) | finuslugi product-URL, PDF-тарифы банка (ipb.ru/doc/tariffs/2025/…), brobank, sravni bank-хаб | нет | 6 статей по банкам (Сбер, ВТБ, РСХБ, Открытие, Интерпромбанк, УБРиР) | низкий; монетизации у этих банков нет. Плюс энтити-путаница: поиск читает «Интерпромбанк» как Интерпрогрессбанк (ipb.ru) |
| 7 | займ на карту онлайн топ МФО (октябрь 2026) | Пар: vc.ru/1549850, /1380640, /1451361, /1559298, /1565653; каталоги доменов tapki.com | «да», но это доры (zaimcho.ru, kred6.ru) | `/zaimy-na-kartu/` + 8 гайдов | ≈0 по head (как в finhelp §1) |
| 8 | кредитная карта 120 дней без процентов лучшие 2026 | T1: finuslugi гео (Москва, Салават, Михайловка), 1000bankov.ru/karty/120-dney/, sravni.ru/karty/besprocentnym-periodom-120-dney (77 предложений / 36 банков на 08.2026), brobank рейтинги ×3; sostav.ru/blogs/287313/97508 (115 vs 120 vs 180) | **да**: sostav-блог (UGC) | `/karty/uralsib-120/`, `/karty/otp-120/`, `/karty/akbars-115/` | низкий по head, **средний** по «115 или 120 дней», «подвох» |
| 9 | кредитная карта или займ что выгоднее | tbank.ru/finance/blog, riamo.ru (2026), brobank, vbr ×2, media.mts.ru, lady.mail.ru, myfin.by, gordonua | **да**: gordonua, lady.mail | `/stati/kreditnaya-karta-ili-zajm/` | **средний-высокий** — уже есть страница |

**Вывод по разделу.** Окно есть там, где выполняются три условия: (а) информационный интент про рефинансирование или долги, (б) в топе уже сидят журналы банков и UGC, а не только T1, (в) запрос можно увести на наш оффер. Это строки 3, 4, 5, 9 и узкие строки 8. Ровно эти темы на домене **уже были** в виде легаси-URL (§5), то есть Яндекс видел их на этом хосте.

---

## 4. Что берём из finhelp-отчёта, а что нет

| Тезис finhelp (`docs/seo/04-competitors.md`) | Для rencredit |
|---|---|
| Резюме 1, ВЧ head закрыт T1 + Яндекс «Вертикаль», ОСАГО в поиске | **переносится**: `/osago/`, `/kasko/`, `/vklady/` по head не продвигать |
| Резюме 2, §4: гео-матрицы не повторять | **переносится**, а для бренда — вдвойне (`/bank/rencredit/<city>` у T1) |
| Резюме 3, §5: регуляторное окно (лимит 2 займов с ПСК > 200% с 01.10.2026, «один заём в руки» с 01.04.2027) | **переносится**: новость `/novosti/mfo-limit-psk-200-s-1-oktyabrya-2026/` уже есть, evergreen-гайда нет |
| Резюме 4: паразиты vc.ru в МФО | **переносится**: подтверждено заново, 5 из 9 результатов по «займ на карту … октябрь 2026» ведут на vc.ru |
| Резюме 6, §3: у T1 нет экспертов с именами, методики, дат | **переносится**: на `/o-proekte/` нет автора, ИНН/ОГРН и редакции (по тексту страницы найдены только «не является сайтом банка или МФО») |
| Резюме 5, 7, §7: дубль донора, 207 тонких карточек, `/go/` открыт | **не относится**: `robots.txt` уже содержит `Disallow: /go/` (`src/pages/robots.txt.ts:8`); донора нет |
| §8 C «X vs Y» по нашим офферам | **переносится**, пары у rencredit свои: Уралсиб 120 vs ОТП 120 vs Ак Барс 115, Халва vs Т-Банк, Альфа-рефинансирование vs Т-Банк-рефинансирование |
| Переиспользование статей finhelp (`finhelp_articles_reuse.tsv`, 30 шт.) | **с оговоркой**: оба сайта из одной сети, поэтому одинаковые тексты = аффилированность и дубль внутри сети. Брать структуру, факты и таблицы, а текст писать заново. Самое тематически близкое: `pochemu-mfo-otkazyvayut-v-zajme`, `novye-pravila-mfo-2026`, `120-dnej-bez-procentov-podvodnye-kamni`, `otkaz-ot-strahovki-po-kreditu`, `kollektory-chto-mogut-po-zakonu` |

---

## 5. Легаси: 101 потерянный URL с историей

Скрипт: CDX `rencredit-online.ru/*` (`collapse=urlkey`) → 145 уникальных `/credit/*.html` → `curl` текущего статуса.

| Статус сейчас | Кол-во | Комментарий |
|---|---|---|
| 200 | 14 | rewrite-статьи на прежнем URL (`public/.htaccess:57-58`, canonical на `.html`) |
| 301 | 30 | новости → `/novosti/`, ипотечные → `/credit/refinansirovanie-kredita-chto-eto-znachit.html`, `page/N` → `/stati/` (из `map.json`) |
| **404** | **101** | **ни одного нет в `legacy/rencredit/map.json`** (208 записей, источник — REST-экспорт 37 постов, `legacy/rencredit/REPORT.md`) |

Из 101: 75 по теме рефинансирования, 29 про ипотеку, **52 отдавали 200 в снимках 2026-01-23…2026-03-06**. Значит, их удалили из WP незадолго до экспорта, и в индексе и ссылочном графе Яндекса они ещё живы. Примеры с прямым небрендовым интентом:
`refinansirovanie-kredita.html`, `refinansirovanie-ili-restryktyrizaciia-chto-vybrat-dlia-ymensheniia-plateja-po-kredity.html`, `kak-proizvesti-refinansirovanie-mikrozaimov-mfo.html`, `razreshat-li-v-banke-refinansirovat-mikrozaim-s-prosrochkami.html`, `gde-oformit-refinansirovanie-kreditov-s-prosrochkoi.html`, `odobriat-li-refinansirovanie-v-banke-esli-net-spravki-o-dohodah.html`, `kogda-vygodno-oformliat-refinansirovanie-a-kogda-kreditnye-kanikyly.html`, `prichiny-otkaza-v-refinansirovanii-kotorye-skryvaut-banki.html`, `refinansirovanie-kreditnoi-karty-tinkoff.html`, `kak-i-gde-polychit-refinansirovanie-kreditnoi-karty.html`.
Мусор, который пусть остаётся 404/410: `metallicheskaya-setka-vidy-osobennosti-i-primenenie.html`, `novak-moratorii-…-rysgidro…`, `iena-dorojaet-…`, `nacbank-ykrainy-…`.

Полный список со статусами: `/tmp/rc_legacy_status.txt` (временный, при необходимости перегенерировать CDX-запросом из §0).

---

## 6. Приоритизированные рекомендации

| # | Рекомендация | Impact | Effort |
|---|---|---|---|
| R1 | **Снять реальные данные Яндекса до решений.** Вебмастер → «Поисковые запросы» за 90 дней, разбить регэкспом `ренессанс\|ренесанс\|rencredit\|ренкредит\|рен кредит` на бренд и небренд. Посмотреть «Безопасность и нарушения», «Внешние ссылки» (анкоры 2019–2022 с «личный кабинет»), «Страницы в поиске → исключённые» (какие из 101 легаси-URL Яндекс ещё помнит). Если брендовых показов > 30% — сигнал к переезду (R9) | high | S |
| R2 | **Бренд-лок в контенте**: ни одного «Ренессанс» в title/H1/slug/анкорах/schema; правило уже предложено в `05-keyword-gap.md:78` — закрепить в `ymyl-content`. Старые брендовые пути `/lk/ /ios/ /podkluch/ /reg/` оставить 404 (не редиректить) | high | S |
| R3 | **Явный дисклеймер о несвязанности** только на `/o-proekte/` и `/politika-konfidencialnosti/`: «Сайт не связан с КБ «Ренессанс Кредит» (ООО) и его товарными знаками». В футер на все страницы не ставить: это добавит слово «Ренессанс» на 83 URL и усилит ранжирование по бренду | high | S |
| R4 | **Не подключать брендовые офферы на этот домен**: Ренессанс Банк (Pampadu прямо запрещает похожие домены), «Ренессанс Жизнь» (2 оффера в пуле) — только на других сайтах сети | high | S |
| R5 | **Вернуть легаси-историю**: дописать в `map.json` 101 URL. Около 60 тематических → 301 на ближайшую живую страницу (`/credit/refinansirovanie-kredita-chto-eto-znachit.html`, `/stati/kak-rabotaet-refinansirovanie-kredita/`, `/kredity/`, `/karty/`, `/novosti/`), мусор → 410. Перегенерировать `.htaccess` через `gen_htaccess.py` (`public/.htaccess:61`) | high | S |
| R6 | **Кластер «рефинансирование → долги → кредитка»** (строки 3–5 §3): 6–8 новых статей на тех же темах, что были легаси-URL. Потом перевести 301 из R5 на эти статьи: рефинансирование или реструктуризация; рефинансирование кредитки; рефинансирование микрозаймов в банке; рефинансирование с просрочкой; без справки о доходах; рефинансирование или кредитные каникулы. Каждая ведёт на `alfa-refinansirovanie`, `tbank-refinansirovanie` и кредитки | high | M |
| R7 | **Сравнения «X vs Y» по своим офферам**: «Уралсиб 120 или ОТП 120 или Ак Барс 115», «Альфа или Т-Банк: рефинансирование», «Халва или кредитка Т-Банка», «кредитка или займ» (страница есть — усилить таблицей ПСК) | medium | M |
| R8 | **Evergreen-гайды по регуляторике МФО** (из finhelp R2): «сколько займов можно иметь с 01.10.2026», «один заём в руки с 01.04.2027». Новость уже есть, гайда нет | medium | S |
| R9 | **Решение о переезде** на нейтральный домен через 301 + «Переезд сайта» в Вебмастере. Принимать после R1: если брендовая доля высокая или есть флаги безопасности. Тематический вес рефинансирования переедет, брендовая путаница и риск по ТЗ останутся на старом домене | high | L |
| R10 | **E-E-A-T, которого нет у T1**: именной автор и рецензент, «Как мы зарабатываем», методика, видимая дата и `dateModified`. На `/o-proekte/` сейчас нет ни автора, ни реквизитов | medium | M |
| R11 | **Банк-специфичные статьи без монетизации** (РСХБ, Интерпромбанк, УБРиР, Открытие) не расширять. В статье про Интерпромбанк проверить, о каком банке речь (поиск путает его с Интерпрогрессбанком, ipb.ru), и актуальность лицензии | low | S |
| R12 | Мониторинг: починить ключи Firecrawl и Exa, снять топ-10 Яндекса по ~50 запросам из §2–3 (Топвизор/Keys.so) раз в 2 недели | medium | S |

---

## 7. Источники

Домен и история:
- whois: `whois -h whois.tcinet.ru rencredit-online.ru` (created 2024-04-24T15:17:43Z, registrar BEGET-RU), 2026-10-19
- https://web.archive.org/web/20190723180953/http://rencredit-online.ru/ · https://web.archive.org/web/20211220115930/http://rencredit-online.ru/ · https://web.archive.org/web/20220314163029/http://rencredit-online.ru/ · https://web.archive.org/web/20250214052639/http://rencredit-online.ru/ · https://web.archive.org/web/20260123082917/http://rencredit-online.ru/
- CDX: https://web.archive.org/cdx/search/cdx?url=rencredit-online.ru/*&collapse=urlkey
- Живой сайт (curl 2026-10-19): https://rencredit-online.ru/ , /robots.txt , /sitemap-0.xml , /o-proekte/
- Локально: `/Users/deniskononov/rencredit-pilot-wt/PROJECT_BRIEF.md:125-144`, `…/legacy/rencredit/map.json`, `…/legacy/rencredit/REPORT.md`, `…/web/apps/rencredit/public/.htaccess:57-61`, `…/web/apps/rencredit/src/pages/robots.txt.ts:8`, `…/web/apps/rencredit/docs/BRAND.md:7`, `…/sites/affiliate_pool.json` (Ренессанс Жизнь), `docs/seo-rencredit/05-keyword-gap.md:26,78`

Бренд, ТЗ, CPA:
- https://pampadu.ru/affiliate-program/cash-loan/api-renessans-bank-pk-vydacha-ru/ (запрет похожих доменов и брендового трафика, 12 000 ₽ за выдачу)
- https://companies.rbc.ru/trademark/394151/ (ТЗ №394151, до 11.08.2028)
- https://habr.com/en/post/180235 (практика доменных споров по ТЗ)
- https://finance.rambler.ru/money/49906933-v-banke-renessans-kredit-startoval-rebrending/ (ребрендинг в «Ренессанс Банк»)
- https://www.affilitizer.com/programs/anketa.rencredit.ru
- Подсказки: https://suggest.yandex.ru/suggest-ff.cgi?part=…&lr=213 (сиды из §2.1)

Брендовая выдача:
- https://ru.myfin.by/bank/rencredit/refinansirovanie-kredita , https://ru.myfin.by/bank/rencredit/kredit-onlain-na-kartu , https://ru.myfin.by/bank/rencredit/onlain-kredit
- https://brobank.ru/credit-rencredit-refin/ , https://brobank.ru/credit-rencredit-refin/faq/ , https://brobank.ru/banki/rencredit/credits , https://brobank.ru/banki/rencredit/lichniy-kabinet/
- https://bankiros.ru/bank/rencredit/kredity-refinansirovanie/doneck , https://bankiros.ru/bank/rencredit/kredity-online-zayavka/kursk , https://bankiros.ru/wiki/term/wikf-renessans-kredit-voyti-v-lichnyiy-kabinet
- https://www.sravni.ru/bank/renessans-kredit/kredity/refinansirovanie-s-prosrochkami/ , https://www.sravni.ru/karty/bank/renessans-kredit/region/aprelevka/
- https://finuslugi.ru/banki/renessans_kredit/potrebitelskie_kredity/teg_refinansirovanie/reg_saratovskaja_oblast/saratov , https://finuslugi.ru/kreditnye_karty/renessans_kredit_145_dnej_bez_procentov
- https://1000bankov.ru/bank/3354/lichniy-kabinet/ , https://1000bankov.ru/bank/3354/kredit-nalichnymi-renessans/
- https://www.vbr.ru/otvety/kreditnie_karti/kreditnaya-karta-renessans-kredit--mojno-li-oformit-seicas-onlain-/

Небрендовая выдача:
- https://bankiros.ru/credits/refinansirovanie , https://1000bankov.ru/refinans/ipotek/ , https://www.sravni.ru/text/kogda-luchshe-refinansirovat-kredit-v-oktyabre-2026-goda/
- https://www.sravni.ru/kredity/refinansirovanie-s-plohoy-ki , https://bankiros.ru/credits/refinansirovanie-s-plohoj-ki , https://finuslugi.ru/navigator/kredity/stat_refinansirovanie_s_plohoj_kreditnoj_istoriej , https://finance.kz/kredity/s-plohoy-kreditnoy-istoriey
- https://finance.rambler.ru/kredity/53872065/ , https://journal.sovcombank.ru/krediti/chem-otlichaetsya-restrukturizatsiya-kredita-ot-refinansirovaniya- , https://media.halvacard.ru/finance/chem-refinansirovanie-otlichaetsya-ot-restrukturizacii , https://kurs.alfabank.ru/vocabulary/refinansirovanie-kreditov/ , https://tenchat.ru/media/3899195-kreditnyye-kanikuly-ili-restrukturizatsiya-chto-vybrat-v-krizis
- https://journal.sovcombank.ru/krediti/mozhno-li-refinansirovat-kreditnuyu-kartu , https://www.vtb.ru/articles/chto-takoe-refinansirovanie-kreditnyh-kart/ , https://asofrayle.org/?p=210264 , https://www.vbr.ru/otvety/kreditnie_karti/mozhno-li-refinansirovat-kreditnuyu-kartu/
- https://ppt.ru/art/zaimy/sposoby-refinansirovaniya-mikrozaymov , https://www.vbr.ru/otvety/zaimi/mozhno-li-refinansirovat-mikrozajmy-vzyatye-cherez-internet/ , https://pravoved.ru/question/4743000/ , https://finance.kz/zaimy/refinansirovanie-mikrozajmov
- https://finuslugi.ru/potrebitelskie_kredity/interprogressbank_refinansirovanie_potrebitelskih_kreditov , https://ipb.ru/doc/tariffs/2025/ (PDF-тарифы)
- https://vc.ru/1549850 , https://vc.ru/1380640 , https://vc.ru/1565653 (паразиты МФО)
- https://1000bankov.ru/karty/120-dney/ , https://www.sravni.ru/karty/besprocentnym-periodom-120-dney , https://www.sostav.ru/blogs/287313/97508 , https://brobank.ru/credit-cards-rating/
- https://www.tbank.ru/finance/blog/credit-vs-creditcard/ , https://riamo.ru/articles/shpargalki/chto-vygodnee-v-2026-godu-zajm-kreditka-ili-rassrochka/ , https://media.mts.ru/technologies/186592
- База: `docs/seo/04-competitors.md` (finhelp-ru), регуляторика и SEO-контекст — см. его §10
