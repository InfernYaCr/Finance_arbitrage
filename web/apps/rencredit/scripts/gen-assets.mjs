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

const NAME = 'Мерка';
const TAGLINE = 'Займы, карты и кредиты — по вашей мерке'; // держать в синхроне с SITE.tagline
const SUB = 'Сравниваем МФО и банки — сами не выдаём и не обещаем';

// Знак «Мерка» (те же координаты, что в LogoMark.astro и favicon.svg).
const mark = (size, x = 0, y = 0) => `
  <g transform="translate(${x} ${y}) scale(${size / 40})">
    <rect width="40" height="40" rx="11" fill="#0d2c26"/>
    <rect x="6" y="9" width="21" height="15" rx="3.5" transform="rotate(-14 16.5 16.5)" fill="#2fb99a"/>
    <rect x="12" y="15.5" width="22" height="16" rx="3.5" fill="#ffb800"/>
    <path d="M17.2 24.2l3.3 3.3 6.5-7.2" fill="none" stroke="#0d2c26" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d2c26"/>
  <g transform="translate(960 330) rotate(-12)"><rect x="-200" y="-125" width="400" height="250" rx="30" fill="#1a4d40"/></g>
  <g transform="translate(1020 360) rotate(6)"><rect x="-200" y="-125" width="400" height="250" rx="30" fill="#ffb800"/><rect x="-200" y="-85" width="400" height="44" fill="#0d2c26" opacity=".85"/><path d="M-70 55l40 40 80-90" fill="none" stroke="#0d2c26" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/></g>
  ${mark(96, 80, 80)}
  <text x="198" y="152" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${NAME}</text>
  <text x="80" y="350" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="700" fill="#ffffff">Займы, карты и кредиты —</text>
  <text x="80" y="412" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="700" fill="#ffb800">по вашей мерке</text>
  <text x="80" y="486" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#9fc9bd">${SUB}</text>
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
