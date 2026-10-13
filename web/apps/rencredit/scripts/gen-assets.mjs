// Одноразовая генерация статичных картинок бренда в public/ (результат коммитится).
// Запуск: node scripts/gen-assets.mjs  (из web/apps/rencredit). Нужен sharp (есть в зависимостях Astro).
// Шрифт — системный Arial (на Windows есть): текст рендерится librsvg из sharp.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const NAME = 'ФинКомпас';
const TAGLINE = 'Подбор займов, карт и кредитов онлайн';
const SUB = 'Сравниваем условия МФО и банков — без обещаний «одобрим всем»';

// Знак бренда (как в LogoMark.astro / favicon.svg) в виде вложенного <g>.
const mark = (size, x = 0, y = 0) => `
  <g transform="translate(${x} ${y}) scale(${size / 40})">
    <rect width="40" height="40" rx="12" fill="#0d2c26"/>
    <circle cx="20" cy="20" r="11" fill="none" stroke="#2fb99a" stroke-width="2"/>
    <path d="M20 8.5l4 11.5-4 11.5-4-11.5z" fill="#ffb800" transform="rotate(35 20 20)"/>
    <circle cx="20" cy="20" r="2.2" fill="#0d2c26"/>
  </g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d2c26"/>
  <circle cx="1010" cy="315" r="300" fill="none" stroke="#12392f" stroke-width="60"/>
  <circle cx="1010" cy="315" r="190" fill="none" stroke="#1a4d40" stroke-width="3"/>
  <g transform="translate(1010 315) rotate(35)"><path d="M0 -150l60 150-60 150-60-150z" fill="#ffb800"/><circle r="14" fill="#0d2c26"/></g>
  ${mark(120, 80, 90)}
  <text x="80" y="330" font-family="Arial, Helvetica, sans-serif" font-size="108" font-weight="700" fill="#ffffff">${NAME}</text>
  <rect x="80" y="362" width="150" height="10" rx="5" fill="#ffb800"/>
  <text x="80" y="440" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#d6eee6">${TAGLINE}</text>
  <text x="80" y="498" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#9fc9bd">${SUB}</text>
  <text x="80" y="570" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#2fb99a">rencredit-online.ru</text>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(join(PUBLIC, 'og', 'default.png'));

// Иконки: знак на скруглённой плашке; apple-touch — без скругления (iOS скругляет сам).
const icon = (size, { round }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
  ${round ? '' : '<rect width="40" height="40" fill="#0d2c26"/>'}
  <g>${mark(40).replace(/<g[^>]*>/, '<g>')}</g>
</svg>`;
const png = (size, opts) => sharp(Buffer.from(icon(size, opts))).png().toBuffer();

writeFileSync(join(PUBLIC, 'apple-touch-icon.png'), await png(180, { round: false }));
writeFileSync(join(PUBLIC, 'icon-192.png'), await png(192, { round: false }));
writeFileSync(join(PUBLIC, 'icon-512.png'), await png(512, { round: false }));

// favicon.ico: контейнер ICO с PNG внутри (16, 32, 48 px) — поддерживается всеми современными браузерами.
const sizes = [16, 32, 48];
const imgs = await Promise.all(sizes.map((s) => png(s, { round: true })));
const head = Buffer.alloc(6);
head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
let offset = 6 + 16 * imgs.length;
const dir = imgs.map((b, i) => {
  const e = Buffer.alloc(16);
  e[0] = sizes[i]; e[1] = sizes[i]; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(b.length, 8); e.writeUInt32LE(offset, 12);
  offset += b.length;
  return e;
});
writeFileSync(join(PUBLIC, 'favicon.ico'), Buffer.concat([head, ...dir, ...imgs]));
console.log('ok');
