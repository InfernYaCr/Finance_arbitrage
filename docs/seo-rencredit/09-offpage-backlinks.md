# 09. Ссылочный профиль и внешние сигналы: rencredit-online.ru («Мерка»)

- **Дата проверки:** 2026-10-19.
- **Линза:** ссылки, упоминания, история домена, футпринты сети, дистрибуция. Основной поисковик — Яндекс.
- **Основа:** `docs/seo/09-offpage-network.md` (сделан для finhelp-ru). Общие выводы по рынку ссылок, анкорам, IndexNow и аффилиат-фильтру переиспользованы и перепроверены. Выводы finhelp про донор-дубль vsezaimyonline, битые ссылки и открытый `/go/` к rencredit не относятся: здесь `/go/` уже закрыт (см. §6).
- **Код:** `/Users/deniskononov/rencredit-pilot-wt`, ветка `feat/rencredit-metrika`.
- **Живой сайт:** сборка от 17.10.2026 (`last-modified: Sat, 17 Oct 2026 20:54:19 GMT`).

---

## Резюме

1. **Ссылочного профиля у домена практически нет.** Megaindex Domain Rank — **0**: формула `log5(IP×0,75+1)` даёт ноль, то есть в индексе Megaindex ссылающихся IP почти нет. Для сравнения: vsezaimyonline.ru — 36, rencredit.ru — 44, banki.ru — 54. Яндекс ИКС по бейджу `yandex.ru/cycounter` — «—», у mosseo.ru — 90, у vsezaimyonline.ru — 580. В открытом поиске упоминаний домена нет: выдача по `"rencredit-online.ru"` уводит на сайт банка rencredit.ru. «Ссылочную ценность старого домена» в бизнес-плане нужно считать равной нулю.
2. **«Возраст домена» как актив не подтверждается.** По whois текущая регистрация — `created: 2024-04-24`, регистратор BEGET-RU. До этого домен минимум дважды освобождался: в январе 2020 года Wayback показывает заглушку REG.RU «Истёк срок регистрации». У домена четыре эпохи (§2):
   - дорвей «Ренессанс Кредит — личный кабинет» с CPA leadgid;
   - снова дорвей «личный кабинет» в 2021–2022 годах;
   - WP-сайт «на продажу» на Telderi, со скриптами биржи ссылок linkslot.ru и NativeRent;
   - текущий Astro-сайт.

   Для Яндекса это смена владельца с обнулением истории. Хуже того, в истории остался «продажный» и брендовый дорвейный след.
3. **delen.ru вычищен полностью.** В старом экспорте было 20 ссылок в 9 постах (`legacy/rencredit/REPORT.md:38-46`). На живом сайте все 9 URL отдают 200, вхождений `delen` — **0**. В исходниках (`src/content/**`) и в `dist` — тоже 0. Других следов продавца на живом сайте нет: ни `telderi`, ни `linkslot`, ни `nativerent`, ни картинок с `lib.zaplata.ru`.
4. **Главная off-page потеря — 101 URL с 404.** Wayback знает 146 HTML-адресов домена. Из них сейчас:
   - **16** отдают 200;
   - **28** — 301;
   - **101 — 404**, все вида `/credit/<slug>.html`.

   Эти 101 страница отдавали 200 с февраля 2025 по 23.01.2026 (321 снимок, все 200). В `legacy/rencredit/map.json` их нет: из них там только 1 URL. Похоже, продавец удалил их до экспорта: к моменту экспорта в WP осталось 37 постов из примерно 138. Если у домена и были внешние ссылки и индекс, то в основном на эти URL, а сейчас они ведут в 404.
5. **Футпринты с сетью сейчас слабые, но три из них станут сильными со вторым сайтом на `@pbn/core`:**
   - общий пул офферов с теми же `/go/saleads-<id>/`;
   - хостинг Beget (тот же AS и /21, те же NS и регистратор);
   - Метрики 109623857 и 109164667. Их выдали почти одновременно, и если они под одним Яндекс ID, это связь сайтов.

   Перекрёстных ссылок между сайтами сети нет. Файла `yandex_b0966….html` от rostpoisk на rencredit нет (404).
6. **Покупать ссылки на rencredit-online.ru сейчас нельзя.** В `06-eeat-legal-trademark.md` рекомендован переезд на нейтральный домен «Мерки» из-за товарного знака банка (ст. 1484 ГК, досудебный запрет КЦ). Ссылка, купленная на домен, который могут отобрать, сгорает вместе с ним. До решения по домену можно развивать только сигналы на **бренд «Мерка»**: Дзен, vc.ru, Telegram/MAX и безанкорные упоминания. Они переживут переезд.

---

## 1. Что проверено и как

