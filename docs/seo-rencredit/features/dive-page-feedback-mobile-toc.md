# Deep-dive: «Материал помог?» + мобильное оглавление статей (rencredit-online.ru)

Идея: `page-feedback-mobile-toc`. Дата проверки: **2026-10-19**. Код: `/Users/deniskononov/rencredit-pilot-wt/web/apps/rencredit`
(Astro 7 static, `ClientRouter`). Основа: finhelp-идеи 6/118 (`finhelp_ideas.json`), `finhelp-adapt-1.md` §11,
`finhelp-adapt-2.md` §10, `brand-engagement.md` E8, `current-state.md` §11. Здесь не пересказываю их, а сверяю с кодом.

## TL;DR и вердикт

**do_next, 6/10.** Задача дешёвая (MVP 1–1,5 дня), но эффект на ранжирование — гипотеза, а не факт.
Реальная ценность складывается из трёх частей:
1. **Мобильное оглавление.** Это настоящая UX-дыра: у всех 30 статей 7–15 H2, а на телефоне оглавления нет вообще.
   Делается нативным `<details>` без JS. Брать **сразу**.
2. **«Материал помог?» как цель Метрики.** Это очередь на актуализацию текстов. Сигнал для поисковика косвенный.
   Без `fkGoal` из `dive-cpa-click-goals.md` цели некуда отправлять, поэтому эта часть идёт **после** него.
3. **v2 «Нашли ошибку» (`report.php`).** Сейчас блокирована: на проде нет контактного email
   (`PUBLIC_CONTACT_EMAIL` пуст, в футере и `/o-proekte/` нет ни одного `mailto:`), а исполнение PHP на docroot не проверено.
   Публичный агрегат «помогло N из M» **отклоняю** (обоснование в §4).

Четыре поправки к описанию идеи:
- Статей **30**, а не 22. Из них 14 с `legacyUrl` живут на `/credit/<slug>.html`.
- Подсветка текущего раздела **уже свёрстана**: `.toc a.is-active` есть в `global.css:420`, но класс никто не ставит.
  Нужен только IO-скрипт.
- «Позу Character переключать CSS-классом» не получится. `Character.astro` рендерит SVG **только** для своей позы
  (руки, лицо, реквизит под `{pose === …}`). Нужны два инлайновых `<Character>` (cheer и think) со скрытием через `hidden`,
  это около 1,5 КБ разметки. Плавающий маскот (`transition:persist`) не трогаем.
- «На «нет» — 3 связанных материала». В `ArticleView` блок «Читайте также» (3 карточки) и `CtaNext` уже стоят ниже.
  Дублировать их бессмысленно. На «нет» полезнее спросить **причину** (3 чипа) и дать 2–3 ссылки из уже вычисленных
  `related`, `others` и `similar`.

## 1. Реальность: API, хостинг, лимиты

| Что | Проверка 2026-10-19 | Вывод |
|---|---|---|
| Метрика `reachGoal` | Документация живая: `ym(counter,'reachGoal',target[,params[,callback[,ctx]]])`. Цель нужно заранее создать в интерфейсе как «JavaScript-событие», в имени нельзя использовать `/ \ & # ? = "`. Числовых лимитов в документации нет. `params` записываются как параметры визита | Бесплатно, без ключей. Цель `page_helpful` создаёт владелец счётчика вручную |
| Отправка целей в коде | `BaseLayout.astro:90-136`: Метрика грузится только после согласия (`fk-consent`), флаг `loaded`. `window.fkGoal` и `reachGoal` в коде **нет** (grep) | Нужна строка `window.fkGoal = (n,p) => loaded && ym(id,'reachGoal',n,p)` из `dive-cpa-click-goals.md` §2. Если тот дайв не внедрён, добавить её в этом MVP |
| Выборка | Цели приходят только от тех, кто согласился на cookie | Доля «да/нет» смещена, но для очереди «какие тексты переписать» этого хватает. Абсолютные числа не публиковать |
| PHP на проде | `curl`: `/mail.php` и `/report.php` → 404, `/index.php` → 301 (legacy-правило `.htaccess:72+`), `server: nginx-reuseport` перед Apache. В `dist/` нет ни одного `.php` | Исполнение PHP на этом docroot **не проверено** (то же, что в `dive-go-php-server-log.md` §1). Перед v2 обязателен smoke-тест |
| Деплой | `scripts/deploy-beget.sh` (tar по ssh) и `.github/workflows/deploy-rencredit.yml` (без `--delete`, «на хостинге лежат … mail.php») | Файл `dist/report.php` доедет обычным деплоем. Каталог вне docroot (`dirname(__DIR__)` → `/rencredit/`) нужно проверить на запись |
| Email для v2 | На проде `mailto:` не найден: `SITE.email` пуст, `o-proekte.astro:28` прячет блок «Контакты» | **Блокер v2**: нужен ящик на домене (Beget-почта), иначе письма некуда слать, а `From:` не пройдёт SPF |
| CSP | В заголовках прода CSP нет; `fetch('/report.php')` same-origin | Препятствий нет |

