# 10. Контент-конвейер на харнессе проекта: rencredit-online.ru («Мерка»)

> Линза: контент-конвейер на харнессе `.claude/`. Дата: 2026-10-19. Ветка `feat/rencredit-metrika`, worktree `/Users/deniskononov/rencredit-pilot-wt` (`${WT}`), приложение `${WT}/web/apps/rencredit` (`${APP}`).
> Стартовая точка: `docs/seo/10-content-factory.md` (finhelp). Из него взяты цены, IndexNow, Вебмастер API и эвристика темпа; всё перепроверено. Выводы finhelp про `loadPages.ts`, `related_pages.json`, pickle-файл и `editorialPosts.json` к rencredit не относятся: здесь Astro 7 и content collections, а не старый `site/`.
> Новостной контур подробно спроектирован в `docs/seo-rencredit/features/news-data-automation.md` (фиды, `facts.json`, регламент дня заседания ЦБ). Здесь он не повторяется, только стыкуется с конвейером.
> Код, конфиги и контент в этой задаче не менялись. Всё ниже — предложения с `file:line`.

## Резюме

1. **Харнесс умеет довести материал до `draft: true` и на этом останавливается.** `/new-article` и `/new-news` заканчиваются фразой «draft не снимай без команды владельца» (`.claude/commands/new-article.md:12`, `new-news.md:11`). Дальше нет ни команды публикации, ни шага деплоя, ни IndexNow, ни refresh. `deploy-beget.sh --build` гоняет только `check-links` и `check-legacy` (`scripts/deploy-beget.sh:70-72`). Главная проверка YMYL-контента `web/scripts/check-content.mjs` (свежесть источников офферов, предел ПСК, allowlist внешних ссылок, «100% одобрение», «Ренессанс») не подключена ни к Stop-хуку, ни к `check.mjs`, ни к деплою, ни к CI. Она упоминается только в README (`README.md:47,118`) как ручная команда.
2. **Скиллы и агенты сами вносят ошибку факта.** `ymyl-content/SKILL.md:16`, `content-writer.md:17` и `ymyl-fact-checker.md:13` называют предел переплаты 130%. С 01.04.2026 для займов до года он равен 100% (545-ФЗ от 29.12.2025). Тексты сайта это уже отражают (`chto-takoe-psk-i-kak-ee-schitat.mdx:60`). Но фактчекер, сверяющий текст со своей инструкцией, пометит верные 100% как ошибку, а новый автор напишет 130%. Это блокер масштабирования: чинить нужно до первой волны.
3. **Сигналы свежести сейчас ложные или отсутствуют.**
   - У 21 из 22 статей и у всех 9 service-pages стоит одна и та же `updatedDate: 2026-10-13`. Это массовый «бамп» даты.
   - У гайдов поля даты в схеме нет (`content.config.ts:83-94`), хотя в них есть датированные факты (`zaimy-s-plohoj-ki.mdx:46`, этап с 01.10.2026).
   - В живом `sitemap-0.xml` 83 URL и 0 `<lastmod>`: `@astrojs/sitemap` без `serialize` lastmod (`astro.config.mjs:60-65`).
   - Отложенной публикации нет: `getArticles`/`getNews` фильтруют только `draft` (`src/lib/content.ts:29,33`), статья с будущей `publishDate` выходит сразу.
4. **`scripts/indexnow.mjs` в нынешнем виде вредит меньше, чем помогает, но всё равно не годится.**
   - Скрипт обходит только `index.html` (`:48`). 14 возрастных легаси-URL `/credit/<slug>.html` переименовываются при сборке в `.html` (`astro.config.mjs:16-31`) и в пинг не попадают. Проверено по dist: 69 URL из скрипта против 83 в sitemap.
   - Без аргументов шлёт весь сайт, а не изменения.
   - Файла ключа в `public/` нет.
   - Пример в комментарии ведёт на несуществующий `/articles/...` (`:5`), а настоящие маршруты — `/stati/` и `/novosti/`.
