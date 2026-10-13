"""PreToolUse hook: детерминированные запреты проекта (Windows, запуск через `py`).

Читает JSON из stdin. Выход 2 блокирует действие, stderr уходит агенту.
Выход 0 с текстом в stderr и без блокировки = предупреждение (stderr виден в логе).
Второй барьер после permissions.deny: просьбы в CLAUDE.md забываются, hook срабатывает всегда.
"""
import json
import re
import sys

for _s in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

SECRET_PATH = re.compile(r"(^|[/\x5c])(\.env(\..+)?|.*\.pem|id_rsa.*|.*\.key)$", re.I)
EXAMPLE_ENV = re.compile(r"\.env\.(example|sample|template)$", re.I)
YANDEX_VERIFY = re.compile(r"(^|[/\x5c])(yandex_[0-9a-f]+\.html|yandex-verification[^/\x5c]*|metrika[^/\x5c]*\.(html|txt))$", re.I)
PAGES_JSON = re.compile(r"(^|[/\x5c])sites[/\x5c][^/\x5c]+[/\x5c]pages[/\x5c][^/\x5c]+\.json$", re.I)
WEB_SRC = re.compile(r"(^|[/\x5c])web[/\x5c]", re.I)
BRAND_RX = re.compile(r"Ренессанс|Renaissance", re.I)

BAD_CMD = [
    # Команда должна стоять в позиции команды (начало строки или после ; & | ( ), иначе блокируются heredoc с текстом про .env.
    (re.compile(r"(^|[;&|(]\s*|\n\s*)(cat|type|more|less|head|tail|Get-Content|gc|bat|grep|rg|sed|awk|Select-String)\s[^|;&\n]*\.env\b(?!\.(example|sample|template))", re.I), "чтение .env"),
    (re.compile(r"(^|[;&|(]\s*|\n\s*)(source|\.)\s+\S*\.env\b", re.I), "загрузка .env в оболочку"),
    (re.compile(r"\bprintenv\b|\benv\s*\||\bGet-ChildItem\s+env:|\bgci\s+env:|\bdir\s+env:|\$env:SALEADS", re.I), "вывод переменных окружения/секретов"),
    (re.compile(r"\bgit\s+push\b", re.I), "git push (пушит только человек)"),
    (re.compile(r"\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.|restore\s+\.)", re.I), "необратимая git-команда"),
    (re.compile(r"\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|-r\s+-f|-f\s+-r)[a-z]*\s+(/|~|\.|\*|[a-z]:|\$HOME)", re.I), "массовое удаление"),
    (re.compile(r"\brm\s+-[a-z]*r[a-z]*f?\s+(site|sites|web|site_pipeline|\.git|registry)/?(\s|$|[;&|])", re.I), "удаление каталога проекта"),
    (re.compile(r"Remove-Item\b[^|;&]*-Recurse[^|;&]*\s(/|~|\.|\*|[a-z]:\?(\s|$)|\$HOME)", re.I), "массовое удаление (PowerShell)"),
    (re.compile(r"\b(rmdir|rd)\s+/s\b[^|;&]*", re.I), "рекурсивное удаление (cmd)"),
    (re.compile(r"\b(cp|copy|Copy-Item|mv|move|xcopy)\b[^;&|]*yandex_[0-9a-f]+\.html", re.I), "копирование файла подтверждения Яндекса между сайтами (футпринт сети)"),
    (re.compile(r"\b(cp|copy|Copy-Item|xcopy)\b[^;&|]*(site|web)[/\x5c][^;&|]*(metrika|yandex)[^;&|]*", re.I), "копирование файлов Яндекс/Метрики между сайтами (футпринт сети)"),
    (re.compile(r"(>|Set-Content|Out-File|tee)\s*[^;&|]*sites[/\x5c][^/\x5c;&| ]+[/\x5c]pages[/\x5c]", re.I), "запись в sites/*/pages/ (генерируемые данные)"),
    (re.compile(r"\b(sed\s+-i|perl\s+-pi)\b[^;&|]*sites[/\x5c][^;&|]*pages[/\x5c]", re.I), "правка sites/*/pages/*.json вручную"),
]


def block(msg: str) -> None:
    print(f"Заблокировано правилами проекта: {msg}. См. CLAUDE.md и docs/harness/README.md.", file=sys.stderr)
    sys.exit(2)


def warn(msg: str) -> None:
    print(f"Предупреждение: {msg}", file=sys.stderr)


def norm(p: str) -> str:
    return p.replace("\\", "/")


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    tool = data.get("tool_name", "")
    inp = data.get("tool_input", {}) or {}
    path = inp.get("file_path") or inp.get("path") or ""

    if tool in ("Read", "Edit", "Write") and path:
        if SECRET_PATH.search(path) and not EXAMPLE_ENV.search(path):
            block(f"доступ к секретному файлу {path}")

    if tool in ("Edit", "Write") and path:
        n = norm(path)
        if YANDEX_VERIFY.search(path):
            block("файлы подтверждения Яндекса/Метрики уникальны для каждого сайта: создаёт владелец, не копируем и не пишем (футпринт сети)")
        if PAGES_JSON.search(path):
            block("sites/*/pages/*.json генерируются пайплайном (crawl/export); правьте рендерер или конфиг сайта, не JSON")
        if WEB_SRC.search(path) and not re.search(r"\.(lock|json)$", n):
            content = inp.get("content") or inp.get("new_string") or ""
            if BRAND_RX.search(content):
                warn("в web/** найдено «Ренессанс/Renaissance». Бренд банка нельзя использовать как бренд сайта; "
                     "допустимы только нейтральное название и дисклеймер «не является сайтом банка».")

    if tool in ("Bash", "PowerShell"):
        cmd = inp.get("command", "")
        for rx, why in BAD_CMD:
            if rx.search(cmd):
                block(why)

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException:
        sys.exit(0)
