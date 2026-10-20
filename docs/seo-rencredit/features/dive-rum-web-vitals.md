# Deep-dive: RUM Core Web Vitals для rencredit-online.ru (web-vitals → `v.php` без ПДн, Метрика опционально)

Идея: `rum-web-vitals`. Дата проверки: **2026-10-19**. Код: `/Users/deniskononov/rencredit-pilot-wt/web` (Astro 7.3.8 static,
ClientRouter, `@pbn/motion` с GSAP/Flip). Что проверено: `curl` по живому сайту, `npm view` и `gh api` по web-vitals,
README и `upgrading-to-v6.md` библиотеки, реальный вес бандла с unpkg, чтение кода и `dist/`. В проекте ничего не менял.

Смежные документы. Лабораторные замеры и бюджет веса: `../01-technical.md` (F7). PHP на docroot и схема CSV вне docroot:
`dive-go-php-server-log.md`. Гейт согласия и `fkGoal`: `dive-cpa-click-goals.md`. Раздутие HTML от `transition:name`:
`dive-offerlogo-vt-fix.md`. Здесь эти темы не пересказываю, только ссылаюсь.

## Вердикт

**later, 4/10. MVP ≈ 1 день: 0,5 на код и 0,5 на smoke-тест PHP и абзац в политике.**

Идея правильная, библиотека живая и маленькая. Сейчас она почти ничего не даст, и вот почему:

1. **Мерить пока некого.** По `../08-monetization-seo.md` стоп-критерий проекта: «к концу М3 нет 50+ визитов в сутки
   из Яндекса». То есть сейчас трафик близок к нулю. Для устойчивого p75 по одному сегменту (шаблон × мобильные) нужно
   примерно 200–300 замеров. При 95% доверии это ±5 процентильных пунктов (√(0,75·0,25/300) ≈ 2,5%). При десятках визитов
   в сутки это 3–6 недель на шаблон. По отдельным URL данных не будет никогда.
2. **Лаборатория зелёная.** `01-technical.md`: на главной LCP 364 мс (это текст `p.hp-sentence`), CLS 0, все `<img>`
   с размерами, GSAP и Flip грузятся только на главной. Правда, замер шёл без троттлинга, и реальный мобильный LCP
   будет хуже. Открытых гипотез, которые нельзя проверить в DevTools, остаётся одна: **INP на слабых Android**
   (2545 DOM-узлов и инициализация GSAP/Flip на главной). Лабораторно INP не измеряется, так что ради него RUM и нужен.
3. **«Покажет, помог ли фикс OfferLogo» — нет.** Фикс ещё не выкачен (`OfferLogo.astro:8` по-прежнему с
   `transition:name={name}`). Чтобы сравнить до и после, RUM должен поработать до фикса 3–6 недель. Задерживать ради
   этого do_now-фикс (HTML главной −40%) неразумно: эффект уже доказан лабораторно.
4. **Мотив «PSI упирается в квоту» решается проще.** Квота кончилась у общего анонимного проекта (проверил: 429,
   `Queries per day`, `consumer project_number:583797351490`). Бесплатный API-ключ Google Cloud снимает ограничение,
   с ключом лимит около 25 000 запросов в сутки (цифра по документации, перепроверить в консоли). С тем же ключом
   работает CrUX API: он сразу ответит, есть ли домен в CrUX. Это 10 минут и первая ступенька, до любого кода.
5. **PHP на docroot не проверен.** `/v.php`, `/go.php`, `/mail.php`, `/test.php` отдают 404 через `ErrorDocument`,
   в `dist/` нет ни одного `.php`. Тот же smoke-шаг уже нужен для `go.php`.

**Когда делать.** Как только выполнено что-то одно:
(а) идёт выкладка `go.php`: smoke-тест PHP и схема «CSV вне docroot» общие, `v.php` прицепляется почти бесплатно;
(б) в Вебмастере ≥ 100 визитов в сутки;
(в) на столе решение «грузить GSAP лениво / убрать ClientRouter / менять анимации», которое без данных INP принимается на глаз.

## 1. Реальность (19.10.2026)

