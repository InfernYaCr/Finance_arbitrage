#!/usr/bin/env python3
"""Генерирует 301/410-правила для старого WordPress rencredit-online.ru из map.json
и вставляет их между маркерами BEGIN/END LEGACY 301 в web/apps/rencredit/public/.htaccess.
Идемпотентно: повторный запуск даёт тот же файл.  Запуск: py legacy/rencredit/gen_htaccess.py [--check]
"""
import json, re, sys
from collections import OrderedDict
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[2]
MAP = ROOT / "legacy/rencredit/map.json"
REMOVED_OFFERS = ROOT / "web/apps/rencredit/src/data/removed-offers.json"
OFFERS_DIR = ROOT / "web/apps/rencredit/src/content/offers"
# Раздел обзора по kind — копия REVIEW_DIR из web/apps/rencredit/src/lib/offers.ts
REVIEW_DIR = {"mfo": "mfo", "card": "karty", "credit": "kredity"}
HTACCESS = ROOT / "web/apps/rencredit/public/.htaccess"
BEGIN, END = "# BEGIN LEGACY 301", "# END LEGACY 301"
MAXLEN = 1800  # лимит длины строки правила
HOST = "https://%{HTTP_HOST}"  # за nginx относительный редирект может уйти на http/внутренний порт

def esc(s):
    # Апач сопоставляет RewriteRule с декодированным путём, поэтому кириллица остаётся как есть.
    return re.sub(r'([.^$*+?()\[\]{}|\\])', r'\\\1', s)

def dest(t, drop_query=False):
    return f"{HOST}{t}" + ("?" if drop_query else "")

# Универсальные правила: (комментарий, pattern, target|None=410, flags-регэксп для пропуска map)
GENERIC_301 = [
    ("Архивы авторов", r"^author/.*$", "/o-proekte/"),
    ("Пагинация рубрики блога /credit/page/N", r"^credit/page/\d+/?$", "/stati/"),
    ("Пагинация главной /page/N", r"^page/\d+/?$", "/"),
    ("Старая точка входа WP", r"^index\.php$", "/"),
]
# Query-параметры WP на главной (?p=, ?s=, …), не покрытые ID из экспорта -> главная без query
WP_QUERY_KEYS = "p|page_id|attachment_id|s|cat|tag|author"

