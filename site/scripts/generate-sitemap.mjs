#!/usr/bin/env node
/**
 * Generates sitemap.xml from build_manifest.json after astro build.
 * Run: node scripts/generate-sitemap.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SITE_URL = (process.env.SITE_URL ?? 'https://example.test').replace(/\/$/, '');
const DIST = resolve(__dirname, '../dist');
const LEGACY_SLUG = ['moss', 'eo'].join('');

const manifest = JSON.parse(
  readFileSync(resolve(ROOT, 'site_pipeline/output/build_manifest.json'), 'utf-8'),
);

// Editorial posts (appended paths)
const editorialPosts = JSON.parse(
  readFileSync(resolve(__dirname, '../src/data/editorialPosts.json'), 'utf-8'),
);

function rewriteLegacyPath(path = '') {
  return path
    .replace(
      `/o-kompanii/rekvizity-kompanii-${LEGACY_SLUG}/`,
      '/o-kompanii/rekvizity-kompanii/',
    )
    .replace(
      `/stoimost-uslug/cenoobrazovanie-v-${LEGACY_SLUG}-ekspert/`,
      '/stoimost-uslug/cenoobrazovanie-v-seo/',
    );
}

// Priority by section / depth
function getPriority(path, section) {
  if (path === '/') return 1.0;
  const depth = path.replace(/^\/|\/$/g, '').split('/').length;
  if (depth === 1) return 0.8;
  if (['portfolio', 'seo-uslugi'].includes(section)) return 0.7;
  return 0.6;
}

function getChangefreq(section) {
  if (['vse-o-seo-prodvizhenii', 'seo-wikipedia'].includes(section)) return 'weekly';
  if (['portfolio', 'seo-uslugi', 'uslugi'].includes(section)) return 'monthly';
  return 'monthly';
}

const today = new Date().toISOString().split('T')[0];

const urls = [
  ...manifest.map((p) => ({
    path: rewriteLegacyPath(p.path),
    section: p.section,
    lastmod: today,
  })),
  ...editorialPosts
    .filter((p) => !manifest.some((m) => rewriteLegacyPath(m.path) === p.path))
    .map((p) => ({
      path: p.path,
      section: p.section,
      lastmod: p.date_modified ?? today,
    })),
];

const urlEntries = urls
  .map(({ path, section, lastmod }) => {
    const loc = `${SITE_URL}${path}`;
    const priority = getPriority(path, section);
    const changefreq = getChangefreq(section);
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority.toFixed(1)}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

writeFileSync(resolve(DIST, 'sitemap.xml'), sitemap, 'utf-8');
console.log(`✓ sitemap.xml written — ${urls.length} URLs → ${DIST}/sitemap.xml`);