5. **Таймер-бомба офферов: 2026-11-12.** У всех 33 файлов `src/data/offer-sources/*.json` и всех 50 `service-sources/*.json` `checkedAt = 2026-10-13`. `check-content.mjs:20` (`MAX_AGE_DAYS = 30`) в один день признает недействительными 26 верифицированных кредитных офферов и 46 услуг, как только проверку подключат (п. 1). Нужна ротация перепроверки по 2–3 оффера в день, а не залп раз в месяц.
6. **Темп.** Узкое место — не LLM, а человек: 15–20 минут вычитки на YMYL-статью. Предлагаемый план:
   - недели 1–4 (20.10–16.11.2026): 3 статьи и 2–3 новости в неделю;
   - недели 5–12: 5 статей в неделю;
   - с 13-й недели: 7–10 статей в неделю, если в Вебмастере нет «малополезных» и ручных мер.

   Этот темп закрывает 50 кандидатов из `05-keyword-gap.md` к середине января 2027. 11 статей finhelp идут как бриф и фактура, не как текст (`02-content-inventory.md` F8). Нагрузка на человека — около 3–4 часов в неделю.
7. **Стоимость через харнесс (агентный цикл Claude Code) — около $1–1.5 за принятую статью и $0.4–0.7 за новость** в ценах API. Это в 2–3 раза дороже batch-конвейера finhelp ($0.33–0.51), зато не нужен новый код. 20 статей и 12 новостей в месяц стоят около $30–40 в месяц. На подписке Claude Code ограничением становятся лимиты, а не доллары.

---

## Находки

### F1. Что есть в харнессе и где обрывается цикл

| Этап | Чем закрыт | Пробел |
|---|---|---|
| Семантика → бриф | ничем; темы приходят аргументом `/new-article <тема>` | нет очереди тем, нет проверки каннибализации против 22 статей и 8 гайдов; есть 50 кандидатов (`05-keyword-gap.md`) и 30 статей finhelp (`finhelp_articles_reuse.tsv`), но харнесс их не читает |
| Текст | `content-writer` (sonnet; зона `articles/**`, `guides/**`, `content-writer.md:11`) | нет шаблона брифа, нет правила реюза finhelp; service-pages не входят ни в одну зону (`CLAUDE.md:34`), а ключевая ставка зашита именно там (`vklady.mdx:19`, `debetovye-karty.mdx:65`) |
| Фактчек | `ymyl-fact-checker` (sonnet, read-only) | тот же класс модели, что и писатель (слепые зоны совпадают); устаревшие 130% в инструкции (`:13`) |
| Детерминированный QA | Stop-хук `check.mjs --quick` (бренды, `/go/` rel, JSON, poolId) | `check-content.mjs` не вызывается; нет проверок длины, источников, внутренних ссылок, пересечения текстов |
| `draft:false` | «только по просьбе владельца» (`new-article.md:12`) | нет команды; публикацию делают руками |
| Сборка/деплой | `deploy-beget.sh --build` (`:68-73`); CI-черновик `deploy-rencredit.yml` только `workflow_dispatch`, FTP без TLS (`ftp:ssl-allow no`) | деплой не запускает `check-content.mjs` и `check.mjs --dist-only` |
| IndexNow | `scripts/indexnow.mjs` | см. Резюме п. 4; в `deploy-beget.sh` не вызывается |
| Мониторинг | нет | нет снапшота Вебмастера/Метрики, нет очереди refresh |
| Refresh | правило «устаревшие числа обновляем» (`ymyl-content/SKILL.md:24`) | нет триггеров, нет владельца, нет запрета на массовый бамп даты |

### F2. Устаревшие факты внутри харнесса