def wp_ids(by_url):
    """?p=<id>/?page_id=<id> из экспорта постов/страниц -> конечная цель (rewrite: тот же URL)."""
    out = []
    for f in sorted((MAP.parent / "posts").glob("*.json")) + sorted((MAP.parent / "pages").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        x = by_url.get(d["link"])
        if not x:
            continue
        t = urlsplit(d["link"]).path if x["decision"] == "rewrite" else x["target"]
        out.append(("page_id" if d["type"] == "page" else "p", d["id"], t, d["link"]))
    return out

def main():
    m = json.loads(MAP.read_text(encoding="utf-8"))
    L = []
    add = L.append
    tags = OrderedDict()   # target -> [slug]
    singles = []           # (path, target, old_url)
    queries = []           # (query, target, old_url)
    gone = []              # (path, old_url) -> 410
    for x in m:
        if x["decision"] == "gone410":
            gone.append((unquote(urlsplit(x["old_url"]).path).strip("/"), x["old_url"]))
            continue
        if x["decision"] != "merge301":
            continue
        u = urlsplit(x["old_url"])
        path = unquote(u.path).strip("/")
        t = x["target"]
        if u.query:
            queries.append((u.query, t, x["old_url"]))
        elif x["type"] == "tag":
            tags.setdefault(t, []).append(path[len("tag/"):])
        else:
            singles.append((path, t, x["old_url"], x["type"]))

    def covered(path, t):
        return any(re.match(p, path) and tt == t for _, p, tt in GENERIC_301)

    add("<IfModule mod_rewrite.c>")
    add("# Сгенерировано legacy/rencredit/gen_htaccess.py из legacy/rencredit/map.json — руками не править.")
    add("")
    add("# --- Query-URL WordPress (сброс query через '?' в конце цели) ---")
    for q, t, old in queries:
        k, _, v = q.partition("=")
        add(f"# {old}")
        add(f"RewriteCond %{{QUERY_STRING}} (^|&){esc(k)}={esc(v)}(&|$)")
        add(f"RewriteRule ^$ {dest(t, True)} [R=301,L]")
    add("# Старые ссылки ?feed=… (rss2/atom/comments-rss2) -> главная")
    add("RewriteCond %{QUERY_STRING} (^|&)feed=")
    add(f"RewriteRule ^$ {dest('/', True)} [R=301,L]")
    add("# Старый REST через ?rest_route=… -> 410")
    add("RewriteCond %{QUERY_STRING} (^|&)rest_route=")
    add("RewriteRule ^(index\\.php)?$ - [G,L]")
    add("# ?p=<id> / ?page_id=<id> постов и страниц из экспорта -> их новый адрес одним 301")
    for k, i, t, _ in wp_ids({x["old_url"]: x for x in m}):
        add(f"RewriteCond %{{QUERY_STRING}} (^|&){k}={i}(&|$)")
        add(f"RewriteRule ^(index\\.php)?$ {dest(t, True)} [R=301,L]")
    add("# Прочие ?p=, ?page_id=, ?s=, ?cat=, ?tag=, ?author= (на статике отдавали бы дубль главной) -> главная")
    add(f"RewriteCond %{{QUERY_STRING}} (^|&)({WP_QUERY_KEYS})=")
    add(f"RewriteRule ^(index\\.php)?$ {dest('/', True)} [R=301,L]")
    add("")

    add("# --- Отдельные страницы, посты, рубрика, feed (из map.json) ---")
    # feed из map: цель указана в map.json (главная) — следуем ей
    for path, t, old, typ in singles:
        if covered(path, t):
            continue
        add(f"# {typ}: {old}")
        add(f"RewriteRule ^{esc(path)}/?$ {dest(t)} [R=301,L]")
    add("# --- Посты без тематической цели (decision gone410 в map.json) -> 410 ---")
    for path, old in gone:
        add(f"# {old}")
        add(f"RewriteRule ^{esc(path)}/?$ - [G,L]")
    add("# Переписанные статьи /credit/<slug>.html/ (WP снимал лишний слэш) -> без слэша;")
    add("# файл credit/<slug>.html существует, '/' попадает в PATH_INFO — DPI, чтобы он не прилип к цели")
    add(f"RewriteRule ^(credit/[^/]+\\.html)/$ {HOST}/$1 [R=301,L,DPI]")
    add("")

    add("# --- Теги /tag/<slug> (с завершающим слэшем и без), сгруппированы по цели ---")
    ntag = 0
    for t, slugs in tags.items():
        slugs = sorted(slugs)
        chunks, cur = [], []
        for s in slugs:
            cand = cur + [esc(s)]
            if cur and len("|".join(cand)) > MAXLEN:
                chunks.append(cur); cur = [esc(s)]
            else:
                cur = cand
        if cur:
            chunks.append(cur)
        for c in chunks:
            ntag += len(c)
            add(f"# {len(c)} тегов -> {t}")
            add(f"RewriteRule ^tag/({'|'.join(c)})/?$ {dest(t)} [R=301,L]")
    add("")

    removed = {k: v for k, v in json.loads(REMOVED_OFFERS.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    add("# --- Снятые офферы (src/data/removed-offers.json): обзор -> раздел ---")
    for slug, t in sorted(removed.items()):
        add(f"RewriteRule ^mfo/{esc(slug)}/?$ {dest(t)} [R=301,L]")
    add("# --- Обзоры карт и кредитов переехали с /mfo/<slug>/ (kind из src/content/offers) ---")
    for f in sorted(OFFERS_DIR.glob("*.json")):
        d = REVIEW_DIR[json.loads(f.read_text(encoding="utf-8"))["kind"]]
        if d != "mfo":
            add(f"RewriteRule ^mfo/{esc(f.stem)}/?$ {dest(f'/{d}/{f.stem}/')} [R=301,L]")
    add("")

    add("# --- Общие правила WordPress ---")
    for comment, pat, t in GENERIC_301:
        add(f"# {comment}")
        add(f"RewriteRule {pat} {dest(t)} [R=301,L]")
    add("# Yoast/WP-карты сайта -> индекс карты нового сайта (Astro: sitemap-index.xml)")
    add(f"RewriteRule ^(sitemap_index|sitemap|[a-z0-9_-]+-sitemap[0-9]*|wp-sitemap[a-z0-9_-]*)\\.(xml|xsl)$ {dest('/sitemap-index.xml')} [R=301,L]")
    add("# Прочие feed (/…/feed/, /feed/atom/, /comments/feed/ и т.п.), не описанные в map.json -> 410")
    add("RewriteRule (^|/)feed(/[a-z0-9-]+)?/?$ - [G,L]")
    add("# Служебное WordPress: админка, API, xmlrpc, плагины/темы/ядро -> 410")
    add("RewriteRule ^wp-(admin|json|content|includes)(/|$) - [G,L]")
    add("RewriteRule ^(wp-[a-z-]+|xmlrpc)\\.php$ - [G,L]")
    add("</IfModule>")

    block = "\n".join(L)
    txt = HTACCESS.read_bytes().decode("utf-8")
    nl = "\r\n" if "\r\n" in txt else "\n"
    s, e = txt.index(BEGIN), txt.index(END)
    new = txt[: s + len(BEGIN)] + nl + block.replace("\n", nl) + nl + txt[e:]
    rules = sum(1 for l in L if l.startswith("RewriteRule"))
    if "--check" in sys.argv:
        print("up-to-date" if new == txt else "STALE"); sys.exit(0 if new == txt else 1)
    if new != txt:
        HTACCESS.write_bytes(new.encode("utf-8"))
    print(f"RewriteRule: {rules}  (теги: {ntag} в {sum(1 for l in L if l.startswith('RewriteRule ^tag/'))} правилах), "
          f"макс. длина строки: {max(len(l) for l in L)}")

if __name__ == "__main__":
    main()
