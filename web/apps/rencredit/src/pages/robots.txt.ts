import type { APIRoute } from 'astro';
import { ENV } from '../lib/ui/site';

// robots.txt генерируется при сборке: на тестовом поддомене (PUBLIC_NOINDEX=true) закрываем всё.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site ?? 'https://rencredit-online.ru').href;
  const body = ENV.noindex
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /go/\n\nSitemap: ${sitemap}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