| Где | Что написано | Как сейчас | Источник |
|---|---|---|---|
| `.claude/skills/ymyl-content/SKILL.md:16` | «общая сумма начислений… не выше 130%» | 100% для договоров до года с 01.04.2026 | 545-ФЗ; ЦБ через buh.ru, garant (см. Источники) |
| `.claude/agents/content-writer.md:17` | «ставка до 0,8%/день, начисления до 130%» | то же | то же |
| `.claude/agents/ymyl-fact-checker.md:13` | «ставка ≤0,8%/день, начисления ≤130%» | то же; плюс этапы 01.10.2026 (≤2 «дорогих» займа с ПСК >200%) и 01.04.2027 (один займ с ПСК >100%) | `news/mfo-limit-psk-200-s-1-oktyabrya-2026.md` |
| `check-content.mjs:24` | `PSK_LIMIT` на IV кв. 2026, «обновлять ежеквартально» | следующая публикация ЦБ около 13–15.11.2026 | `news-data-automation.md` §4 |

Корень проблемы — изменчивые лимиты записаны литералами в четырёх местах. Править каждый раз все четыре никто не будет. Правильнее держать их в одном файле (`src/data/facts.json` из `news-data-automation.md` §3), а в скиллах и агентах писать «лимиты — только из `facts.json`, сверять с cbr.ru».

### F3. Новостной контур: расхождения правил и данных

- В схеме `source` и `sourceName` необязательны (`content.config.ts:77-78`), хотя скилл требует их всегда (`news-pipeline/SKILL.md:21,26`). Сборка новость без источника пропустит.
- Скилл требует имя `YYYY-MM-DD-slug.md` (`news-pipeline/SKILL.md:23`, `news-writer.md:11`). Все 4 файла названы без даты.
- Новость о самозапрете ссылается на banki.ru, то есть на агрегатор, что скилл запрещает (`SKILL.md:15`). При этом `check-content.mjs:122` держит banki.ru в allowlist. Две новости о законе ссылаются на Интерфакс, а не на pravo.gov.ru.
- `publishDate` двух новостей стоит на дату события: 2023-07-01 (draft) и 2025-03-01. На сайте в нынешнем виде их тогда не было. Скилл разрешает такие материалы только «как справку с пометкой» (`SKILL.md:30`). Это не новости, а evergreen. Их место — хаб «Правила МФО 2026» в `articles` (так и предлагает `02-content-inventory.md` F8).
- На странице новости стоят `CtaCallout`/`CtaNext` с подбором займа (`src/pages/novosti/[...slug].astro:6-7,41`), а скилл запрещает рекламные CTA в новостях (`SKILL.md:29`).
- Пока вместо заявленных 2–5 новостей в неделю (`SKILL.md:33`) опубликовано 3 за всё время, последняя — 01.10.2026.

### F4. Свежесть: где даты врут или их нет

| Где | Факт | Риск |
|---|---|---|
| 21 статья + 9 service-pages | `updatedDate: 2026-10-13` у всех | массовый бамп без изменения фактов: «Обновлено» на странице и `dateModified` в JSON-LD (`ArticleView.astro:36,49`) не подтверждены изменениями |
| 8 новых статей `/stati/` | `publishDate` идут шагом около 7 дней: 14.08, 22.08, 30.08, 05.09, 12.09, 19.09, 26.09, 03.10 | похоже на синтетический график. Проверить по `git log` (здесь не делалось: запрет на git). Если даты задним числом, вернуть реальные: Яндекс знает дату первого обхода |
| 14 легаси-статей | `publishDate` = дата WP (проверено: `legacy/rencredit/posts/kak-polychit-pomosh-v-refinansirovanii.json` `date: 2025-09-02`) | честно, оставить |
| гайды | нет `updatedDate` в схеме | нет видимой свежести на коммерческих посадочных |
| sitemap | 0 `<lastmod>` на 83 URL | Яндекс не видит, что обновилось; IndexNow-diff не из чего строить |
| `vklady.mdx:19,50`, `debetovye-karty.mdx:65` | «ключевая ставка 14% на 13 октября 2026» | заседание ЦБ 23.10.2026; у service-pages нет агента-владельца |

