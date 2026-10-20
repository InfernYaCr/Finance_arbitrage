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

# 101 пост /credit/<slug>.html, которых не было в REST API/sitemap (в inventory их нет), но в Wayback
# они 200 (2025-08…2026-01), а на новом сайте отдавали 404. Источник: docs/seo-rencredit/01-technical.md
# прил. A; цели по таблице SEO_PLAN.md §7.1: сильное совпадение -> 301 на существующую страницу,
# остальное (банки без статей, новости без темы, офтоп, цель ещё в draft) -> 410 (цель None).
# Когда выйдет статья-цель из draft — перенести slug в её группу и перегенерировать .htaccess.
KAK = "/credit/kak-proishodit-refinansirovanie-kredita-chto-nyjno-znat.html"
BADKI = "/credit/refinansirovanie-kreditov-s-plohoi-kreditnoi-istoriei-perechen-bankov.html"
LOST = {
    REFI: ("Общее про рефинансирование, ипотеку (до хаба /stati/refinansirovanie-ipoteki-v-2026/), автокредит, кредитные карты — опорная статья.", [
        "chto-takoe-refinansirovanie-ipoteki", "kak-i-gde-proizvesti-refinansirovanie-avtokredita",
        "kak-rabotaet-kalkyliator-refinansirovaniia-ipoteki", "kak-refinansirovat-ipotechnyi-dolg",
        "kak-refinansirovat-kredit-pod-zalog-nedvijimosti", "kak-sdelat-refinansirovanie-kredita-ili-ipoteki",
        "kak-sdelat-refinansirovaniia-ipoteki-s-materinskim-kapitalom-v-2024-gody",
        "kakie-rashody-mogyt-vozniknyt-pri-refinansirovanii-ipotechnogo-kredita",
        "kyda-obratitsia-dlia-oformleniia-refinansirovaniia-avtokredita",
        "mojno-li-refinansirovat-ipoteky-v-slychae-rojdeniia-pervogo-rebenka",
        "mojno-li-refinansirovat-kredit-s-pomoshu-selskoi-ipoteki",
        "mojno-li-refinansirovat-po-programme-semeinaia-ipoteka-kredit-oformlennyi-na-apartamenty",
        "mojno-li-sdelat-refinansirovanie-yje-imeusheisia-ipoteki-za-schet-lgotnoi-ipoteki-dlia-it-specialistov",
        "mojno-li-vziat-obychnyu-ipoteky-a-potom-refinansirovat-po-semeinoi-ipoteke",
        "obzor-programm-refinansirovaniia-2023-goda", "osobennosti-refinansirovaniia-voennoi-ipoteki-v-2024-gody",
        "otvety-na-voprosy-zaemshikov-pro-refinansirovanie",
        "refinansirovanie-ili-restryktyrizaciia-chto-vybrat-dlia-ymensheniia-plateja-po-kredity",
        "refinansirovanie-ipoteki-drygih-bankov-lychshie-predlojeniia-2024-goda",
        "refinansirovanie-ipoteki-v-chem-vygoda-i-kak-ee-rasschitat", "refinansirovanie-kredita",
        "refinansirovanie-kredita-dlia-pensionerov-lychshie-predlojeniia-bankov-v-2024-gody",
        "refinansirovanie-kreditov-drygih-bankov-gde-polychit-bez-problem",
        "refinansirovanie-kreditov-drygih-bankov-na-vygodnyh-ysloviiah-v-2024-gody",
        "refinansirovanie-kreditov-pod-zalog-nedvijimosti-kak-pravilno-oformit-sdelky",
        "refinansirovanie-kreditov-v-raznyh-sityaciiah-podborka-statei-ot-mbk",
        "v-kakih-bankah-oformliaut-refinansirovanie", "v-kakom-banke-vygodno-oformliat-refinansirovanie-ipoteki",
        "vozmojno-li-posle-refinansirovaniia-ipoteki-polychit-nalogovyi-vychet",
        "vozmojno-li-povtorno-provesti-refinansirovanie",
        "kak-i-gde-polychit-refinansirovanie-kreditnoi-karty", "kak-provesti-refinansirovanie-kreditki",
        "top-9-predlojenii-po-refinansirovaniu-kreditnyh-kart-v-2023-gody",
    ]),
    KAK: ("Порядок, документы, «без справки о доходах», «когда работает».", [
        "chto-nyjno-znat-pered-tem-kak-sdelat-refinansirovanie-kredita", "dokymenty-dlia-refinansirovaniia-ipoteki",
        "gde-polychit-refinansirovanie-kredita-bez-spravki-o-dohodah",
        "kogda-bank-razreshaet-obrashatsia-za-refinansirovaniem", "kogda-rabotaet-refinansirovanie",
        "odobriat-li-refinansirovanie-v-banke-esli-net-spravki-o-dohodah",
        "spisok-dokymentov-dlia-refinansirovaniia-kredita-i-ipoteki",
    ]),
    BADKI: ("Просрочка, плохая КИ, причины отказа (до /stati/pochemu-bank-otkazyvaet-v-kredite/).", [
        "gde-oformit-refinansirovanie-kreditov-s-prosrochkoi",
        "kyda-obrashatsia-za-refinansirovaniem-esli-kredit-s-zadoljennostu",
        "osnovnye-prichiny-pochemy-bank-ne-refinansiryet-kredit-daje-pod-zalog",
        "otkazali-v-refinansirovanii-osnovnye-prichiny", "pochemy-bank-otkazyvaet-v-refinansirovanii-posle-restryktyrizacii",
        "prichiny-otkaza-v-refinansirovanii-kotorye-skryvaut-banki",
        "razreshat-li-v-banke-refinansirovat-mikrozaim-s-prosrochkami",
        "refinansirovanie-ipoteki-s-plohoi-ki-v-kakih-bankah-odobriat",
        "refinansirovanie-s-plohoi-kreditnoi-istoriei-predlojeniia-bankov",
        "top-6-prichin-pochemy-banki-otkazyvaut-v-refinansirovanii",
    ]),
    "/credit/kak-sdelat-refinansirovanie-kreditov-v-sberbanke.html": ("Сбербанк.", [
        "kak-oformit-refinansirovanie-kredita-v-sberbanke", "kakie-nyjny-dokymenty-dlia-refinansirovaniia-v-sberbanke",
        "refinansirovanie-ipoteki-v-sberbanke-chto-nyjno-znat", "refinansirovanie-sberbank-vtb",
        "sberbank-otkazal-v-refinansirovanii-prichiny-kak-ispravit-sityaciu",
    ]),
    "/credit/stoit-li-ispolzovat-refinansirovanie-kredita.html": ("«Плюсы и минусы», «когда выгодно».", [
        "plusy-i-minysy-refinansirovaniia", "kogda-vygodno-oformliat-refinansirovanie-a-kogda-kreditnye-kanikyly",
    ]),
    "/credit/perekreditovanie-kredita-pod-menshii-procent.html": ("«Снизить процент».", [
        "kak-snizit-procent-po-kredity-v-2024-gody",
    ]),
    "/credit/na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-vtb.html": ("ВТБ.", [
        "kak-oformit-refinansirovanie-ipoteki-v-vtb",
    ]),
    "/credit/naskolko-vygodno-refinansirovanie-v-rosselhozbanke.html": ("Россельхозбанк.", [
        "poriadok-i-ysloviia-refinansirovaniia-ipoteki-v-rosselhozbanke",
    ]),
    "/kredity/tbank-refinansirovanie/": ("Т-Банк (Тинькофф): обзор оффера рефинансирования (до /stati/refinansirovanie-v-t-banke/).", [
        "kak-proishodit-refinansirovanie-kreditov-v-tinkoff-banke",
        "preimyshestva-refinansirovaniia-ipoteki-v-tinkoff-banke", "refinansirovanie-kreditnoi-karty-tinkoff",
    ]),
    "/kredity/alfa-refinansirovanie/": ("Альфа-Банк: обзор оффера рефинансирования (до /stati/refinansirovanie-v-alfa-banke/).", [
        "refinansirovanie-ipoteki-v-alfa-banke-v-2024-gody", "refinansirovanie-v-alfa-banke-ysloviia-i-poriadok-oformleniia",
    ]),
    "/stati/kak-ne-popast-v-dolgovuyu-yamu-s-mikrozajmami/": ("Рефинансирование микрозаймов (до /stati/refinansirovanie-mikrozajmov/).", [
        "kak-proizvesti-refinansirovanie-mikrozaimov-mfo",
    ]),
    "/stati/samozapret-na-kredity/": ("Самозапрет на кредиты.", [
        "grigorenko-grajdane-smogyt-samozapretit-oformlenie-kredita-cherez-gosyslygi",
    ]),
    "/zaimy/": ("Краткосрочные займы.", [
        "bystrye-kredity-kratkosrochnye-zajmy",
    ]),
    None: ("Нет тематической цели: банки без статей (Райффайзен, Росбанк, ПСБ, Газпромбанк, Возрождение), "
           "льготная ипотека без рефинансирования, ставка рефинансирования ЦБ, новости без темы, офтоп. "
           "301 на хаб/главную = soft-404 (SEO_PLAN §7.1).", [
        "kak-polychit-refinansirovanie-ipoteki-v-rosbanke", "kak-polychit-refinansirovanie-kreditov-v-raiffaizenbanke",
        "na-kakih-ysloviiah-mojno-polychit-refinansirovanie-v-gazprombanke",
        "procedyra-refinansirovaniia-ipoteki-v-raiffaizenbanke",
        "refinansirovanie-kreditov-drygih-bankov-v-rosbanke-ysloviia-i-procedyra",
        "refinansirovanie-kreditov-v-promsviazbanke-dlia-fizicheskih-lic",
        "ysloviia-refinansirovaniia-ipoteki-v-gazprombanke", "ysloviia-refinansirovaniia-v-banke-vozrojdenie",
        "popyliarnye-voprosy-o-lgotnyh-ipotechnyh-programmah", "popyliarnye-voprosy-o-programme-dalnevostochnaia-ipoteka",
        "razmer-stavki-refinansirovaniia-v-2024-gody", "stavka-refinansirovaniia-chto-eto",
        "brysnika-s-sovkombankom-pervoi-v-rossii-zapystila-ipoteky-so-snijennoi-stavkoi-849",
        "cb-ne-bydet-prodlevat-mery-podderjki-bankov-zavershaushih-deistvie-v-2024-gody",
        "cb-povysil-ojidaniia-po-rosty-potrebkreditovaniia-v-2024-gody-do-15-18",
        "docent-gorbynova-esli-bank-yrezal-vam-kreditnyi-limit-proverte-nalichie-dolga",
        "gosdyma-priniala-v-i-chtenii-zakonoproekt-o-periode-ohlajdeniia-po-potrebkreditam",
        "gosdyma-vo-ii-chtenii-razreshaet-cb-limitirovat-vydachy-ipoteki-i-avtokreditov-fizlicam",
        "nabiyllina-kreditnaia-aktivnost-v-pervye-nedeli-dekabria-ostavalas-sderjannoi",
        "naimenee-popyliarnoi-ipotechnoi-programmoi-v-2024-gody-stala-dalnevostochnaia-ipoteka",
        "nbki-dolia-zaemshikov-moloje-30-let-v-stryktyre-vydachi-potrebitelskih-kreditov-sokratilas",
        "nbki-kolichestvo-vydannyh-v-rossii-avtokreditov-v-oktiabre-sokratilos-na-35",
        "nbki-srednii-razmer-potrebkredita-v-sentiabre-snizilsia-do-160-tysiach-ryblei",
        "novak-moratorii-do-2028-goda-na-vyplaty-dividendov-rysgidro-obsyjdaetsia",
        "polyianova-mikropredpriiatiia-smogyt-brat-kredity-bez-ogranicheniia-na-plavaushyu-stavky",
        "pytin-podpisal-zakon-o-bessrochnom-mehanizme-zontichnyh-porychitelstv-dlia-msp",
        "pytin-porychil-vlastiam-otslejivat-dinamiky-korporativnogo-kreditovaniia-v-rossii",
        "pytin-prizval-obespechivat-rost-korporativnogo-kreditnogo-portfelia",
        "rbk-nachislennye-rossiianam-procenty-po-kreditam-prevysili-600-milliardov-ryblei",
        "ria-novosti-rossiiane-v-2024-g-chashe-vsego-brali-kredity-na-remont-i-pokypky-avto",
        "za-2024-god-nornikel-sokratil-chistyu-pribyl-po-rsby-na-57-do-123-mlrd-ryb",
        "metallicheskaya-setka-vidy-osobennosti-i-primenenie", "vidy-bankovskih-prodyktov",
    ]),
}


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

lost = [(s, t, why) for t, (why, slugs) in LOST.items() for s in slugs]
assert len(lost) == 101 and len({s for s, _, _ in lost}) == 101
known = {r["old_url"] for r in out}
for s, t, why in sorted(lost):
    u = f"https://rencredit-online.ru/credit/{s}.html"
    assert u not in known, u
    out.append(dict(old_url=u, type="post", title=None, words=None, http_status=404, in_sitemap=False,
                    decision="merge301" if t else "gone410", target=t, reason="Wayback 200, не было в REST. " + why,
                    priority=None))
# CRLF как в репозитории (файл создавался на Windows), чтобы запуск на macOS не давал diff на весь файл
(R / "map.json").write_bytes((json.dumps(out, ensure_ascii=False, indent=2) + "\n").replace("\n", "\r\n").encode("utf-8"))
print(len(out), dict(Counter(r["decision"] for r in out)), dict(Counter(r["target"] for r in out if r["type"] == "tag")))
