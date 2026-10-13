// Проверка контента перед сборкой. Запуск: node web/scripts/check-content.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '../apps/rencredit');
const pool = JSON.parse(readFileSync(resolve(here, '../packages/core/src/data/pool.json'), 'utf-8'));
const poolById = new Map(pool.map((o) => [o.id, o]));

const errors = [];
const warns = [];
const err = (m) => errors.push(m);

// 1. Офферы
const offersDir = join(app, 'src/content/offers');
const files = readdirSync(offersDir).filter((f) => f.endsWith('.json'));
const slugs = new Set();
const poolUsed = new Map();
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err(`${f}: slug должен быть латиницей kebab-case`);
  if (slugs.has(slug)) err(`${f}: дубль slug`);
  slugs.add(slug);
  const o = JSON.parse(readFileSync(join(offersDir, f), 'utf-8'));
  const p = poolById.get(o.poolId);
  if (!p) err(`${f}: poolId ${o.poolId} нет в пуле`);
  else {
    if (!p.enabled) err(`${f}: оффер ${o.poolId} в пуле выключен (enabled=false)`);
    if (!p.href) err(`${f}: у оффера ${o.poolId} нет href`);
    if (p.vertical !== o.kind && !(o.kind === 'credit' && p.vertical === 'credit')) {
      err(`${f}: kind=${o.kind}, а vertical в пуле=${p.vertical}`);
    }
  }
  if (poolUsed.has(o.poolId)) err(`${f}: poolId ${o.poolId} уже использован в ${poolUsed.get(o.poolId)}`);
  poolUsed.set(o.poolId, f);
  if (o.verified !== false) err(`${f}: verified должен быть false до ручной сверки`);
  if (o.rateDayPct > 0.8) err(`${f}: ставка > 0.8%/день`);
  if (o.pskMax != null && o.pskMax > 292) err(`${f}: ПСК > 292`);
  if (o.amountMin > o.amountMax) err(`${f}: amountMin > amountMax`);
  if (o.termMinDays > o.termMaxDays) err(`${f}: termMin > termMax`);
  if (o.ageMin > o.ageMax) err(`${f}: ageMin > ageMax`);
  if (o.logo && !existsSync(join(app, 'public', o.logo))) err(`${f}: нет файла логотипа ${o.logo}`);
  if (o.rating != null || o.reviewsCount != null) warns.push(`${f}: rating/reviewsCount заполнены — убедитесь, что это не выдуманные отзывы`);
}

// 2. Тексты: чужие партнёрки и внешние ссылки
const PARTNER_RE = /saleads|admitad|leads\.su|leadgid|actionpay|cpa\.|utm_|aff_|click\.|clickid/i;
const ALLOWED_HOSTS = ['cbr.ru', 'www.cbr.ru', 'consultant.ru', 'www.consultant.ru', 'garant.ru', 'pravo.gov.ru',
  'publication.pravo.gov.ru', 'gosuslugi.ru', 'www.gosuslugi.ru', 'fedresurs.ru', 'interfax.ru', 'www.interfax.ru',
  'banki.ru', 'www.banki.ru', 'rencredit-online.ru', 'duma.gov.ru', 'government.ru', 'kremlin.ru', 'minfin.gov.ru', 'xn--90aivcdt6dxbc.xn--p1ai'];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
}
const contentDir = join(app, 'src/content');
const counts = {};
for (const file of walk(contentDir)) {
  const ext = extname(file);
  if (!['.md', '.mdx', '.json'].includes(ext)) continue;
  const rel = file.slice(contentDir.length + 1).replace(/\\/g, '/');
  const sect = rel.split('/')[0];
  counts[sect] = (counts[sect] ?? 0) + 1;
  const text = readFileSync(file, 'utf-8');
  if (sect !== 'offers') {
    if (PARTNER_RE.test(text)) err(`${rel}: похоже на партнёрскую ссылку/метку`);
    for (const m of text.matchAll(/https?:\/\/([^\s/)"'\]>]+)/g)) {
      if (!ALLOWED_HOSTS.includes(m[1].toLowerCase())) err(`${rel}: внешняя ссылка на ${m[1]} (нет в allowlist)`);
    }
    if (/100\s*%\s*(одобрен|гарант)/i.test(text)) err(`${rel}: обещание 100% одобрения`);
    if (/(Ренессанс|Renaissance)/i.test(text)) err(`${rel}: упоминание «Ренессанс Кредит»`);
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) err(`${rel}: нет frontmatter`);
    else if (/^verified:/m.test(fm[1])) err(`${rel}: лишнее поле verified`);
  }
}

console.log('Контент:', counts, `| офферов в пуле использовано: ${poolUsed.size}`);
for (const w of warns) console.warn('WARN', w);
if (errors.length) {
  for (const e of errors) console.error('ERROR', e);
  process.exit(1);
}
console.log('check-content: OK');
