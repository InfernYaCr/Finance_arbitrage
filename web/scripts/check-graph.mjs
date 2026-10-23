// Ссылочный граф собранного сайта (SEO-18): контентные входящие = ссылки из <main> других страниц
// (шапка и футер не считаются), по одной на пару страниц. Запуск:
//   node web/scripts/check-graph.mjs [путь-к-dist] [--all]   (--all — вывести входящие всех страниц)
// Ошибка (exit 1): индексируемая страница с ≤2 контентными входящими или обзор, у которого входящих
// больше чем в 3 раза выше медианы своего раздела (/mfo/, /karty/, /kredity/).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_IN = 3;
const MAX_RATIO = 3;
/** Не требуют контентных входящих: главная и служебные страницы, на которые ведёт футер. */
const SKIP = new Set(['/', '/politika-konfidencialnosti/']);
const args = process.argv.slice(2);
const DIST = resolve(args.find((a) => !a.startsWith('--')) ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'rencredit', 'dist'));
if (!existsSync(DIST)) { console.error(`dist не найден: ${DIST}`); process.exit(1); }

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

/** URL ссылки -> ключ страницы: /a/b/ или /credit/<slug>.html (как путь файла в dist). */
function key(url) {
  const p = decodeURIComponent(url.split(/[?#]/)[0]);
  return p.endsWith('/') || /\.\w+$/.test(p) ? p : `${p}/`;
}

const pages = new Map(); // ключ -> множество ключей, на которые страница ссылается из <main>
for (const f of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const page = '/' + f.slice(DIST.length + 1).replaceAll('\\', '/').replace(/index\.html$/, '');
  if (page.startsWith('/go/') || page === '/404.html') continue;
  const html = readFileSync(f, 'utf8');
  if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) continue;
  if (/http-equiv=["']refresh["']/i.test(html) && html.length < 1200) continue;
  const main = html.slice(html.indexOf('<main'), html.lastIndexOf('</main>'));
  const out = new Set();
  for (const m of main.matchAll(/\shref=["'](\/[^"'\s]*)["']/g)) {
    if (m[1].startsWith('//') || m[1].startsWith('/go/')) continue;
    const k = key(m[1]);
    if (k !== page) out.add(k);
  }
  pages.set(page, out);
}

const inbound = new Map([...pages.keys()].map((k) => [k, 0]));
for (const out of pages.values()) for (const k of out) if (inbound.has(k)) inbound.set(k, inbound.get(k) + 1);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const all = [...inbound.values()];
console.log(`Индексируемых страниц: ${inbound.size}, контентных входящих: медиана ${median(all)}, min ${Math.min(...all)}, max ${Math.max(...all)}`);

let failed = false;
const weak = [...inbound].filter(([k, n]) => n < MIN_IN && !SKIP.has(k)).sort((a, b) => a[1] - b[1]);
if (weak.length) {
  failed = true;
  console.error(`Страниц с ≤${MIN_IN - 1} контентными входящими: ${weak.length}`);
  for (const [k, n] of weak) console.error(`  ${n}  ${k}`);
}

for (const dir of ['mfo', 'karty', 'kredity']) {
  const rx = new RegExp(`^/${dir}/[^/]+/$`);
  const rows = [...inbound].filter(([k]) => rx.test(k)).sort((a, b) => b[1] - a[1]);
  if (!rows.length) continue;
  const med = median(rows.map(([, n]) => n));
  const [top, max] = rows[0];
  const ratio = med ? max / med : Infinity;
  const line = `/${dir}/*: ${rows.length} обзоров, входящих min ${rows.at(-1)[1]} / медиана ${med} / max ${max} (${top}), max/медиана ${ratio.toFixed(2)}`;
  if (ratio > MAX_RATIO) { failed = true; console.error(`${line} > ${MAX_RATIO}`); } else console.log(line);
}

if (args.includes('--all')) for (const [k, n] of [...inbound].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) console.log(`${String(n).padStart(4)}  ${k}`);
if (failed) process.exit(1);
console.log('Граф ссылок в норме');
