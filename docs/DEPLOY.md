# Выкладка на Beget (rencredit-online.ru)

Сайт статический: после сборки вся выкладка — это содержимое `web/apps/rencredit/dist/`, залитое в корень домена
(`public_html` или папка домена в панели Beget). Хостинг: Apache за nginx, правила лежат в `.htaccess`
(он уже в `dist/`, исходник — `web/apps/rencredit/public/.htaccess`).

Переменные окружения сборки описаны в `web/apps/rencredit/.env.example`.

## 0. Что нужно знать заранее

- Перед боевой выкладкой владелец заполняет: `PUBLIC_CONTACT_EMAIL`, реквизиты (`PUBLIC_LEGAL_*`), `PUBLIC_METRIKA_ID`,
  коды подтверждения Вебмастера/GSC. Пустое значение = блок на сайте не выводится (ничего не выдумываем).
- `.htaccess` скрытый (начинается с точки). В FTP-клиенте включите «показывать скрытые файлы», в файловом менеджере
  Beget — «показывать скрытые файлы», иначе он не зальётся и редиректы/кэш/404 не заработают.
- Старые статьи WordPress вида `/credit/<slug>.html`, которые переписаны (в frontmatter есть `legacyUrl`), отдаются
  по тому же адресу БЕЗ редиректа. Остальные старые URL получают 301 из блока `# BEGIN LEGACY 301` в `.htaccess`
  (его заполняют отдельно, перед боевой выкладкой).

## 1. Бэкап WordPress

1. Панель Beget -> Сайты -> нужный сайт -> «Бэкапы»: создать/скачать копию файлов.
2. Панель Beget -> MySQL -> дамп БД сайта (экспорт через phpMyAdmin или кнопка бэкапа). Скачать себе.
3. Убедиться, что архив открывается и размер адекватный. Без бэкапа дальше не идти.

## 2. Убрать старые файлы WordPress

Лучше всего перенести их ВНЕ публичной директории (например, в `~/_wp_backup` рядом с `public_html`).
Если рядом место создать нельзя — папка `public_html/_wp_backup`, но тогда закройте её (ниже), иначе WP-файлы
(включая `wp-config.php` с паролями БД) останутся доступны из интернета.

1. Создать каталог `_wp_backup` вне `public_html`.
2. Перенести туда всё содержимое `public_html` (wp-admin, wp-content, wp-includes, wp-*.php, старый `.htaccess` и т.д.).
3. Если пришлось оставить внутри `public_html/_wp_backup` — положить в неё файл `.htaccess` с одной строкой
   `Require all denied`.
4. `public_html` должен остаться пустым.

## 3. Сборка

Из корня репозитория, один раз `npm --prefix web install`.

Боевая сборка, bash (Git Bash / Linux / macOS):

```bash
SITE_URL=https://rencredit-online.ru \
PUBLIC_METRIKA_ID=12345678 \
PUBLIC_YANDEX_VERIFICATION=xxxxxxxxxxxxxxxx \
PUBLIC_GOOGLE_VERIFICATION=xxxxxxxxxxxxxxxx \
PUBLIC_CONTACT_EMAIL=you@example.com \
PUBLIC_LEGAL_OWNER="ИП Иванов И. И." PUBLIC_LEGAL_INN=0000000000 PUBLIC_LEGAL_OGRN=000000000000000 \
npm --prefix web/apps/rencredit run build
```

Боевая сборка, PowerShell:

```powershell
$env:SITE_URL = "https://rencredit-online.ru"
$env:PUBLIC_METRIKA_ID = "12345678"
$env:PUBLIC_YANDEX_VERIFICATION = "xxxxxxxxxxxxxxxx"
$env:PUBLIC_GOOGLE_VERIFICATION = "xxxxxxxxxxxxxxxx"
$env:PUBLIC_CONTACT_EMAIL = "you@example.com"
$env:PUBLIC_LEGAL_OWNER = "ИП Иванов И. И."; $env:PUBLIC_LEGAL_INN = "0000000000"; $env:PUBLIC_LEGAL_OGRN = "000000000000000"
npm --prefix web/apps/rencredit run build
```

Вместо переменных в консоли можно положить файл `web/apps/rencredit/.env` (в git не попадает) по образцу `.env.example`.
На боевой сборке `PUBLIC_NOINDEX` должен быть пустым (не `true`).

Проверки перед заливкой:

```bash
node scripts/check.mjs --dist-only
node web/scripts/check-links.mjs
```

В `web/apps/rencredit/dist/` должны быть: `index.html`, `404.html`, `.htaccess`, `robots.txt`, `sitemap-index.xml`,
`favicon.ico`, `og/default.png`. В `robots.txt` — `Disallow: /go/` и строка `Sitemap:`, без `Disallow: /`.

## 4. Заливка

1. Подключиться по FTP (FileZilla и т.п.) или открыть файловый менеджер Beget. Включить показ скрытых файлов.
2. Залить СОДЕРЖИМОЕ `dist/` (не саму папку `dist`) в корень домена: чтобы `index.html` и `.htaccess` лежали прямо в
   `public_html`.
