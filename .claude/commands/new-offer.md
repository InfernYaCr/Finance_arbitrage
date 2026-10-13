---
description: Добавить оффер из пула Saleads на сайт - $ARGUMENTS
argument-hint: <poolId, например saleads-b87534e0>
---

poolId: $ARGUMENTS

Следуй скиллу `offer-placement`.

1. Найди запись с этим `id` в `sites/affiliate_pool.json`. Нет записи или `status` не `approve`, или `enabled` не true: остановись и сообщи.
2. Создай `web/apps/rencredit/src/content/offers/<slug>.json` по схеме `content.config.ts` (`poolId`, `kind`, `name`, суммы, сроки, `rateDayPct` ≤ 0.8, `features`). Условия брать из кабинета Saleads (`.venv\Scripts\python.exe site_pipeline\saleads_offers.py offer <offer_uuid>`, нужны сеть и токен; `.env` не читать). Нет данных, оставь поле пустым или `verified: false`, ничего не выдумывай.
3. `verified: true` только если условия сверены с первоисточником.
4. Запусти `node scripts/check.mjs --quick`. Покажи созданный файл и список полей, которые не удалось подтвердить.
