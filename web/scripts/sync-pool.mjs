// Копирует sites/affiliate_pool.json в packages/core/src/data/pool.json,
// оставляя только нужные поля. Копия лежит внутри workspace — Vite на Windows
// не упирается в server.fs.allow. Запуск: node web/scripts/sync-pool.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../sites/affiliate_pool.json');
const dst = resolve(here, '../packages/core/src/data/pool.json');
const pool = JSON.parse(readFileSync(src, 'utf-8'));
const out = pool.map(({ id, label, href, network, vertical, payout, status, enabled }) => ({
  id, label, href: href ?? '', network, vertical, payout: payout ?? '', status, enabled,
}));
mkdirSync(dirname(dst), { recursive: true });
writeFileSync(dst, JSON.stringify(out, null, 2) + '\n', 'utf-8');
console.log(`pool: ${out.length} записей -> ${dst}`);
