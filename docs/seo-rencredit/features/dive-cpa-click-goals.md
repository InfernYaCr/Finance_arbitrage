# Deep-dive: цели Метрики на CPA-клики + placement/subid в `/go/` (rencredit-online.ru)

Дата: 2026-10-19. Код: `/Users/deniskononov/rencredit-pilot-wt/web/apps/rencredit` (Astro 7, static, ClientRouter).
Идея `cpa-click-goals`. Уже описана тезисно в `../08-monetization-seo.md` (R1, §3), `../07-yandex-domain-history.md` (R4),
`finhelp-adapt-2.md` §1. Здесь только то, чего там нет: проверка на живом сайте, точные места в коде, готовый MVP и правки к исходной идее.

## Вердикт

**do_now, 9/10, ~1 день.** Код дешёвый: около 40 строк TS, 10 строк inline в `/go/`, 1 строка в BaseLayout, меньше 1 КБ JS.
Без этого не измерить остальные идеи (слоты, маскот, калькуляторы, A/B).

Две правки к исходной формулировке:

1. **Основной источник данных не Метрика, а `utm_content` у Saleads.** Он не зависит от cookie-согласия и блокировщиков.
   Метрика видит только посетителей с `consent=yes`, поэтому её выборка смещена. Она нужна для поведения: маскот, пикер, путь до клика.
2. **subid генерировать на исходной странице в момент клика**, а не на `/go/`, и класть одно значение и в параметры цели, и в `?s=`.
   Если subid создаётся только на `/go/`, где счётчика нет, склеить цель Метрики с конверсией Saleads нечем.
   `/go/` генерирует свой subid только как фолбэк, когда ссылку открыли через контекстное меню без JS-клика.

## 1. Реальность: что проверено

| Что | Результат (19.10.2026) |
|---|---|
| `grep reachGoal` по `src` и `packages` | 0 совпадений |
| Главная, живой HTML | 49 ссылок `href="/go/…"`, из них 44 с `data-cta`. Все с `target="_blank"` (проверено по всем `offerHref(`/`goHref(` в компонентах). `data-cta-slot` на главной нет, есть `[data-showcase]`, `section#offers`, `#how`, `#faq` |
| Статья `/stati/chto-takoe-psk-i-kak-ee-schitat/` | Слоты `aside`, `callout-2`, `next`, `picker`, `top3` + `data-cta="sticky"`. Шесть мест конкурируют за клик, и сейчас не видно, какое из них работает |
| `/go/saleads-4f2e3fe0/` | `noindex,nofollow`, meta-refresh 0 → `my.saleads.pro/s/<uuid>?erid=2Vtzqving8M&utm_source=rencredit-online.ru&utm_medium=compare&utm_campaign=go`. У всех офферов одинаковые utm |
| `/go/…/?p=test` | HTTP 200: статика с query-строкой отдаётся, Apache/nginx не мешают |
| `robots.txt` | `Disallow: /go/` (расхождение со скиллом `offer-placement` уже записано в 06 №13, здесь не дублирую) |
| Метрика | `BaseLayout.astro:90-131`: `window.ym` создаётся только внутри `load()`, а `load()` вызывается только после согласия. `clickmap`, `trackLinks`, ручной `hit` на `astro:page-load`. id берётся из `ENV.metrikaId` (`src/lib/ui/site.ts:13`), в noindex-сборках пустой |
| `reachGoal` (доки Яндекса) | `ym(id,'reachGoal',target[,params[,callback[,ctx]]])`. Цель нужно заранее создать в интерфейсе как «JavaScript-событие». Лимиты: 200 целей на счётчик, одна и та же цель не чаще 1 раза в секунду, 400 онлайн-достижений за визит. В id нельзя `/ \ & # ? = "`. Задним числом цели не считаются, поэтому создать их нужно до деплоя |
| Saleads | `saleads_offers.py clicks` читает `GET https://saleads.pro/api/v1/click`, в записях есть `utm_marks`, `num_clicks`, `conversions[]`. По docs Saleads на площадку можно ставить неограниченно utm/GET-параметров. **Не проверено**, разбивает ли API записи по уникальному `utm_term`: ключ лежит в `.env`, читать его запрещено. По `utm_content` (десяток значений) разбивка в ЛК есть (`load-utm-values`) |
| Маскот | `packages/motion/src/mascot.ts:65-77`: кнопки `[data-act=pick|close|toggle]` внутри `[data-mascot]`, `persist`. Автооткрытие по таймеру, поэтому цель «открыт» ставить только на клик `toggle` |
| Пикер главной | `home-picker.ts:213` `[data-hp-all]` («Все предложения») |
| quiz, page_helpful, фильтры | Квиза и «Полезно?» в коде нет. Фильтры витрины (`offers-ui.ts:149-187`) есть, но событий много. **В MVP не берём** |

Внешних библиотек и репозиториев не нужно. Лицензий и платных лимитов нет.

## 2. Куда встраивается