| Что | Проверка | Вывод |
|---|---|---|
| web-vitals | `npm view`: **6.2.3** (05.10.2026), Apache-2.0, без зависимостей. GitHub `GoogleChrome/web-vitals`: 8 649★, не архивирован, push 16.10.2026. Ветка 6.x: 6.0.0 (21.07) → 6.2.3, в патчах закрыты утечки памяти в INP и LoAF | Живая, поддерживается командой Chrome, лицензия совместима. Лимитов и ключей нет, это локальный код |
| Вес | unpkg `dist/web-vitals.js` 6.2.3: 8 967 Б raw, **3 325 Б gzip** -9. Attribution-сборка: 15 677 / **5 561 Б gzip**. README: «~3K brotli», attribution +1,5K | В идее «~2 КБ» занижено. С tree-shaking (только `onLCP/onINP/onCLS`) выйдет примерно 2,5–3 КБ gzip отдельным ленивым чанком. Бюджет не задевает: база ≈ 13 КБ JS gzip |
| Загрузка поздно | README: библиотека использует `buffered: true`, «не нужно грузить рано… откладывайте до загрузки остального кода» | Ленивый `import()` после `load` корректен для LCP и CLS. Для INP теряются только взаимодействия до загрузки чанка (буфер `event` ограничен), на практике это мелочь |
| Поддержка браузеров | README 6.2.3: `onLCP`, `onINP` — Chromium, Firefox, Safari; `onCLS` — **только Chromium**; soft-nav — Chromium 151+ | iOS Safari даст LCP и INP, но не CLS. Яндекс Браузер на Chromium даёт всё. Поддержка soft-nav у него зависит от версии движка (не проверял) |
| Soft navigations | Chrome 151 (stable 28.07.2026) включил soft-nav без флага. В v6 опция `reportSoftNavs: true`, у метрики есть `navigationType: 'soft-navigation'` и `navigationURL`. 13.10.2026 CrUX начал публиковать экспериментальные CWV с учётом soft-nav (выход из эксперимента ориентировочно май 2027) | Для сайта с ClientRouter это ключевое (§2.2): без soft-nav CLS и INP всех страниц визита записываются на страницу входа |
| CrUX / PSI | PSI без ключа: **429** (дневная квота общего проекта). CrUX API без ключа не работает | Есть ли домен в CrUX, неизвестно. При таком трафике, скорее всего, нет, но это проверяется ключом за минуту (пункт 4 вердикта) |
| Метрика | `BaseLayout.astro:90-131`: счётчик 109623857, `init` только после `fkConsent(true)`, флаг `loaded`, ручной `hit` на `astro:page-load`. Встроенный отчёт Метрики «Время загрузки страниц» строится по Navigation Timing, LCP/INP/CLS в нём нет. Официальной CWV-интеграции у Метрики не нашёл | Метрика годится как вторичный канал для **сегментации визитов** (рейтинг CWV × отказы и цели), но не как источник выборки: в ней только согласившиеся |
| Хостинг | Все ответы проходят через Apache (заголовки `.htaccess`), `Server: nginx-reuseport`. CSP нет, есть `nosniff`, `X-Frame-Options`, `Permissions-Policy`. В `.htaccess` нет правил, блокирующих `*.php` | Same-origin `sendBeacon` на `/v.php` ничего не блокирует. Если файл существует, Apache отдаст его PHP-обработчику, когда PHP включён (smoke §4) |
| Деплой | `scripts/deploy-beget.sh`: заливает `dist/` без удаления. `BEGET_PATH` = корень `/rencredit/public_html/` | `public/v.php` уедет вместе с `dist`. Каталог `../rum/` (вне docroot) PHP создаст сам, как в схеме `go.php` |

## 2. Куда встраивается

### 2.1. Файлы