Внешних репозиториев и библиотек не нужно. Лицензий и лимитов нет. TOC-подсветка — около 25 строк своего TS:
готовые пакеты вроде `tocbot` тяжелее и сами строят DOM, который здесь уже есть.

## 2. Куда встраивается (по коду)

### 2.1 Что уже есть
- `src/components/ArticleView.astro`: `toc = headings.filter(depth 2|3)`, `<aside class="hidden lg:block">` с `nav.toc`,
  мета-строка «Обновлено {updatedDate}», «N мин чтения», `Faq`, «Читайте также» (`related`, 3 шт.), `CtaTop3`, `CtaNext`, `CtaSticky`.
  `CtaH2` подменяет `<h2>` и пробрасывает `id` через `{...attrs}`, поэтому якоря рабочие.
- `global.css:63`: `scroll-padding-top: calc(var(--header-h) + 16px)` и `.prose h2 { scroll-margin-top }`. Шапка якоря не перекрывает.
- `global.css:416-421`: стили `.toc` и `.toc a.is-active`. `.toc` имеет `position: sticky` — для мобильной версии
  нужен `position: static`.
- `src/scripts/main.ts`: единая точка входа, `astro:page-load` → `init*()` из `chrome.ts`. IO-паттерн с `prefersReduced()`
  уже есть в `packages/motion/src/reveal.ts`.
- `content.config.ts:53`: `updatedDate` есть в `baseArticle` (статьи, гайды) и в service-pages (`:140`).
  Поля под текст исправления («Исправлено: …») **нет**.
- Обзоры `src/pages/[dir]/[slug].astro` (33 оффера: `/mfo/`, `/karty/`, `/kredity/`), гайды `src/pages/[guide].astro` (8),
  `ServiceLanding.astro` (9 посадочных + хаб, `noMascot`).

### 2.2 Файлы MVP

| Файл | Правка | Объём |
|---|---|---|
| `src/components/ArticleView.astro` | Над `.prose`: `<details class="toc toc-m lg:hidden">` с тем же `<ol>`, показывать при `toc.length > 2`. Под `</article>` вставить `<Helpful slug={entry.id} next={related.map(...)} />` | +8 строк |
| `src/components/Helpful.astro` (новый) | Кнопки, два `Character`, чипы причин, делегированный обработчик в `<script>` | ≈45 строк |
| `src/scripts/chrome.ts` + `main.ts` | `initToc()`: IO на `h2[id], h3[id]` → `is-active` на всех `.toc a` с этим hash. При `astro:page-load` отключать прошлый observer | ≈25 строк |
| `src/styles/global.css` | `.toc-m { position: static }`, `summary`, `.helpful` | ≈15 строк |
| `src/pages/[guide].astro` | `<Helpful slug={guide.id} next={others.slice(0,3)…} />` после `CtaNext` | +1 |
| `src/pages/[dir]/[slug].astro` | `<Helpful slug={o.slug} q="Обзор помог разобраться в условиях?" next={[hub, 'как проверить МФО в реестре']} />` перед `similar` | +1 |
| `src/layouts/BaseLayout.astro` | Только если `cpa-click-goals` не внедрён: строка `window.fkGoal` | +1 |