| Проверка | Метод | Результат |
|---|---|---|
| Whois | `whois -h whois.tcinet.ru rencredit-online.ru` | created 2024-04-24, paid-till 2027-04-24, BEGET-RU, `UNVERIFIED`, NS `ns{1,2}.beget.{ru,com,pro}` |
| DNS/IP | `dig` + RADB | A 87.236.16.51 (`ssl.atom4.beget.com`), route 87.236.16.0/21, **AS198610 (Beget)**; MX `mx{1,2}.beget.com` |
| История | Wayback CDX (`matchType=domain`, 770 строк по месяцам) + снимки главной `id_` | 2018–2026, §2 |
| Domain Rank | `https://api.megaindex.com/dr/?d=<домен>&json=1` | rencredit-online.ru **0**; vsezaimyonline.ru 36; rencredit.ru 44; banki.ru 54; delen.ru 22 |
| ИКС | `https://yandex.ru/cycounter?<домен>` (PNG-бейдж) | rencredit-online.ru «—»; mosseo.ru 90; vsezaimyonline.ru 580 |
| Упоминания | WebSearch `"rencredit-online.ru"`, Bing | 0 упоминаний домена: выдача про банк rencredit.ru |
| Статусы старых URL | `curl` по 146 HTML-путям из Wayback | 200 — 16, 301 — 28, **404 — 101** |
| delen.ru и следы продавца | grep по живым страницам, `src/content`, `dist`, `legacy/` | 0 на живом сайте |
| Футпринты | живой HTML rencredit и `yourkedm.beget.tech`, код `web/` и `sites/` | §6 |

**Ограничения.** Доступа к Яндекс Вебмастеру («Ссылки → Внешние ссылки»), Ahrefs, Majestic и Keys.so не было.
- checktrust.ru и DuckDuckGo отдали капчу или anomaly-челлендж. Обходить их я не стал.
- be1.ru грузит данные JS-ом, и через curl цифр не получить.
- Exa и Firecrawl-поиск ответили 401: ключи невалидны.

Поэтому §3 — оценка по косвенным признакам (DR 0, ИКС «—», ноль упоминаний). **Финальный список доноров нужно один раз выгрузить из Вебмастера** (рек. R1).

## 2. История домена (Wayback + whois)

| Период | Что было на домене | Признаки | Значение для ссылок |
|---|---|---|---|
| 2018-02 … 2019-07 | «Ренессанс Кредит — Личный кабинет онлайн вход»: копия разделов банка («Кредит пенсионерам», «Вклад — Ренессанс Доходный») | Исходящие на `go.leadgid.ru` (CPA). Снимок `20190723180953` | Брендовый дорвей под чужой ТЗ. Вероятные доноры — каталоги и сети дорвеев |
| 2020-01 | Заглушка REG.RU «Истёк срок регистрации домена» | Снимок `20200103170302` | **Первый дроп**: история обнуляется |
| 2021-12 … 2022-10 | «Ренессанс Кредит личный кабинет: вход, регистрация, взять кредит» | Метрика 74708692, `yandex-verification d8aa14071a7e8900`; исходящие на `ib.rencredit.ru`, `renessanskredit.ru`, `1sberbank.ru` | Сеть брендовых дорвеев одного владельца: renessanskredit.ru сейчас продаётся на REG.RU, 1sberbank.ru не отвечает |
| 2023 … 2024-04 | Пусто или 301 | — | **Второй дроп**; новая регистрация 2024-04-24 |
| 2024-08 … 2026-01 | WordPress 6.1.1, «Все о рефинансировании кредита», `/credit/<slug>.html` | Метрика 97221969, `yandex-verification f5adf900f309cebf`, `google-site-verification wRbOJ9…`, `<meta name="telderi">`, баннер «Можно купить через биржу… 927138@mail.ru» → `telderi.ru/ru/viewsite/2609418` (лот снят), NativeRent, блоки `linkslot.ru/bancode_new.php?id=360850/360848/362307` | Сайт собран «под продажу». Linkslot — биржа размещения ссылок и тизеров, то есть сайт **продавал** исходящие. Среди удалённых постов есть нетематические: «Металлическая сетка», «Норникель», «РусГидро» — типичные продажные публикации |
| 2026-10 | Astro, бренд «Мерка», Метрика 109623857, `yandex-verification a4cd787f70f90b84` | Живой сайт | Текущее состояние |

Выводы:
- Домен «старый» только по Wayback. Для Яндекса это сайт с несколькими сменами владельца и тематики. Ценность у домена одна: страницы WP-эпохи 2025 года, которые, возможно, ещё в индексе. Ссылочного веса у него нет.
- Верификации прошлых владельцев (`f5adf900…`, `d8aa…`, Google `wRbOJ9…`) на живом сайте уже не стоят. Права в Вебмастере и GSC у них отзовутся при перепроверке. Надёжнее самому удалить чужих пользователей в «Права доступа» (R1).

## 3. Текущий ссылочный профиль

**Количественно (публичные данные):**

