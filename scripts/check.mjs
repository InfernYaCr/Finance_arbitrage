#!/usr/bin/env node
// Проверки проекта. Использование:
//   node scripts/check.mjs --quick   лёгкие проверки исходников web/ (Stop-хук, секунды)
//   node scripts/check.mjs --dist-only  как полный, но без сборки (проверяет готовый dist)
//   node scripts/check.mjs           полный режим: quick + astro build + проверка dist
// Горизонтальный скролл/CLS/скриншоты здесь НЕ проверяются: это работа агента page-reviewer (Playwright).
// Если web/ ещё не собран или пуст, скрипт молчит и выходит с кодом 0.
// Как Stop-хук: при ошибках пишет в stderr и выходит с кодом 2 (Claude продолжит и исправит);
// при stop_hook_active=true (повторный заход) только предупреждает, чтобы не зациклиться.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB = join(ROOT, 'web');
const APP = join(WEB, 'apps', 'rencredit');
const SRC = join(APP, 'src');
const DIST = join(APP, 'dist');
const POOL = join(ROOT, 'sites', 'affiliate_pool.json');

const args = new Set(process.argv.slice(2));
const QUICK = args.has('--quick');
const DIST_ONLY = args.has('--dist-only'); // полный режим без пересборки: проверить уже существующий dist

// Из хука (флаг --hook) stdin содержит JSON. Без флага stdin не читаем:
// в не-TTY окружениях (агенты, CI) он может не закрыться, и чтение зависнет.
let hookInput = null;
if (args.has('--hook')) {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    if (raw) hookInput = JSON.parse(raw);
  } catch {
    hookInput = null;
  }
}
const AS_HOOK = hookInput !== null && typeof hookInput === 'object';
const REENTRY = AS_HOOK && hookInput.stop_hook_active === true;

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// Латиница без учёта регистра; кириллический бренд регистрозависимо, чтобы не ловить фразу «все займы онлайн».
const DONOR_RX = /vsezaimyonline|delen\.ru/i;
const DONOR_RX_CASE = /ВсеЗаймыОнлайн|Все Займы Онлайн|ВСЕЗАЙМЫОНЛАЙН/;
const BRAND_RX = /Ренессанс|Renaissance\s+Credit/gi;
const DISCLAIMER_RX = /не\s+является|не\s+связан|товарн\w+\s+знак|не\s+аффилирован|не\s+представляет|не\s+имеет\s+отношения/i;

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.astro') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (!exts || exts.includes(extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Бренд банка допустим только рядом с дисклеймером; в content/ (статьи) это предупреждение, не ошибка. */
function checkBrand(file, text, strict) {
  BRAND_RX.lastIndex = 0;
  let m;
  while ((m = BRAND_RX.exec(text))) {
    const ctx = text.slice(Math.max(0, m.index - 250), m.index + 250);
    if (DISCLAIMER_RX.test(ctx)) continue;
    const msg = `${rel(file)}:${lineOf(text, m.index)} «${m[0]}» вне дисклеймера (бренд банка нельзя использовать как бренд сайта)`;
    strict ? err(msg) : warn(msg);
  }
}

function checkDonor(file, text) {
  const m = DONOR_RX.exec(text) || DONOR_RX_CASE.exec(text);
  if (m) err(`${rel(file)}:${lineOf(text, m.index)} донорский бренд/ссылка «${m[0]}»`);
}