`ServiceLanding` отложен до v1.1. Это каталог с коротким текстом, и вопрос «Материал помог?» там читается странно.

### 2.3 Черновики (в репо не вносились)

```astro
<!-- ArticleView.astro: перед <div class="prose"> -->
{toc.length > 2 && (
  <details class="toc toc-m lg:hidden">
    <summary>Содержание · {toc.length}</summary>
    <ol>{toc.map((h) => <li><a class:list={[h.depth === 3 && 'sub2']} href={`#${h.slug}`}>{h.text}</a></li>)}</ol>
  </details>
)}
```

```ts
// chrome.ts
let tocIo: IntersectionObserver | null = null;
export function initToc() {
  tocIo?.disconnect();
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  // slug кириллический: a.hash приходит percent-encoded
  const ids = new Set(links.map((a) => decodeURIComponent(a.hash.slice(1))));
  const set = (id: string) => links.forEach((a) => a.classList.toggle('is-active', decodeURIComponent(a.hash.slice(1)) === id));
  tocIo = new IntersectionObserver((es) => {
    const hit = es.find((e) => e.isIntersecting);
    if (hit) set(hit.target.id);
  }, { rootMargin: '-15% 0px -75% 0px' });
  ids.forEach((id) => { const h = document.getElementById(id); if (h) tocIo!.observe(h); });
  // мобильное оглавление закрываем ДО дефолтного скролла, иначе цель уедет на высоту списка
  document.querySelector('.toc-m')?.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) (e.currentTarget as HTMLDetailsElement).open = false;
  });
}
```

```astro
---
// Helpful.astro
import Character from './mascots/Character.astro';
interface Props { slug: string; q?: string; next?: { href: string; label: string }[] }
const { slug, q = 'Материал помог?', next = [] } = Astro.props;
---
<section class="helpful" data-helpful={slug} aria-label="Оценка материала">
  <p class="helpful-q">{q}</p>
  <div class="helpful-btns"><button type="button" class="btn btn-ghost" data-v="yes">Да</button><button type="button" class="btn btn-ghost" data-v="no">Нет</button></div>
  <div class="helpful-yes" hidden role="status"><Character pose="cheer" size="sm" /><p>Спасибо! Так мы понимаем, какие тексты работают.</p></div>
  <div class="helpful-no" hidden role="status"><Character pose="think" size="sm" />
    <p>Чего не хватило?</p>
    <div class="chips">
      <button type="button" class="chip" data-r="outdated">Устарели условия</button>
      <button type="button" class="chip" data-r="no-answer">Нет ответа на мой вопрос</button>
      <button type="button" class="chip" data-r="hard">Сложно написано</button>
    </div>
    {next.length > 0 && <ul>{next.map((n) => <li><a href={n.href}>{n.label}</a></li>)}</ul>}
  </div>
</section>
<script>
  // Скрипт компонента выполняется один раз; с ClientRouter работает делегирование на document.
  type W = Window & { fkGoal?: (n: string, p?: object) => void };
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-helpful] button[data-v], [data-helpful] button[data-r]');
    const box = b?.closest<HTMLElement>('[data-helpful]');
    if (!b || !box) return;
    const slug = box.dataset.helpful!;
    const v = b.dataset.v;
    if (v) {
      box.querySelector<HTMLElement>('.helpful-btns')!.hidden = true;
      box.querySelector<HTMLElement>(`.helpful-${v}`)!.hidden = false;
      // вложенность {helpful:{yes:slug}} → в «Параметрах визитов» дерево helpful → yes|no → slug
      (window as W).fkGoal?.('page_helpful', { helpful: { [v]: slug } });
    } else {
      b.parentElement!.hidden = true;
      (window as W).fkGoal?.('page_helpful_reason', { helpful_reason: { [b.dataset.r!]: slug } });
    }
  });
