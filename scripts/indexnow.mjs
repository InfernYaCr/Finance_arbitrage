// Оповещение Яндекс/Bing об изменённых URL через IndexNow (по образцу raft-site-astro).
// Запуск вручную или из CI после деплоя; не встроен в сборку (сетевой сбой не должен её ронять).
//
//   node scripts/indexnow.mjs                      весь сайт из web/apps/rencredit/dist
//   node scripts/indexnow.mjs /articles/foo /news/bar   только конкретные URL
//
// Настройка через переменные окружения:
//   INDEXNOW_SITE   например https://rencredit-online.ru (без слеша на конце)
//   INDEXNOW_KEY    ключ (строка 8-128 символов a-zA-Z0-9-)
//   INDEXNOW_DIST   путь к dist (по умолчанию web/apps/rencredit/dist)
// Файл ключа <KEY>.txt (внутри только ключ) должен лежать в корне сайта: web/apps/rencredit/public/<KEY>.txt.
// Без INDEXNOW_SITE/INDEXNOW_KEY скрипт сообщает об этом и выходит с кодом 0 (в CI это не ошибка).

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, sep, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = (process.env.INDEXNOW_SITE || '').replace(/\/$/, '');
const KEY = process.env.INDEXNOW_KEY || '';
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://yandex.com/indexnow';
const DIST_DIR = resolve(process.env.INDEXNOW_DIST || fileURLToPath(new URL('../web/apps/rencredit/dist', import.meta.url)));

if (!SITE || !KEY) {
  console.log('[indexnow] INDEXNOW_SITE/INDEXNOW_KEY не заданы: пропускаю.');
  process.exit(0);
}

const HOST = new URL(SITE).host;
const KEY_LOCATION = `${SITE}/${KEY}.txt`;

// Не предлагаем поисковикам: служебные страницы и редиректы /go/.
const EXCLUDED = (path) => path === '/404' || path.startsWith('/go/') || path === '/go';

async function collectUrlsFromDist() {
  if (!existsSync(DIST_DIR)) {
    console.error(`[indexnow] ${DIST_DIR} не найден: сначала соберите сайт.`);
    process.exit(1);
  }
  const urls = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (entry.name !== 'index.html') continue;
      const routeDir = relative(DIST_DIR, full).slice(0, -'index.html'.length).split(sep).join('/');
      const path = routeDir === '' ? '/' : `/${routeDir.replace(/\/$/, '')}`;
      if (EXCLUDED(path)) continue;
      urls.push(path === '/' ? `${SITE}/` : `${SITE}${path}/`);
    }
  }
  await walk(DIST_DIR);
  return urls;
}

const normalize = (args) => args.map((a) => (a.startsWith('http') ? a : `${SITE}${a.startsWith('/') ? a : `/${a}`}`));

const args = process.argv.slice(2);
const urlList = args.length ? normalize(args) : await collectUrlsFromDist();

if (!urlList.length) {
  console.error('[indexnow] Список URL пуст.');
  process.exit(1);
}

console.log(`[indexnow] Отправка ${urlList.length} URL (${HOST})...`);

// IndexNow принимает до 10000 URL за запрос.
for (let i = 0; i < urlList.length; i += 10000) {
  const chunk = urlList.slice(i, i + 10000);
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: chunk }),
  });
  if (response.ok || response.status === 202) {
    console.log(`[indexnow] Готово: ${response.status} ${response.statusText}.`);
  } else {
    console.error(`[indexnow] Ошибка: ${response.status} ${response.statusText}`);
    console.error(await response.text().catch(() => ''));
    process.exit(1);
  }
}
