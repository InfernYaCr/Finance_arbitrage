"""Самопроверка PreToolUse-хука: py scripts/test_guard.py (нужен exit 0)."""
import json
import os
import subprocess
import sys

B = chr(92)
CASES = [
    ("Read", {"file_path": "E:" + B + "Finance_arbitrage" + B + "site" + B + ".env"}, 2),
    ("Read", {"file_path": "site/.env.local"}, 2),
    ("Read", {"file_path": "site/.env.example"}, 0),
    ("Bash", {"command": "git push origin main"}, 2),
    ("Bash", {"command": "git reset --hard HEAD~1"}, 2),
    ("Bash", {"command": "cat site/.env"}, 2),
    ("Bash", {"command": "echo ok; source ./site/.env"}, 2),
    ("Bash", {"command": "cat <<EOF\nтокен в site/.env читает скрипт\nEOF"}, 0),
    ("Bash", {"command": "rm -rf /"}, 2),
    ("Bash", {"command": "rm -r web"}, 2),
    ("Bash", {"command": "rm web/apps/rencredit/src/_tmp/t.astro"}, 0),
    ("Bash", {"command": "printenv"}, 2),
    ("Bash", {"command": "cp site/public/yandex_b096686526decb58.html web/apps/rencredit/public/"}, 2),
    ("Bash", {"command": "npm --prefix web run build && git status"}, 0),
    ("PowerShell", {"command": "Get-Content site/.env"}, 2),
    ("PowerShell", {"command": "git push"}, 2),
    ("Write", {"file_path": "site/public/yandex_abc123.html", "content": "x"}, 2),
    ("Edit", {"file_path": "sites/finhelp-ru/pages/a.json", "new_string": "x"}, 2),
    ("Edit", {"file_path": "web/apps/rencredit/src/x.astro", "new_string": "ok"}, 0),
    ("Edit", {"file_path": "E:" + B + "Finance_arbitrage" + B + "web" + B + "apps" + B + "rencredit" + B + "src" + B + "x.astro", "new_string": "ok"}, 0),
    ("Write", {"file_path": "web/apps/rencredit/src/x.astro", "content": "Ренессанс Кредит"}, 0),  # только предупреждение
]

fails = 0
for tool, inp, want in CASES:
    r = subprocess.run(
        [sys.executable if sys.executable else "py", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".claude", "hooks", "guard.py")],
        input=json.dumps({"tool_name": tool, "tool_input": inp}).encode("utf-8"),
        capture_output=True,
    )
    ok = r.returncode == want
    fails += not ok
    print(("OK  " if ok else "FAIL"), tool, str(inp)[:70].replace("\n", " "), "->", r.returncode)
sys.exit(1 if fails else 0)
