import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadAllPages } from '../data/loadPages';
import { siteConfig } from '../data/siteConfig';

// Sections that produce article-like content across niches
const ARTICLE_SECTIONS = new Set([
  'qa', 'faq', 'blog', 'news', 'article',
  'vse-o-seo-prodvizhenii', 'seo-wikipedia',
  'online-credit', 'banks', 'terms',
]);

export function GET(context: APIContext) {
  const today = new Date();

  const items = loadAllPages()
    .filter((p) => ARTICLE_SECTIONS.has(p.section) && p.description)
    .sort((a, b) => {
      const da = a.data.wp?.date ? new Date(a.data.wp.date).getTime() : 0;
      const db = b.data.wp?.date ? new Date(b.data.wp.date).getTime() : 0;
      return db - da;
    })
    .slice(0, 30)
    .map((p) => ({
      title: p.h1 || p.title,
      description: p.description ?? undefined,
      link: p.path,
      pubDate: p.data.wp?.date ? new Date(p.data.wp.date) : today,
    }));

  return rss({
    title: siteConfig.siteName,
    description: siteConfig.siteDescription,
    site: context.site?.toString() ?? siteConfig.siteUrl,
    items,
    customData: '<language>ru</language>',
  });
}
