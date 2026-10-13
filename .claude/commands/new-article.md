---
description: Написать статью по теме - $ARGUMENTS
argument-hint: <тема статьи>
---

Тема: $ARGUMENTS

1. Вызови агента `content-writer`: статья в `web/apps/rencredit/src/content/articles/`, frontmatter по `content.config.ts`, `draft: true`, факты из первоисточников с URL в отчёте.
2. Вызови агента `ymyl-fact-checker` на созданный файл.
3. Исправь найденные проблемы (или верни автору), повтори проверку до пустого списка.
4. Запусти `node scripts/check.mjs --quick`.
5. Верни пути файлов и итог проверки. `draft: false` ставь только если владелец попросил публиковать.