</script>
```

Параметры сделаны вложенными намеренно. Плоский объект `{slug, v}` разложится в отчёте на две независимые ветки,
и связку «slug × ответ» потом не собрать.

### 2.4 Совместимость и вес
- Всё статика: `<details>` нативный, без JS. Скрипты собираются Vite в общий бандл. Прирост около 1 КБ min, примерно 0,5 КБ gzip.
- `ClientRouter`: обработчик Helpful вешается один раз на `document`. `initToc` перезапускается на каждом `astro:page-load`
  и сначала отключает прошлый IO.
- Hash-переходы `ClientRouter` на той же странице отдаёт браузеру. Закрытие `<details>` в click-хендлере срабатывает
  до дефолтного скролла. **Проверить вручную** на iOS Safari: известна особенность, когда смена layout во время smooth-scroll
  сбивает позицию. Если сбивает, оставить `<details>` открытым.
- `prefers-reduced-motion`: анимации `.ch-cheer-*` уже глушатся в `decor.css:47/85`.
- `CtaSticky` на мобиле может перекрыть кнопки Helpful у низа страницы. Блок стоит выше `Faq`, перекрытие вероятно,
  проверить на 375 px.

## 3. Ценность

**Аудитория.** Тексты длинные: 1100–2600 слов, 7–15 H2, в 6 статьях ещё и H3. Самые объёмные:
`kak-obedinit-kredity-v-odin`, `refinansirovanie-ipoteki-v-2026`, `refinansirovanie-v-t-banke`,
`refinansirovanie-avtokredita` (около 2500 слов). Это информационные запросы, по которым читают с телефона:
«рефинансирование кредита что это», «как объединить кредиты в один», «что такое ПСК и как её считать»,
«самозапрет на кредиты», «что будет при просрочке займа». Сейчас на мобиле до нужного раздела приходится листать
3–5 экранов. Частоты по Вордстату здесь не замерял: это задача SEO-аудита `0*.md`, его не дублирую.

**ПФ и SEO (честно).**
- Оглавление с якорями даёт быстрый переход к ответу, меньше отказов и возвратов в выдачу. Иногда это ещё и якорные
  ссылки в сниппете (у Google «Jump to», у Яндекса навигация по якорям). Гарантии нет, но это стандартная практика,
  и десктопная версия уже есть.
- Сами кнопки «Помог?» на ранжирование **напрямую не влияют**: поисковик их не видит. Польза в другом:
  (а) на «нет» человек получает следующий шаг и реже уходит в выдачу;
  (б) появляется очередь «какие статьи переписать», а это реальная работа для YMYL, потому что ПСК, лимиты и ключевая
  ставка меняются, ближайшее решение ЦБ — 23.10.2026;
  (в) чипы «Устарели условия» прямо указывают на устаревший текст.
- Ссылкоёмкость не меняется. Монетизация косвенная: человек дольше на странице, видит больше показов `CtaSlot`/`CtaTop3`,
  а переписанные слабые тексты лучше конвертируют.

**Юридические риски.**
- **38-ФЗ.** Сам блок не реклама. Риск появляется на обзорах `/mfo/*`: «помогло» легко прочитать как оценку МФО.
  Поэтому там формулировка про **обзор** («помог разобраться в условиях?»), без свободного текста и без публичных чисел.
  `aggregateRating` не выводим, это уже правило в `[dir]/[slug].astro`.
- **152-ФЗ.** v1 передаёт данные только в Метрику и только после согласия, гейт уже есть. ПДн в параметрах нет (slug и ответ).
  v2: в свободный текст пользователь может вписать телефон или ФИО. Нужны предупреждение у поля «не указывайте
  персональные данные», хранение 90 дней и пункт в `/politika-konfidencialnosti/`. Email не собираем; если когда-нибудь
  начнём — отдельный чекбокс согласия. Хеш IP для rate-limit тоже ПДн-подобен: соль меняется ежедневно,
  файл лимитов живёт около часа.
- **Финсоветы.** На сообщения об ошибках не отвечаем персонально, у формы строка «Мы не консультируем по личным
  финансовым вопросам». Иначе это отзывы и вопросы без модерации на YMYL-странице.

## 4. MVP и полная версия

### MVP (1–1,5 дня, без бэкенда)
1. Мобильное `<details>`-оглавление в `ArticleView` (30 статей). **0,25 дня.**
   Проверка: 375/768 px, `lg:hidden`, переход по якорю, закрытие, iOS Safari.
2. `initToc()` с подсветкой `is-active` в обоих оглавлениях. **0,25 дня.**
   Проверка: на длинной статье при скролле подсвечивается нужный пункт; после перехода через `ClientRouter` нет двойных observer.
3. `Helpful.astro` в статьях, гайдах и обзорах, цели `page_helpful` и `page_helpful_reason`. Владелец создаёт обе цели в Метрике.
   **0,5 дня.** Проверка: в DevTools после согласия видна отправка `reachGoal`, без согласия — ничего и без ошибок.
4. Зависимость: `window.fkGoal` (одна строка, `dive-cpa-click-goals.md`).

Через 4–6 недель: отчёт «Параметры визитов → helpful → no → slug». Топ-5 по «нет» и «Устарели условия» отправить
в работу по `ymyl-content` skill.

### Полная версия (+2–3 дня, после разблокировки)
- **«Нашли ошибку».** Ссылка «Нашли ошибку?» внутри `Helpful` всегда видна: на мобиле нет Ctrl+Enter, а выделение там неудобно.
  На десктопе дополнительно работает Ctrl+Enter по `getSelection()` (≤300 символов). Форма из одного `<textarea>` ≤1000
  символов, цитаты и URL страницы. Данные уходят в `fetch('/report.php')`.
- **`report.php`** — Astro-эндпоинт `src/pages/report.php.ts`, по образцу `go.php.ts` из `dive-go-php-server-log.md` §2.2.
  Так `SITE.email` подставляется на сборке и не хардкодится в `public/`. Внутри:
  только POST; honeypot; `Origin`/`Referer` = свой хост; `mb_substr` лимиты; URL только своего хоста;
  rate-limit 5/час по `sha256(ip + date('Ymd') + соль)` в файле с `flock`; запись CSV с `flock` в `dirname(__DIR__).'/private/'`
  (вне docroot); `mail()` с фиксированными `Subject`/`From` — пользовательский текст только в теле, никогда не в заголовках;
  ответ `204`.
- **Smoke PHP до всего:** выложить `report.php`, который на GET отвечает 405, и проверить `curl`, что он исполняется,
  а не отдаётся текстом. Отдельно проверить запись в `/rencredit/private/`.
- **«Исправлено: …».** Поле `fixNote: z.string().max(160).optional()` в `baseArticle`. Выводится в `.meta-line`
  рядом с «Обновлено {updatedDate}». `dateModified` в JSON-LD уже берётся из `updatedDate`.
- **ServiceLanding** — тот же `Helpful` с вопросом «Страница помогла выбрать?».

### Что отклоняю
- **Публичный агрегат «помогло N из M» (от 30 голосов).** Данные лежат в Метрике, и для показа на сборке нужен OAuth-токен
  Метрики в CI плюс API-запрос. Голосов мало: только согласившиеся, трафик небольшой. Цифры на финансовой странице выглядят
  как рейтинг, а это прямой путь к соблазну `aggregateRating` и вопросам по 38-ФЗ на обзорах МФО. Кроме того, это поощряет
  накрутку. Ценности для читателя почти нет.
- **Хранение голосов в `localStorage`, чтобы не голосовать повторно.** Метрика и так считает конверсию один раз за визит.

## Блокеры и открытые вопросы
1. `window.fkGoal` ещё не внедрён: сначала `dive-cpa-click-goals`, или его строка входит в этот MVP.
2. Цели `page_helpful` и `page_helpful_reason` создаёт владелец счётчика вручную.
3. v2: нет контактного email на проде; исполнение PHP и запись вне docroot на Beget не проверены.
4. v2: текст политики конфиденциальности (свободный текст, 90 дней) согласует владелец.
