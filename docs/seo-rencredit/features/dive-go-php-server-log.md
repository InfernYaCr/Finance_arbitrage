# Deep-dive: серверный `go.php` для rencredit-online.ru (302, subid, CSV-лог без IP, сверка с Saleads)

Идея: `go-php-server-log`. Дата проверки: **2026-10-19**. Код: `/Users/deniskononov/rencredit-pilot-wt/web` (Astro 7 static,
ClientRouter, `@pbn/core`). Проверено: `curl` по живому сайту, `gh`, чтение кода и `dist/`. В проекте ничего не менялось.

Основа — `../../seo/features/dive-go-php-click-tracker.md` (finhelp-ru). Этот файл повторно её не пересказывает:
здесь только то, что для rencredit другое, и две находки, которых там нет (prefetch, `%{DOCUMENT_ROOT}`-фолбэк).
Клиентская часть атрибуции (`?p=&s=`, цели Метрики) — в `dive-cpa-click-goals.md`, SEO-часть `/go/` — в `../03-architecture.md`,
`../08-monetization-seo.md` (R1), erid — в `../06-eeat-legal-trademark.md`.

## Вердикт

**do_next, 6/10, MVP ≈ 1,5 дня (из них 0,5 — двухшаговая выкладка и smoke-тест).**

Делать **после** `cpa-click-goals`, а не вместо и не одновременно. Почему не do_now:

1. Большую часть денег от атрибуции даёт `cpa-click-goals`: раздел → `utm_campaign`, слот → `utm_content`, subid → `utm_term`
   прямо в статическом `/go/`. Работает без согласия на cookie, без PHP и без риска сломать CTA. Saleads начинает видеть
   «раздел × слот» сразу.
2. `go.php` добавляет к этому: **свой** лог (клик → полный путь страницы, не только раздел), учёт без JS, 302 вместо
   промежуточной HTML-страницы, `X-Robots-Tag` на уровне сервера. Это заметно, но это надстройка.
3. Неподтверждённые места: PHP на новом docroot ни разу не исполнялся (на сервере нет ни одного `.php`), не проверено,
   отдаёт ли `GET /api/v1/click` запись на каждый уникальный `utm_term`. Трафик сайта неизвестен.
4. Есть ловушка, которой в исходной идее нет: **hover-prefetch ClientRouter** превратит 302 в фальшивые клики у Saleads (§2.3).
   Её надо закрыть до включения rewrite, иначе испортим конверсию площадки в глазах сети.

Если после 2–4 недель `cpa-click-goals` окажется, что EPC по разделам сильно разный и нужен разрез по страницам, — делать сразу.

## 1. Реальность (19.10.2026)

