#!/usr/bin/env node
/**
 * Generates sitemap.xml from build_manifest.json after astro build.
 * Run: node scripts/generate-sitemap.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SITE_ROOT = resolve(__dirname, '..');

// This runs as a plain `node` process after `astro build` in the npm script
// chain — it does NOT get Vite's automatic .env loading, so site/.env must
// be parsed manually here (same pattern as generate-mail-php.mjs) or every
// site built via CONTENT_OUTPUT_DIR silently falls back to the wrong dataset
// and domain.
function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const envPath = resolve(SITE_ROOT, '.env');
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };

const SITE_URL = (env.SITE_URL || 'https://example.test').replace(/\/$/, '');
const DIST = resolve(__dirname, '../dist');
const LEGACY_SLUG = ['moss', 'eo'].join('');
const DATA_ROOT = env.CONTENT_OUTPUT_DIR
  ? resolve(ROOT, 'site', env.CONTENT_OUTPUT_DIR)
  : resolve(ROOT, 'site_pipeline/output');
const ENABLE_EDITORIAL_POSTS = env.ENABLE_EDITORIAL_POSTS
  ? env.ENABLE_EDITORIAL_POSTS === 'true'
  : !env.CONTENT_OUTPUT_DIR;

const manifest = JSON.parse(
  readFileSync(resolve(DATA_ROOT, 'build_manifest.json'), 'utf-8'),
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
  ...(ENABLE_EDITORIAL_POSTS ? editorialPosts : [])
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
