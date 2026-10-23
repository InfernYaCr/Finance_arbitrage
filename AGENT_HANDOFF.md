# Agent Handoff — rencredit-online.ru («Мерка»)

> Точка входа для нового агента. Снимок: **2026-10-20**, ветка `content/wave-1-articles` (после merge wave A, `c005c3b`).
> Старый снимок про finhelp-ru (июнь 2026): `docs/archive/AGENT_HANDOFF_finhelp_2026-06.md`. Он **не про этот сайт**.

## 1. Что это

Финансовый CPA-сайт: рефинансирование, кредиты, кредитные карты, кредитная история, долги. МФО — вторичный контур.
Деньги: SEO → витрина офферов → `/go/<poolId>/` → CPA-сеть Saleads. Основной поисковик — Яндекс.

- **Активное приложение:** `web/apps/rencredit/` (Astro 7 + Tailwind 4 + GSAP, статика). Контент — markdown в content collections.
- `web/packages/core` (`@pbn/core`: офферы, JSON-LD, SEO, факты) и `web/packages/motion` (`@pbn/motion`: анимации, View Transitions).
- Схемы frontmatter — источник правды: `web/apps/rencredit/src/content.config.ts`.
- Старый `site/` (Astro 4), `site_pipeline/`, `sites/finhelp-ru` — донорский конвейер и другой сайт. Не трогать без задачи (см. раздел Legacy в `CLAUDE.md`).

## 2. Где работать

- Рабочая ветка: `content/wave-1-articles`, основной checkout `/Users/deniskononov/rencredit-pilot-wt`.
- Новая работа — в своём worktree от этой ветки (`claude/rencredit-<тема>-<id>`). Ветка `release` — база для PR; `codex/pbn-factory` в корневом checkout — старая.
- Запрещено настройками проекта: `git push`, `reset --hard`, `clean`, `rm -rf`. Хук `.claude/hooks/guard.py` блокирует чтение `.env`, правку `sites/*/pages/*.json` и т.п. Не обходить.

## 3. Состояние контента

| Коллекция | Всего | Опубликовано | Draft |
|---|---|---|---|
| `articles` | 52 | 37 | 15 (wave-1) |
| `guides` | 7 | 7 | 0 |
| `news` | 4 | 3 | 1 (`stavka-0-8-procenta-i-limit-130-s-iyulya-2023`) |
| `offers/*.json` | 33 | — | — |

- **Релиз 1** = 15 статей (commit `7337b6c`): `draft: false`, `publishDate: 2026-10-21`; факты сверены с первоисточниками (`23c482c`), перелинковка (`825967a`).
- Для 14 legacy-URL `/credit/*.html` настроены 301 на статьи релиза 1 (`21e8fb1`); остальные потерянные URL — 301/410 (`2775a9f`).
- Витрины гайдов `/zaimy/`, `/zaimy-na-kartu/` разведены по интентам (`fd1b39f`), ставка ЦБ подтягивается при сборке (`163a329`), цели Метрики на CPA-кликах (`022a0e0`).
- Оставшиеся 15 draft-статей — релиз 2. План и приоритеты: `docs/seo-rencredit/SEO_PLAN.md`, `FEATURES_PLAN.md`, `article-briefs.md`.
- Факт в HEAD ≠ факт на проде: статус выкладки на Beget в git не виден, проверяй у владельца. Процедура: `docs/DEPLOY.md`, `scripts/deploy-beget.sh`.

## 4. Открытые ветки (не смёржены в `content/wave-1-articles`)

| Ветка | Что внутри |
|---|---|
| `claude/rencredit-release-2-prep-97be7b` | черновики релиза 2: фактчек и перелинковка карточных статей (#18, #20, #21, #22, #30); работа идёт |

Wave A уже в HEAD: indexation (IndexNow, `lastmod`, Clean-param), interlinking (`check-graph.mjs`, крошки, порядок офферов), registry-data (реестр ЦБ, `check-content` в `check.mjs`), eeat-pages (`/metodologiya/`, `/redakcionnaya-politika/`).
Остальные `claude/rencredit-*` ветки тоже в HEAD.

## 5. Команды (из корня репозитория)

```bash
npm --prefix web install                 # один раз
npm --prefix web run dev -- --port 4321  # dev (launch.json: rencredit-dev)
npm --prefix web run build               # статика в web/apps/rencredit/dist
node scripts/check.mjs --quick           # быстрая проверка (она же Stop-хук)
node scripts/check.mjs                   # полная: quick + build + проверка dist
py scripts/test_guard.py                 # самопроверка хука (macOS: python3)
```

## 6. Харнесс `.claude/`

- Агенты: `ui-builder`, `motion-designer`, `content-writer`, `news-writer`, `ymyl-fact-checker` (read-only), `seo-auditor` (read-only), `page-reviewer` (Playwright).
- Команды: `/check`, `/new-article <тема>`, `/new-news <тема>`, `/new-offer <poolId>`, `/review-page <url>`.
- Скиллы: `site-design`, `motion-system`, `ymyl-content`, `offer-placement`, `news-pipeline`, `grill-me`, `to-spec`, `handoff`, `diagnosing-bugs`, `code-review`.
- Зоны владения при параллельной работе: `src/{pages,layouts,components,styles}` — ui-builder; `web/packages/motion` — motion-designer; `src/content/{articles,guides}` — content-writer; `src/content/news` — news-writer; `web/packages/core` и `src/content/offers` — основной агент.
- Подробности: `docs/harness/README.md`, окружение: `docs/harness/ENV.md` (написано под Windows; на macOS команды те же, `py` → `python3`).

## 7. Правила, которые легко нарушить

- Ссылки на офферы только `/go/<poolId>/` с `rel="sponsored nofollow"`. Офферы берутся из `sites/affiliate_pool.json` через `content/offers/*.json`.
- Пределы и ставки не писать по памяти: предельная переплата по микрозаймам — 100%, лимит ПСК — по `ymyl-content` и `facts.json`. Сверять с первоисточниками (cbr.ru, consultant.ru).
- Новость без `source` — только draft. Статью с непроверенными фактами не снимать с draft.
- Не копировать файлы Яндекса/Метрики с других сайтов сети.

## 8. Открытые вопросы (владелец)

- **Домен.** `rencredit` — риск по товарному знаку банка; SEO_PLAN рекомендует переезд на нейтральный домен «Мерки». Решения нет.
- Реквизиты оператора (`PUBLIC_LEGAL_*`), контактный e-mail, `PUBLIC_METRIKA_ID`, коды Вебмастера — заполняет владелец (`web/apps/rencredit/.env.example`).
- Мёрж трёх открытых веток из раздела 4 и план релиза 2.