| Что | Проверка | Вывод |
|---|---|---|
| Кто отдаёт файлы | `curl -I` на `/`, `/favicon.svg`, `/_astro/*.css`, `/search.json`, `/go/<id>/`: у всех заголовки из `.htaccess` (`nosniff`, `Referrer-Policy`, `Cache-Control` по `FilesMatch`). `Server: nginx-reuseport/1.21.1` | **Все запросы проходят через Apache** (nginx только проксирует). Значит rewrite перехватит `/go/<id>/` даже при оставшихся `index.html`, а deny-правила `.htaccess` работают и для статики. Риск из идеи «старые `/go/*/index.html` перехватят запрос» на этом хостинге **не подтверждается** |
| PHP на docroot | `/mail.php`, `/go.php`, `/nonexist.php` → 404 (наша `404.html` через `ErrorDocument`), `/xmlrpc.php` → 405 от nginx, `/index.php` → 301 (правило legacy). В `dist/` ни одного `.php` | Исполнение PHP **не проверено**. Косвенно «да»: тот же аккаунт `yourkedm.beget.tech` исполняет `mail.php` finhelp (303 в прошлом дайве), раньше здесь жил WordPress. Нужен smoke-шаг до включения rewrite (§4) |
| `/go/` сейчас | `/go/saleads-b87534e0/` → 200, 1357 Б, `noindex,nofollow`, meta-refresh 0 + `location.replace`. Без слэша → 301 на слэш. TTFB 0,40–0,63 с на холодном соединении | Итоговый URL: `my.saleads.pro/s/<uuid>?erid=…&utm_source=rencredit-online.ru&utm_medium=compare&utm_campaign=go` — одинаковый для всех мест на сайте |
| Saleads-трекер | `my.saleads.pro/s/<uuid>` → **200 HTML** (не 302), ставит `clid` (1 год), `offer_<uuid>` (30 дней), Laravel-сессию | Цепочка после `go.php`: 302 → HTML Saleads → рекламодатель. Экономим один HTML-рендер нашей промежуточной страницы, на тёплом соединении ≈ 50–150 мс. Пользователь этого почти не заметит |
| Пул | `packages/core/src/data/pool.json`: 209 записей, **144** linkable, все `approve`, id все `^[a-z0-9-]{1,64}$`, **erid уже в `href` у всех 144**, все на `my.saleads.pro`. В пуле есть `payout` | В `go.php` вшивать только `id → URL`, payout наружу не отдавать. `dist/go/` = 144 каталога, на сайте 564 ссылки `href="/go/…"`, ни одной с query |
| Saleads API/доки | `saleads.pro/docs` → 200, в конфиге ЛК есть `utmMarks` («Utm метки, SubID»), `tools/global-postback` (get/update/test-url), `finance/postbacks/export`. `saleads.pro/api/v1/click` без токена → 302 на логин | Своя метка в `utm_term` проходит. Сверка — pull через существующий `saleads_offers.py clicks` (`GET /click`: `utm_marks`, `num_clicks`, `conversions[]`). Гранулярность по `utm_term` **не проверена** (ключ в `.env`, читать запрещено). Запасные пути: экспорт постбэков из ЛК (CSV вручную) и глобальный постбэк (макросы только в ЛК) |
| Блокировщики | `gh search code saleads.pro`: домен есть в нишевых списках (`mtxadmin/ublock` hosts + косметика `a[href*="saleads.pro/"]`, squidblacklist, pihole-листы). В `AdguardTeam/AdguardFilters` и `easylist/easylist` поиском не найден | Утверждение «работает с блокировщиками» верно только для **лога**: наш `/go/` и `go.php` не блокируются, а сам переход на `my.saleads.pro` у пользователей таких списков заблокирован и сегодня, и после `go.php`. Косметика по `href*=saleads.pro` наши CTA не прячет уже сейчас — ссылки внутренние |

Внешних библиотек нет, лицензий и платных лимитов нет. Нагрузка — один PHP-скрипт без БД.

## 2. Как устроено и куда встраивается

### 2.1. Что есть

- `src/pages/go/[offer].astro` — `getStaticPaths` по `pool.filter(isLinkable)`, erid из коллекций `offers` + `services`,
  `outboundUrl(id, {source: site.hostname, medium: 'compare', campaign: 'go', erid})`.
- `packages/core/src/offers.ts` — `outboundUrl()` / `buildUtmHref()` (erid не дублируется, если уже есть в `href`), `goHref()`.
- CTA рендерятся в 6 местах: `OfferCard.astro:49`, `CompareTable.astro:37`, `cta/CtaTop3.astro:25`, `cta/CtaZero.astro:24`,
  `services/ServiceCard.astro:33`, `pages/[dir]/[slug].astro:71,117`. Все `rel="sponsored nofollow noopener" target="_blank"`
  (без `noreferrer`, значит Referer дойдёт). Обёртки слотов уже размечены `data-cta-slot` (`cta/*.astro`).
- `public/.htaccess` (319 строк): блоки 1–9, legacy-301 генерируется `legacy/rencredit/gen_htaccess.py` между `BEGIN/END LEGACY 301`.
  Правила `?p=`/`?s=` из legacy матчат **только корень** (`^(index\.php)?$`), с `/go/?p=…` не конфликтуют.
- `robots.txt.ts` — `Disallow: /go/` уже есть.
- Деплой: `scripts/deploy-beget.sh` (tar по ssh или curl-ftp, **без удаления**; `--archive-old` переносит всё содержимое docroot
  в `_old_site_<дата>`), черновик `.github/workflows/deploy-rencredit.yml` (`lftp mirror --only-newer`, без `--delete`).
  `BEGET_PATH=.` — корень FTP-аккаунта уже `/rencredit/public_html/`.
