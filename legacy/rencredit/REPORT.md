# Экспорт rencredit-online.ru: сводка

Источник: публичный WP REST API + sitemap (только GET/HEAD). Скрипт: `scripts/wp_export.py`; карта решений: `legacy/rencredit/map.json` (строится `build_map.py`).

## Числа

- URL в inventory: **208** (картинки не входят: 37 media-файлов лежат на чужом домене lib.zaplata.ru, список в `media.json`)
- Типы: author 1, category 1, category_page 2, feed 3, home 1, library 1, page 2, post 37, sitemap 1, tag 159
- Решения: **rewrite 14**, **merge301 193**, keep 1 (главная)
- Посты: 37 -> rewrite 14, merge301 23
- HTTP-статусы: 200 — 202, 301 — 6 (feed без слэша, пагинация рубрики, `?oceanwp_library=footer`), 404 — 0 (несуществующая /credit/page/4/ исключена из inventory)

## Rewrite (статья пишется заново по тому же URL `/credit/<slug>.html`)

| prio | old_url | title | words | category | offerKind |
|---|---|---|---|---|---|
| 1 | /credit/refinansirovanie-kredita-chto-eto-znachit.html | Рефинансирование кредита – что это значит? | 1947 | refinansirovanie | credit |
| 1 | /credit/naskolko-vygodno-refinansirovanie-v-rosselhozbanke.html | Насколько выгодно рефинансирование в Россельхозбанке | 1707 | refinansirovanie | credit |
| 1 | /credit/refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov.html | Рефинансирование кредитов с плохой кредитной историей: перечень банков | 1587 | kreditnaya-istoriya | credit |
| 1 | /credit/perekreditovanie-kredita-pod-menshii-procent.html | Перекредитование кредита под меньший процент | 1185 | refinansirovanie | credit |
| 1 | /credit/kak-sdelat-refinansirovanie-kreditov-v-sberbanke.html | Как сделать рефинансирование кредитов в Сбербанке | 830 | refinansirovanie | credit |
| 2 | /credit/kak-polychit-pomosh-v-refinansirovanii.html | Как получить помощь в рефинансировании | 1727 | refinansirovanie | credit |
| 2 | /credit/bank-otkrytie-kak-i-na-kakih-ysloviiah-polychit-refinansirovanie-kreditov-i-ipoteki.html | Банк «Открытие»: как и на каких условиях получить рефинансирование кредитов и ипотеки | 1386 | refinansirovanie | credit |
| 2 | /credit/na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-vtb.html | На каких условиях можно получить рефинансирование в ВТБ | 1359 | refinansirovanie | credit |
| 2 | /credit/stoit-li-ispolzovat-refinansirovanie-kredita.html | Стоит ли использовать рефинансирование кредита | 1305 | refinansirovanie | credit |
| 2 | /credit/kak-proishodit-refinansirovanie-kredita-chto-nyjno-znat.html | Как происходит рефинансирование кредита: что нужно знать | 1185 | refinansirovanie | credit |
| 3 | /credit/refinansirovanie-kreditov-dlia-ip-i-uridicheskih-lic-osobennosti-perekreditovaniia-biznesa.html | Рефинансирование кредитов для ИП и юридических лиц: особенности перекредитования бизнеса | 1347 | refinansirovanie | credit |
| 3 | /credit/kak-rabotaet-agentstvo-po-refinansirovaniu.html | Как работает агентство по рефинансированию | 803 | refinansirovanie | credit |
| 3 | /credit/refinansirovanie-v-interprombanke-ysloviia-i-poriadok-oformleniia.html | Рефинансирование в Интерпромбанке: условия и порядок оформления | 681 | refinansirovanie | credit |
| 3 | /credit/ysloviia-refinansirovaniia-kreditov-v-banke-ybrir.html | Условия рефинансирования кредитов в банке УБРиР | 603 | refinansirovanie | credit |

