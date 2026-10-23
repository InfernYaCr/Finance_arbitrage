// Оповещение Яндекса (и через обмен Bing, Seznam и др.) о новых и изменённых URL через IndexNow.
// Вызывается из scripts/deploy-beget.sh после успешной заливки; в сборку не встроен (сетевой сбой не должен её ронять).
//
//   node scripts/indexnow.mjs             новые/изменённые URL из dist/sitemap-0.xml
//   node scripts/indexnow.mjs --all       весь sitemap, без учёта состояния
//   node scripts/indexnow.mjs --dry-run   только показать список и решение guard, без сети и без записи состояния
//
// URL берутся из sitemap (канонические адреса, с /credit/*.html, без /go/ и noindex-посадочных).
// Guard: в dist/robots.txt есть «Disallow: /» (тестовая сборка) или origin sitemap ≠ INDEXNOW_SITE → пропуск.
// Изменённость: sha1 HTML без путей /_astro/ (правка CSS/JS не трогает все страницы).
// Состояние {url: sha1} — web/.indexnow-state.json (вне dist: сборка его стирает; в .gitignore).
// Ключ: INDEXNOW_KEY или файл dist/<key>.txt, в котором записан сам ключ (из public/).
// Ответ 200 — состояние сохраняется; 202 — ключ ещё на проверке, состояние НЕ сохраняется (повтор при следующем деплое).
//
// Окружение: INDEXNOW_SITE (по умолчанию https://rencredit-online.ru), INDEXNOW_KEY, INDEXNOW_DIST, INDEXNOW_ENDPOINT.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const ALL = args.has('--all');

const SITE = (process.env.INDEXNOW_SITE || 'https://rencredit-online.ru').replace(/\/+$/, '');
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://yandex.com/indexnow';
const DIST = resolve(process.env.INDEXNOW_DIST || fileURLToPath(new URL('../web/apps/rencredit/dist', import.meta.url)));
const STATE = fileURLToPath(new URL('../web/.indexnow-state.json', import.meta.url));
const log = (m) => console.log(`[indexnow] ${m}`);

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

const sitemap = read(join(DIST, 'sitemap-0.xml'));
if (!sitemap) {
  console.error(`[indexnow] нет ${join(DIST, 'sitemap-0.xml')}: сначала соберите сайт.`);
  process.exit(1);
}
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

// --- guard: отправляем только боевую индексируемую сборку ---
const robots = read(join(DIST, 'robots.txt')) ?? '';
const origins = new Set(urls.map((u) => new URL(u).origin));
let skip = '';
if (/^Disallow:\s*\/\s*$/m.test(robots)) skip = 'в dist/robots.txt «Disallow: /» (тестовая сборка)';
else if (origins.size !== 1 || !origins.has(new URL(SITE).origin)) skip = `origin sitemap ${[...origins].join(', ') || '—'} ≠ ${SITE}`;
if (skip) {
  log(`пропуск: ${skip}.`);
  process.exit(0);
}

// --- ключ ---
const KEY = process.env.INDEXNOW_KEY
  || readdirSync(DIST).filter((f) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(f)).find((f) => readFileSync(join(DIST, f), 'utf8').trim() === f.slice(0, -4))?.slice(0, -4);
if (!KEY) {
  console.error('[indexnow] нет ключа: задайте INDEXNOW_KEY или положите web/apps/rencredit/public/<key>.txt.');
  process.exit(1);
}

// --- что изменилось ---
/** URL → файл в dist: / → index.html, /x/ → x/index.html, *.html как есть. */
const fileOf = (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return join(DIST, p.endsWith('/') ? `${p}index.html` : p);
};
const hashOf = (u) => {
  const html = read(fileOf(u));
  return html === null ? null : createHash('sha1').update(html.replace(/\/_astro\/[^"' )]+/g, '')).digest('hex');
};
const prev = ALL ? {} : JSON.parse(read(STATE) ?? '{}');
const next = Object.fromEntries(urls.map((u) => [u, hashOf(u)]));
const missing = urls.filter((u) => next[u] === null);
if (missing.length) log(`нет файла в dist для ${missing.length} URL (не отправляю): ${missing.join(', ')}`);
const changed = urls.filter((u) => next[u] !== null && prev[u] !== next[u]);
const removed = Object.keys(prev).filter((u) => !(u in next));
if (removed.length) log(`ушли из sitemap (не отправляю, на сервере файлы остаются): ${removed.join(', ')}`);

log(`${changed.length} из ${urls.length} URL новые или изменённые${ALL ? ' (--all)' : ''}; ключ ${KEY}.txt`);
if (DRY) {
  for (const u of changed) console.log(`  ${u}`);
  log('--dry-run: в IndexNow ничего не отправлено, состояние не записано.');
  process.exit(0);
}
if (!changed.length) process.exit(0);

// --- отправка (до 10 000 URL за запрос) ---
const host = new URL(SITE).host;
let pending = false;
for (let i = 0; i < changed.length; i += 10000) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: changed.slice(i, i + 10000) }),
  });
  if (res.status === 202) {
    pending = true;
    log('202: ключ ещё на проверке у Яндекса — состояние не сохраняю, URL уйдут повторно при следующем деплое.');
  } else if (res.status !== 200) {
    console.error(`[indexnow] ошибка ${res.status} ${res.statusText}: ${await res.text().catch(() => '')}`);
    process.exit(1);
  }
}
if (!pending) {
  writeFileSync(STATE, `${JSON.stringify({ ...prev, ...Object.fromEntries(changed.map((u) => [u, next[u]])) }, null, 1)}\n`);
  log(`200: отправлено ${changed.length} URL, состояние → web/.indexnow-state.json`);
}
