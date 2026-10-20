#!/usr/bin/env node
// Офлайн-проверка старых URL WordPress (rencredit-online.ru) без Apache.
// Для каждого URL из legacy/rencredit/map.json симулирует блок LEGACY 301 из .htaccess
// и проверяет, что итоговая страница существует в dist.
// Запуск: node web/scripts/check-legacy.mjs [--allow-missing-rewrite] [--dist <dir>] [--verbose]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const args = process.argv.slice(2);
const allowMissing = args.includes('--allow-missing-rewrite');
const verbose = args.includes('--verbose');
const di = args.indexOf('--dist');
const dist = resolve(di >= 0 ? args[di + 1] : join(repo, 'web/apps/rencredit/dist'));
const htaccess = join(repo, 'web/apps/rencredit/public/.htaccess');
const mapFile = join(repo, 'legacy/rencredit/map.json');

if (!existsSync(dist)) { console.error(`dist не найден: ${dist}. Соберите сайт: npm --prefix web/apps/rencredit run build`); process.exit(2); }

// ---------- парсинг блока LEGACY ----------
const txt = readFileSync(htaccess, 'utf8').replace(/\r\n/g, '\n');
const s = txt.indexOf('# BEGIN LEGACY 301'), e = txt.indexOf('# END LEGACY 301');
if (s < 0 || e < 0) { console.error('Нет маркеров LEGACY 301 в .htaccess'); process.exit(2); }
const rules = [];
let conds = [];
for (const raw of txt.slice(s, e).split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#') || line.startsWith('<')) continue;
  let m;
  if ((m = line.match(/^RewriteCond\s+%\{QUERY_STRING\}\s+(\S+)(?:\s+\[(.*)\])?$/))) {
    conds.push({ re: new RegExp(m[1], (m[2] || '').includes('NC') ? 'i' : '') });
    continue;
  }
  if ((m = line.match(/^RewriteRule\s+(\S+)\s+(\S+)(?:\s+\[(.*)\])?$/))) {
    const flags = (m[3] || '').split(',');
    rules.push({
      re: new RegExp(m[1], flags.includes('NC') ? 'i' : ''), src: m[1], to: m[2], conds,
      status: flags.includes('G') ? 410 : (flags.find(f => f.startsWith('R')) ? Number((flags.find(f => f.startsWith('R')).split('=')[1]) || 302) : 0),
    });
    conds = [];
    continue;
  }
  console.error(`Не понял строку в блоке LEGACY: ${line}`); process.exit(2);
}

// Первый совпавший терминальный ([L]) rule: { status, target } | null
function simulate(path, query) {
  for (const r of rules) {
    const m = path.match(r.re);
    if (!m) continue;
    if (!r.conds.every(c => c.re.test(query))) continue;
    if (r.status === 410) return { status: 410, rule: r };
    let t = r.to.replace('https://%{HTTP_HOST}', '').replace(/\$(\d)/g, (_, n) => m[n] ?? '');
    return { status: r.status, target: t, rule: r };
  }
  return null;
}

// ---------- существование страницы в dist ----------
const isFile = p => existsSync(p) && statSync(p).isFile();
function pageExists(urlPath) {
  const p = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (p === '') return isFile(join(dist, 'index.html'));
  if (isFile(join(dist, p))) return true;
  if (isFile(join(dist, p, 'index.html'))) return true;
  // внутренний rewrite блока 6: /credit/<slug>.html -> /credit/<slug>/index.html
  const m = p.match(/^credit\/([^/]+)\.html$/);
  return !!(m && (isFile(join(dist, 'credit', `${m[1]}.html`)) || isFile(join(dist, 'credit', m[1], 'index.html'))));
}

// ---------- проверка карты ----------
const map = JSON.parse(readFileSync(mapFile, 'utf8'));
const problems = [];
const rewritePaths = new Set(map.filter(x => x.decision === 'rewrite').map(x => new URL(x.old_url).pathname));
const stat = { rewrite: 0, rewriteMissing: 0, merge: 0, gone: 0, keep: 0 };
for (const x of map) {
  const u = new URL(x.old_url);
  const path = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  const query = u.search.replace(/^\?/, '');
  const sim = simulate(path, query);
  const add = (kind, note) => problems.push({ kind, url: x.old_url, note });

  if (x.decision === 'rewrite') {
    stat.rewrite++;
    if (sim) add('HIJACK', `rewrite-URL перехвачен правилом ${sim.rule.src} (${sim.status})`);
    if (!pageExists('/' + path)) { stat.rewriteMissing++; add('MISSING', `нет dist/${path.replace(/\.html$/, '')}/index.html`); }
  } else if (x.decision === 'keep') {
    stat.keep++;
    if (sim) add('HIJACK', `keep-URL перехвачен правилом ${sim.rule.src}`);
    if (!pageExists(x.target || '/')) add('TARGET', 'нет dist/index.html');
  } else if (x.decision === 'merge301') {
    stat.merge++;
    if (!sim) { add('NO_RULE', 'ни одно правило LEGACY не совпало'); continue; }
    if (sim.status !== 301) { add('STATUS', `ожидался 301, получен ${sim.status}`); continue; }
    const [tp, tq = ''] = sim.target.split('?');
    if (sim.target !== x.target && tp !== x.target) add('TARGET_MISMATCH', `map: ${x.target}, правило: ${sim.target}`);
    if (!pageExists(tp)) {
      // цель — ещё не написанная rewrite-статья: это ожидание, а не ошибка карты
      if (rewritePaths.has(tp)) add('MISSING', `цель ${tp} (rewrite-статья) ещё не собрана`);
      else add('TARGET', `цель ${tp} отсутствует в dist`);
    }
    const chain = simulate(decodeURIComponent(tp).replace(/^\/+/, ''), tq);
    if (chain) add('CHAIN', `цель ${tp} снова редиректится (${chain.status})`);
    if (verbose) console.log(`301 ${x.old_url} -> ${sim.target}`);
  } else if (x.decision === 'gone410') {
    stat.gone++;
    if (!sim || sim.status !== 410) add('STATUS', `ожидался 410, получено ${sim ? sim.status : 'нет правила'}`);
    if (pageExists('/' + path)) add('HIJACK', `410 на существующую страницу dist/${path}`);
  } else add('UNKNOWN', `decision=${x.decision}`);
}

