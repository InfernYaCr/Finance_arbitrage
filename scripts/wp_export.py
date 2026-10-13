#!/usr/bin/env python3
"""Идемпотентный экспорт старого WordPress-сайта через публичный REST API (только GET/HEAD).

Запуск:  PYTHONIOENCODING=utf-8 py scripts/wp_export.py [--skip-status]
Пишет в legacy/rencredit/: posts/<slug>.json, pages/<slug>.json, taxonomy.json,
media.json, sitemap_urls.json, inventory.json (с HTTP-статусами). Картинки не скачиваются.
"""
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://rencredit-online.ru"
HOST = "rencredit-online.ru"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
PAUSE = 0.3
TIMEOUT = 30
OUT = Path(__file__).resolve().parent.parent / "legacy" / "rencredit"

# Подстроки хоста/URL, указывающие на партнёрки и трекинг (чужие)
PARTNER_HINTS = ("delen.ru", "leads.su", "saleads", "admitad", "tinyurl", "bit.ly", "clck.ru", "cpa", "/go/", "ref=", "utm_")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def get(url, method="GET", follow=True):
    """(status, headers, body). При follow=False редиректы не следуем."""
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with opener.open(req, timeout=TIMEOUT) as r:
            return r.status, r.headers, (r.read() if method == "GET" else b"")
    except urllib.error.HTTPError as e:
        return e.code, e.headers, b""
    except Exception as e:
        return 0, {"error": str(e)}, b""


def jget(path, **params):
    url = f"{BASE}/wp-json/wp/v2/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    time.sleep(PAUSE)
    st, h, body = get(url)
    if st != 200:
        raise RuntimeError(f"{url} -> {st}")
    return json.loads(body.decode("utf-8")), h


def paged(path, fields=None, **extra):
    out, page = [], 1
    while True:
        params = dict(per_page=100, page=page, **extra)
        if fields:
            params["_fields"] = fields
        data, h = jget(path, **params)
        out += data
        if page >= int(h.get("X-WP-TotalPages", 1)):
            break
        page += 1
    return out


class TextExtractor(HTMLParser):
    BLOCK = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "ul", "ol", "table", "blockquote"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip, self.links, self.imgs = [], 0, [], []
        self._in_a = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style"):
            self.skip += 1
        if tag in self.BLOCK:
            self.parts.append("\n")
        if tag == "a" and a.get("href"):
            self.links.append({"href": a["href"].strip(), "text": "", "kind": "a"})
            self._in_a = True
        elif a.get("data-href"):  # «клоакинговые» ссылки WP-плагина: <span class="hl hl_custlink" data-href=...>
            self.links.append({"href": a["data-href"].strip(), "text": "", "kind": "data-href"})
            self._in_a = True
        elif tag == "iframe" and a.get("src"):
            self.links.append({"href": a["src"].strip(), "text": "", "kind": "iframe"})
        if tag == "img" and (a.get("src") or a.get("data-src")):
            self.imgs.append(a.get("src") or a.get("data-src"))

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1
        if tag in self.BLOCK:
            self.parts.append("\n")
        if tag in ("a", "span"):
            self._in_a = False

    def handle_data(self, d):
        if self.skip:
            return
        self.parts.append(d)
        if self._in_a and self.links:
            self.links[-1]["text"] += d


def analyze_html(content_html):
    p = TextExtractor()
    p.feed(content_html)
    text = html.unescape("".join(p.parts))
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return text, p.links, p.imgs


def classify_links(links, own):
    outgoing, internal, partner = [], [], []
    for l in links:
        href = l["href"]
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absu = urllib.parse.urljoin(BASE + "/", href)
        u = urllib.parse.urlparse(absu)
        host = u.netloc.lower().removeprefix("www.")
        if host == HOST:
            internal.append({"url": absu, "path": u.path, "text": l["text"].strip(), "kind": l["kind"],
                             "post_slug": own.get(u.path.rstrip("/"))})
        else:
            rec = {"url": absu, "host": host, "text": l["text"].strip(), "kind": l["kind"]}
            outgoing.append(rec)
            if any(h in host or h in absu.lower() for h in PARTNER_HINTS):
                partner.append(rec)
    return outgoing, internal, partner


def sitemap_urls():
    seen, urls = set(), []

    def walk(u):
        if u in seen:
            return
        seen.add(u)
        time.sleep(PAUSE)
        st, _, body = get(u)
        if st != 200:
            print("sitemap fail", u, st)
            return
        root = ET.fromstring(body)
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for sm in root.findall("s:sitemap", ns):
            walk(sm.find("s:loc", ns).text.strip())
        for ue in root.findall("s:url", ns):
            lm = ue.find("s:lastmod", ns)
            urls.append({"url": ue.find("s:loc", ns).text.strip(),
                         "lastmod": lm.text if lm is not None else None, "sitemap": u})

    walk(BASE + "/sitemap_index.xml")
    return urls


