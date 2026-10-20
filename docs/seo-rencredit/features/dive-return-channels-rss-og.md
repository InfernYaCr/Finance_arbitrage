# Deep-dive: каналы возврата — RSS, Telegram/MAX, OG-картинки, «поделиться»

Идея `return-channels-rss-og` · rencredit-online.ru («Мерка») · проверено 2026-10-19

## Вердикт

**do_next, 6/10.** Делать частями. Как единый пакет идея переоценена: каналы и Дзен упираются в отсутствие конвейера новостей.

| Часть | Вердикт | Почему |
|---|---|---|
| `/rss.xml` + `/feed/` → `/rss.xml` + `<link rel=alternate>` | **do_now**, 0,5 дня | Без ленты не работает ни автопостинг, ни Дзен. Код без зависимостей по образцу `search.json.ts`. Риск нулевой |
| Кнопки «поделиться» (статьи и новости) | **do_now**, 0,25 дня | Обычные ссылки и `navigator.share`, около 0,5 КБ JS, без сторонних виджетов и cookie |
| OG-картинка на страницу (статьи, новости, обзоры, разделы) | **do_next**, 1 день | Аудит оценил F5 как LOW. Польза только при шеринге, а он появится вместе с кнопками и каналами |
| Каналы «Мерка» в Telegram и MAX + `announce.php` по cron | **do_next**, 1 день кода + организационная часть | Сейчас публиковать нечего: 4 новости, из них 3 старше полугода, и 22 статьи. Канал без потока в 2–5 постов в неделю мёртв |
| Плашка «подписаться на решение ЦБ» | **do_next** | Ближайшее решение ЦБ 23.10.2026, через 4 дня. Канал к этому сроку не наберёт аудиторию. Целиться в следующее заседание (декабрь) |
| Дзен (`content:encoded`) | **later** | Нужно 10+ материалов, 3+ публикации за месяц, свежесть 2–3 дня. Канал Дзена привязывается к домену, а домен под вопросом (`06-eeat-legal-trademark.md`) |
| Шеринг **результата калькулятора** с OG | **reject** для этого этапа | У `Calculator.astro` нет состояния в URL (`URLSearchParams` есть только в `offers-ui.ts` и `home-picker.ts`). Динамическую OG на статике не сделать, а заранее сгенерированные пресеты не стоят затрат |
| PWA-push | **later** | См. brand-engagement E9 |

Если делать всё, MVP занимает 2–2,5 дня: RSS, шеринг, OG по шаблону и `announce.php`. Каналы имеет смысл запускать, только когда news-pipeline реально выпускает 2+ материала в неделю.

## 1. Реальность: что есть и что работает

### Живой сайт (curl, 2026-10-19)

| URL | Ответ | Комментарий |
|---|---|---|
| `/rss.xml` | 404 | Ленты нет |
| `/feed/` | 301 → `/` | `public/.htaccess:164`. Подписчики старого WP-фида получают HTML главной |
| `/credit/feed/`, `/comments/feed/` | 301 → `/` | `.htaccess:160,162` |
| `/?feed=rss2` | 301 → `/` | `.htaccess:67-69` |
| прочие `*/feed/` | 410 | `.htaccess:264` |
| `og:image` | `/og/default.png` на всех страницах | `BaseLayout.astro:37`. У `cover` нет ни одного значения в `src/content/**` |
| `/search.json` | 200 `application/json` | Endpoint-образец на статике работает на хостинге |

### Код (worktree `rencredit-pilot-wt`)

