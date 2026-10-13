import type { APIRoute } from 'astro';
import { getOffers } from '../lib/offers';
import { getArticles, getGuides } from '../lib/content';

export const GET: APIRoute = async () => {
  const [offers, articles, guides] = await Promise.all([getOffers(), getArticles(), getGuides()]);
  const items = [
    ...guides.map((g) => ({ t: g.data.title, u: `/${g.id}/`, k: 'Подборка' })),
    ...offers.map((o) => ({ t: o.name, u: `/mfo/${o.slug}/`, k: 'Обзор' })),
    ...articles.map((a) => ({ t: a.data.title, u: `/stati/${a.id}/`, k: 'Статья' })),
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