def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    skip_status = "--skip-status" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)

    print("categories/tags/users...")
    cats = paged("categories", "id,slug,link,count,name,parent")
    tags = paged("tags", "id,slug,link,count,name")
    users = [{"id": u["id"], "slug": u["slug"], "link": u["link"]} for u in paged("users", "id,slug,link")]
    cat_by_id = {c["id"]: c for c in cats}
    tag_by_id = {t["id"]: t for t in tags}

    print("media...")
    media = paged("media", "id,slug,source_url,post,mime_type")
    media_by_id = {m["id"]: m for m in media}

    print("posts/pages...")
    posts = paged("posts")
    pages = paged("pages")

    own = {urllib.parse.urlparse(it["link"]).path.rstrip("/"): it["slug"] for it in posts + pages}
    post_ids = {p["id"] for p in posts + pages}
    write(OUT / "media.json", [
        {"id": m["id"], "source_url": m["source_url"], "post": m.get("post"),
         "attached_to_existing": m.get("post") in post_ids, "mime": m.get("mime_type")} for m in media])

    def build(it, kind):
        y = it.get("yoast_head_json") or {}
        text, links, imgs = analyze_html(it["content"]["rendered"])
        outgoing, internal, partner = classify_links(links, own)
        fm = media_by_id.get(it.get("featured_media"))
        return {
            "id": it["id"], "type": kind, "link": it["link"], "slug": it["slug"],
            "date": it["date"], "modified": it["modified"], "status": it.get("status"),
            "title": html.unescape(it["title"]["rendered"]),
            "yoast_title": y.get("title"), "yoast_description": y.get("description"),
            "canonical": y.get("canonical"), "robots": y.get("robots"),
            "excerpt": html.unescape(re.sub(r"<[^>]+>", "", it.get("excerpt", {}).get("rendered", ""))).strip(),
            "word_count": len(re.findall(r"\w+", text)),
            "categories": [{"id": c, "slug": cat_by_id[c]["slug"], "name": cat_by_id[c]["name"]}
                           for c in it.get("categories", []) if c in cat_by_id],
            "tags": [{"id": t, "slug": tag_by_id[t]["slug"], "name": tag_by_id[t]["name"], "link": tag_by_id[t]["link"]}
                     for t in it.get("tags", []) if t in tag_by_id],
            "featured_media_url": fm["source_url"] if fm else None,
            "content_images": imgs,
            "outgoing_links": outgoing, "partner_links": partner, "internal_links": internal,
            "content_html": it["content"]["rendered"], "content_text": text,
        }

    post_recs = [build(p, "post") for p in posts]
    page_recs = [build(p, "page") for p in pages]
    for r in post_recs:
        write(OUT / "posts" / f"{r['slug']}.json", r)
    for r in page_recs:
        write(OUT / "pages" / f"{r['slug']}.json", r)
    write(OUT / "taxonomy.json", {"categories": cats, "tags": tags, "users": users})

    print("sitemaps...")
    sm = sitemap_urls()
    write(OUT / "sitemap_urls.json", sm)
    sm_set = {u["url"] for u in sm}

    inv = {}

    def add(url, typ, **kw):
        if url not in inv:
            inv[url] = {"url": url, "type": typ, "in_sitemap": url in sm_set, **kw}

    add(BASE + "/", "home")
    for r in post_recs:
        add(r["link"], "post", slug=r["slug"], title=r["title"], words=r["word_count"])
    for r in page_recs:
        add(r["link"], "page", slug=r["slug"], title=r["title"], words=r["word_count"])
    for c in cats:
        add(c["link"], "category", slug=c["slug"], title=c["name"], count=c["count"])
        for n in range(2, max(1, -(-c["count"] // 10)) + 1):  # 10 постов на страницу по умолчанию
            add(f"{c['link'].rstrip('/')}/page/{n}/", "category_page", slug=c["slug"], title=f"{c['name']} — стр. {n}")
        add(c["link"].rstrip("/") + "/feed/", "feed", title=f"Feed рубрики {c['name']}")
    for t in tags:
        add(t["link"], "tag", slug=t["slug"], title=t["name"], count=t["count"])
    for u in users:
        add(u["link"], "author", slug=u["slug"])
    add(BASE + "/feed/", "feed", title="Главный feed")
    add(BASE + "/comments/feed/", "feed", title="Feed комментариев")
    add(BASE + "/sitemap_index.xml", "sitemap")
    for u in sm:
        if u["url"] not in inv:
            typ = "author" if "/author/" in u["url"] else ("library" if "library" in u["url"] else "other")
            add(u["url"], typ, title=None)

    items = sorted(inv.values(), key=lambda x: (x["type"], x["url"]))

    if not skip_status:
        print(f"HTTP status for {len(items)} URLs...")
        for i, it in enumerate(items, 1):
            time.sleep(PAUSE)
            st, h, _ = get(it["url"], method="HEAD", follow=False)
            if st in (0, 405, 501):
                st, h, _ = get(it["url"], method="GET", follow=False)
            it["http_status"] = st
            loc = h.get("Location") if hasattr(h, "get") else None
            if loc:
                it["location"] = loc
            if i % 25 == 0:
                print(f"  {i}/{len(items)}")
    # несуществующие страницы пагинации рубрики в инвентарь не входят
    items = [i for i in items if not (i["type"] == "category_page" and i.get("http_status") == 404)]
    write(OUT / "inventory.json", items)

    print("DONE posts", len(post_recs), "pages", len(page_recs), "inventory", len(items))
    print(dict(Counter(i["type"] for i in items)))
    if not skip_status:
        print(dict(Counter(i.get("http_status") for i in items)))


if __name__ == "__main__":
    main()