3. Убедиться, что `.htaccess` на сервере есть и его размер совпадает с локальным.
4. Если Beget отдаёт старую версию — сбросить кэш: панель -> сайт -> «Очистить кэш» (если опция есть).

## 5. Проверки после выкладки

В браузере открыть: `/`, `/zaimy/`, `/zaimy-bez-otkaza/`, `/stati/`, одну статью, `/mfo/<любой>/`, `/novosti/`,
`/o-proekte/`, `/politika-konfidencialnosti/`, `/robots.txt`, `/sitemap-index.xml`, `/несуществующая-страница` (должна быть
наша 404, код 404). Прокликать кнопку «Получить деньги»: ведёт через `/go/...` на оффер.

Заголовки и редиректы (bash или PowerShell с `curl.exe`):

```bash
curl -sI http://rencredit-online.ru/zaimy/          # 301 -> https://rencredit-online.ru/zaimy/ (один хоп)
curl -sI https://www.rencredit-online.ru/zaimy/     # 301 -> https://rencredit-online.ru/zaimy/ (один хоп)
curl -sI https://rencredit-online.ru/zaimy          # 301 -> /zaimy/ (добавление слэша)
curl -sI https://rencredit-online.ru/zaimy/         # 200, Cache-Control: ... max-age=300
curl -sI https://rencredit-online.ru/credit/<slug>.html   # 200 (без редиректа), если статья переписана
curl -sI https://rencredit-online.ru/<старый-url-из-LEGACY-301>   # 301 на новый адрес
curl -sI https://rencredit-online.ru/net-takoj/     # 404
curl -sI https://rencredit-online.ru/_astro/<файл>.css   # 200, Cache-Control: ... immutable
curl -sI -H "Accept-Encoding: br, gzip" https://rencredit-online.ru/   # Content-Encoding: br или gzip
```

В ответах также должны быть `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy: strict-origin-when-cross-origin`.

Если схема http/https определяется неверно (бесконечный редирект) — на Beget перед Apache стоит nginx и `%{HTTPS}` не
передаётся; в `.htaccess` для этого уже учтён `X-Forwarded-Proto`. При зацикливании временно закомментируйте блок 4b и
напишите разработчику.

Метрика: после выкладки открыть сайт, в Метрике -> «Проверить код счётчика». Вебвизор в коде выключен намеренно.

## 6. Вебмастер и поисковики

1. Яндекс Вебмастер: добавить сайт `https://rencredit-online.ru` (если коды подтверждения вставлены переменными — метатег
   уже на всех страницах), «Индексирование» -> «Файлы Sitemap» -> добавить `https://rencredit-online.ru/sitemap-index.xml`.
2. «Переобход страниц»: отправить главную, `/zaimy/`, ключевые посадочные, переписанные `/credit/<slug>.html`.
3. «Индексирование» -> «Переезд сайта»/«Диагностика»: следить за разделом ошибок, 404 и «страницы не найдены».
4. Google Search Console: добавить ресурс, отправить `sitemap-index.xml`, инспекция URL главной.
5. IndexNow (по желанию): `node scripts/indexnow.mjs`.
6. Через 1–2 недели: проверить, что старые URL отдают 301 на новые, а в выдаче нет 404 по прежним адресам.

## 7. Откат

Заменить содержимое `public_html` обратно из `_wp_backup` (с бэкапом БД, если она менялась) и удалить новый `.htaccess`.

---

## Вариант: тестовый поддомен с noindex

Для обкатки без риска для основного домена и индексации.

1. Панель Beget -> Домены/Поддомены -> создать `test.rencredit-online.ru`, привязать к отдельной папке
   (например, `test.rencredit-online.ru/public_html`). Включить SSL (Let's Encrypt) для поддомена.
2. Сборка с noindex и своим адресом:

```bash
SITE_URL=https://test.rencredit-online.ru PUBLIC_NOINDEX=true npm --prefix web/apps/rencredit run build
```

```powershell
$env:SITE_URL = "https://test.rencredit-online.ru"; $env:PUBLIC_NOINDEX = "true"
npm --prefix web/apps/rencredit run build
```

   При `PUBLIC_NOINDEX=true` на всех страницах стоит `<meta name="robots" content="noindex, nofollow">`, а `robots.txt`
   содержит только `User-agent: *` / `Disallow: /` (без Sitemap).
3. Залить содержимое `dist/` (с `.htaccess`) в папку поддомена.
4. Проверить `curl -s https://test.rencredit-online.ru/robots.txt` и заголовок `<meta name="robots">` на нескольких страницах.
   Метрику и коды подтверждения на тестовом поддомене не задавайте.
5. Для боевого домена обязательно пересобрать БЕЗ `PUBLIC_NOINDEX` и с `SITE_URL=https://rencredit-online.ru`: иначе canonical
   и sitemap будут указывать на тестовый адрес. Помните, что у переписанных статей canonical берётся из `legacyUrl`
   (боевой домен) независимо от `SITE_URL`.
6. Для дополнительной защиты от индексации можно закрыть поддомен паролем (Beget: «Защита паролем» для директории).
