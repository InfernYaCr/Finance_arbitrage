import type { APIRoute } from 'astro';
import { ENV } from '../lib/ui/site';

// Метки рекламы и счётчиков: Яндекс склеивает URL с ними в один (Clean-param понимает только Яндекс).
const CLEAN_PARAM = 'utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&_openstat&from&erid';

// robots.txt генерируется при сборке: на тестовом поддомене (PUBLIC_NOINDEX=true) закрываем всё.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site ?? 'https://rencredit-online.ru').href;
  const body = ENV.noindex
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /go/\n\nUser-agent: Yandex\nDisallow: /go/\nClean-param: ${CLEAN_PARAM}\n\nSitemap: ${sitemap}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