План H2 каждой статьи — в поле `outline` у записи в `map.json`.

## Чужие партнёрки и внешние ссылки

Ссылки в старом контенте закамуфлированы: `<span class="hl hl_custlink" data-href="...">`, не `<a href>`; экспорт учитывает и `data-href`.

Партнёрские (delen.ru, трекинг `/track/.../source/campaign-ads`) — **20 ссылок в 9 постах**; в новый сайт не переносить, заменять на `/go/<offer>/`:

- `https://delen.ru/track/go-banki.ru_credit-master/source/campaign-ads` — постов: 3
- `https://delen.ru/track/go-i.doktor.kr/source/campaign-ads` — постов: 1
- `https://delen.ru/track/go-interprombank.ru_refin/source/campaign-ads` — постов: 1
- `https://delen.ru/track/go-open.ru_ipoteka_refinancing/source/campaign-ads` — постов: 1
- `https://delen.ru/track/go-openbank.ru_refin/source/campaign-ads` — постов: 1
- `https://delen.ru/track/go-ubrr.ru_refin/source/campaign-ads` — постов: 4
- `https://delen.ru/track/open.ru_refin-ipoteka/source/campaign-ads` — постов: 1

Прочие внешние (data-href, не партнёрские): `http://kreditnyi-calculyator.ru/refinansirovanie-kredita-kalkulyator/`, `http://www.xn--80ajjbfvbtgiye.xn--p1ai/`, `https://rshb.ru/natural/application-for-credit/?type=refinancing-credit&time=1&period=10000`, `https://rshb.ru/natural/loans/refinancing_consumer`, `https://www.rshb.ru/natural/loans/refinancing_consumer/`, `https://www.sberbank.ru/common/img/uploaded/redirected/person/credits/money/consumer_refinance/files/blank_vypiska.docx`, `https://www.sberbank.ru/ru/about/today/oib`, `https://www.sberbank.ru/ru/person/credits/money/consumer_refinance`, `https://www.vtb.ru/personal/kredit-nalichnymi/refinansirovanie/#tab_0#`

YouTube-встраивания: 14 iframe в 11 постах (при переписывании — ссылки не переносить автоматически).

Внутренних ссылок между постами в контенте нет (кроме HTML-карты `/sitemap.html`). Картинки в тексте и обложки — с `lib.zaplata.ru` (чужой домен), использовать нельзя.

## Замечания

- Все 37 постов в одной рубрике `credit` (URL `/credit/<slug>.html`), структура плоская; теги (159) — тонкие архивы, `/tag/<slug>` (без слэша), **в sitemap их нет**, но все отдают 200 — в map.json каждый получает 301 (в основном на `/stati/`, 5 на `/kredity/`).
- Форматы URL WP: рубрика `/credit` и теги `/tag/x` — без завершающего слэша, автор `/author/yourkedm_admin`. Для 301 в `.htaccess` учитывать оба варианта (со слэшем и без).
- Не в sitemap, но живые: `/privacy.html` (200, страница), все 159 тегов, `/credit/page/2`, `/credit/page/3` (301 со слэшем на без слэша), feed-URL (301). Главная и `/sitemap.html` в sitemap есть.
- Постов в post-sitemap 38 против 37 в API: лишний — главная `/`; все URL sitemap учтены в inventory (проверено).
- 23 из 37 постов — короткие перепечатки новостей РИА/Прайм (золото, Мосбиржа, ЦБ, ипотечные законы и т.п.), все -> merge301.
- Новый сайт: на `/credit/<slug>.html` отдаются статьи с `legacyUrl` (pages/credit/[slug].astro), поэтому для rewrite target = тот же путь, 301 не нужен.
- `/sitemap-index.xml` в target — имя индекса по умолчанию у @astrojs/sitemap; проверить после сборки.
- Решение `keep` — только главная `/`.
- Тег-цели выбраны по ключевым словам названия тега; при желании уточнить вручную.

