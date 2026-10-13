// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { readdirSync, existsSync, renameSync, rmdirSync } from 'node:fs';
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

export default defineConfig({
  // Пилот: тестовый поддомен с noindex, потом — боевой домен.
  site: (env.SITE_URL || 'https://rencredit-online.ru').replace(/\/+$/, ''),
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    legacyHtmlFiles(),
    sitemap({
      filter: (p) => !p.includes('/go/'),
      // Переписанные старые статьи собираются как /credit/<slug>/, но живут (и каноничны)
      // на старом адресе /credit/<slug>.html — в карту сайта кладём именно его.
      serialize: (item) => ({ ...item, url: item.url.replace(/\/credit\/([^/]+)\/$/, '/credit/$1.html') }),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
