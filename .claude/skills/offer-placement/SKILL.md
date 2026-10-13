---
name: offer-placement
description: Как офферы Saleads попадают на сайт - sites/affiliate_pool.json, content/offers/*.json (poolId), витрина/гайды/статьи (offerKind), редирект /go/. Как обновлять офферы через site_pipeline/saleads_offers.py. Загружай при добавлении или правке офферов и блоков с офферами.
---

# Размещение офферов

## Цепочка данных
```
Saleads API --saleads_offers.py--> sites/affiliate_pool.json     (мастер-реестр, 189 коннекторов)
                                        | id = poolId = saleads-<8 hex>
                                        v
web/apps/rencredit/src/content/offers/<slug>.json   (карточка оффера: условия + poolId + verified)
                                        |
      +---------------------------------+------------------------------+
      v                                 v                              v
 витрина (главная, guides:        статьи (offerKind)             обзор оффера
 kind/feature)
      +------------- CTA: /go/<poolId>/ (rel="sponsored nofollow") ------+
                                        v
        страница-редирект /go/<poolId>/ (noindex) -> href из пула + UTM
```
- `sites/affiliate_pool.json` мастер: `id`, `label`, `href` (`https://my.saleads.pro/s/<uuid>`), `vertical`, `payout`, `status` (`approve` | `wait`), `enabled`.
- Оффер на сайт выводим только при `status: approve` и `enabled: true`. `wait` (на модерации) на витрину не идёт.
- `content/offers/*.json` валидируется схемой `content.config.ts`: `poolId` (формат `saleads-xxxxxxxx`, обязан быть в пуле), `kind` (mfo|card|credit), `name`, суммы, сроки, `rateDayPct` ≤ 0.8, `features[]`, `verified`, `priority`.
- `verified: false` по умолчанию. `true` только после сверки условий с кабинетом Saleads и страницей кредитора. Описание оффера Saleads это рекламный текст рекламодателя: дословно не публиковать (`site_pipeline/output/offer_details_*.json` в .gitignore).
- В разметке нет прямых ссылок на Saleads: только `/go/<poolId>/` с `rel="sponsored nofollow"`. `/go/*` закрыт `noindex`, не входит в sitemap и не блокируется в `robots.txt` (иначе noindex не прочитают).
- Статья: `offerKind` во frontmatter выбирает тип продуктов для блока внутри статьи; порядок по `priority`, затем `rating`.
- Гайд: `kind` + `feature` задают предустановленный фильтр витрины (например `no_refusal`).

## Добавить оффер
1. Найти его в пуле (открой `sites/affiliate_pool.json` и найди по `label`; структура: список объектов с `id`).
2. Нет в пуле или статус `wait`: `connect-missing` или дождаться модерации (команды ниже).
3. Создать `content/offers/<slug>.json` по схеме, `verified: false`.
4. Заполнить условия из кабинета (`saleads_offers.py offer <uuid>`), затем `verified: true`.
5. `node scripts/check.mjs --quick` (poolId есть в пуле, JSON валиден), затем `npm --prefix web run build`.

## Обновить офферы через Saleads
Токен лежит в `site/.env` (`SALEADS_API_KEY`). Этот файл не читаем и не печатаем: скрипт читает его сам. Нужна сеть и токен; без них работает только `--help`.
```powershell
.venv\Scripts\python.exe site_pipeline\saleads_offers.py connect-missing --dry-run   # что не подключено
.venv\Scripts\python.exe site_pipeline\saleads_offers.py connect-missing             # подключить (идемпотентно)
.venv\Scripts\python.exe site_pipeline\saleads_offers.py export-pool                 # -> sites\affiliate_pool.json
.venv\Scripts\python.exe site_pipeline\saleads_offers.py offer <offer_uuid>          # детали оффера
.venv\Scripts\python.exe site_pipeline\saleads_offers.py financial                   # финансовые офферы по выплате
```
После `export-pool` посмотреть diff пула и статусы офферов сайта: оффер снят или `wait`, значит убрать с витрины.

## Чего не делать
- Не размещать офферы банка «Ренессанс» и не использовать его бренд как бренд сайта.
- Не копировать ссылки между сайтами сети без смены UTM `campaign`.
- Не править `sites/*/pages/*.json` и `affiliateLinks.json` старого пайплайна ради нового фронта: он читает свой `content/offers`.