### F5. Что переиспользовать из прошлых прогонов (вместо работы с нуля)

| Наработка | Где | Как использовать в конвейере |
|---|---|---|
| 50 кандидатов статей, 23 из них P1 | `docs/seo-rencredit/05-keyword-gap.md` «Кандидаты» | готовая очередь тем на 10–12 недель; ядро — рефинансирование, кредиты, карты, КИ; МФО вторичны (против аффилиат-фильтра с finhelp) |
| 30 статей finhelp с ревью | `sites/finhelp-ru/editorial/*.json`, карта `finhelp_articles_reuse.tsv`, `02-content-inventory.md` F8 | 8–11 штук как **бриф и фактура** (`key_points`, `sources`, FAQ), 9 — влить в существующие страницы, 7 — не брать. Текст 1-в-1 не переносить: сеть, дубль, Яндекс оставит одну копию |
| Регламент новостей и фактов | `features/news-data-automation.md` §3–4 | `fetch_facts.py` → `facts.json`, `news_inbox.py` → inbox → `news-writer`; расписание ниже на нём и построено |
| Батч-конвейер и экономика | `docs/seo/10-content-factory.md` | цены и eval-подход. Python-`editorial.py` и SQLite-registry для rencredit **не нужны**: content collections + git уже дают статусы (`draft`), историю и ревью через diff |

---

## Целевой цикл (на существующем харнессе)

```
очередь тем (docs/content-queue.tsv: slug, kw, cluster, offerKind, source_brief, status, due)
   │  scheduled «понедельник»: берёт N тем со status=todo
   ▼
/new-article <slug>  ── content-writer (бриф: 05-keyword-gap + finhelp editorial JSON как фактура)
   │                    draft:true, источники URL в отчёте
   ▼
check-content.mjs + check-overlap.mjs (5-граммы: vs свои 43 текста, vs sites/finhelp-ru/editorial)
   ▼
ymyl-fact-checker (Opus 5.5 для денежных кластеров) ── правки ── повтор до «Проблем не найдено»
   ▼
человек: вычитка 15–20 мин → /publish <file>   (draft:false, publishDate = реальная дата выхода)
   ▼
ежедневно 07:00: build → check.mjs --dist-only → deploy-beget.sh → indexnow (только изменённые URL)
   ▼
еженедельно: снапшот Вебмастера (query-analytics, 2 недели истории) → refresh-очередь в том же TSV
```

Очередь — один TSV в репозитории, а не БД. Для 100–300 материалов этого достаточно: статус меняется коммитом, история и ревью идут через diff.

### Темп публикации

| Период | Статьи в неделю | Новости в неделю | Refresh в неделю | Человек, ч/нед | Условие перехода |
|---|---:|---:|---:|---:|---|
| Нед. 1–4 (20.10–16.11.2026) | 3 | 2–3 | 3–5 (хвост F4 + ставка 23.10) | ~3 | ТЗ/гайды с пустыми витринами исправлены (`02` F1), sitemap с lastmod, check-content в цикле |
| Нед. 5–12 (17.11.2026–11.01.2027) | 5 | 2–3 | 2–3 | ~4 | показы новых URL растут, в «Исключённых» доля «Малоценная/маловостребованная» < 10% |
| Нед. 13+ | 7–10 | 3–5 | по триггерам | 5–6 | нет ручных мер; CTR новых ≥ CTR легаси |

Правила сети (из `docs/seo/10-content-factory.md`, сохраняют силу):
- тема закреплена за одним сайтом;
- на rencredit и finhelp она не выходит в одну неделю;
- пересечение 5-грамм с finhelp < 15% (порог из `02-content-inventory.md` F8);
- без синхронных залпов.

