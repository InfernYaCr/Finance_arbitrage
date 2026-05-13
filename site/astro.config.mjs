import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL ?? 'https://example.test',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    server: {
      watch: {
        // Exclude exported content dirs from file-watching to prevent OOM
        ignored: ['**/sites/*/pages/**', '**/registry/**'],
      },
    },
  },
});