| Файл | Что | Объём |
|---|---|---|
| `web/apps/rencredit/package.json` (+ `web/package-lock.json`) | `"web-vitals": "6.2.3"` (точная версия). Ставит человек, агенту `npm install` запрещён | 1 строка |
| `src/scripts/vitals.ts` (новый) | Очередь замеров и flush на `visibilitychange: hidden` через `sendBeacon` | ~30 строк |
| `src/scripts/main.ts` | Ленивый старт после `load`, только в прод-сборке без `PUBLIC_NOINDEX` | 3–4 строки |
| `public/v.php` (новый) | Приём POST, валидация, дневной CSV вне docroot | ~30 строк |
| `src/pages/politika-konfidencialnosti.astro` | Абзац 2.x «Технические замеры скорости» (§3.3) | 1 абзац |
| (полная) `src/layouts/BaseLayout.astro` | `window.fkParams` рядом с `fkGoal` из `dive-cpa-click-goals` | 1 строка |
| (полная) `web/scripts/rum-p75.mjs` | p75 по метрике × шаблону × устройству из CSV | ~30 строк |

Static-сборку это не меняет: ни `getStaticPaths`, ни адаптера. В `astro preview` и на тестовом поддомене маячок молчит:
гейт по `import.meta.env.PROD` и `PUBLIC_NOINDEX`. Отдельный флаг заводить не нужно.

### 2.2. Ловушка ClientRouter, которой нет в идее

`main.ts` выполняется **один раз** на визит, дальше страницы меняет ClientRouter (pushState + подмена DOM в
`startViewTransition`). Без поддержки soft-nav web-vitals считает весь визит одной страницей:

- **LCP** фиксируется на первом взаимодействии, поэтому всегда относится к странице входа. Это корректно.
- **CLS и INP** копятся по всем страницам визита и отправляются при `hidden` с URL страницы входа. Пример: зашёл на
  `/stati/…`, кликнул в `/zaimy/` и там тормознул Flip витрины. Плохой INP запишется на статью.

Что делать (минимум):

1. `reportSoftNavs: true`. В Chromium 151+ каждая мягкая навигация получает свои метрики с `navigationURL`, путь берём оттуда.
   Распознаёт ли Chrome переход ClientRouter как soft-nav (нужны клик, смена URL через History API и отрисовка контента),
   **не проверено**. Проверка в DevTools: `performance.getEntriesByType('soft-navigation')` после клика по меню.
2. Счётчик `s` = число `astro:after-swap` до момента отчёта. На клиенте отбрасываем CLS и INP, если `s > 0` и
   `navigationType !== 'soft-navigation'`: такие значения смешаны с другими страницами. Цена: в Safari и Firefox CLS/INP
   останутся только у одностраничных визитов. Для анализа отказов это как раз нужный срез.

### 2.3. Набросок кода (не применён)

`src/scripts/vitals.ts`:

```ts
import type { Metric } from 'web-vitals';

type Row = { m: string; v: number; r: string; n: string; u: string; d: 'm' | 'd' };
const queue: Row[] = [];
const d = matchMedia('(pointer: coarse)').matches ? 'm' : 'd';
let soft = 0;
document.addEventListener('astro:after-swap', () => { soft++; });

const push = (x: Metric) => {
  // CLS/INP без soft-nav после перехода ClientRouter смешаны с другими страницами (§2.2).
  if (x.name !== 'LCP' && soft > 0 && x.navigationType !== 'soft-navigation') return;
  queue.push({
    m: x.name,
    v: Math.round(x.name === 'CLS' ? x.value * 1000 : x.value),
    r: x.rating,
    n: x.navigationType ?? '',
    u: new URL(x.navigationURL ?? location.href).pathname, // только путь: без utm/yclid/subid
    d,
  });
};

const flush = () => {
  if (queue.length) navigator.sendBeacon('/v.php', JSON.stringify(queue.splice(0, 10)));
};
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

export const initVitals = () =>
  import('web-vitals').then(({ onLCP, onINP, onCLS }) => {
    onLCP(push, { reportSoftNavs: true });
    onINP(push, { reportSoftNavs: true });
    onCLS(push, { reportSoftNavs: true });
  });
```

`src/scripts/main.ts`, в начало, рядом с `markJs()`:

```ts
if (import.meta.env.PROD && import.meta.env.PUBLIC_NOINDEX !== 'true') {
  addEventListener('load', () => setTimeout(() => import('./vitals').then((v) => v.initVitals()), 0), { once: true });
}
```

`public/v.php`:

