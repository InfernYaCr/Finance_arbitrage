import type { FullPage, SeoFields, PageType } from '../data/types';
import { siteConfig } from '../data/siteConfig';
import { buildBreadcrumbs } from './routing';
import { replaceLegacyBrand, stripBrandSuffix } from './brand';

export function deriveSeoFields(page: FullPage, pageType: PageType): SeoFields {
  const seed = page.data.seed;
  const meta = page.data.meta;
  const wp = page.data.wp;

  // Title: seed CSV > HTML meta > wp_title > page manifest title
  const rawTitle =
    seed.title ||
    meta.html_title ||
    page.data.wp_title ||
    page.title ||
    '';

  const title = stripBrandSuffix(rawTitle) || siteConfig.siteName;
  const fullTitle = title === siteConfig.siteName
    ? siteConfig.siteNameFull
    : `${title} — ${siteConfig.siteName}`;

  // Description
  const description = replaceLegacyBrand(
    seed.meta_description ||
    meta.html_meta_description ||
    page.description ||
    '',
  );

  // H1: seed CSV h1 > wp_title > title (templates control display)
  const h1 = replaceLegacyBrand(seed.h1 || page.data.wp_title || title);

  // Canonical: always use our domain + original path
  const canonical = siteConfig.siteUrl.replace(/\/$/, '') + page.path;

  const isArticle = ['article', 'faq', 'portfolio_case', 'service', 'dictionary_article', 'company'].includes(pageType);

  const extracted = page.data.extracted;
  const datePublished = wp?.date
    ? wp.date.split('T')[0]
    : (extracted?.date_published || undefined);
  const dateModified = wp?.modified
    ? wp.modified.split('T')[0]
    : (extracted?.date_modified || extracted?.date_published || undefined);

  const breadcrumbs = page.path === '/'
    ? [{ label: 'Главная', path: '/' }]
    : buildBreadcrumbs(page.path, h1 || title);

  return {
    title: fullTitle,
    description,
    h1,
    canonical,
    ogTitle: fullTitle,
    ogDescription: description,
    ogType: isArticle ? 'article' : 'website',
    datePublished,
    dateModified,
    breadcrumbs,
  };
}
