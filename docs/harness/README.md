# Харнесс Claude Code: карта

Конфигурация лежит в `.claude/` и `scripts/`. Назначение: параллельная работа нескольких агентов над `web/` без конфликтов, автоматические запреты и быстрая проверка.

## Что где

```
.claude/
  settings.json         разрешения (deny) и хуки; коммитится
  settings.local.json   личные разрешения; в .gitignore
  launch.json           dev-серверы: mosseo-preview (4322), rencredit-dev (4321); в .gitignore
  hooks/guard.py        PreToolUse: детерминированные запреты
  skills/               site-design, motion-system, ymyl-content, offer-placement, news-pipeline,
                        grill-me, to-spec, handoff, diagnosing-bugs, code-review
  agents/               ui-builder, motion-designer, content-writer, news-writer,
                        ymyl-fact-checker, seo-auditor, page-reviewer
  commands/             check, new-article, new-news, new-offer, review-page
scripts/
  check.mjs             проверки (--quick / полная / --dist-only); он же Stop-хук
  indexnow.mjs          пинг IndexNow после деплоя
  test_guard.py         самопроверка хука
.github/workflows/deploy-rencredit.yml   черновик деплоя (только ручной запуск)
docs/harness/           эта документация и ENV.md
```

## Хуки

| Хук | Что делает |
|---|---|
| `PreToolUse` `py .claude/hooks/guard.py` (Bash, PowerShell, Read, Edit, Write) | Блокирует (код 2): чтение `.env*`/`*.pem`, `git push`, `git reset --hard`, `git clean -f`, `rm -rf`/массовое удаление, `printenv`, запись и копирование файлов подтверждения Яндекса/Метрики (`yandex_*.html`; у каждого сайта свой, иначе футпринт сети), запись в `sites/*/pages/*.json`. Предупреждает (не блокирует) о «Ренессанс/Renaissance» в `web/**`. |
| `Stop` `node scripts/check.mjs --quick` (таймаут 120 с) | Если в `git status` есть изменения в `web/`: нет донорских брендов в `src/` и `public/`, нет «Ренессанс» вне дисклеймера (в `src/content` только предупреждение), у всех `/go/` ссылок `rel` с `sponsored`, JSON в `src/content` и `packages/core/src/data` валидны, `poolId` офферов существует в `sites/affiliate_pool.json`. Ошибки: код 2, агент продолжает и чинит; при повторном заходе (`stop_hook_active`) не зацикливает. Нет `web/` или нет изменений: молчит, код 0. |
| `permissions.deny` | Дублирует запреты (`git push`, `reset --hard`, `clean`, `rm -rf`, `printenv`, чтение `.env*`, `*.pem`) на уровне Claude Code. |

`node scripts/check.mjs` (полный режим) добавляет `npm --prefix web run build` и проверку `dist`: у каждой индексируемой страницы title, meta description, canonical; `/go/*` с `noindex`; `/go/` нет в sitemap; нет донорских брендов. Проверку горизонтального скролла, CLS и скриншотов выполняет агент `page-reviewer` (Playwright), не скрипт.

## Агенты: когда вызывать

| Агент | Когда | Пишет в |
|---|---|---|
| `ui-builder` | новые страницы, layout, компоненты, токены | `web/apps/rencredit/src/{pages,layouts,components,styles,lib}`, `public` |
| `motion-designer` | переходы, GSAP, Flip, маскот-карта | `web/packages/motion`, анимационные хуки в компонентах |
| `content-writer` | статьи, SEO-гайды | `src/content/articles`, `src/content/guides` |
| `news-writer` | новости | `src/content/news` |
| `ymyl-fact-checker` | перед снятием `draft` и релизом | ничего (read-only) |
| `seo-auditor` | после `build` | ничего (read-only) |
| `page-reviewer` | после правок вёрстки/анимаций | ничего (read-only, Playwright) |

Основной агент владеет `web/packages/core`, `src/content/offers`, `src/content.config.ts`, `.claude/**`, `scripts/**`, документами.

## Как параллелить без конфликтов

1. Зона владения = папка из таблицы. Агент пишет только в свою зону; чужое не правит, а сообщает.
2. Общие файлы (`content.config.ts`, `packages/core`, `package.json`, `astro.config.mjs`) правит только основной агент; остальные просят изменение в отчёте.
3. Один dev-сервер на порт 4321, его запускает тот, кому нужен визуал (`rencredit-dev`); остальные подключаются к нему.
4. Параллельно безопасно: `ui-builder` + `content-writer` + `news-writer` (разные папки). `motion-designer` запускай после того, как `ui-builder` оставил хуки (`data-` атрибуты, `transition:name`).
5. Падение `astro build` из-за чужого незавершённого файла не повод его править: сообщи владельцу зоны.
6. Контент создаётся с `draft: true`, снимается после `ymyl-fact-checker`.
7. Коммиты и пуш делает только человек (хук блокирует `git push`).

Типовой цикл статьи: `/new-article <тема>` -> `content-writer` -> `ymyl-fact-checker` -> правки -> `/check` -> `/review-page`.

## Скиллы

- `site-design`: токены, запреты «ИИ-шаблона», 375 px, AA, витрина как главный экран, CTA на `/go/`.
- `motion-system`: View Transitions, ленивый GSAP, Flip, transform/opacity, CLS=0, reduced motion, замеры Playwright.
- `ymyl-content`: законы (353-ФЗ, 151-ФЗ, 230-ФЗ), лимиты, дисклеймеры, запреты, frontmatter.
- `offer-placement`: пул -> `content/offers` -> витрина -> `/go/`; обновление через `saleads_offers.py`.
- `news-pipeline`: источники, рерайт, `source`, `draft`.
- Из Content_Zavod без изменений сути: `grill-me`, `to-spec`, `handoff`, `diagnosing-bugs`, `code-review`.

## Что нужно от владельца

- Секреты GitHub для `deploy-rencredit.yml`: `BEGET_FTP_HOST`, `BEGET_FTP_USER`, `BEGET_FTP_PASS`, `BEGET_FTP_PATH`; переменные `INDEXNOW_SITE`, `INDEXNOW_KEY` (и файл `<KEY>.txt` в `web/apps/rencredit/public`).
- Ключи в окружении Windows для MCP: `FIRECRAWL_API_KEY`, `EXA_API_KEY`.
- Файлы подтверждения Яндекса/Метрики для нового домена: создаёт владелец.
- Решение по бренду/домену rencredit (риск товарного знака, см. `PROJECT_BRIEF.md` §4).