```php
<?php
// RUM-маячок: метрика, значение, путь, класс устройства. Без IP, UA, cookie и идентификаторов.
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit; }
if (parse_url($_SERVER['HTTP_ORIGIN'] ?? '', PHP_URL_HOST) !== ($_SERVER['HTTP_HOST'] ?? '')) { http_response_code(403); exit; }
$rows = json_decode((string) file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($rows) || count($rows) > 10) { http_response_code(400); exit; }
$dir = dirname(__DIR__) . '/rum';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
$file = $dir . '/' . gmdate('Y-m-d') . '.csv';
// ponytail: дневной потолок вместо rate-limit по IP (IP не храним); при спаме теряем хвост суток.
if (@filesize($file) > 2000000) { http_response_code(204); exit; }
$max = ['LCP' => 60000, 'INP' => 60000, 'CLS' => 10000]; // CLS × 1000
$out = '';
foreach ($rows as $r) {
  if (!is_array($r)) continue;
  $m = $r['m'] ?? ''; $v = $r['v'] ?? null; $u = $r['u'] ?? '';
  if (!isset($max[$m]) || !is_int($v) || $v < 0 || $v > $max[$m]) continue;
  if (!is_string($u) || !preg_match('~^/[a-z0-9/_.-]{0,150}$~', $u)) continue;
  $rt = in_array($r['r'] ?? '', ['good', 'needs-improvement', 'poor'], true) ? $r['r'] : '';
  $n = is_string($r['n'] ?? null) && preg_match('~^[a-z-]{0,24}$~', $r['n']) ? $r['n'] : '';
  $d = ($r['d'] ?? '') === 'm' ? 'm' : 'd';
  $out .= gmdate('H:i') . ",$m,$v,$rt,$n,$d,$u\n";
}
if ($out !== '') file_put_contents($file, $out, FILE_APPEND | LOCK_EX);
http_response_code(204);
```

Почему так:
- **Один beacon на скрытие вкладки**, а не запрос на каждую метрику. Меньше нагрузки на shared-хостинг, меньше строк.
- `LOCK_EX` вместо ручного `flock`: тот же эффект, меньше кода.
- Проверка Origin отсекает тривиальный кросс-сайтовый спам (`sendBeacon` со строкой — это `text/plain` без preflight,
  но POST всегда несёт `Origin`). От `curl` с подделанным Origin это не спасает, поэтому есть дневной потолок 2 МБ
  (≈ 40 тыс. строк, на порядки больше реального трафика) и жёсткая валидация. CSV-инъекция невозможна: все поля из whitelist или regex.
- `metric.id` не храню. Дедуп не нужен: без `reportAllChanges` CLS/INP повторяются только при повторном hidden,
  это доли процента и на p75 не влияют.

## 3. Ценность и риски

### 3.1. Аудитория, ПФ, SEO

- **Пользователь:** косвенно. Чинить будем то, что тормозит на реальных телефонах, а не то, что кажется.
- **ПФ (Яндекс):** CWV Яндекс как фактор не заявляет, влияние идёт через отказы и глубину. RUM полезен, если связать его
  с поведением, а это делает только Метрика-канал (§4.2, сегмент «визиты с INP = poor» против отказов и `offer_go`).
- **Google:** page experience — слабый сигнал. Search Console строит отчёт CWV по CrUX, для маленького сайта он, скорее
  всего, пуст. Свой RUM — единственный способ увидеть те же метрики. Доля Google в РФ-финансах заметная, но не основная.
- **Запросы и трафик:** не влияет, страниц не добавляет. **Ссылкоёмкость:** нулевая.
- **Монетизация:** косвенная. Витрины `/zaimy/`, `/mfo/*` с Flip и таблицами — главный кандидат на плохой INP.
  Каждый «залипший» тап по фильтру — потерянный `offer_go`. Без трафика это ничего не стоит.

### 3.2. Решения, которые данные разблокируют (когда наберутся)

