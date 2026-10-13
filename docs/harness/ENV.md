# Окружение разработки (Windows 11)

Системного `python` нет. Используем `py` (лаунчер, Python 3.13) для служебных скриптов и `uv` для виртуального окружения проекта. `uv`: `C:\Users\Ramil\.local\bin\uv.exe` (в Git Bash добавить в PATH: `export PATH="$PATH:/c/Users/Ramil/.local/bin"`).

## Python-окружение пайплайна (.venv, Python 3.11)

Python 3.11 подходит и старому пайплайну (`site_pipeline/*`: bs4, requests, firecrawl-py, anthropic), и Crawl4AI (нужен 3.10+). Прежние `.venv` (3.9) и `.venv311` с macOS не переносятся: окружение одно.

Создание с нуля:

```powershell
uv venv .venv --python 3.11
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
```

Зависимости зафиксированы в корневом `requirements.txt` (собран по импортам `site_pipeline/*.py` и корневых скриптов + `site_pipeline/requirements*.txt`).

Особенности:
- `litellm` отдельно НЕ ставим: `crawl4ai` приносит форк `unclecode-litellm` под тем же именем модуля `litellm`; отдельный `litellm` затирает его и ломает импорт (`ImportError ... LITELLM_TRUNCATION_STDOUT_SAFEGUARD_NOTE`).
- `urllib3<2` из `site_pipeline/requirements.txt` сохранён (его требует `requests==2.32.3` из этого файла); crawl4ai при этом работает.
- Браузер для Crawl4AI/Playwright не скачан (нужен только для краулинга). Если понадобится донор-краулинг: `.venv\Scripts\python.exe -m playwright install chromium` или `.venv\Scripts\crawl4ai-setup.exe`. Для нового фронта `web/` краулинг не используется.
- Все ключи (`SALEADS_API_KEY`, `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, `EXA_API_KEY`) берутся из `site/.env` и переменных окружения. Файл `.env` агентам читать нельзя.

## Запуск скриптов пайплайна

```powershell
# PowerShell, из корня репозитория
.venv\Scripts\python.exe site_pipeline\saleads_offers.py --help        # без сети и токена
.venv\Scripts\python.exe site_pipeline\saleads_offers.py connect-missing --dry-run
.venv\Scripts\python.exe site_pipeline\saleads_offers.py export-pool
.venv\Scripts\python.exe site_pipeline\qa_pages.py
.venv\Scripts\python.exe site_pipeline\crawl_pages_c4ai.py --source-domain example.ru --limit 50
```

Git Bash: те же команды с прямыми слешами: `.venv/Scripts/python.exe site_pipeline/saleads_offers.py --help`. Активация: `.venv\Scripts\Activate.ps1` (PowerShell) или `source .venv/Scripts/activate` (Git Bash). Старые `.sh`-скрипты в корне (`build-all.sh`, `preview.sh`, `gen-env.sh`) исполняются через Git Bash.

Если скрипт печатает кириллицу кракозябрами, задайте `$env:PYTHONUTF8 = "1"` (PowerShell) или `export PYTHONUTF8=1`.

## Node и фронт (web/)

Нужен Node 22+ (проверено на установленном в системе) и npm.

```powershell
npm --prefix web install
npm --prefix web run dev -- --port 4321     # http://localhost:4321
npm --prefix web run build                  # web\apps\rencredit\dist
node scripts\check.mjs --quick              # быстрая проверка исходников
node scripts\check.mjs                      # полная: build + проверка dist
node scripts\check.mjs --dist-only          # только проверка уже собранного dist
node scripts\indexnow.mjs                   # IndexNow (нужны INDEXNOW_SITE, INDEXNOW_KEY)
py scripts\test_guard.py                    # самопроверка защитного хука
```

Старый рендерер: `npm --prefix site run build`, `npm --prefix site run preview -- --port 4322` (конфигурация `mosseo-preview` в `.claude/launch.json`).

## Claude Code

- `.claude/settings.json` (в git): запреты и хуки; `settings.local.json` и `launch.json` в `.gitignore`, у каждого свои.
- Хук запускается как `py .claude/hooks/guard.py` (Python 3.13 из лаунчера, зависимостей нет, только stdlib).
- Stop-хук: `node scripts/check.mjs --quick` (таймаут 120 с); без изменений в `web/` молчит.
- MCP (`.mcp.json`): firecrawl и exa (нужны `FIRECRAWL_API_KEY`, `EXA_API_KEY` в окружении Windows), playwright (запускается через `npx`, нужен Chrome). Filesystem-сервер убран: он был привязан к macOS-пути и не нужен.
- Переменные окружения на Windows задаются через «Параметры системы» или `setx NAME value` (после этого перезапустить Claude Code).

## Частые проблемы

| Симптом | Причина и решение |
|---|---|
| `python` не найден | Системного Python нет. Используй `py` или `.venv\Scripts\python.exe` |
| `ImportError` из `litellm` | Поставлен отдельный `litellm`. Пересоздай venv по инструкции выше |
| FTP зависает или `425 Bad IP connecting` | Отключить VPN/прокси на время деплоя |
| `astro build` падает на YAML в `src/content` | Значение с двоеточием/кавычками взять в двойные кавычки; схема в `content.config.ts` |
| Хук блокирует команду | Читай stderr: правило и причина указаны. Обход не предусмотрен; нужное действие делает владелец |
