// Проверка внутренних ссылок собранного сайта: каждый href/src="/..." из dist/**/*.html
// должен указывать на существующий файл. Запуск: node web/scripts/check-links.mjs [путь-к-dist]
// Правила резолва повторяют .htaccess: /dir/ -> dir/index.html; /credit/<slug>.html -> credit/<slug>/index.html.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'rencredit', 'dist'));
if (!existsSync(DIST)) { console.error(`dist не найден: ${DIST}`); process.exit(1); }

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(DIST);
const htmls = files.filter((f) => f.endsWith('.html'));

function exists(path) {
  const rel = decodeURIComponent(path).replace(/^\/+/, '');
  const abs = join(DIST, rel);
  if (rel === '' || rel.endsWith('/')) return existsSync(join(abs, 'index.html'));
  if (existsSync(abs) && statSync(abs).isFile()) return true;
  const legacy = rel.match(/^credit\/([^/]+)\.html$/);
  if (legacy && (existsSync(join(DIST, 'credit', `${legacy[1]}.html`)) || existsSync(join(DIST, 'credit', legacy[1], 'index.html')))) return true;
  return false;
}

const bad = new Map();
let total = 0;
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  const page = '/' + f.slice(DIST.length + 1).replaceAll('\\', '/');
  for (const m of html.matchAll(/\s(?:href|src)=["'](\/[^"'\s]*)["']/g)) {
    const url = m[1];
    if (url.startsWith('//')) continue;
    total++;
    const path = url.split(/[?#]/)[0];
    if (!exists(path)) {
      if (!bad.has(url)) bad.set(url, []);
      bad.get(url).push(page);
    }
  }
}
console.log(`Проверено ссылок: ${total}, страниц: ${htmls.length}`);
if (bad.size) {
  for (const [url, pages] of bad) console.error(`НЕТ ФАЙЛА ${url}  <- ${pages.slice(0, 3).join(', ')}${pages.length > 3 ? ` (+${pages.length - 3})` : ''}`);
  console.error(`Битых ссылок: ${bad.size}`);
  process.exit(1);
}
console.log('Битых внутренних ссылок нет');