- `content.config.ts:49-60` — `baseArticle` уже содержит всё нужное для ленты: `title`, `description≤200`, `publishDate`, `updatedDate`, `cover?`, `draft`, `legacyUrl`. У новостей ещё есть `source` и `sourceName`.
- `lib/content.ts` — `getArticles()` и `getNews()` уже фильтруют `draft` и сортируют. `articleHref()` даёт правильный адрес, включая `/credit/<slug>.html`. Достаточно переиспользовать.
- Статьи: 38 `.mdx` (16 в draft), импортов и компонентов в теле нет. Новости: 4 `.md`. Тело MDX не попадает в `entry.rendered`, поэтому полный текст для `content:encoded` придётся рендерить через Container API или remark. Это нужно только для Дзена, в MVP не входит.
- `scripts/gen-assets.mjs` рисует OG через `sharp` + SVG `<text font-family="Arial">`. librsvg берёт шрифт из fontconfig: на Ubuntu в CI Arial нет, и кириллица уйдёт в DejaVu. Сейчас это не проблема, потому что PNG закоммичен.
- `sharp 0.35.5` есть в `node_modules` транзитивно через Astro. В `package.json` он не объявлен.
- Onest лежит только как woff2 (`@fontsource-variable/onest`). Для Pango/librsvg нужен TTF: `google/fonts/ofl/onest/Onest[wght].ttf` (200, OFL).
- `RESERVED_SLUGS` в `lib/ui/site.ts`: по словам автора идеи, `/og` там уже зарезервирован, так что маршрут `[guide]` его не перехватит.
- Деплой: `scripts/deploy-beget.sh` (ssh/ftp, без `--delete`) и черновой `.github/workflows/deploy-rencredit.yml` (только ручной запуск, lftp `--only-newer`). Сейчас в `dist` 213 страниц, 7,5 МБ.
- В `.htaccess` CSP нет, поэтому inline-скрипт шеринга ничего не сломает.

### Внешние API, пакеты, лицензии

| Что | Состояние | Ограничения |
|---|---|---|
| `@astrojs/rss` | 4.0.19 (npm, 30.06.2026). Зависимости: fast-xml-parser, zod | Для ленты на 30 записей не нужен: шаблонная строка короче, чем подключение пакета |
| `astro-og-canvas` | 0.13.2, peer `astro ^5 \|\| ^6 \|\| ^7`, **MIT** по npm (GitHub лицензию не распознаёт). Репозиторий обновлён 2026-10-17, 288★ | Тянет `canvaskit-wasm` (~7 МБ в node_modules, в dist не попадает). Шрифт берёт из файла, от системы не зависит |
| Telegram Bot API | `api.telegram.org` 200 (отсюда, не с Beget) | `sendMessage`: 4096 символов, ~20 сообщений в минуту в канал. **Доступность с Beget не проверена.** С 10.02.2026 Telegram в РФ замедляют, в августе фильтрацию усилили (источники в brand-engagement E9) |
| MAX Bot API | `dev.max.ru/docs-api/methods/POST/messages` 200 | Хост `platform-api2.max.ru` (это CNAME на `platform-api.max.ru`). Токен передаётся **только в заголовке `Authorization`**, через query больше не принимается. `chat_id` в query, `text` до 4000 символов, `format: html\|markdown`, до 2 сообщений в секунду на чат. **TLS на сертификате Минцифры**: обычный curl падает (`000`), с `-k` отвечает 401. На Beget в `CURLOPT_CAINFO` нужен `russian_trusted_root_ca.pem` |
| MAX PHP-клиент | `BushlanovDev/max-bot-api-client-php`, MIT, обновлён 2026-10-01, 51★ | Для одного `POST` не нужен, хватает curl на 10 строк |
| Каналы в MAX | **не проверено** (веб-поиск упёрся в лимит сессии) | Кто может завести канал (нужна ли верификация юрлица или ИП) и как бот становится его админом, выяснить до того, как обещать «дубль в MAX» |
| Дзен RSS | `dzen.ru/help/ru/website/rss-modify.html` 200 | Для первой разметки нужно ≥10 материалов, ≥3 публикации за последний месяц, материалы за 2–3 дня, не больше 500 за раз. `content:encoded` от 300 символов, `enclosure` от 700 px (JPEG/PNG/GIF), `guid`, `category=native-draft` сохраняет черновиком. Правки принимаются 7 дней. Лента не должна быть закрыта в robots |
| Share-ссылки | `t.me/share/url?url=` 200, `vk.com/share.php?url=` 200 | Без JS и cookie |

## 2. Куда встраивается (файлы)

### 2.1 `/rss.xml`, 0,5 дня

`web/apps/rencredit/src/pages/rss.xml.ts` (новый, по образцу `search.json.ts`):