- Генератора PHP в этом приложении нет (у finhelp был `generate-mail-php.mjs`), `package.json` — голый `astro build`.

### 2.2. Решение лениво: `go.php` — это Astro-эндпоинт

Отдельный `web/scripts/gen-go-php.mjs` из идеи не нужен. В приложении уже есть паттерн статических эндпоинтов
(`robots.txt.ts`, `search.json.ts` — оба лежат в `dist/` файлами). `src/pages/go.php.ts` при сборке пишет `dist/go.php`, берёт
**тот же** `outboundUrl()` и те же erid, что и `[offer].astro`. Один источник правды, без копии `buildUtmHref`, без правки
`package.json`, без дубля логики erid. В sitemap эндпоинты не попадают (проверено: `search.json` в `sitemap-0.xml` нет).

`[offer].astro` остаётся как есть: это настоящий фолбэк, потому что rewrite включается только при наличии файла
(`RewriteCond %{DOCUMENT_ROOT}/go.php -f`, тот же приём уже использован в блоке 6). Откат — закомментировать одну строку.

### 2.3. Ловушка: hover-prefetch ClientRouter

`BaseLayout.astro:138` подключает `<ClientRouter />`. В собранном `ClientRouter.astro_…js` стоит `prefetchAll:!0`,
стратегия `hover`. Значит **наведение мыши на любую `/go/`-ссылку уже сейчас** делает `<link rel="prefetch" href="/go/<id>/">`,
а в Safari (нет `relList.supports('prefetch')`) — `fetch(url, {priority:'low'})` **без** каких-либо служебных заголовков
(`astro/dist/prefetch/index.js:186-198`).

- Сейчас это безвредно: префетчится 1,3 КБ HTML, JS и meta-refresh в префетче не исполняются.
- После `go.php` префетч получит 302 и **сходит на `my.saleads.pro`**. Saleads засчитает клик и поставит `clid`.
  Итог: раздутые клики у сети, заниженный CR площадки, мусор в нашем логе. Chrome/Firefox шлют `Sec-Purpose: prefetch`
  (можно отсечь на сервере), Safari-фолбэк не шлёт ничего — отсечь нельзя.

Закрывается двумя мерами, обе входят в MVP:
1. `data-astro-prefetch="false"` на 6 CTA-якорях из §2.1 (атрибут в SSR, 0 Б JS). Глобально `prefetchAll: false` не трогаем —
   это ухудшит навигацию по сайту.
2. В `go.php`: запрос с `Sec-Purpose`/`Purpose: prefetch` → `204 no-store`, без `Location` и без записи в лог.

## 3. Ценность

**Аудитория и ПФ.** Почти ноль, честно. `/go/` открывается в новой вкладке (`target=_blank`), исходная страница остаётся,
промежуточной страницы Метрика не видит. 302 убирает мелькание «Переходим на сайт партнёра…» и примерно 50–150 мс.
Дальше всё равно HTML Saleads. На поведенческие факторы Яндекса это не влияет.

**SEO.** Прямого эффекта нет. `Disallow: /go/` + мета-noindex уже есть. `X-Robots-Tag: noindex` на 302 — подстраховка
(Яндекс директивы на ответах-редиректах практически не использует). Ссылкоёмкости нет. Новых URL для робота нет.

**Монетизация — единственная настоящая ценность.**
- Свой лог «время, оффер, subid, полный путь страницы, раздел, слот» не зависит от согласия на cookie, JS и блокировщиков
  Метрики. Это даёт **EPC и CTR по конкретной странице**, а не только по разделу, как в `cpa-click-goals`.
- Сверка subid ↔ конверсия Saleads → отчёт «страница × слот × оффер → клики, конверсии, выручка». Отсюда решения:
  какие офферы снимать со слабых мест, какие статьи дописывать по деньгам, а не по частотности (связь с `../05-keyword-gap.md`).
- Основа для A/B текста CTA и для offline-конверсий в Метрику (полная версия).
- Бонус к `../09-offpage-backlinks.md` R5 (футпринт общих `/go/saleads-<id>/` у сайтов сети): с `go.php` свои id на сайт —
  это просто другие ключи массива, без новых страниц.

