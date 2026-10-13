// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// SITE_URL берём из окружения или из .env (PUBLIC_* Vite подхватывает сам).
const env = { ...loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), ''), ...process.env };

export default defineConfig({
  // Пилот: тестовый поддомен с noindex, потом — боевой домен.
  site: (env.SITE_URL || 'https://rencredit-online.ru').replace(/\/+$/, ''),
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    sitemap({
      filter: (p) => !p.includes('/go/'),
      // Переписанные старые статьи собираются как /credit/<slug>/, но живут (и каноничны)
      // на старом адресе /credit/<slug>.html — в карту сайта кладём именно его.
      serialize: (item) => ({ ...item, url: item.url.replace(/\/credit\/([^/]+)\/$/, '/credit/$1.html') }),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