| Файл | Правка |
|---|---|
| `src/layouts/BaseLayout.astro` (inline-скрипт Метрики, перед `if (choice === 'yes') load();`) | Одна строка: `window.fkGoal = function (n, p) { if (loaded) window.ym(id, 'reachGoal', n, p); };`. Гейт согласия — уже существующий флаг `loaded`. Отдельная проверка `html[data-consent]`, второй `define:vars` и захардкоженный `109623857` не нужны. Без `PUBLIC_METRIKA_ID` функции нет, и цели молча выключены |
| `src/scripts/goals.ts` (новый, ~40 строк) + `import './goals'` в `main.ts` | Делегированный `click`/`auxclick` на `document`. Модуль выполняется один раз, поэтому переживает ClientRouter. В `astro:page-load` ничего не вешаем, ручной `hit` не трогаем |
| `src/pages/go/[offer].astro` | meta-refresh убрать в `<noscript>`. Inline-скрипт читает `p`/`s`/referrer и дописывает utm перед `location.replace` |
| `src/pages/politika-konfidencialnosti.astro` | Одно предложение: «При переходе к партнёру в ссылку добавляются метка блока и случайный идентификатор перехода. Они не связаны с вашей личностью» |

Совместимость. Static-сборка не меняется: `getStaticPaths` прежний, query обрабатывает клиент. PHP не нужен.
Все `/go/`-ссылки с `target=_blank`, поэтому исходная страница остаётся открытой, Метрика успевает отправить цель, `callback` и `sendBeacon` не нужны.
ClientRouter ссылки `_blank` не перехватывает.

### MVP-код (черновик для реализации, в репо не вносился)

```ts
// src/scripts/goals.ts
type Goal = (name: string, params?: Record<string, string>) => void;
const goal: Goal = (n, p) => (window as Window & { fkGoal?: Goal }).fkGoal?.(n, p);
const hex = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

function slotOf(el: Element): string {
  const raw =
    el.closest<HTMLElement>('[data-cta-slot]')?.dataset.ctaSlot ??
    (el.closest('[data-showcase]') ? 'showcase' : el.closest('[data-cta-sticky]') ? 'sticky' : el.closest('section[id]')?.id);
  return (raw ?? 'inline').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'inline';
}

function onClick(e: MouseEvent) {
  if (e.type === 'auxclick' && e.button !== 1) return; // только средняя кнопка
  const t = e.target as Element;
  const a = t.closest<HTMLAnchorElement>('a[href^="/go/"]');
  if (a) {
    const path = a.getAttribute('href')!.split('?')[0];
    const p = slotOf(a);
    const s = hex(6); // 12 hex, без ПДн
    a.setAttribute('href', `${path}?p=${p}&s=${s}`); // браузер берёт href уже после обработчиков
    goal('offer_go', { offer: path.split('/')[2], slot: p, page: location.pathname, sid: s });
    return;
  }
  const act = t.closest<HTMLElement>('[data-mascot] [data-act]')?.dataset.act;
  if (act === 'pick') return goal('mascot_pick');
  // наш слушатель на document срабатывает после слушателя маскота, состояние уже новое
  if (act === 'toggle' && t.closest<HTMLElement>('[data-mascot]')?.dataset.state === 'talk') return goal('mascot_open');
  if (t.closest('[data-hp-all]')) return goal('picker_all');
  const g = t.closest<HTMLElement>('[data-goal]')?.dataset.goal; // задел для будущих quiz_*/page_helpful
  if (g) goal(g);
}
document.addEventListener('click', onClick);
document.addEventListener('auxclick', onClick);
```

```astro
<!-- src/pages/go/[offer].astro: в <head> -->
<noscript><meta http-equiv="refresh" content={`0;url=${destination}`} /></noscript>
<!-- в <body>, вместо текущего скрипта -->
<script define:vars={{ destination }}>
  var q = new URLSearchParams(location.search), u = new URL(destination);
  var p = q.get('p') || '', s = q.get('s') || '', sec = 'home';
  try { var r = new URL(document.referrer); if (r.origin === location.origin) sec = r.pathname.split('/')[1] || 'home'; else sec = 'ext'; } catch (e) { sec = 'direct'; }
  if (!/^[0-9a-f]{12}$/.test(s)) s = Array.from(crypto.getRandomValues(new Uint8Array(6)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  u.searchParams.set('utm_content', /^[a-z0-9-]{1,32}$/.test(p) ? p : 'none');
  u.searchParams.set('utm_term', s);
  if (/^[a-z0-9-]{1,48}$/.test(sec)) u.searchParams.set('utm_campaign', sec); // раздел вместо безликого 'go'
  location.replace(u.href);
</script>
```

Итоговая разметка у Saleads: `utm_campaign` = раздел (`zaimy`, `stati`, `home`), `utm_content` = слот (`top3`, `showcase`, `sticky`…), `utm_term` = subid.
`erid` и путь коннектора не трогаются. `searchParams.set` меняет только свои ключи, но перекодирует строку. Для текущих `erid` (буквы и цифры) это безопасно.
Проверку «erid присутствует и не изменён в итоговом URL» стоит добавить в `scripts/check-links.mjs`.