Где разрез по страницам важнее всего (много близнецов с разным EPC): «займ на карту без отказа», «займ под 0%»,
«кредитная карта 120 дней без процентов», «рефинансирование кредита» (наследие домена, `/credit/*.html`),
«открыть расчётный счёт ИП», «ОСАГО онлайн».

## 4. MVP (≈1,5 дня)

### Файлы

| Файл | Что сделать |
|---|---|
| `web/apps/rencredit/src/pages/go.php.ts` (новый, ≈60 строк вместе с PHP-шаблоном) | Эндпоинт: `id → outboundUrl(...)` по `pool.filter(isLinkable)` с erid из коллекций (копия 3 строк `getStaticPaths` из `[offer].astro`), подставляет JSON в PHP-шаблон |
| `web/apps/rencredit/public/.htaccess` | Блок «4c» сразу после канонического хоста (4b), до LEGACY: rewrite `/go/<id>/` → `go.php` при наличии файла |
| 6 CTA-якорей (`OfferCard`, `CompareTable`, `CtaTop3`, `CtaZero`, `ServiceCard`, `[dir]/[slug]`) | `data-astro-prefetch="false"` |
| `web/scripts/smoke-go.sh` (новый, ≈10 строк) | `HEAD` по всем `dist/go/*/` → ждём `302` на `https://my.saleads.pro/…erid=…`. HEAD в лог не пишется |
| `site_pipeline/saleads_offers.py` | Подкоманда `reconcile --log <csv>`: `GET /click` → индекс по `utm_term` → склейка с логом → CSV «путь × слот × оффер» |
| `src/pages/politika-konfidencialnosti.astro` | Одно предложение про журнал переходов (§5) |

Порядок с `cpa-click-goals`: тот дайв уже кладёт `?p=<slot>&s=<subid>` в href в момент клика. `go.php` принимает те же `p`/`s`
(subid от клиента, если валиден, иначе генерирует сам) — клиентский код менять не придётся. Без `cpa-click-goals` лог всё равно
пишет путь страницы из Referer, но слот будет `none`.

### `src/pages/go.php.ts` (черновик, в репо не вносился)

```ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { pool, isLinkable, outboundUrl } from '@pbn/core';

const PHP = String.raw`<?php
$LINKS = json_decode(<<<'JSON'
__LINKS__
JSON
, true);
$id = $_GET['o'] ?? '';
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
if (!preg_match('/^[a-z0-9-]{1,64}$/', $id) || !isset($LINKS[$id])) { header('Location: /', true, 302); exit; }
// Префетч ClientRouter/браузера: не ведём к партнёру и не пишем в лог.
$purpose = ($_SERVER['HTTP_SEC_PURPOSE'] ?? '') . ($_SERVER['HTTP_PURPOSE'] ?? '');
if (stripos($purpose, 'prefetch') !== false) { http_response_code(204); exit; }

$s = $_GET['s'] ?? '';
if (!preg_match('/^[0-9a-f]{12}$/', $s)) $s = bin2hex(random_bytes(6));      // 12 hex, без ПДн
$p = $_GET['p'] ?? '';
if (!preg_match('/^[a-z0-9-]{1,32}$/', $p)) $p = 'none';
$path = ''; $sec = 'direct';
$ref = parse_url($_SERVER['HTTP_REFERER'] ?? '');
if (!empty($ref['host'])) {
  if (strcasecmp($ref['host'], $_SERVER['HTTP_HOST'] ?? '') === 0) {
    $path = substr($ref['path'] ?? '/', 0, 200);
    $sec = explode('/', trim($path, '/'))[0] ?: 'home';
    if (!preg_match('/^[a-z0-9-]{1,48}$/', $sec)) $sec = 'other';
  } else { $sec = 'ext'; }
}
// erid и путь коннектора не трогаем, переопределяем только свои utm.
[$base, $qs] = explode('?', $LINKS[$id], 2) + [1 => ''];
parse_str($qs, $q);
$q['utm_campaign'] = $sec; $q['utm_content'] = $p; $q['utm_term'] = $s;
header('Location: ' . $base . '?' . http_build_query($q), true, 302);