| Метрика | rencredit-online.ru | Ориентир |
|---|---|---|
| Megaindex DR | 0 | vsezaimyonline.ru 36 · rencredit.ru 44 · banki.ru 54 |
| Яндекс ИКС | «—» (нет значения) | mosseo.ru 90 · vsezaimyonline.ru 580 |
| Упоминания домена в вебе | 0 найдено | — |
| Страниц в sitemap | 83 (`/sitemap-0.xml`): `/mfo/*` 22, `/credit/*` 14, `/stati/*` 9, `/karty/*` 8, `/kredity/*` 5, `/novosti/*` 4, хабы | — |

**Что может быть в профиле (гипотезы, проверить в Вебмастере):**

| Тип донора | Откуда вероятен | Оценка | Действие |
|---|---|---|---|
| Сети брендовых дорвеев «личный кабинет банка», каталоги 2018–2022 | Эпохи дорвеев | Токсичные: связывают домен с ТЗ «Ренессанс» и фишингоподобными сайтами | В Яндексе инструмента отклонения ссылок нет (Disavow есть только в Google Search Console). Сами ссылки не трогать. Целевые URL эпохи ЛК должны отдавать 410, не 301. Это согласовано с `06-eeat-legal-trademark.md:174` |
| Ссылки и тизеры через linkslot.ru, обмены продавца | WP 2024–2026 | Нейтральные или слабые. Linkslot размещал исходящие, входящих он не давал | Ничего не делать; убедиться, что исходящих блоков нет. Проверено: на живом сайте их нет |
| Внутренние ссылки сети продавца (oaoo.ru — картинка баннера, lib.zaplata.ru — 37 медиафайлов) | WP 2024–2026 | DR обоих 0, домены не отвечают или это «архив статей» | Игнорировать |
| Естественные ссылки на статьи о рефинансировании (форумы, Q&A) | WP 2025 | Единственные потенциально ценные | Найти в Вебмастере. Если ведут на 404 из §4, сделать 301 на ближайший аналог |

## 4. Потерянный капитал: 101 URL WP-эпохи с 404

- **Факт.** Wayback CDX зафиксировал 101 адрес `/credit/<slug>.html` (первые снимки — 2025-02, последние — 2026-01-23). У всех 321 снимка статус 200. Сейчас все 101 отдают **404**.
- **Почему так.** Блок `BEGIN LEGACY 301` в `web/apps/rencredit/public/.htaccess:59` генерируется из `legacy/rencredit/map.json`. В map.json 208 URL, и он строился по REST и sitemap на момент экспорта, когда постов было уже 37. Поэтому 101 удалённый пост в карту не попал. Сработать для них может только общий rewrite `.htaccess:276-277`, но статического файла под этими URL нет.
- **Темы.** Рефинансирование — 75, ипотека — 29 (темы пересекаются). Новостные (Госдума, ЦБ, Путин, НБКИ, Нацбанк Украины, Турция) — около 12. Нетематические «продажные» — `metallicheskaya-setka-…`, `za-2024-god-nornikel-…`, `novak-moratorii-…-rysgidro…`.
- **Почему это важно для off-page.**
  1. Если у домена есть хоть какие-то внешние ссылки WP-эпохи, они почти наверняка ведут на эти URL.
  2. Массовые 404 на недавно живые URL Яндекс видит как потерю контента. При переезде на новый домен эти URL тоже нужно учесть, иначе «Переезд сайта» склеит только 16+28 адресов.
- **Что делать (R3).**
  - Рефинансирование и ипотеку — 301 на ближайшую rewrite-статью `/credit/<slug>.html` или хаб `/kredity/`.
  - Новости — 301 на `/novosti/`, как уже сделано для 28 новостей в map.json.
  - Нетематические продажные посты — 410.
  - Полный список — в приложении А.
  - Это правка генератора `gen_htaccess.py`. Сам я его не менял: в этой задаче это запрещено.

## 5. delen.ru и прочие чужие партнёрки

| Что | Где было | Сейчас |
|---|---|---|
| 20 ссылок `delen.ru/track/<offer>/source/campaign-ads` (УБРиР 4 поста, banki.ru credit-master 3, Интерпромбанк, Открытие ×3 варианта, i.doktor.kr) в 9 постах, замаскированы как `<span class="hl hl_custlink" data-href>` | `legacy/rencredit/REPORT.md:34-46`, `legacy/rencredit/posts/*.json` | **0 на живом сайте**: проверено curl по всем 9 URL `/credit/<slug>.html`, все 200. Есть 0 в `src/content/**` и 0 в `web/apps/rencredit/dist` |
| Исходящие в переписанных статьях | — | Только `alfabank.ru`, `tbank.ru`, `interfax.ru` с `rel="nofollow noopener"`, плюс источники `cbr.ru` (17 ссылок в контенте), `consultant.ru` (21), `gosuslugi.ru`, `banki.ru` |
| Главная | — | 27 исходящих на официальные сайты МФО с `nofollow noopener`; 49 CTA `/go/…` с `sponsored nofollow noopener` |