Эвристика темпа не документирована Яндексом. Это осторожная оценка для YMYL, её нужно калибровать по Вебмастеру.

### Refresh-политика

**Правило даты:** `updatedDate` меняется только тогда, когда изменился факт (число, норма, условие оффера) или переписано не меньше одного раздела. Правка опечатки, перелинковка или смена оффера в блоке — не обновление. Это нужно записать в `ymyl-content` и проверять в `seo-auditor`: не больше 5 материалов с одинаковой новой `updatedDate` в одном релизе без пометки `reason`.

| Триггер | Когда | Что обновляем | Кто |
|---|---|---|---|
| Ключевая ставка ЦБ | 23.10.2026, 18.12.2026, далее по календарю ЦБ на 2027 | `facts.json` → `<Fact>`; до появления токенов — `vklady.mdx:19,50`, `debetovye-karty.mdx:65` руками | scheduled + основной агент (service-pages без владельца, см. R7) |
| Предельные ПСК ЦБ | около 13–15.11, 15.02, 15.05, 15.08 | `check-content.mjs:24` `PSK_LIMIT`, `pskMax` офферов, текст `chto-takoe-psk…` | scheduled |
| Этапы закона о МФО | 01.04.2027 (один «дорогой» займ) | `news/mfo-limit-psk-200…`, `guides/zaimy-s-plohoj-ki.mdx:46`, хаб «Правила МФО» | content-writer, март 2027 |
| НДФЛ с процентов по вкладам | январь 2027 | `vklady.mdx:11`, `debetovye-karty.mdx:61` | основной агент |
| Источники офферов > 25 дней | ежедневно 2–3 оффера (ротация 83 карточек за ~30 дней) | `offer-sources/*.json`, `service-sources/*.json` `checkedAt`; оффер снят → `removed-offers.json` | scheduled + `/new-offer`-подобная проверка |
| Статус в пуле Saleads | еженедельно `export-pool` → diff | убрать `wait`/снятые с витрины (`offer-placement/SKILL.md:47`) | основной агент |
| Возраст | денежные кластеры (рефинансирование, кредиты, карты, МФО) — 180 дней; КИ и финграмотность — 365 | полный проход writer → checker в режиме update | очередь TSV `due` |
| Просадка | −5 позиций за 28 дней по ключу из Вебмастера | update с разбором ТОП-10 | еженедельный отчёт |
| Событийные статьи | «приём заявок приостановлен на октябрь 2026» (`naskolko-vygodno-…-rosselhozbanke`) | ежемесячная проверка | scheduled |

### Новостной контур (стык с конвейером)

Берём регламент `features/news-data-automation.md` §4 без изменений: inbox из 7 официальных фидов 2 раза в день, отбор 0–2 тем, `news-writer` → `draft:true` → фактчек → человек. Под него в харнессе нужно:
- сделать `source` обязательным (`z.url()` без `.optional()`, `content.config.ts:77-78`);
- убрать banki.ru из allowlist новостей (`check-content.mjs:122`) или явно разрешить его только для `articles`;
- выключить CTA на `/novosti/*` (`[...slug].astro:41`), оставив одну нейтральную ссылку на гайд;
- перенести 2 «справки» с датами 2023/2025 в evergreen-хаб;
- день заседания ЦБ: черновик до 15:00 МСК, деплой и IndexNow только для URL новости и хаба.

---

## Стоимость

Цены API на 2026-10 (skill `claude-api`, кеш от 2026-10-06): Opus 5.5 — $4/$20 за 1 млн токенов, cache read $0.20; Sonnet 5.5 — $2/$10, cache read $0.20; Haiku 5.5 — $0.10/$0.50. Batch API даёт −50%. Web search — $10 за 1000 запросов (по `docs/seo/10-content-factory.md`).

Агентный цикл Claude Code отличается от batch: на каждом из 10–25 шагов инструментов контекст отправляется заново, но в основном из кеша. Оценка (проверить через `/cost` на первых 5 статьях):

