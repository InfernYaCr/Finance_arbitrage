// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { readdirSync, readFileSync, existsSync, renameSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Переписанные старые статьи живут по адресам /credit/<slug>.html.
 * Astro собирает их как credit/<slug>/index.html — после сборки превращаем в настоящий файл
 * credit/<slug>.html, чтобы адрес работал на любом хостинге и в `astro preview` без .htaccess.
 */
const legacyHtmlFiles = () => ({
  name: 'legacy-html-files',
  hooks: {
    /** @param {{ dir: URL }} opts */
    'astro:build:done': ({ dir }) => {
      const credit = join(fileURLToPath(dir), 'credit');
      if (!existsSync(credit)) return;
      for (const slug of readdirSync(credit)) {
        const index = join(credit, slug, 'index.html');
        if (!existsSync(index)) continue;
        renameSync(index, join(credit, `${slug}.html`));
        rmdirSync(join(credit, slug));
      }
    },
  },
});

// SITE_URL берём из окружения или из .env (PUBLIC_* Vite подхватывает сам).
const env = { ...loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), ''), ...process.env };

// Боевая сборка (без PUBLIC_NOINDEX) без реквизитов оператора: футер и политика выйдут без них.
if (process.argv.includes('build') && env.PUBLIC_NOINDEX?.trim() !== 'true') {
  const missing = ['PUBLIC_LEGAL_OWNER', 'PUBLIC_LEGAL_INN', 'PUBLIC_CONTACT_EMAIL'].filter((k) => !env[k]?.trim());
  if (missing.length) console.warn(`\n[rencredit] ВНИМАНИЕ: прод-сборка без ${missing.join(', ')} — футер и политика конфиденциальности выйдут без оператора/контакта (152-ФЗ).\n`);
}

// Посадочные некредитных разделов без предложений собираются с noindex (ServiceLanding) — в sitemap их не кладём.
const svcDir = './src/content/services';
const svcData = existsSync(svcDir)
  ? readdirSync(svcDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(svcDir, f), 'utf-8')))
  : [];
const filledSvcPages = new Set([...svcData.map((s) => s.category), ...(svcData.some((s) => s.kind === 'insurance') ? ['strahovanie'] : [])]);
const SVC_PAGE_RE = /^\/(strahovanie|osago|kasko|strahovanie-ipoteki|strahovanie-puteshestvennikov|strahovanie-kvartiry|debetovye-karty|vklady|rko)\/$/;
/** @param {string} p */
const isEmptySvcPage = (p) => { const m = new URL(p).pathname.match(SVC_PAGE_RE); return !!m && !filledSvcPages.has(m[1]); };

// Подборки, где офферов с признаком меньше 3, собираются с noindex (getGuideOffers в lib/content.ts) — в sitemap их не кладём.
const offerData = readdirSync('./src/content/offers').filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join('./src/content/offers', f), 'utf-8')));
const thinGuides = new Set(readdirSync('./src/content/guides').filter((f) => /\.mdx?$/.test(f)).flatMap((f) => {
  const fm = readFileSync(join('./src/content/guides', f), 'utf-8');
  const field = (k) => fm.match(new RegExp(`^${k}:\\s*"?(\\w+)`, 'm'))?.[1];
  const kind = field('kind') ?? 'mfo';
  const feature = field('feature');
  const verifiedOnly = /^verifiedOnly:\s*true/m.test(fm);
  const n = offerData.filter((o) => o.kind === kind && (!feature || o.features.includes(feature))
    && (!verifiedOnly || (o.verified && o.pskMin != null && o.pskMax != null))).length;
  return n < 3 ? [`/${f.replace(/\.mdx?$/, '')}/`] : [];
}));

// lastmod в sitemap: updatedDate ?? publishDate статей (/stati/, /credit/*.html) и новостей; витрины без lastmod.
/** @param {string} dir @param {(id: string, fm: string) => string} urlOf */
const contentDates = (dir, urlOf) => readdirSync(dir).filter((f) => /\.mdx?$/.test(f)).map((f) => {
  const fm = readFileSync(join(dir, f), 'utf-8').split(/^---\r?$/m)[1] ?? '';
  const field = (k) => fm.match(new RegExp(`^${k}:\\s*["']?([^"'\\s]+)`, 'm'))?.[1];
  const date = field('updatedDate') ?? field('publishDate');
  return [urlOf(f.replace(/\.mdx?$/, ''), fm), date && new Date(date).toISOString()];
});
const lastmod = new Map([
  ...contentDates('./src/content/articles', (id, fm) => {
    const legacy = fm.match(/^legacyUrl:\s*["']?https?:\/\/[^/]+(\/credit\/[^"'\s]+\.html)/m)?.[1];
    return legacy ?? `/stati/${id}/`;
  }),
  ...contentDates('./src/content/news', (id) => `/novosti/${id}/`),
]);

export default defineConfig({
  // Пилот: тестовый поддомен с noindex, потом — боевой домен.
  site: (env.SITE_URL || 'https://rencredit-online.ru').replace(/\/+$/, ''),
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    legacyHtmlFiles(),
    sitemap({
      filter: (p) => !p.includes('/go/') && !isEmptySvcPage(p) && !thinGuides.has(new URL(p).pathname),
      // Переписанные старые статьи собираются как /credit/<slug>/, но живут (и каноничны)
      // на старом адресе /credit/<slug>.html — в карту сайта кладём именно его.
      serialize: (item) => {
        const url = item.url.replace(/\/credit\/([^/]+)\/$/, '/credit/$1.html');
        const date = lastmod.get(new URL(url).pathname);
        return { ...item, url, ...(date && { lastmod: date }) };
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
