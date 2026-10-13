import type { APIRoute } from 'astro';
import { getOffers } from '../lib/offers';
import { getArticles, getGuides, articleHref } from '../lib/content';
import { SERVICE_LINKS } from '../lib/services';

export const GET: APIRoute = async () => {
  const [offers, articles, guides] = await Promise.all([getOffers(), getArticles(), getGuides()]);
  const items = [
    ...guides.map((g) => ({ t: g.data.title, u: `/${g.id}/`, k: 'Подборка' })),
    ...[{ label: 'Страхование', href: '/strahovanie/' }, ...SERVICE_LINKS].map((l) => ({ t: l.label, u: l.href, k: 'Раздел' })),
    ...offers.map((o) => ({ t: o.name, u: `/mfo/${o.slug}/`, k: 'Обзор' })),
    ...articles.map((a) => ({ t: a.data.title, u: articleHref(a), k: 'Статья' })),
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