| Гипотеза из `01-technical.md` | Метрика и порог | Действие |
|---|---|---|
| GSAP+Flip на главной (36 КБ gzip) тормозит слабые Android | INP p75 моб. `/` > 200 мс | `import()` GSAP по IntersectionObserver или первому взаимодействию в HomeHero |
| 2545 DOM-узлов на главной | INP/LCP p75 моб. `/` против `/stati/*` | `content-visibility: auto` для списков ниже первого экрана |
| Шрифт без preload сдвигает раскладку | CLS p75 > 0,1 (Chromium) | `preload` только для `onest-cyrillic-wght-normal` |
| View transitions ClientRouter мешают | INP на `navigationType=soft-navigation` против `navigate` | Отключить VT на витринах или вообще |

### 3.3. Юридические риски

- **152-ФЗ.** В CSV пишутся метрика, значение, рейтинг, тип навигации, класс устройства (m/d), путь без query и время
  с точностью до минуты (UTC). Нет IP, UA, cookie, localStorage и идентификаторов визита или устройства. Связать строку
  с человеком нельзя, поэтому это **не персональные данные**, и согласие не требуется. Две оговорки:
  1. Политика сейчас обещает, что «до согласия счётчик не работает» (речь про Метрику, `politika-konfidencialnosti.astro:31`).
     Чтобы не было вопроса «а что за запросы до согласия», нужен абзац 2.x: «Технические замеры скорости: без cookie и IP,
     обезличенные значения, хранение 90 дней, только для оптимизации сайта».
  2. Access-лог хостинга пишет IP **любого** запроса, включая `/v.php`. Так уже происходит для всех файлов сайта, маячок
     ничего не добавляет. Но если о серверных логах в политике не сказано, это стоит дописать в том же абзаце (отдельно от этой идеи).
  - `query` не пишем никогда: в `utm_term`, `yclid` и subid может оказаться псевдоидентификатор.
- **38-ФЗ «О рекламе»:** не касается, это не реклама. **Финсоветы / YMYL:** не касается, контента не добавляет.
- **Метрика-канал** (§4.2) работает только после согласия, через существующий флаг `loaded`. Рамки согласия не расширяет.

## 4. План

### 4.0. Ступенька до кода (10 минут, делать сейчас независимо от вердикта)

Владелец создаёт API-ключ в Google Cloud (PageSpeed Insights API + Chrome UX Report API) и кладёт его в `.env` пайплайна.
PSI с ключом даёт мобильный Lighthouse с троттлингом по ключевым шаблонам (`/`, `/zaimy/`, `/mfo/<slug>/`, статья).
CrUX API ответит, есть ли origin в CrUX. Если есть — RUM ещё менее срочен.

### 4.1. MVP (1 день, когда сработает триггер из вердикта)

1. **Smoke PHP** (общий с `go.php`): `public/v.php` с одной веткой `GET → 405`. Выкатить, `curl -i -X GET /v.php` → 405
   (а не 404 через `404.html`). `curl -i -X POST -H 'Origin: https://rencredit-online.ru' --data '[{"m":"LCP","v":1200,"r":"good","n":"navigate","u":"/","d":"m"}]' /v.php`
   → 204, на сервере появился `../rum/<дата>.csv`. После проверки удалить тестовую строку.
2. Человек ставит `web-vitals@6.2.3` (точная версия). Добавить `vitals.ts` и строки в `main.ts` (§2.3), `npm run check`.
3. Проверить в DevTools на прод-сборке: чанк web-vitals грузится после `load`; при переключении вкладки в Network
   виден один `POST /v.php` → 204; после клика по меню `performance.getEntriesByType('soft-navigation')` не пустой.
   Если пустой — ClientRouter не распознаётся как soft-nav, и CLS/INP остаются только от одностраничных визитов (§2.2).
4. Абзац в политике (§3.3), выкладка.
5. Через 2–4 недели забрать CSV по FTP/SSH и посчитать p75 по `метрика × шаблон × устройство`. Шаблон выводится из
   первого сегмента пути. Ротация: удалять файлы старше 90 дней (руками или строкой в `v.php`, когда понадобится).

**Критерий готовности:** за сутки в CSV есть строки LCP с `d=m` и `d=d`; нет строк с query в пути; GET → 405;
POST с чужим Origin → 403.