| Шаг | Модель | Вход (≈80% из кеша) | Выход с thinking | ≈ $ |
|---|---|---:|---:|---:|
| content-writer: скиллы, схема, 3–6 веб-источников, текст 13–17 тыс. знаков (как текущие статьи) | Sonnet 5.5 | 400 тыс. | 15 тыс. | 0.37 |
| ymyl-fact-checker, денежный кластер | Opus 5.5 | 300 тыс. | 6 тыс. | 0.41 |
| правки + повторная проверка (~50% статей) | Sonnet 5.5 | 150 тыс. | 5 тыс. | 0.09 (ожид.) |
| оркестратор `/new-article` | Opus 5.5 | 150 тыс. | 4 тыс. | 0.22 |
| веб-поиск, 5–10 запросов | — | — | — | 0.05–0.10 |
| **Итого, статья** | | | | **≈ $1.1–1.3** (до $1.5 с ретраями) |
| Новость (news-writer + checker на Sonnet) | Sonnet 5.5 | 250 тыс. | 6 тыс. | ≈ $0.4–0.7 |

В месяц (фаза «5 статей в неделю»): 20 статей × $1.3 + 12 новостей × $0.6 + 15 refresh × $0.5 ≈ **$40**. Писать batch-скрипт ради экономии $20–25 в месяц не стоит, пока сайтов в конвейере меньше 3–4. Время человека: 20 × 18 мин + 12 × 10 мин + 15 × 8 мин ≈ 10 ч в месяц. Именно поэтому темп растёт ступенями.

Где качество важнее цены: фактчек денежных кластеров запускать на Opus 5.5, писатель Sonnet 5.5. Модели разного класса снижают риск совпадающих слепых зон. Решение подтвердить eval на 10 статьях: доля замечаний фактчекера, найденных человеком после него.

---

## Автоматизация через scheduled-агентов

**Где запускать.** Локально: задачи Claude Code по расписанию в десктоп-приложении или `launchd`/cron + `claude -p` в worktree. Облачные routines (`/schedule`) подходят только для шагов без сети в РФ и без SSH-ключа Beget: доступность cbr.ru и gosuslugi с зарубежных IP не проверялась (`news-data-automation.md` §3). Кроме того, команды харнесса написаны под Windows (`.venv\Scripts\python.exe` в `offer-placement/SKILL.md:41-45`, `commands/new-offer.md:11`), а worktree живёт на macOS. Для расписания нужны пути, не зависящие от ОС.

| Когда (МСК) | Задача | Права | Выход | Человек |
|---|---|---|---|---|
| ежедн. 06:00 | `fetch_facts.py` → `facts.json` (ставка, ПСК, реестр МФО) | запись только `src/data/facts.json` | diff, при изменении — уведомление | merge |
| ежедн. 09:00, 18:00 | `news_inbox.py` → 0–2 черновика через `/new-news` | зона `content/news` | `draft:true` + отчёт фактчекера | вычитка 10 мин |
| пн 10:00 | 3–5 тем из `content-queue.tsv` → `/new-article` → check-content → overlap → фактчек | зона `articles`, `guides` | черновики + сводка | вычитка, `/publish` |
| ежедн. 11:00 | ротация 2–3 офферов с самым старым `checkedAt` | `src/data/*-sources`, предложение правок `offers/*.json` | diff + список расхождений | подтверждение |
| ежедн. 07:00 | build → `check.mjs --dist-only` → deploy → indexnow diff | деплой только при наличии новых коммитов с `draft:false` | лог | — |
| пн 08:00 | снапшот Вебмастера (query-analytics) + Метрика → refresh-кандидаты в TSV | запись TSV | отчёт: просадки, «Исключённые» | решение |
| 1-е число | `export-pool` diff, статусы офферов; триггеры возраста `due ≤ сегодня` | TSV, отчёт | список | решение |