// Проверка 410 на служебных путях WordPress
for (const [p, q] of [['wp-json/wp/v2/posts', ''], ['wp-admin/', ''], ['wp-login.php', ''], ['xmlrpc.php', ''],
  ['wp-content/uploads/a.jpg', ''], ['wp-includes/js/x.js', ''], ['tag/banki/feed/', ''], ['sitemap_index.xml', ''], ['post-sitemap.xml', ''], ['', 'feed=rss2']]) {
  const r = simulate(p, q);
  const want = /sitemap/.test(p) ? 301 : (p === '' ? 301 : 410);
  if (!r || r.status !== want) problems.push({ kind: 'SERVICE', url: `/${p}${q ? '?' + q : ''}`, note: `ожидался ${want}, получено ${r ? r.status : 'нет правила'}` });
  else if (want === 301 && !pageExists(r.target)) problems.push({ kind: 'TARGET', url: `/${p}`, note: `цель ${r.target} отсутствует` });
}

// Варианты, которые отдавал WP: ?p=/?page_id= по ID, поиск, лишний слэш у .html, index.php -> одна 301 на цель
for (const [p, q, want] of [['', 'p=40625', '/credit/refinansirovanie-kredita-chto-eto-znachit.html?'],
  ['', 'p=40573', '/novosti/?'], ['', 'page_id=3', '/politika-konfidencialnosti/?'], ['', 'p=5', '/?'], ['', 's=kredit', '/?'],
  ['', 'author=1', '/?'], ['', 'utm_source=x', null], ['index.php', 'p=40625', '/credit/refinansirovanie-kredita-chto-eto-znachit.html?'],
  ['index.php', '', '/'], ['credit/refinansirovanie-kredita-chto-eto-znachit.html/', '', '/credit/refinansirovanie-kredita-chto-eto-znachit.html'],
  ['credit/zoloto-desheveet-pered-pyblikaciei-reshenii-frs-ssha.html/', '', '/novosti/'], ['sitemap.html/', '', '/'], ['tag/banki/', '', '/kredity/']]) {
  const r = simulate(p, q);
  const got = r ? `${r.status} ${r.target}` : 'нет правила';
  const ok = want === null ? !r : (r && r.status === 301 && r.target === want);
  if (!ok) problems.push({ kind: 'VARIANT', url: `/${p}${q ? '?' + q : ''}`, note: `ожидалось ${want === null ? 'без правила' : '301 ' + want}, получено ${got}` });
  else if (r && !pageExists(r.target.replace(/\?$/, ''))) problems.push({ kind: 'TARGET', url: `/${p}?${q}`, note: `цель ${r.target} отсутствует` });
  else if (r && simulate(r.target.replace(/^\/|\?$/g, ''), '')) problems.push({ kind: 'CHAIN', url: `/${p}?${q}`, note: `цель ${r.target} снова редиректится` });
}

// ---------- отчёт ----------
const missing = problems.filter(p => p.kind === 'MISSING');
const hard = problems.filter(p => !(allowMissing && p.kind === 'MISSING'));
console.log(`Правил в блоке LEGACY: ${rules.length}; URL в map.json: ${map.length}`);
console.log(`rewrite: ${stat.rewrite} (нет в dist: ${stat.rewriteMissing}), merge301: ${stat.merge}, gone410: ${stat.gone}, keep: ${stat.keep}`);
if (problems.length) {
  console.log('\nПроблемы:');
  const w = Math.max(...problems.map(p => p.kind.length));
  for (const p of problems) {
    if (allowMissing && p.kind === 'MISSING' && !verbose) continue;
    console.log(`  ${p.kind.padEnd(w)}  ${p.url}  ${p.note}`);
  }
  if (allowMissing && missing.length && !verbose) console.log(`  (MISSING для rewrite скрыты: ${missing.length}; --verbose покажет)`);
}
console.log(hard.length ? `\nFAIL: ${hard.length} проблем(ы)` : `\nOK: все merge301 резолвятся${missing.length ? `, rewrite ожидают статьи: ${missing.length}` : ''}`);
process.exit(hard.length ? 1 : 0);
