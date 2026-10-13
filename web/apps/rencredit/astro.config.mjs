// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Пилот: тестовый поддомен с noindex, потом — боевой домен.
  site: process.env.SITE_URL ?? 'https://rencredit-online.ru',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [mdx(), sitemap({ filter: (p) => !p.includes('/go/') })],
  vite: { plugins: [tailwindcss()] },
});