```ts
import type { APIRoute } from 'astro';
import { getArticles, getNews, articleHref } from '../lib/content';
import { SITE } from '../lib/ui/site';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const [articles, news] = await Promise.all([getArticles(), getNews()]);
  const items = [
    ...news.map((n) => ({ d: n.data, url: abs(`/novosti/${n.id}/`) })),
    ...articles.map((a) => ({ d: a.data, url: abs(articleHref(a)) })),
  ].sort((a, b) => +b.d.publishDate - +a.d.publishDate).slice(0, 30);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE.name)}: новости и статьи</title><link>${abs('/')}</link>
<description>${esc(SITE.tagline)}</description><language>ru</language>
${items.map(({ d, url }) => `<item><title>${esc(d.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid>
<pubDate>${d.publishDate.toUTCString()}</pubDate><description>${esc(d.description)}</description></item>`).join('\n')}
</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
```

Путь `/novosti/${id}/` и наличие `SITE.tagline` сверить с `novosti/[...slug].astro` и `lib/ui/site.ts`.

- `BaseLayout.astro` после строки 58 (`canonical`): `<link rel="alternate" type="application/rss+xml" title="Мерка — новости и статьи" href="/rss.xml" />`.
- `public/.htaccess`: в строках 69, 160, 162 и 164 заменить цель `https://%{HTTP_HOST}/` на `https://%{HTTP_HOST}/rss.xml`. Правило 410 на строке 264 стоит ниже и эти адреса не перехватит.
- `scripts/check.mjs` (dist-проверка): одна строка — `dist/rss.xml` существует, и в нём нет `/go/`.
- Промо в ленту не попадает: в RSS идут только `title`, `description` и ссылка. `content:encoded` не нужен, пока не подключаем Дзен.

### 2.2 Кнопки «поделиться», 0,25 дня

`src/components/ShareBar.astro` (новый) вставить в `ArticleView.astro` после тела статьи и в `novosti/[...slug].astro`:

- `<a href="https://t.me/share/url?url={u}&text={t}">`, `<a href="https://vk.com/share.php?url={u}">`, кнопка «Скопировать ссылку» (`navigator.clipboard.writeText`) и кнопка «Поделиться», которая показывается только при `'share' in navigator`. На мобильном она открывает системное меню, где есть и MAX.
- Ссылка на MAX: публичного share-URL, аналогичного `t.me/share`, я не нашёл. Не выдумывать, MAX покрывает `navigator.share`.
- JS около 0,5 КБ inline, в стиле существующих `src/scripts/*`. Цель Метрики `share` с параметром канала (через `reachGoal`, как в dive-cpa-click-goals).
- `rel="noopener"` и `target="_blank"`. Кнопки — ссылки, без iframe, поэтому без 152-ФЗ и без CookieBar.

### 2.3 OG-картинки, 1 день

Два варианта. Рекомендую **A**.

**A. Без новой зависимости: `sharp` + Pango-текст с `fontfile`.**
`sharp({ text: { text, fontfile, font: 'Onest Bold 56', width: 760, wrap: 'word', rgba: true } })` сам переносит кириллицу по ширине. Фон — тот же SVG без `<text>` из `gen-assets.mjs` (знак, карточки, цвета бренда), заголовок и раздел накладываются через `composite`.
- Где: хук `astro:build:done` в `astro.config.mjs` рядом с `legacyHtmlFiles()`. Он проходит по `dist/**/index.html`, берёт `og:title`, рисует `dist/og/<path>.png` и подставляет `og:image` в HTML. Вариант проще: endpoint `src/pages/og/[...path].png.ts` с `getStaticPaths` из коллекций, тогда `ogImage` передаётся явно из `ArticleView`, `novosti/[...slug]`, `[dir]/[slug]`, `[guide]` и `Catalog`. **Endpoint лучше**: без пост-обработки HTML, и `BaseLayout` уже принимает `ogImage`.
- Шрифт: `web/apps/rencredit/assets/fonts/Onest[wght].ttf` (OFL, ~200 КБ, коммитится). Тогда CI и Windows рендерят одинаково.
- `sharp` объявить в `dependencies` явно (сейчас он транзитивный, его может убрать любое обновление Astro).
- `BaseLayout.astro:74-75`: `og:image:width`/`height` выводятся только при `!ogImage`. Для сгенерированных картинок тоже нужны 1200×630, поэтому заменить условие флагом.
- Объём: ~22 статьи + 4 новости + 33 обзора + 9 подборок + ~12 разделов ≈ 80 PNG × 40–50 КБ ≈ 3,5–4 МБ к `dist`. Каждая сборка заново пишет PNG и меняет mtime, поэтому lftp `--only-newer` будет перезаливать все 80 при каждом деплое. Это терпимо. Если начнёт мешать, писать только при изменении хэша (`ponytail:`-уровень, не сейчас).
- Эта же картинка закрывает `image` в `Article` JSON-LD (01-technical, п. 4 и F5). Отдельно её не делать.

**B. `astro-og-canvas` 0.13.2.** Точная типографика и готовый `OGImageRoute`, но +canvaskit-wasm и время сборки. Брать, если Pango-переносы выглядят плохо (висячие предлоги, неровная правая граница).

### 2.4 Автопостинг в Telegram и MAX, 1 день кода

`scripts/beget/announce.php`. Это **не** `public/`: файл в `public` попадёт в dist, и его сможет дёрнуть кто угодно. Копируется на Beget один раз в `~/announce.php`. Cron в панели Beget: `*/30 * * * * php ~/announce.php`.

```php
<?php
if (PHP_SAPI !== 'cli') exit(1);
$cfg = parse_ini_file(getenv('HOME') . '/merka-bot.ini');        // TG_TOKEN, TG_CHAT, MAX_TOKEN, MAX_CHAT; вне public_html
$stateFile = getenv('HOME') . '/merka-posted.json';
$posted = is_file($stateFile) ? json_decode(file_get_contents($stateFile), true) : null;
$rss = simplexml_load_string(file_get_contents('https://rencredit-online.ru/rss.xml'));
$items = array_reverse(iterator_to_array($rss->channel->item, false));
if ($posted === null) {                                              // первый запуск: всё старое = уже опубликовано, без спама
  file_put_contents($stateFile, json_encode(array_map(fn($i) => (string)$i->guid, $items))); exit;
}
foreach ($items as $i) {
  $guid = (string)$i->guid;
  if (in_array($guid, $posted, true)) continue;
  $text = '<b>' . htmlspecialchars($i->title) . "</b>\n\n" . htmlspecialchars($i->description)
        . "\n\n" . (string)$i->link . '?utm_source=tg';                // ponytail: один utm на оба канала, разнести, когда будет что сравнивать
  $ok = post('https://api.telegram.org/bot' . $cfg['TG_TOKEN'] . '/sendMessage', [], ['chat_id' => $cfg['TG_CHAT'], 'text' => $text, 'parse_mode' => 'HTML']);
  $ok = post('https://platform-api2.max.ru/messages?chat_id=' . $cfg['MAX_CHAT'], ['Authorization: ' . $cfg['MAX_TOKEN']], ['text' => $text, 'format' => 'html'], __DIR__ . '/russian_trusted_root_ca.pem') && $ok;
  if (!$ok) break;                                                   // повторим в следующий запуск, состояние не портим
  $posted[] = $guid; file_put_contents($stateFile, json_encode($posted));
  sleep(2);
}
function post($url, $headers, $body, $ca = null) { /* curl_init, JSON, CURLOPT_TIMEOUT 15, CAINFO=$ca; вернуть HTTP 200 */ }
```

- «При снятии draft» получается само: снятый draft → сборка и деплой → запись появилась в `rss.xml` → cron её публикует. Отдельного триггера не нужно.
- Почему cron на Beget, а не шаг в CI: деплой сейчас ручной и локальный (`deploy-beget.sh`), а workflow — черновик. Cron не зависит от того, кто и откуда деплоил. Если `api.telegram.org` с Beget недоступен (проверить заранее одной командой `curl -sI https://api.telegram.org` по SSH), Telegram-часть переносится в `scripts/announce.mjs` после деплоя с машины владельца. MAX остаётся в cron.
- Ошибка одного канала блокирует очередь. Это сознательная простота: дубль в одном канале хуже задержки в обоих. Если какой-то канал начнёт падать надолго, хранить состояние по каналам.
- Utm-метки дают в Яндексе дубли URL (01-technical, F про `?utm_source`). Canonical это закрывает, но 01-technical предлагает `Clean-param`. Синхронизироваться с ним, а не делать отдельно.

### 2.5 Дзен — позже

Нужен отдельный `/rss-dzen.xml`: `xmlns:content`, `content:encoded` из отрендеренного тела без AdMark/OfferCard, `enclosure` из OG (1200 px ≥ 700), `category=native-draft` на первые недели. Тела MDX рендерить через `experimental_AstroContainer` / `astro/container` (уточнить API в Astro 7 через context7 перед работой). Подключать, когда за последний месяц будет 3+ материала и решится вопрос с доменом.

## 3. Ценность

**Аудитория.** Человек с займом или кредитом не читает сайты-агрегаторы регулярно. Регулярно он читает Telegram, MAX и Дзен. Новость «с 1 октября МФО ограничивают ПСК 200%» или «ЦБ снизил ставку: что будет с вашим кредитом» — естественный повод для поста. Шеринг статьи «как объединить кредиты в один» родственнику — реальный сценарий, но только если в один тап.

**SEO / ПФ.** Честная оценка: прямого поискового спроса RSS и OG не дают, это не страницы под запросы. Эффект косвенный:
- брендовые и прямые визиты («мерка займы», заходы из канала) — сигнал для Яндекса, но заметным он станет от ~1–2 тыс. подписчиков;
- кликабельные превью в TG/VK поднимают CTR шеринга (OG с заголовком против одинаковой карточки на всех 83 страницах);
- внешние упоминания бренда «Мерка» переживут возможную смену домена (09-offpage, п. 6). Это главный довод делать каналы под брендом, а не под доменом;
- старые подписчики фида: у WP-сайта их, скорее всего, единицы. Это аргумент за 4 строки `.htaccess`, не за фичу;
- ссылкоёмкость низкая. Ссылки в каналах nofollow или не индексируются, Дзен даёт трафик, но не ссылочный вес.

**Монетизация.** Возвратная аудитория идёт на статьи, в которых уже стоят офферы, и на витрины без затрат на привлечение. Посты-подборки офферов («займы 0% этой недели») — отдельный источник CPA-кликов, но это **реклама** (см. ниже). В MVP подборок нет, только редакционные записи из RSS.

**Метрики успеха (30 дней после запуска каналов):** визиты с `utm_source=tg|max`, цель `share`, доля возвратных посетителей в Метрике, CTR превью. Если меньше 50 визитов в месяц из каналов, не масштабировать, а вкладываться в news-pipeline.

## 4. Юридические риски

- **38-ФЗ.** Пост с упоминанием конкретной МФО или банка и ссылкой на `/go/` или витрину, скорее всего, будет признан рекламой финуслуги. Нужны пометка «Реклама», рекламодатель, erid, отчёт в ЕРИР и полная ПСК/условия по ст. 28. Поэтому в MVP публикуются только редакционные записи со ссылкой на свою страницу, без `/go/` и без названий офферов в тексте поста. Подборки офферов — только с erid от CPA-сети. Для них нужен отдельный ручной шаблон, не автопостинг.
- **Реестр РКН (149-ФЗ в ред. 303-ФЗ, с 01.11.2024).** Канал от 10 тыс. подписчиков обязан подать сведения в РКН, иначе в нём нельзя размещать рекламу и делать сборы. До этого порога далеко, но заложить заранее.
- **Telegram.** Замедление и фильтрация в РФ. Удержание только на нём не строить. MAX как второй канал и `navigator.share` закрывают это частично.
- **152-ФЗ.** RSS, share-ссылки и посты ПДн не собирают. Сторонние виджеты (yastatic share2) не ставить: они ставят cookie до согласия (brand-engagement, «Что не делать»). Email-подписку в этот пакет не включать.
- **Финсоветы.** Тексты постов берутся из `description`, который уже прошёл ymyl-content и fact-checker. Не дописывать в постах «выгодно», «одобрят», «лучший». Плашка «подписаться на решение ЦБ» — это обещание прислать новость, а не рекомендация.
- **Товарный знак.** Каналы, OG и подписи — только бренд «Мерка», без «Ренессанс» и «рен». На OG выводится домен `rencredit-online.ru` (сейчас он в `gen-assets.mjs`). Если домен поменяется, OG пересоберутся, а каналы останутся.

## 5. MVP (2–2,5 дня) и полная версия

### MVP

1. `rss.xml.ts` + `<link rel=alternate>` + 4 цели редиректа в `.htaccess` + проверка в `check.mjs`. **Готово, когда** `curl /rss.xml` отдаёт 200, валидный XML и ≥26 `<item>`, `curl -I /feed/` отдаёт 301 на `/rss.xml`, в ленте нет `/go/`.
2. `ShareBar.astro` в статьях и новостях + цель `share`. **Готово, когда** на 375 px кнопки в один ряд без горизонтального скролла, работают с клавиатуры, а `navigator.share` скрыт на десктопе без поддержки.
3. OG endpoint (вариант A) для статей, новостей, обзоров и подборок + Onest TTF + `sharp` в deps + width/height в `BaseLayout`. **Готово, когда** собранный `dist/og/*.png` для 3 длинных заголовков читается без обрезки, а Telegram-превью (через @WebpageBot) показывает новую картинку.
4. `announce.php` + ini вне `public_html` + cron. Перед этим: каналы созданы, бот — админ, `curl api.telegram.org` и `platform-api2.max.ru` с Beget работают. **Готово, когда** первый запуск только записал состояние, а снятие draft с одной новости после деплоя дало ровно один пост в каждом канале.

Пункты 1–2 можно делать сразу. Пункты 3–4 — когда news-pipeline выдаёт 2+ материала в неделю (иначе в канале будет пост раз в месяц).

### Полная версия (+3–4 дня, после 1–2 месяцев регулярного выпуска)

- `/rss-dzen.xml` с `content:encoded` и `enclosure`, подключение Дзена (после решения по домену).
- Плашка «подписаться на решение ЦБ» в 29 статьях с упоминанием рефинансирования. Это ссылки на каналы, без формы. Запуск к декабрьскому заседанию ЦБ, а не к 23.10.
- Еженедельный дайджест-пост из RSS (бренд-ритуал E10 «Мерка месяца» туда же).
- Шеринг результата калькулятора — только после того, как `Calculator.astro` начнёт хранить параметры в URL (отдельная задача, связанная с dive-C7 и dive-refi-calc). OG для результатов делать как набор пресетов, без динамики.
- PWA-push — по brand-engagement E9.

## Что не делать

- `@astrojs/rss` ради одной ленты на 30 записей.
- `cron.php` в `public/` (окажется в dist и будет вызываться снаружи) и токены в репо или в `public_html`.
- Автопостинг подборок офферов без erid.
- Подключение Дзена с 4 новостями: первую разметку он не пройдёт, и ленту придётся переподавать.
- RSS-to-Telegram-Bot и подобные боты на VPS: для одного `sendMessage` в 30 минут не нужны.

## Источники (проверены 2026-10-19)

- Код: `web/apps/rencredit/{astro.config.mjs, package.json, public/.htaccess:64-69,156-164,264, src/pages/search.json.ts, src/pages/robots.txt.ts, src/layouts/BaseLayout.astro:31-37,56-79, src/components/ArticleView.astro:42, src/pages/novosti/[...slug].astro:29, src/content.config.ts:49-80, src/lib/content.ts, scripts/gen-assets.mjs}`, `scripts/{deploy-beget.sh, check.mjs, indexnow.mjs}`, `.github/workflows/deploy-rencredit.yml`, `.claude/skills/news-pipeline/SKILL.md`.
- Живой сайт: `/rss.xml` 404, `/feed/` 301 → `/`, `/og/default.png` 200 (45,9 КБ), `/search.json` 200.
- npm: `@astrojs/rss@4.0.19`, `astro-og-canvas@0.13.2` (peer astro ^7, MIT, deps canvaskit-wasm). `sharp@0.35.5` в node_modules.
- GitHub: delucis/astro-og-canvas (pushed 2026-10-17), BushlanovDev/max-bot-api-client-php (MIT, 2026-10-01).
- [MAX POST /messages](https://dev.max.ru/docs-api/methods/POST/messages): хост, заголовок Authorization, лимиты. `platform-api.max.ru/me` отвечает 401 только с `-k` (сертификат Минцифры).
- [Дзен: требования к RSS](https://dzen.ru/help/ru/website/rss-modify.html).
- [Telegram Bot API](https://core.telegram.org/bots/api), `t.me/share/url`, `vk.com/share.php` (200).
- Onest TTF: `github.com/google/fonts/raw/main/ofl/onest/Onest[wght].ttf` (200, OFL).
- Смежные отчёты: `features/brand-engagement.md` E9/E10, `01-technical.md` F5 и п. 4, 11, `09-offpage-backlinks.md` п. 6 и R11, `06-eeat-legal-trademark.md` (домен), `finhelp_ideas.json` (`return-channels`, `og-images-telegram-share`, `dzen-telegram-distribution`).
- Не проверено: условия создания каналов в MAX и добавления бота в админы, доступность `api.telegram.org` с Beget (веб-поиск упёрся в лимит сессии, SSH к Beget в задачу не входил).
