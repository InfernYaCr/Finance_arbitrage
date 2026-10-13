#!/usr/bin/env python3
"""Строит legacy/rencredit/map.json из inventory.json + posts/*.json (решения зашиты ниже)."""
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

R = Path(__file__).resolve().parent
inv = json.loads((R / "inventory.json").read_text(encoding="utf-8"))

REFI = "/credit/refinansirovanie-kredita-chto-eto-znachit.html"

# slug -> (category, offerKind, priority, reason, outline)
REWRITE = {
    "refinansirovanie-kredita-chto-eto-znachit": ("refinansirovanie", "credit", 1,
        "Головной запрос «рефинансирование кредита что это значит», 1900+ слов; пишем как опорную статью-определение (в отличие от /stati/kak-rabotaet-refinansirovanie-kredita/: там механика и выгода, здесь термины и виды).",
        ["Что такое рефинансирование простыми словами", "Чем рефинансирование отличается от реструктуризации и перекредитования", "Виды рефинансирования: потребкредит, ипотека, кредитные карты, займы", "Кому и когда оно действительно нужно", "Какие требования предъявляют банки", "Пошаговый порядок оформления", "Риски и скрытые расходы", "Вопросы и ответы"]),
    "refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov": ("kreditnaya-istoriya", "credit", 1,
        "Сильный коммерческий интент (плохая КИ + рефинансирование), 1587 слов, в старом тексте есть партнёрские CTA.",
        ["Дадут ли рефинансирование с плохой кредитной историей", "Что банки считают плохой КИ и как её проверить", "Какие банки чаще идут навстречу (без гарантий одобрения)", "Как повысить шансы: поручитель, залог, созаёмщик", "Что делать после отказа", "Альтернативы: реструктуризация, рефинансирование через займы", "Типичные ошибки и мошенники-«помощники»", "Вопросы и ответы"]),
    "naskolko-vygodno-refinansirovanie-v-rosselhozbanke": ("refinansirovanie", "credit", 1,
        "Брендовый запрос по банку, 1707 слов, коммерческий интент; переписать без устаревших ставок, с датой проверки условий.",
        ["Условия рефинансирования в Россельхозбанке", "Кто может подать заявку", "Какие кредиты можно рефинансировать", "Документы и порядок подачи", "Сколько реально можно сэкономить (пример расчёта)", "Плюсы и минусы по сравнению с другими банками", "Как рассчитать выгоду самому", "Вопросы и ответы"]),
    "perekreditovanie-kredita-pod-menshii-procent": ("refinansirovanie", "credit", 1,
        "Прямой коммерческий запрос «перекредитование под меньший процент», 1185 слов, есть партнёрский блок.",
        ["Что такое перекредитование и когда оно снижает ставку", "Как понять, что новая ставка ниже (ПСК, комиссии, страховка)", "Пример расчёта экономии", "Пошаговый алгоритм", "Какие кредиты банки не рефинансируют", "Подводные камни: страховка, срок, досрочное погашение", "Вопросы и ответы"]),
    "kak-sdelat-refinansirovanie-kreditov-v-sberbanke": ("refinansirovanie", "credit", 1,
        "Высокочастотный брендовый запрос (Сбербанк), 830 слов — расширить до полноценной инструкции; свежий пост (2026-06).",
        ["Условия рефинансирования в Сбербанке", "Кто может рефинансировать и какие кредиты подходят", "Пошаговая инструкция (онлайн и в отделении)", "Документы", "Сколько это стоит и как посчитать выгоду", "Частые причины отказа", "Альтернативы Сбербанку", "Вопросы и ответы"]),
    "kak-polychit-pomosh-v-refinansirovanii": ("refinansirovanie", "credit", 2,
        "1727 слов, широкий информационный запрос; база для практического гайда «как получить одобрение».",
        ["Кому нужна помощь в рефинансировании", "Когда можно справиться самостоятельно", "Как подготовить заявку и документы", "Кредитные брокеры: что делают и сколько берут", "Как не попасть на мошенников", "Куда обратиться при отказе", "Вопросы и ответы"]),
    "bank-otkrytie-kak-i-na-kakih-ysloviiah-polychit-refinansirovanie-kreditov-i-ipoteki": ("refinansirovanie", "credit", 2,
        "Брендовый запрос банка «Открытие», 1386 слов, есть партнёрские ссылки; ипотечную часть сократить.",
        ["Какие программы рефинансирования есть в банке «Открытие»", "Условия и ставки (с датой проверки)", "Требования к заёмщику", "Как подать заявку", "Рефинансирование ипотеки: особенности", "Плюсы, минусы и сравнение", "Вопросы и ответы"]),
    "na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-vtb": ("refinansirovanie", "credit", 2,
        "Брендовый запрос ВТБ, 1359 слов, стабильный спрос.",
        ["Программы рефинансирования ВТБ", "Условия: сумма, срок, ставка", "Кто может подать заявку", "Порядок оформления", "Какие кредиты можно объединить", "Плюсы и минусы", "Вопросы и ответы"]),
    "stoit-li-ispolzovat-refinansirovanie-kredita": ("refinansirovanie", "credit", 2,
        "1305 слов, решающий запрос «стоит ли рефинансировать»; пересекается с опорной статьёй — делать акцент на расчёте выгоды.",
        ["В каких случаях рефинансирование выгодно", "Когда не стоит рефинансировать", "Как посчитать выгоду: формула и пример", "Скрытые расходы (страховка, комиссии, оценка)", "Влияние на кредитную историю", "Чек-лист решения", "Вопросы и ответы"]),
    "kak-proishodit-refinansirovanie-kredita-chto-nyjno-znat": ("refinansirovanie", "credit", 2,
        "1185 слов, процессный запрос; пишем как пошаговую инструкцию с чек-листом документов.",
        ["Этапы рефинансирования от заявки до закрытия старого кредита", "Какие документы нужны", "Как банк принимает решение", "Как гасится старый кредит и что проверить", "Сроки на каждом этапе", "Частые ошибки", "Вопросы и ответы"]),
    "refinansirovanie-kreditov-dlia-ip-i-uridicheskih-lic-osobennosti-perekreditovaniia-biznesa": ("refinansirovanie", "credit", 3,
        "1347 слов, но аудитория бизнес — вторична для потребительского CPA; оставляем ради веса URL, делаем компактнее.",
        ["Что значит рефинансирование бизнес-кредитов", "Отличия от потребительского рефинансирования", "Кто может претендовать (ИП, ООО)", "Требования и документы", "Плюсы и риски для бизнеса", "Альтернативы: реструктуризация, овердрафт", "Вопросы и ответы"]),
    "kak-rabotaet-agentstvo-po-refinansirovaniu": ("refinansirovanie", "credit", 3,
        "803 слова, посредники/брокеры — тема с высоким риском мошенничества; пишем с акцентом на предупреждения.",
        ["Что такое агентство (брокер) по рефинансированию", "За что берут деньги и сколько", "Какие услуги можно сделать бесплатно самому", "Признаки мошенников", "Как выбрать посредника и проверить договор", "Итог: когда посредник оправдан", "Вопросы и ответы"]),
    "refinansirovanie-v-interprombanke-ysloviia-i-poriadok-oformleniia": ("refinansirovanie", "credit", 3,
        "681 слов, нишевый банк, но есть брендовый спрос и партнёрская ссылка.",
        ["Программа рефинансирования в Интерпромбанке", "Условия и требования", "Документы", "Порядок оформления", "Плюсы и минусы", "Вопросы и ответы"]),
    "ysloviia-refinansirovaniia-kreditov-v-banke-ybrir": ("refinansirovanie", "credit", 3,
        "603 слова, брендовый запрос УБРиР, есть партнёрский блок; нужны свежие условия.",
        ["Условия рефинансирования в УБРиР", "Кто может подать заявку", "Какие кредиты рефинансируются", "Документы и порядок оформления", "Плюсы и минусы", "Вопросы и ответы"]),
}