Вывод: задача «вычистить delen.ru» **закрыта**. Остаточный след — только копии в Wayback, на ранжирование они не влияют.

## 6. Футпринты с другими сайтами сети

Живых сайтов сети сейчас два: rencredit-online.ru и тестовый `yourkedm.beget.tech` (rostpoisk, копия mosseo.ru). finhelp-ru и vsezaimyonline пока без домена (`sites/*/site.config.json`: `site_url: ""`).

| Футпринт | rencredit | Сеть | Риск сейчас / со 2-м сайтом на `@pbn/core` |
|---|---|---|---|
| Хостинг и IP | 87.236.16.51, AS198610, /21 87.236.16.0 | yourkedm: 87.236.19.9 — тот же AS и тот же /21 | Низкий / средний. У Beget тысячи сайтов, но один аккаунт и одна /21 у всех сайтов сети — классический сигнал |
| NS и регистратор | `ns{1,2}.beget.*`, BEGET-RU | Планируется так же | Низкий / средний. Разносить регистраторов и NS по кластерам |
| Метрика | 109623857 (env `PUBLIC_METRIKA_ID` → `src/lib/ui/site.ts:13`, инлайн в `BaseLayout.astro:84-115`) | rostpoisk 109164667 (`sites/rostpoisk/site.config.json:29`) | **Высокий, если оба под одним Яндекс ID**: Метрика и Вебмастер связывают сайты через аккаунт |
| Офферы и `/go/` | `/go/saleads-<id>/`, ID из общего пула (`sites/affiliate_pool.json`, 209 записей) | finhelp-ru использует те же ID, например `saleads-21500100`: `sites/affiliate_pool.json:1587`, `sites/finhelp-ru/affiliateLinks.json:479` | Сейчас 0 (finhelp не живой) / **высокий**: одинаковые пути `/go/saleads-21500100/` в HTML двух сайтов находятся простым поиском |
| UTM | `outboundUrl` по умолчанию `source: 'rencredit-online.ru', medium: 'compare'` (`web/packages/core/src/offers.ts:34`) | Старый рендерер: `source=site&medium=cpa` (`site/src/lib/affiliate.ts:36-38`) | Яндексу не виден: `/go/` закрыт `Disallow` и `noindex`. Но дефолт с захардкоженным доменом в общем пакете при втором сайте утечёт в его UTM. Брать хост из `Astro.site`, как уже сделано в `go/[offer].astro:20` |
| Ключ согласия cookie | `localStorage 'fk-consent'` (`BaseLayout.astro:92`) | Пока только rencredit | Со 2-м сайтом на том же `BaseLayout` — одинаковый инлайн-скрипт. Параметризовать префикс |
| robots и JSON-LD | `robots.txt.ts:9` — `Disallow: /go/` + `Sitemap`; общие генераторы `packages/core/src/schema.ts` | — | Средний со 2-м сайтом: одинаковая форма JSON-LD (Organization, WebSite, BreadcrumbList, FAQPage), одинаковый robots |
| Сборщик | `/_astro/BaseLayout.*.css`, `/_astro/*ClientRouter*.js` | rostpoisk: `/_astro/_slug_.*.css` | Низкий: Astro массовый, DOM у двух рендереров разный |
| Файл подтверждения Яндекса | Нет (`/yandex_b096686526decb58.html` → 404) | На `yourkedm.beget.tech` есть (200) — общий `site/public/` (`PROJECT_BRIEF.md:193`) | Для rencredit риска нет. Для сайтов на старом `site/` риск остаётся |
| Служебные пути | `/mail.php`, `/rss.xml`, `/thanks/` → 404 | Старый рендерер их отдаёт | Хорошо: rencredit не повторяет шаблон старой сети |
| Перекрёстные ссылки | Ни одной ссылки на сайты сети (исходящие только на МФО, банки, ЦБ, Консультант) | — | Хорошо. Держать так |

Тестовый `yourkedm.beget.tech` открыт для индексации (`robots: Allow: /`, `Sitemap: https://example.test/…`) и полностью дублирует mosseo.ru. К rencredit он не относится, но если Метрика под тем же логином, ассоциация «владелец дублей» распространится на всю сеть (R6).

## 7. План наращивания под финнишу Яндекса

Базовые цифры (цены, Минусинск, анкор-лист 50/25/20/5, темп «не больше 2× к прошлому месяцу») — из `docs/seo/09-offpage-network.md` §2–3. Ниже — что меняется для rencredit.

### 7.1 Гейт: сначала решение по домену