$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
if ($_SERVER['REQUEST_METHOD'] !== 'GET' || preg_match('/bot|crawl|spider|preview|yandex|google|curl|wget/i', $ua)) exit;
// ponytail: CSV + flock по месяцам; SQLite, если > 50 тыс. кликов в месяц.
$dir = dirname(__DIR__) . '/go_clicks';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
$f = @fopen($dir . '/' . gmdate('Y-m') . '.csv', 'a');
if ($f) { flock($f, LOCK_EX); fputcsv($f, [gmdate('c'), $id, $s, $path, $sec, $p]); flock($f, LOCK_UN); fclose($f); }
`;

export const GET: APIRoute = async ({ site }) => {
  const entries = [...(await getCollection('offers')), ...(await getCollection('services'))];
  const erids = new Map(entries.map((e) => [e.data.poolId, e.data.erid]));
  const source = site?.hostname ?? 'rencredit-online.ru';
  const links = Object.fromEntries(
    pool.filter((o) => isLinkable(o))
      .map((o) => [o.id, outboundUrl(o.id, { source, medium: 'compare', campaign: 'go', erid: erids.get(o.id) })]),
  );
  return new Response(PHP.replace('__LINKS__', JSON.stringify(links)));
};
```

Заметки:
- Nowdoc (`<<<'JSON'`) не интерпретирует `$` и `\`, экранировать JSON не нужно. Пул — только URL `my.saleads.pro`, строки `JSON`
  в нём нет. В PHP-массив попадают только публичные URL (они и сейчас видны в `/go/*/index.html`), payout не попадает.
- Если PHP окажется выключен, Apache отдаст `go.php` текстом — поэтому rewrite включается вторым шагом (ниже).
- Лог пишется после заголовков. Ошибка записи не ломает переход.
- `Referrer-Policy` для ответа задаёт `.htaccess` (`Header always set`, `strict-origin-when-cross-origin`): Saleads видит только
  origin площадки, путь страницы остаётся у нас.

### `public/.htaccess`, блок 4c

```apache
# --- 4c. Переходы к партнёрам: /go/<id>/ -> go.php (302 + журнал) ----------------
# Работает, только если go.php лежит в корне; иначе отдаются статические /go/<id>/index.html.
# Откат: закомментировать RewriteRule.
<IfModule mod_rewrite.c>
RewriteCond %{DOCUMENT_ROOT}/go.php -f
RewriteRule ^go/([a-z0-9-]+)/?$ go.php?o=$1 [END,QSA]
</IfModule>
```

Ставится после 4b, чтобы `http://`/`www.` сначала канонизировались одним 301. Правила LEGACY и блок 7 на `go.php`
не срабатывают (проверено по тексту: `?p=` только на корне, блок 7 исключает существующие файлы).

### Выкладка в два шага

1. Деплой с `go.php`, но **без** блока 4c. `curl -I 'https://rencredit-online.ru/go.php?o=saleads-b87534e0'` → `302` на
   `my.saleads.pro/...erid=...&utm_term=...`. Если пришёл текст PHP или 500 — стоп, разбираться с PHP на сайте в панели Beget.
   Проверить, что каталог лога вне docroot создаётся (`~/rencredit/go_clicks/`): один клик из браузера, затем
   `ssh ... ls ~/rencredit/go_clicks`. Если FTP/SSH-аккаунт деплоя замкнут на `public_html` и не видит родителя — читать лог
   основным SSH-аккаунтом. **Не** класть лог в docroot: `--archive-old` перенесёт его в архив.
2. Деплой с блоком 4c. `bash web/scripts/smoke-go.sh https://rencredit-online.ru` → 144/144 `302 → my.saleads.pro…erid=`.
   Неизвестный id → `302 /`. `curl -I` содержит `X-Robots-Tag: noindex`.

### Критерии готовности MVP
1. Smoke 144/144; один реальный клик даёт одну строку CSV и **один** клик в статистике Saleads (наведение мыши без клика — ноль).
2. `HEAD` и запрос с `Sec-Purpose: prefetch` в лог не попадают (`curl -H 'Sec-Purpose: prefetch'` → 204).
3. `saleads_offers.py reconcile` склеивает тестовый клик по `utm_term`. Заодно ответ на главный открытый вопрос: отдаёт ли
   `GET /click` запись на каждый `utm_term`. Если нет — сверка по агрегату `utm_campaign × utm_content`, а поштучно —
   через экспорт постбэков из ЛК.

`reconcile` (набросок, формат `utm_marks` уточнить на реальном ответе):

```python
def cmd_reconcile(args: argparse.Namespace) -> None:
    by_sid: dict[str, tuple[int, int]] = {}
    for c in _get_all("/click"):
        marks = {m.get("name"): m.get("value") for m in c.get("utm_marks") or []}  # формат проверить
        if sid := marks.get("utm_term"):
            by_sid[sid] = (int(c.get("num_clicks") or 0), len(c.get("conversions") or []))
    agg: dict[tuple[str, str, str], list[int]] = {}
    with open(args.log, encoding="utf-8") as f:
        for _ts, offer, sid, path, _sec, slot in csv.reader(f):
            row = agg.setdefault((path, slot, offer), [0, 0])
            row[0] += 1
            row[1] += by_sid.get(sid, (0, 0))[1]
    w = csv.writer(sys.stdout)
    w.writerow(["path", "slot", "offer", "clicks_log", "conversions"])
    for k, v in sorted(agg.items(), key=lambda kv: -kv[1][0]):
        w.writerow([*k, *v])
```

JS на сайте не добавляется (0 Б). Совместимость со static Astro 7 полная: эндпоинт — штатный механизм.

## 5. Юридические риски

| Риск | Что делать |
|---|---|
| **38-ФЗ, ст. 18.1 (erid).** Токен должен оставаться в ссылке на объект рекламы | `go.php` берёт URL из `outboundUrl()` с erid и переопределяет только `utm_*`. `parse_str`/`http_build_query` перекодируют строку, для текущих erid (буквы-цифры) это безопасно. Добавить в smoke проверку «erid в Location совпадает с erid в `/go/<id>/index.html»`. Маскировка партнёрской ссылки внутренним `/go/` есть и сейчас — `go.php` её не ухудшает. Письменно уточнить у менеджера Saleads, что переопределение `utm_campaign/content/term` допустимо (по их докам — да) |
| **152-ФЗ.** Журнал кликов | MVP-лог: время, id оффера, случайный subid, путь страницы, раздел, слот. **Ни IP, ни UA, ни cookie** — по нему нельзя определить человека, это не ПДн. UA используется только в памяти для отсева ботов. В политику одно предложение: «При переходе к партнёру мы фиксируем время, страницу и блок, из которого был переход, и добавляем в ссылку случайный идентификатор перехода; IP-адрес и другие данные о вас не сохраняются». Хранить 12 месяцев (помесячные файлы, удаление старых — руками или cron) |
| `_ym_uid` для offline-конверсий (полная версия) | Псевдонимный идентификатор. Cookie появляется только после согласия (Метрика грузится по `fk-consent=yes`, при отзыве `_ym*` стираются, `BaseLayout.astro:123-133`), так что наличие cookie — разумный признак согласия. Всё равно описать в политике и cookie-баннере до включения. После поправок 420-ФЗ (штрафы за утечки с 30.05.2025) лучше не копить лишнего — поэтому в MVP его нет |
| Лог как точка утечки | Вне docroot, каталог 0700. Никаких `?download`, никакой админки |
| Open redirect | Только белый список, id по регэкспу, никаких `?url=` |
| Накрутка у сети | Префетч закрыт (§2.3), боты отсеяны, `Disallow: /go/`. Без этого Saleads видит клики без визитов — риск санкций площадке |
| Финсоветы / YMYL | Контент не меняется. Не затрагивается |

## 6. Полная версия (+2–3 дня, когда пойдут конверсии)

1. Ежедневный `reconcile` (cron на Beget или локально) → `go_revenue.csv`: EPC = выручка / клики, RPM = выручка / 1000 просмотров
   (просмотры из Метрики). Решения по слотам из `../08-monetization-seo.md` принимать по этим цифрам.
2. `_ym_uid` в лог (после правки политики) → offline-конверсии в Метрику (Management API): выручка по поисковым фразам и
   посадочным. Самая сильная часть для SEO-приоритизации.
3. Глобальный постбэк Saleads → `pb.php` с секретом в URL, пишет в тот же каталог. Только если pull через `/click` неполный.
4. A/B текста CTA: вариант в `p` (`top3-b`), назначение cookie в `<head>`, варианты только CSS-ом, ботам — контроль. Расчёт
   выборки — в дайве finhelp: ≈ 25 тыс. просмотров шаблона на один тест CTR. Не раньше ≥1 тыс. визитов в сутки.
5. Свои id `/go/` на сайт (R5 из 09-offpage): ключи массива = хеш `site_id + poolId`, генерация в том же эндпоинте.
6. `v.php` для RUM — **later**: Метрика уже есть, а `web-vitals` в `ym params` решает задачу без своего сервера.

## 7. Блокеры

1. PHP на docroot `rencredit-online.ru` не проверен (на сервере нет ни одного `.php`). Снимается шагом 1 выкладки.
2. Гранулярность `GET /api/v1/click` по `utm_term` не проверена: ключ API в `.env`, читать запрещено. Снимается `reconcile`
   на первом тестовом клике.
3. Доступ к логу вне docroot: деплойный аккаунт `BEGET_USER` может быть замкнут на `public_html`. Нужен основной SSH-доступ.
4. Макросы глобального постбэка Saleads публично не описаны — только в ЛК (нужно для п. 3 полной версии, не для MVP).
5. Зависимость: слот (`p`) приходит из `cpa-click-goals`. Без него лог даёт только страницу.

## 8. Что не делать

- Не добавлять `web/scripts/gen-go-php.mjs` и шаг в `package.json`: эндпоинт `go.php.ts` делает то же штатно.
- Не удалять `pages/go/[offer].astro`: это фолбэк и для `RewriteCond -f`, и для `astro preview`.
- Не выключать prefetch глобально (`prefetchAll: false`): хватит атрибута на CTA.
- Не включать rewrite одним деплоем с первым `go.php`: если PHP не исполняется, сломаются все 564 CTA.
- Не писать IP, UA, query страницы, суммы и сроки из пикера.
- Keitaro, YOURLS, GrowthBook — избыточно для одного PHP-файла.

## Источники

- Живой сайт, `curl` 19.10.2026: `/`, `/robots.txt`, `/go/saleads-b87534e0/`, `/mail.php`, `/go.php`, `/nonexist.php`, `/xmlrpc.php`, `/index.php`, статика `/_astro/*`, `/favicon.svg`, `/search.json`; `my.saleads.pro/s/<uuid>` (200, `Set-Cookie: clid`, `offer_*`).
- Saleads: https://saleads.pro/docs (маршруты ЛК `utmMarks`, `tools/global-postback`, `finance/postbacks/export`); `GET /api/v1/click` — `site_pipeline/saleads_offers.py:259`.
- Блок-листы: `mtxadmin/ublock` `hosts/_marketing_r-s-` (строки 4204–4206), `EnergizedProtection/mirror` `squidblacklist-dg-ads.txt`; поиск по `AdguardTeam/AdguardFilters`, `easylist/easylist` — совпадений нет.
- Код: `web/apps/rencredit/src/pages/go/[offer].astro`, `src/pages/robots.txt.ts`, `src/pages/search.json.ts`, `public/.htaccess` (блоки 4, 5, 6, 7, 9), `src/layouts/BaseLayout.astro:84-138`, `dist/_astro/ClientRouter.astro_astro_type_script_index_0_lang.*.js` (`prefetchAll:!0`), `web/node_modules/astro/dist/prefetch/index.js:165-198`, `web/packages/core/src/offers.ts`, `web/packages/core/src/data/pool.json`, `scripts/deploy-beget.sh`, `.github/workflows/deploy-rencredit.yml`, `web/deploy-env.example`.
- Внутренние: `../../seo/features/dive-go-php-click-tracker.md`, `dive-cpa-click-goals.md`, `../08-monetization-seo.md` (R1, §3), `../09-offpage-backlinks.md` (R5), `../06-eeat-legal-trademark.md`.
