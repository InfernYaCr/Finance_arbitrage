---
description: Подготовить новость по теме - $ARGUMENTS
argument-hint: <тема или событие>
---

Тема: $ARGUMENTS

1. Вызови агента `news-writer`: найти первоисточник (cbr.ru, consultant.ru и др.), написать рерайт в `web/apps/rencredit/src/content/news/YYYY-MM-DD-slug.md`, `source` и `sourceName` обязательны, `draft: true`.
2. Вызови `ymyl-fact-checker` на файл: числа, даты, номера документов против источника.
3. Исправь замечания. Запусти `node scripts/check.mjs --quick`.
4. Верни путь, источник (URL) и итог проверки. `draft` не снимай без команды владельца.