# Остальные посты -> (target, reason); всё прочее по умолчанию -> /novosti/
MERGE = {
    "kak-polychit-povtornoe-refinansirovanie-ipoteki": (REFI, "429 слов, ипотека вне фокуса сайта; тема повторного рефинансирования раскрывается в опорной статье."),
    "pytin-podpisal-zakon-o-periode-ohlajdeniia-po-potrebitelskim-kreditam": ("/novosti/", "Устаревшая новостная заметка (459 слов) без самостоятельной ценности; общий раздел новостей."),
    "sovfed-na-plenarnom-zasedanii-odobril-zakon-o-periode-ohlajdeniia-po-potrebkreditam": ("/novosti/", "Короткая новость-однодневка (180 слов) о том же законе."),
    "gosdyma-priniala-zakon-po-limitam-na-vydachy-ipotechnyh-i-avtokreditov-fizlicam": ("/kredity/", "Короткая устаревшая новость об ограничениях по ипотеке и автокредитам; ближайший раздел — каталог кредитов."),
    "komitet-gosdymy-odobril-pravo-cb-rf-ogranichivat-vydachy-ipotechnyh-i-avtokreditov": ("/kredity/", "Короткая новость того же сюжета, дубль."),
    "sovfed-odobril-pravo-cb-limitirovat-vydachy-ipotechnyh-i-avtokreditov-fizlicam": ("/kredity/", "Короткая новость того же сюжета, дубль."),
    "bank-rossii-planiryet-ogranichit-rost-ejemesiachnogo-plateja-po-ipoteke": ("/kredity/", "Короткая устаревшая новость про ипотечный платёж."),
    "vtb-rynok-ipoteki-v-rossii-v-2025-gody-sojmetsia-minimym-na-20": ("/kredity/", "Короткая устаревшая новость про рынок ипотеки."),
    "eksperty-osvobojdenie-ot-ndfl-kosnetsia-nebolshogo-chisla-ipotechnikov": ("/kredity/", "Короткая устаревшая новость про ипотеку и НДФЛ."),
    "pochta-bank-dohodnost-lestnichnyh-vkladov-i-obychnyh-depozitov-pochti-odinakova": ("/novosti/", "Новость про вклады, не по теме займов/кредитов."),
    "cb-dopyskaet-vvedenie-nadbavok-na-kredity-urlicam-s-vysokim-dolgom-yje-v-2025-g": ("/novosti/", "Новость про корпоративные кредиты, 140 слов."),
    "cb-dolia-ryblevyh-kreditov-s-plavaushei-stavkoi-urlicam-za-9-mes-vyrosla-do-60": ("/novosti/", "Новость про корпоративные кредиты, 194 слова."),
}
DEFAULT_NEWS = "Новость-однодневка (рынки, золото, зарубежные ЦБ, облигации) не по теме сайта; общий раздел новостей."