| Сценарий | Что делать со ссылками |
|---|---|
| **Переезд на домен «Мерки»** (рекомендация 06) | До переезда — ни одной купленной ссылки на rencredit-online.ru. Все бренд-активы (Дзен, vc.ru, TG/MAX) ведут на бренд, а ссылки ставить уже на новый домен после «Переезда сайта» в Вебмастере. Покупные ссылки — с месяца +1 после склейки |
| Остаться на rencredit-online.ru | Только крауд и бренд-упоминания; статейные — не раньше, чем через 3 месяца. Анкоры **никогда** не содержат «Ренессанс», «rencredit», «ренкредит»; домен в безанкорных ссылках — да, бренд «Мерка» — основной анкор |

### 7.2 Куда вести ссылки (страницы с уникальной ценностью)

- **Хабы.** `/zaimy/` и 7 посадочных `/zaimy-*` (`/zaimy-bez-otkaza/`, `/zaimy-na-kartu/`, `/zaimy-bez-procentov/` и др.), `/karty/`, `/kredity/`, `/debetovye-karty/`, `/vklady/`.
- **Карточки МФО** `/mfo/<id>/` (22 шт.) — только безанкорно, через крауд в обсуждениях конкретной МФО.
- **Рефинансирование.** 14 переписанных `/credit/<slug>.html` — это единственный кластер с историей WP-эпохи.
- **Инструменты.** Квиз, «Примерки», ПДН-самопроверка из `features/brand-engagement.md` (E3, E4, E6). Это лучший естественный повод для крауда: «посчитать ПДН», «проверить ПСК».
- **Не вести ссылки** на `/novosti/*` и `/stati/*` без инструментов.

### 7.3 Площадки с проверенными фактами

| Канал | Факт (проверено 2026-10-19) | Роль |
|---|---|---|
| vc.ru (блог бренда) | Внешние ссылки в постах идут через `api.vc.ru/v2.8/redirect?to=…` с `rel="nofollow noopener"` (проверено на `vc.ru/seo/1966869`) | Бренд и реферальный трафик, **веса нет**. 1 пост в 1–1,5 месяца с данными («сравнили ПСК 22 МФО») |
| Дзен-канал «Мерка» | Атрибуты ссылок в статьях не проверены (страница отдаётся JS-ом) | Бренд в экосистеме Яндекса. 2–3 выжимки в неделю из `/stati/` |
| Telegram + MAX | Детали в `features/brand-engagement.md` E9. `/rss.xml` сейчас 404, автопостинг без RSS не собрать. Telegram замедляется с 10.02.2026 | Канал возврата и бренд-запросы |
| Крауд (banki.ru форум, sravni.ru вопросы, Пикабу, otvet.mail.ru, «Вопросы» Яндекса) | Цены — из 09-offpage-network, 150–600 ₽ за ссылку | 10–15 в месяц, ответ по существу + ссылка на инструмент или хаб |
| Статейные (Miralinks / GoGetLinks) | 1 500–6 000 ₽ за донора финнишы | Только после гейта 7.1. Доноры: ИКС ≥ 100, трафик Яндекса ≥ 1 000 в сутки, не сетки |
| Sape-аренда | Минусинск | Не используем |

По официальной справке Яндекса, рекламные и партнёрские ссылки размечаются `rel="sponsored"` (можно в сочетании с `nofollow`), пользовательские — `rel="ugc"`. На rencredit это уже соблюдено. Эти же правила нужно требовать от площадок, где публикуются офферы с `/go/` (маркировка erid обязательна).

### 7.4 Бюджет (1 сайт, 6 месяцев, после гейта)

Сайт втрое меньше finhelp (83 URL в sitemap против 2921), поэтому берём экономный вариант из 09-offpage-network §7:
- крауд — 10–12 ссылок в месяц × ~300 ₽, то есть около 3,5 тыс. ₽ в месяц;
- статейные — 1–2 в месяц с М2, около 6 тыс. ₽ в месяц;
- Дзен и vc.ru — время плюс рерайт около 3 тыс. ₽ в месяц.

**Итого ≈ 55–65 тыс. ₽ за 6 месяцев.** Стоп-критерий тот же: если к концу М3 нет 50+ визитов в сутки из Яндекса, бюджет замораживаем.

## 8. Приоритизированные рекомендации

