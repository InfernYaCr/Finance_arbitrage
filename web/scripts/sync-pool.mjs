// Копирует sites/affiliate_pool.json в packages/core/src/data/pool.json,
// оставляя только нужные поля. Копия лежит внутри workspace — Vite на Windows
// не упирается в server.fs.allow. Запуск: node web/scripts/sync-pool.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../sites/affiliate_pool.json');
const dst = resolve(here, '../packages/core/src/data/pool.json');
// Жёсткий режим (docs/seo-rencredit/SEO_PLAN.md §2.3): офферы группы «Ренессанс» на сайт не попадают никогда,
// иначе для них соберётся /go/<id>/. Мастер-реестр sites/affiliate_pool.json не трогаем.
const BANNED_RX = /ренессанс|rencredit|ренкредит|renaissance/i;
const pool = JSON.parse(readFileSync(src, 'utf-8')).filter((o) => !BANNED_RX.test(o.label ?? ''));
const out = pool.map(({ id, label, href, network, vertical, payout, status, enabled }) => ({
  id, label, href: href ?? '', network, vertical, payout: payout ?? '', status, enabled,
}));
mkdirSync(dirname(dst), { recursive: true });
writeFileSync(dst, JSON.stringify(out, null, 2) + '\n', 'utf-8');
console.log(`pool: ${out.length} записей -> ${dst}`);