def tag_target(name, slug):
    n = (name + " " + slug).lower()
    if any(k in n for k in ("займ", "заём", "мфо", "микро", "zaym", "zaim", "mfo")):
        return "/zaimy/"
    if any(k in n for k in ("карт", "kart")):
        return "/karty/"
    if any(k in n for k in ("кредит", "ипотек", "рефинанс", "банк", "ставк", "kredit", "ipotek", "refinans", "bank")):
        return "/kredity/"
    return "/stati/"


out = []
for it in inv:
    u, t = it["url"], it["type"]
    path = urlparse(u).path
    row = dict(old_url=u, type=t, title=it.get("title"), words=it.get("words"),
               http_status=it.get("http_status"), in_sitemap=it.get("in_sitemap"))
    if t == "post":
        s = it["slug"]
        if s in REWRITE:
            cat, kind, prio, why, outline = REWRITE[s]
            row.update(decision="rewrite", target=path, new_slug=s, category=cat, offerKind=kind,
                       priority=prio, reason=why, outline=outline)
        else:
            tgt, why = MERGE.get(s, ("/novosti/", DEFAULT_NEWS))
            row.update(decision="merge301", target=tgt, reason=why, priority=None)
    elif t == "home":
        row.update(decision="keep", target="/", reason="Главная сохраняет URL.")
    elif t == "page":
        if "privacy" in it["slug"]:
            row.update(decision="merge301", target="/politika-konfidencialnosti/", reason="Политика конфиденциальности WP -> новая страница политики.")
        else:
            row.update(decision="merge301", target="/", reason="HTML-карта сайта WP; заменена sitemap.xml и навигацией.")
    elif t == "category":
        row.update(decision="merge301", target="/stati/", reason="Рубрика «Блог» -> раздел статей.")
    elif t == "category_page":
        row.update(decision="merge301", target="/stati/", reason="Пагинация рубрики -> раздел статей.")
    elif t == "tag":
        row.update(decision="merge301", target=tag_target(it.get("title") or "", it["slug"]),
                   reason="Тег-архив (тонкая страница) -> ближайший раздел по теме.")
    elif t == "author":
        row.update(decision="merge301", target="/o-proekte/", reason="Архив автора (закрыт в robots) -> о проекте.")
    elif t == "feed":
        row.update(decision="merge301", target="/", reason="RSS-лента WP не поддерживается.")
    elif t == "sitemap":
        row.update(decision="merge301", target="/sitemap-index.xml", reason="Индекс карты сайта WP -> индекс карты Astro.")
    else:
        row.update(decision="merge301", target="/", reason="Служебный URL WP (oceanwp_library и т.п.).")
    row.setdefault("priority", None)
    out.append(row)

assert all(r["target"].startswith("/") for r in out)
assert {r["old_url"] for r in out} == {i["url"] for i in inv} and len(out) == len(inv)
(R / "map.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(len(out), dict(Counter(r["decision"] for r in out)), dict(Counter(r["target"] for r in out if r["type"] == "tag")))