**Ограничители для работы без присмотра:**
- scheduled-задачи никогда не ставят `draft:false`;
- лимит — 5 черновиков за прогон;
- Stop-хук и `check-content.mjs` обязательны;
- `git push` блокирует `guard.py`, поэтому коммиты остаются локальными и деплой берёт только закоммиченное.

---

## Приоритизированные рекомендации

| # | Что | Impact | Effort | Где |
|---|---|---|---|---|
| R1 | Исправить предел переплаты 130% → 100% (с 01.04.2026, 545-ФЗ), добавить этапы 01.10.2026 и 01.04.2027; изменчивые лимиты вынести в один источник (`facts.json`), а в скиллах ссылаться на него | high | S | `ymyl-content/SKILL.md:16`, `content-writer.md:17`, `ymyl-fact-checker.md:13` |
| R2 | Подключить `web/scripts/check-content.mjs` в `check.mjs` (quick-режим), в `deploy-beget.sh:70-72` и в `deploy-rencredit.yml` | high | S | `scripts/check.mjs` main, `deploy-beget.sh:70` |
| R3 | До 2026-11-12 разнести перепроверку источников 83 офферов и услуг (ротация 2–3 в день), иначе после R2 сборка упадёт разом | high | S | `src/data/offer-sources`, `service-sources`; `check-content.mjs:20` |
| R4 | Честный `lastmod` в sitemap: `serialize` берёт `updatedDate ?? publishDate` для статей и новостей, для остальных не пишет | high | S | `astro.config.mjs:60-65` |
| R5 | Правило даты в `ymyl-content` (менять `updatedDate` только при изменении факта или раздела) + проверка в `seo-auditor`; откатить массовую `2026-10-13` там, где фактов не меняли; проверить по `git log` реальность `publishDate` 8 новых статей | high | S | `ymyl-content/SKILL.md:24`, `seo-auditor.md`, `content/articles/*` |
| R6 | Команда `/publish <file>`: `draft:false`, реальная `publishDate`, check-content, build, `check.mjs --dist-only`, deploy, IndexNow на URL этого материала | high | S | `.claude/commands/publish.md` |
| R7 | IndexNow: брать URL из `dist/sitemap-0.xml` (покрывает `/credit/*.html` и исключает noindex-услуги), отправлять diff с прошлым sitemap, положить `public/<KEY>.txt`, вызывать из `deploy-beget.sh` | high | S | `scripts/indexnow.mjs:35-57`, `deploy-beget.sh` |
| R8 | Очередь `docs/content-queue.tsv`, заполненная 50 кандидатами из `05-keyword-gap.md` и картой реюза finhelp; `/new-article` принимает slug из очереди, а `content-writer` читает `sites/finhelp-ru/editorial/<slug>.json` как фактуру, а не как текст | high | S | `.claude/commands/new-article.md`, `content-writer.md` |
| R9 | `web/scripts/check-overlap.mjs`: 5-граммы против своих 43 текстов (каннибализация) и против `sites/finhelp-ru/editorial/*` (порог < 15%) | high | S | новый скрипт, шаг в `/new-article` |
| R10 | Отложенная публикация: фильтр `publishDate <= new Date()` рядом с `!draft` + ежедневная сборка | medium | S | `src/lib/content.ts:29,33` |
| R11 | Схема: `news.source`/`sourceName` обязательны; `updatedDate` для `guides` | medium | S | `content.config.ts:77-78,83-94` |
| R12 | Новости: без CTA на `/novosti/*`; banki.ru убрать из allowlist для новостей; 2 «справки» 2023/2025 перенести в evergreen-хаб; имена `YYYY-MM-DD-` | medium | S | `novosti/[...slug].astro:41`, `check-content.mjs:122`, `content/news/` |
| R13 | Зона service-pages: добавить в `content-writer` (или отдельный `refresh-editor`), иначе ставку 23.10 обновлять некому | medium | S | `CLAUDE.md:34`, `content-writer.md:11` |
| R14 | Фактчек денежных кластеров на Opus 5.5 (`model:` в агенте или параметр команды); eval на 10 статьях | medium | S | `ymyl-fact-checker.md:4` |
| R15 | Scheduled-задачи по таблице выше: локально, только черновики, ОС-независимые пути к Python | medium | M | `.claude/commands/*`, launchd/desktop tasks |
| R16 | Еженедельный снапшот Вебмастера (`query-analytics` хранит только 2 недели) → refresh-кандидаты в TSV | medium | M | новый скрипт + задача пн 08:00 |
| R17 | Устранить противоречие по robots: `Disallow: /go/` на живом сайте и в `robots.txt.ts:9`, а `offer-placement/SKILL.md:27` и `seo-auditor.md:16` требуют не закрывать `/go/`. Выбрать одно и привести к нему код и скиллы | low | S | `robots.txt.ts:9` или скиллы |
| R18 | Запрет «Ренессанс»-семантики (title, H1, slug, анкоры) записать в `ymyl-content` и `seo-auditor`, а не только искать слово | medium | S | `ymyl-content/SKILL.md:31`, `seo-auditor.md:21` |