Referrer доступен: `Referrer-Policy: strict-origin-when-cross-origin` в `.htaccess` отдаёт полный путь внутри своего домена, `rel="noopener"` (без `noreferrer`) его не режет.

## 3. Ценность

- **SEO напрямую:** ноль. `/go/` закрыт `Disallow` и `noindex`, параметры `?p=&s=` в индекс не попадут. Новых URL для краулера нет: ссылки в HTML остаются `/go/<id>/`, query дописывается только в момент клика.
- **ПФ:** появляются измеримые цели. В отчётах Метрики («Конверсии», сегменты по целям) видно, какие страницы и источники ведут к `offer_go`, где был клик по маскоту и пикеру, и как эти визиты соотносятся с отказами и глубиной. Это база для решения «убрать блок / поднять блок».
- **Монетизация (главное):** CTR и EPC по связке раздел × слот × оффер. На статье шесть CTA-мест, на главной 49 ссылок. Сейчас Saleads видит все клики как `compare/go`, без разбивки. Склейка `utm_term` ↔ `sid` в параметрах цели даёт сквозной путь «страница → блок → конверсия» для доли визитов с согласием.
- **Запросы и трафик:** механика не про семантику. Её эффект — правильная расстановка офферов на уже ранжируемых страницах (займы, «что такое ПСК», «просрочка займа»).
- **Ссылкоёмкость:** нет.

Ограничение по объёму: значимые выводы по слоту требуют сотен кликов. При малом трафике первые 2–4 недели смотреть только агрегат «раздел × слот», не офферы.

## 4. Юридические риски

- **152-ФЗ.** Цели уходят только после согласия, через существующий гейт `loaded`. `sid` — случайные 12 hex, мы его нигде не храним и с личностью не связываем. В `utm_term` для Saleads без согласия он остаётся псевдонимной меткой перехода, а не ПДн. В параметры цели не класть query страницы, сумму и срок из пикера в сыром виде, ничего из форм. Одна строка в политике (см. §2) закрывает прозрачность.
- **38-ФЗ, ст. 18.1.** `erid` не удаляется и не переписывается, utm только дописываются. Saleads прямо разрешает свои utm/GET-параметры. Маскировка ссылки через `/go/` уже есть и не ухудшается.
- **Финсоветы:** не затрагиваются, контент не меняется.

## 5. MVP (1 день) и полная версия

**MVP (~1 день, из них ~0,5 — код):**
1. Владелец в интерфейсе Метрики 109623857 создаёт цели «JavaScript-событие»: `offer_go`, `mascot_open`, `mascot_pick`, `picker_all`. Делать **до деплоя**: задним числом цели не считаются.
2. Правки из §2: BaseLayout (1 строка), `goals.ts` + импорт, `/go/[offer].astro`, политика.
3. Проверка:
   - `dist/go/<id>/index.html?p=top3&s=0123456789ab` в браузере → итоговый URL содержит `erid`, `utm_campaign=<раздел>`, `utm_content=top3`, `utm_term=0123456789ab`.
   - Без параметров: `utm_content=none` и сгенерированный subid.
   - Без JS: срабатывает `noscript`-refresh на исходный URL.
   - С согласием и `?_ym_debug=1`: в консоли `reachGoal offer_go` с параметрами. Без согласия запросов к `mc.yandex.ru` нет.
   - Через сутки: `saleads_offers.py clicks` показывает новые `utm_marks`.

**Полная версия (по мере появления механик):**
- Цели `showcase_filter` (один раз за страницу, имя контрола), `calc_*`, `quiz_*`, `page_helpful` — через `data-goal`, без новых обработчиков.
- Составная цель-воронка в Метрике: просмотр раздела → `picker_all`/`mascot_pick` → `offer_go`.
- Команда `reconcile` в `saleads_offers.py`: `GET /click` → группировка по `utm_campaign × utm_content` → CSV с EPC. Склейка по `utm_term`, если API отдаёт клики поштучно.
- Серверный учёт без зависимости от согласия: `go.php` с логом (`../../seo/features/dive-go-php-click-tracker.md`). Тот же формат `?p=&s=`, поэтому клиентский код не меняется.
- A/B слотов: суффикс варианта в `p` (`top3-b`).

## Блокеры и открытые вопросы

1. Цели в интерфейсе Метрики создаёт владелец счётчика вручную (агент не может).
2. Не проверено, отдаёт ли Saleads `GET /click` запись на каждый уникальный `utm_term` (ключа API в окружении агента нет). Если нет, поштучная склейка возможна только через глобальный постбэк, макросы которого смотреть в ЛК. Агрегат по `utm_content` работает в любом случае.
3. Открытие ссылки через контекстное меню («открыть в новой вкладке») проходит мимо `click`: цели не будет, `utm_content=none`. Доля этих переходов мала, их закроет `go.php`.