| # | Рекомендация | Impact | Effort | Где |
|---|---|---|---|---|
| R1 | Вебмастер (за вечер): «Ссылки → Внешние ссылки» (выгрузить CSV доноров), «Страницы в поиске» (сколько из 101 удалённых и 37 старых ещё в индексе), «Права доступа» (удалить пользователей прошлых владельцев). В GSC проверить, нет ли там чужого владельца `wRbOJ9…` | high | S | Вебмастер, GSC |
| R2 | Не покупать ссылки на rencredit-online.ru до решения по домену. Бренд-активы (Дзен, vc.ru, TG/MAX) заводить на имя «Мерка» | high | S | Процесс |
| R3 | Закрыть 101 404 из приложения А: рефинансирование и ипотека → 301 на rewrite-статью или `/kredity/`, новости → 301 на `/novosti/`, нетематические → 410. Добавить их в `map.json` и перегенерировать блок LEGACY 301 | high | S | `legacy/rencredit/map.json`, `gen_htaccess.py`, `.htaccess:59` |
| R4 | При переезде включить в постраничный 301 все 16+28+101 известных Wayback-адресов; URL эпохи «личного кабинета» (если найдутся в Вебмастере) → 410 | high | S | `.htaccess` нового домена |
| R5 | Убрать общий футпринт офферов до запуска второго сайта на `@pbn/core`: свои ID `/go/` на сайт (хеш от `site_id`+`poolId`) или свой префикс (`/go/`, `/out/`, `/r/`); `DEFAULT_UTM.source` брать из конфигурации сайта | medium | S | `packages/core/src/offers.ts:34`, `pages/go/[offer].astro` |
| R6 | Метрика и Вебмастер rencredit — под отдельным Яндекс ID, не под тем, где rostpoisk 109164667. Тестовый `yourkedm.beget.tech` закрыть `Disallow: /` (дубль mosseo.ru) | medium | S | Яндекс-аккаунты, `sites/rostpoisk` |
| R7 | Сайты сети разносить по аккаунтам и хостингам (не все на одном аккаунте Beget в 87.236.16.0/21), регистраторам и NS | medium | M | Инфраструктура |
| R8 | Параметризовать `fk-consent` и общие инлайн-скрипты `BaseLayout` перед вторым сайтом | low | S | `BaseLayout.astro:92` |
| R9 | Включить IndexNow: ключ-файл в `public/`, запуск `scripts/indexnow.mjs` после `deploy-beget.sh`. Скрипт есть, но не подключён; ключа на живом сайте нет | medium | S | `scripts/indexnow.mjs`, `scripts/deploy-beget.sh` |
| R10 | После гейта: крауд 10–12 ссылок в месяц на хабы и инструменты, анкоры без «Ренессанс/rencredit»; статейные 1–2 в месяц с М2 | medium | M | §7 |
| R11 | Дзен + vc.ru + TG/MAX как бренд-каналы. Для TG/MAX нужен `/rss.xml` (сейчас 404) — см. brand-engagement E9 | medium | M | `features/brand-engagement.md` |
| R12 | Ежемесячно: DR Megaindex, ИКС (бейдж), «Внешние ссылки» Вебмастера; снимать или не продлевать ссылки с доноров, выпавших из индекса | low | S | Мониторинг |

## Источники

- Whois TCI: `whois -h whois.tcinet.ru rencredit-online.ru` (2026-10-19).
- Wayback CDX: `https://web.archive.org/cdx/search/cdx?url=rencredit-online.ru&matchType=domain`.
- Снимки главной: `web.archive.org/web/20190723180953id_/…`, `…/20200103170302id_/…`, `…/20220314163029id_/…`, `…/20240819205943id_/…` (telderi, linkslot, nativerent), `…/20260123082917id_/…`.
- Megaindex DR API: `https://api.megaindex.com/dr/?d=<домен>&json=1`. Формула DR описана на be1.ru («Log5(IP*0.75 + 1)»).
- Яндекс ИКС-бейдж: `https://yandex.ru/cycounter?<домен>`.
- Яндекс Вебмастер, рекомендации по ссылкам (sponsored, ugc, nofollow): https://yandex.ru/support/webmaster/ru/recommendations/links.html
- vc.ru, исходящие ссылки через редирект с nofollow: https://vc.ru/seo/1966869-kraud-ssylki-dlya-seo (HTML от 2026-10-19).
- Telderi-лот (снят, редирект на главную): https://www.telderi.ru/ru/viewsite/2609418
- Внутренние: `docs/seo/09-offpage-network.md`; `docs/seo-rencredit/06-eeat-legal-trademark.md`; `docs/seo-rencredit/features/brand-engagement.md`; `rencredit-pilot-wt/PROJECT_BRIEF.md:125-144,186-195`; `rencredit-pilot-wt/legacy/rencredit/REPORT.md:1-46`.

## Приложение А. 101 URL `/credit/<slug>.html` (200 в Wayback 2025-02…2026-01, сейчас 404)

Префикс `https://rencredit-online.ru/credit/`, суффикс `.html`. Пометки: `[news]` — новость, кандидат на 301 → `/novosti/`; `[410]` — нетематический, продажный; без пометки — рефинансирование, ипотека или кредиты, кандидат на 301 → ближайший аналог.