Порядок: R1 → R2+R3 → R4+R5 → R6+R7 → R8+R9 (старт первой волны 3 статей в неделю) → R10–R14 → R15–R16.

---

## Источники

- 545-ФЗ, предел начислений 100% с 01.04.2026: [buh.ru](https://buh.ru/news/maksimalnaya-summa-pereplaty-po-zaymam-snizhena-do-100-godovykh.html), [harant.ru](https://harant.ru/blog/yuridicheskie-novosti/100-predelnaya-summa-nachislennyh-proczentov-po-potrebitelskomu-kreditu-vmesto-130/), [ppt.ru](https://ppt.ru/obzory/vstupaet-v-silu/federalnyy-zakon-29-12-2025-545-fz-ob-uvelichenii-maksimalnogo-razmera-mikrozayma-dlya-kompaniy-i-ip), [bankiros.ru](https://bankiros.ru/news/s-1-aprela-2026-goda-maksimalnaa-pereplata-po-potrebitelskim-zajmam-srokom-do-goda-snizaetsa-21010). Первоисточник для фактчека — текст ч. 24 ст. 5 353-ФЗ на publication.pravo.gov.ru / consultant.ru.
- Яндекс IndexNow: https://yandex.ru/support/webmaster/indexing-options/index-now.html ; протокол (до 10 000 URL на POST): https://www.indexnow.org/documentation
- Яндекс Вебмастер API, query-analytics: https://yandex.ru/dev/webmaster/doc/ru/reference/host-query-analytics
- Google про `lastmod` (недостоверный игнорируется): https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Цены Claude и Batch API: https://platform.claude.com/docs/en/about-claude/pricing , https://platform.claude.com/docs/en/build-with-claude/batch-processing
- Живой сайт (curl 2026-10-19): `https://rencredit-online.ru/robots.txt` (`Disallow: /go/`), `/sitemap-0.xml` (83 `<loc>`, 0 `<lastmod>`).
- Внутренние: `docs/seo/10-content-factory.md`, `docs/seo-rencredit/02-content-inventory.md` (F1, F6, F8), `05-keyword-gap.md` (кандидаты, §5–6), `features/news-data-automation.md` (§3–4), `finhelp_articles_reuse.tsv`; код `${WT}/.claude/**`, `${WT}/scripts/{check.mjs,indexnow.mjs,deploy-beget.sh}`, `${WT}/web/scripts/check-content.mjs`, `${APP}/{astro.config.mjs,src/content.config.ts,src/lib/content.ts}`, `${APP}/dist` (213 `index.html`, из них 144 `/go/`).