/** Каждая ссылка на /go/ обязана иметь rel с sponsored. */
function checkGoLinks(file, text) {
  const tagRx = /<a\b[^>]*>/gs;
  let m;
  while ((m = tagRx.exec(text))) {
    const tag = m[0];
    if (!/\/go\//.test(tag)) continue;
    if (!/rel\s*=\s*["'{][^"'}]*sponsored/i.test(tag) && !/\bsponsored\b/i.test(tag)) {
      err(`${rel(file)}:${lineOf(text, m.index)} ссылка на /go/ без rel="sponsored nofollow"`);
    }
  }
}

function checkJsonFiles() {
  const dirs = [join(SRC, 'content'), join(WEB, 'packages', 'core', 'src', 'data')];
  const files = dirs.flatMap((d) => walk(d, ['.json']));
  let pool = null;
  if (existsSync(POOL)) {
    try {
      const raw = JSON.parse(readFileSync(POOL, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.links || raw.items || raw.offers || [];
      pool = new Set(list.map((x) => x.id));
    } catch (e) {
      warn(`sites/affiliate_pool.json не читается: ${e.message}`);
    }
  }
  const unverified = [];
  for (const f of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(f, 'utf8'));
    } catch (e) {
      err(`${rel(f)} невалидный JSON: ${e.message}`);
      continue;
    }
    if (rel(f).includes('/content/offers/') && data && data.poolId) {
      if (!/^saleads-[0-9a-f]{8}$/.test(data.poolId)) err(`${rel(f)} poolId «${data.poolId}» не по формату saleads-xxxxxxxx`);
      else if (pool && pool.size > 0 && !pool.has(data.poolId)) err(`${rel(f)} poolId «${data.poolId}» нет в sites/affiliate_pool.json`);
      if (data.verified !== true) unverified.push(data.poolId);
    }
  }
  if (unverified.length) warn(`офферов с verified != true: ${unverified.length} (условия не сверены с кабинетом Saleads; на витрине не подавать как проверенные)`);
}

function checkSources() {
  const files = walk(SRC, ['.astro', '.mdx', '.md', '.ts', '.tsx', '.js', '.mjs', '.json', '.css']);
  const publicFiles = walk(join(APP, 'public'), ['.html', '.txt', '.xml', '.json', '.svg']);
  for (const f of [...files, ...publicFiles]) {
    const text = readFileSync(f, 'utf8');
    checkDonor(f, text);
    const isContent = rel(f).includes('/src/content/');
    // service-sources: служебные данные проверки фактов, на сайт не попадают (бренды партнёров в notes допустимы)
    if (!rel(f).includes('/src/data/service-sources/')) checkBrand(f, text, !isContent);
    if (/\.(astro|mdx|md|tsx)$/.test(f)) checkGoLinks(f, text);
  }
  checkJsonFiles();
}

function runBuild() {
  const r = spawnSync('npm', ['--prefix', 'web', 'run', 'build'], { cwd: ROOT, shell: true, encoding: 'utf8' });
  if (r.status !== 0) {
    const tail = `${r.stdout || ''}\n${r.stderr || ''}`.trim().split('\n').slice(-25).join('\n');
    err(`astro build завершился с кодом ${r.status}:\n${tail}`);
    return false;
  }
  return true;
}

function attr(html, rx) {
  const m = html.match(rx);
  return m ? m[1].trim() : '';
}

function checkDist() {
  if (!existsSync(DIST)) {
    err('web/apps/rencredit/dist не найден после сборки');
    return;
  }
  const htmls = walk(DIST, ['.html']);
  let pages = 0;
  for (const f of htmls) {
    const html = readFileSync(f, 'utf8');
    const r = '/' + relative(DIST, f).split(sep).join('/');
    checkDonor(f, html);
    checkBrand(f, html, false);
    checkGoLinks(f, html);
    const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
    if (r.startsWith('/go/')) {
      if (!noindex) err(`${rel(f)} страница /go/ без meta robots noindex`);
      continue;
    }
    if (/\/404\.html$/.test(r) || noindex) continue;
    // Страницы-редиректы Astro (meta refresh) не считаем контентными.
    if (/http-equiv=["']refresh["']/i.test(html) && html.length < 1200) continue;
    pages++;
    if (!attr(html, /<title[^>]*>([^<]+)<\/title>/i)) err(`${rel(f)} нет <title>`);
    if (!attr(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)) err(`${rel(f)} нет meta description`);
    if (!attr(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)) err(`${rel(f)} нет link canonical`);
    if (!/<h1[\s>]/i.test(html)) warn(`${rel(f)} нет <h1>`);
  }
  const sm = join(DIST, 'sitemap-index.xml');
  const sm0 = join(DIST, 'sitemap-0.xml');
  if (!existsSync(sm) && !existsSync(sm0) && !existsSync(join(DIST, 'sitemap.xml'))) warn('в dist нет sitemap');
  if (existsSync(sm0) && /\/go\//.test(readFileSync(sm0, 'utf8'))) err('в sitemap попали /go/ ссылки');
  if (!existsSync(join(DIST, 'robots.txt'))) warn('в dist нет robots.txt');
  if (pages === 0) warn('в dist нет индексируемых страниц');
}

// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(SRC)) return; // web/ ещё не создан: молча выходим

  if (QUICK) {
    // В quick-режиме работаем только если есть изменения в web/ (git status), иначе молчим.
    const g = spawnSync('git', ['status', '--porcelain', '--', 'web'], { cwd: ROOT, encoding: 'utf8' });
    if (g.status === 0 && !g.stdout.trim()) return;
  }

  checkSources();

  if (!QUICK) {
    if (DIST_ONLY || runBuild()) checkDist();
  }
}

try {
  main();
} catch (e) {
  warn(`check.mjs упал: ${e.stack || e}`);
}

if (warns.length) console.error(`Предупреждения (${warns.length}):\n- ${warns.join('\n- ')}`);
if (errors.length) {
  console.error(`ОШИБКИ (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(AS_HOOK && !REENTRY ? 2 : AS_HOOK ? 0 : 1);
}
if (!QUICK) console.log(`check: OK${warns.length ? ` (предупреждений: ${warns.length})` : ''}`);
process.exit(0);