- `brysnika-s-sovkombankom-pervoi-v-rossii-zapystila-ipoteky-so-snijennoi-stavkoi-849` [news]
- `bystrye-kredity-kratkosrochnye-zajmy`
- `cb-ne-bydet-prodlevat-mery-podderjki-bankov-zavershaushih-deistvie-v-2024-gody` [news]
- `cb-povysil-ojidaniia-po-rosty-potrebkreditovaniia-v-2024-gody-do-15-18` [news]
- `chto-nyjno-znat-pered-tem-kak-sdelat-refinansirovanie-kredita`
- `chto-takoe-refinansirovanie-ipoteki`
- `docent-gorbynova-esli-bank-yrezal-vam-kreditnyi-limit-proverte-nalichie-dolga` [news]
- `dokymenty-dlia-refinansirovaniia-ipoteki`
- `gde-oformit-refinansirovanie-kreditov-s-prosrochkoi`
- `gde-polychit-refinansirovanie-kredita-bez-spravki-o-dohodah`
- `gosdyma-priniala-v-i-chtenii-zakonoproekt-o-periode-ohlajdeniia-po-potrebkreditam` [news]
- `gosdyma-vo-ii-chtenii-razreshaet-cb-limitirovat-vydachy-ipoteki-i-avtokreditov-fizlicam` [news]
- `grigorenko-grajdane-smogyt-samozapretit-oformlenie-kredita-cherez-gosyslygi` [news]
- `kak-i-gde-polychit-refinansirovanie-kreditnoi-karty`
- `kak-i-gde-proizvesti-refinansirovanie-avtokredita`
- `kak-oformit-refinansirovanie-ipoteki-v-vtb`
- `kak-oformit-refinansirovanie-kredita-v-sberbanke`
- `kak-polychit-refinansirovanie-ipoteki-v-rosbanke`
- `kak-polychit-refinansirovanie-kreditov-v-raiffaizenbanke`
- `kak-proishodit-refinansirovanie-kreditov-v-tinkoff-banke`
- `kak-proizvesti-refinansirovanie-mikrozaimov-mfo`
- `kak-provesti-refinansirovanie-kreditki`
- `kak-rabotaet-kalkyliator-refinansirovaniia-ipoteki`
- `kak-refinansirovat-ipotechnyi-dolg`
- `kak-refinansirovat-kredit-pod-zalog-nedvijimosti`
- `kak-sdelat-refinansirovanie-kredita-ili-ipoteki`
- `kak-sdelat-refinansirovaniia-ipoteki-s-materinskim-kapitalom-v-2024-gody`
- `kak-snizit-procent-po-kredity-v-2024-gody`
- `kakie-nyjny-dokymenty-dlia-refinansirovaniia-v-sberbanke`
- `kakie-rashody-mogyt-vozniknyt-pri-refinansirovanii-ipotechnogo-kredita`
- `kogda-bank-razreshaet-obrashatsia-za-refinansirovaniem`
- `kogda-rabotaet-refinansirovanie`
- `kogda-vygodno-oformliat-refinansirovanie-a-kogda-kreditnye-kanikyly`
- `kyda-obrashatsia-za-refinansirovaniem-esli-kredit-s-zadoljennostu`
- `kyda-obratitsia-dlia-oformleniia-refinansirovaniia-avtokredita`
- `metallicheskaya-setka-vidy-osobennosti-i-primenenie` [410]
- `mojno-li-refinansirovat-ipoteky-v-slychae-rojdeniia-pervogo-rebenka`
- `mojno-li-refinansirovat-kredit-s-pomoshu-selskoi-ipoteki`
- `mojno-li-refinansirovat-po-programme-semeinaia-ipoteka-kredit-oformlennyi-na-apartamenty`
- `mojno-li-sdelat-refinansirovanie-yje-imeusheisia-ipoteki-za-schet-lgotnoi-ipoteki-dlia-it-specialistov`
- `mojno-li-vziat-obychnyu-ipoteky-a-potom-refinansirovat-po-semeinoi-ipoteke`
- `na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-gazprombanke`
- `nabiyllina-kreditnaia-aktivnost-v-pervye-nedeli-dekabria-ostavalas-sderjannoi`
- `naimenee-popyliarnoi-ipotechnoi-programmoi-v-2024-gody-stala-dalnevostochnaia-ipoteka`
- `nbki-dolia-zaemshikov-moloje-30-let-v-stryktyre-vydachi-potrebitelskih-kreditov-sokratilas` [news]
- `nbki-kolichestvo-vydannyh-v-rossii-avtokreditov-v-oktiabre-sokratilos-na-35` [news]
- `nbki-srednii-razmer-potrebkredita-v-sentiabre-snizilsia-do-160-tysiach-ryblei` [news]
- `novak-moratorii-do-2028-goda-na-vyplaty-dividendov-rysgidro-obsyjdaetsia` [410]
- `obzor-programm-refinansirovaniia-2023-goda`
- `odobriat-li-refinansirovanie-v-banke-esli-net-spravki-o-dohodah`
- `osnovnye-prichiny-pochemy-bank-ne-refinansiryet-kredit-daje-pod-zalog`
- `osobennosti-refinansirovaniia-voennoi-ipoteki-v-2024-gody`
- `otkazali-v-refinansirovanii-osnovnye-prichiny`
- `otvety-na-voprosy-zaemshikov-pro-refinansirovanie`
- `plusy-i-minysy-refinansirovaniia`
- `pochemy-bank-otkazyvaet-v-refinansirovanii-posle-restryktyrizacii`
- `polyianova-mikropredpriiatiia-smogyt-brat-kredity-bez-ogranicheniia-na-plavaushyu-stavky`
- `popyliarnye-voprosy-o-lgotnyh-ipotechnyh-programmah`
- `popyliarnye-voprosy-o-programme-dalnevostochnaia-ipoteka`
- `poriadok-i-ysloviia-refinansirovaniia-ipoteki-v-rosselhozbanke`
- `preimyshestva-refinansirovaniia-ipoteki-v-tinkoff-banke`
- `prichiny-otkaza-v-refinansirovanii-kotorye-skryvaut-banki`
- `procedyra-refinansirovaniia-ipoteki-v-raiffaizenbanke`
- `pytin-podpisal-zakon-o-bessrochnom-mehanizme-zontichnyh-porychitelstv-dlia-msp` [news]
- `pytin-porychil-vlastiam-otslejivat-dinamiky-korporativnogo-kreditovaniia-v-rossii` [news]
- `pytin-prizval-obespechivat-rost-korporativnogo-kreditnogo-portfelia` [news]
- `razmer-stavki-refinansirovaniia-v-2024-gody`
- `razreshat-li-v-banke-refinansirovat-mikrozaim-s-prosrochkami`
- `rbk-nachislennye-rossiianam-procenty-po-kreditam-prevysili-600-milliardov-ryblei`
- `refinansirovanie-ili-restryktyrizaciia-chto-vybrat-dlia-ymensheniia-plateja-po-kredity`
- `refinansirovanie-ipoteki-drygih-bankov-lychshie-predlojeniia-2024-goda`
- `refinansirovanie-ipoteki-s-plohoi-ki-v-kakih-bankah-odobriat`
- `refinansirovanie-ipoteki-v-alfa-banke-v-2024-gody`
- `refinansirovanie-ipoteki-v-chem-vygoda-i-kak-ee-rasschitat`
- `refinansirovanie-ipoteki-v-sberbanke-chto-nyjno-znat`
- `refinansirovanie-kredita`
- `refinansirovanie-kredita-dlia-pensionerov-lychshie-predlojeniia-bankov-v-2024-gody`
- `refinansirovanie-kreditnoi-karty-tinkoff`
- `refinansirovanie-kreditov-drygih-bankov-gde-polychit-bez-problem`
- `refinansirovanie-kreditov-drygih-bankov-na-vygodnyh-ysloviiah-v-2024-gody`
- `refinansirovanie-kreditov-drygih-bankov-v-rosbanke-ysloviia-i-procedyra`
- `refinansirovanie-kreditov-pod-zalog-nedvijimosti-kak-pravilno-oformit-sdelky`
- `refinansirovanie-kreditov-v-promsviazbanke-dlia-fizicheskih-lic`
- `refinansirovanie-kreditov-v-raznyh-sityaciiah-podborka-statei-ot-mbk`
- `refinansirovanie-s-plohoi-kreditnoi-istoriei-predlojeniia-bankov`
- `refinansirovanie-sberbank-vtb`
- `refinansirovanie-v-alfa-banke-ysloviia-i-poriadok-oformleniia`
- `ria-novosti-rossiiane-v-2024-g-chashe-vsego-brali-kredity-na-remont-i-pokypky-avto`
- `sberbank-otkazal-v-refinansirovanii-prichiny-kak-ispravit-sityaciu`
- `spisok-dokymentov-dlia-refinansirovaniia-kredita-i-ipoteki`
- `stavka-refinansirovaniia-chto-eto`
- `top-6-prichin-pochemy-banki-otkazyvaut-v-refinansirovanii`
- `top-9-predlojenii-po-refinansirovaniu-kreditnyh-kart-v-2023-gody`
- `v-kakih-bankah-oformliaut-refinansirovanie`
- `v-kakom-banke-vygodno-oformliat-refinansirovanie-ipoteki`
- `vidy-bankovskih-prodyktov`
- `vozmojno-li-posle-refinansirovaniia-ipoteki-polychit-nalogovyi-vychet`
- `vozmojno-li-povtorno-provesti-refinansirovanie`
- `ysloviia-refinansirovaniia-ipoteki-v-gazprombanke`
- `ysloviia-refinansirovaniia-v-banke-vozrojdenie`
- `za-2024-god-nornikel-sokratil-chistyu-pribyl-po-rsby-na-57-do-123-mlrd-ryb` [410]