### 4.2. Полная версия (+1–1,5 дня)

- **Метрика для ПФ-сегментов.** В `BaseLayout.astro` рядом с `fkGoal`:
  `window.fkParams = function (p) { if (loaded) window.ym(id, 'params', p); };`, в `push()`:
  `window.fkParams?.({ cwv: { [x.name]: x.rating } })`. В Метрике появятся сегменты «визиты с LCP/INP = poor»,
  их можно сравнить по отказам, глубине и цели `offer_go`. Только согласившиеся, поэтому выборка смещена.
  Абсолюты считать по CSV, Метрику использовать для связи с поведением. Отдельные цели под каждую метрику
  (подход из статьи на Хабре) не нужны, хватает параметров визита.
- **Attribution-сборка** (`web-vitals/attribution`, +2,2 КБ gzip): CSS-селектор элемента LCP и цели INP, `loadState`.
  Включать только когда p75 плохой и непонятно, что именно тормозит. Селектор — не ПДн.
- `web/scripts/rum-p75.mjs`: CSV → таблица p75 и доля `poor` по сегментам, с порогом «n < 200 — не показывать».
- Сигнал для `site_pipeline` сети: тот же `v.php` и `vitals.ts` переносятся на finhelp-ru и другие сайты почти без
  изменений. Этот довод в пользу пакета (`@pbn/motion` или `@pbn/core`) появится, когда будет второй сайт с трафиком,
  не раньше.

### 4.3. Что сознательно не делать

- Не сэмплировать (трафика мало, нужна каждая строка).
- Не писать rate-limit по IP: пришлось бы обрабатывать IP, а это ПДн. Дневного потолка хватает.
- Не тянуть SaaS-RUM (SpeedCurve, DebugBear и т. п.): данные за рубежом, это вопрос 152-ФЗ (локализация, трансграничная
  передача), да и платно.
- Не включать `reportAllChanges` в проде (README прямо не рекомендует).

## 5. Риски и неизвестные

| Риск | Вероятность | Что делать |
|---|---|---|
| PHP на docroot не исполняется | средняя | Smoke §4.1 п.1. Если нет — только Метрика-канал (смещённая выборка) или отказ от идеи |
| ClientRouter не распознаётся как soft-nav | средняя | Проверка §4.1 п.3. Фолбэк уже в коде: CLS/INP только при `s = 0` |
| Данных слишком мало для решений | **высокая** сейчас | Это и есть причина вердикта «later». Триггер — ≥ 100 визитов/сутки |
| Спам в CSV | низкая | Origin, валидация, потолок 2 МБ/сутки |
| Новая зависимость | низкая | Apache-2.0, 0 deps, команда Chrome. Точная версия в `package.json` |
| Путаница с обещанием в политике | низкая | Абзац §3.3 до выкладки |

## Источники

- web-vitals: https://github.com/GoogleChrome/web-vitals (README, CHANGELOG 6.2.3, `docs/upgrading-to-v6.md`), npm `web-vitals@6.2.3`
- Вес бандла: `https://unpkg.com/web-vitals@6.2.3/dist/web-vitals.js` и `web-vitals.attribution.js` (замер gzip -9)
- Soft navigations в Chrome 151: https://developer.chrome.com/blog/new-in-chrome-151 ; обзоры: https://csswizardry.com/2026/08/web-perf-wednesday-003-native-spa-metrics-have-arrived/ , https://www.relevantaudience.com/seo/chrome-crux-experimental-soft-navigation-core-web-vitals/ (CrUX experimental soft-nav, 13.10.2026; вторичный источник)
- web-vitals → Яндекс Метрика через `reachGoal`, пример и подводные камни SPA: https://habr.com/en/articles/911672
- Живой сайт: `curl -I https://rencredit-online.ru/`, `/v.php` и `/go.php` → 404; PSI API без ключа → 429 (19.10.2026)
- Код: `web/apps/rencredit/src/layouts/BaseLayout.astro`, `src/scripts/main.ts`, `public/.htaccess`, `src/components/OfferLogo.astro`, `src/pages/politika-konfidencialnosti.astro`, `web/scripts/deploy-beget.sh`
