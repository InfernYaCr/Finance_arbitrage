import type { FullPage, SeoFields, PageType } from '../data/types';
import { siteConfig } from '../data/siteConfig';

const ORG = {
  '@type': 'Organization',
  name: siteConfig.company.name,
  url: siteConfig.company.url,
  foundingDate: siteConfig.company.foundingYear,
};

function breadcrumbList(crumbs: SeoFields['breadcrumbs'], siteUrl: string) {
  if (crumbs.length <= 1) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: siteUrl.replace(/\/$/, '') + c.path,
    })),
  };
}

export function buildJsonLd(
  page: FullPage,
  seo: SeoFields,
  pageType: PageType,
): object[] {
  const siteUrl = siteConfig.siteUrl.replace(/\/$/, '');
  const graph: object[] = [];

  // Organization + WebSite always on home
  if (pageType === 'home') {
    graph.push({
      '@type': 'WebSite',
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
    });
    graph.push(ORG);
    return graph;
  }

  // Breadcrumbs for non-root pages
  const bc = breadcrumbList(seo.breadcrumbs, siteUrl);
  if (bc) graph.push(bc);

  const webPageBase = {
    name: seo.title,
    description: seo.description || undefined,
    url: seo.canonical,
    inLanguage: 'ru',
    isPartOf: { '@type': 'WebSite', url: siteConfig.siteUrl },
  };

  if (pageType === 'contact') {
    graph.push({
      '@type': 'ContactPage',
      ...webPageBase,
      publisher: ORG,
    });
    graph.push(ORG);
    return graph;
  }

  if (pageType === 'article' || pageType === 'faq' || pageType === 'company') {
    graph.push({
      '@type': pageType === 'faq' ? 'Article' : 'Article',
      headline: seo.h1 || seo.title,
      description: seo.description || undefined,
      mainEntityOfPage: seo.canonical,
      ...(seo.datePublished ? { datePublished: seo.datePublished } : {}),
      ...(seo.dateModified ? { dateModified: seo.dateModified } : {}),
      publisher: ORG,
      inLanguage: 'ru',
    });
    return graph;
  }

  if (pageType === 'dictionary_article') {
    graph.push({
      '@type': 'Article',
      headline: seo.h1 || seo.title,
      description: seo.description || undefined,
      mainEntityOfPage: seo.canonical,
      ...(seo.datePublished ? { datePublished: seo.datePublished } : {}),
      ...(seo.dateModified ? { dateModified: seo.dateModified } : {}),
      publisher: ORG,
      inLanguage: 'ru',
      about: { '@type': 'DefinedTerm', name: seo.h1 || seo.title },
    });
    return graph;
  }

  if (pageType === 'service') {
    graph.push({
      '@type': 'Service',
      name: seo.h1 || seo.title,
      description: seo.description || undefined,
      url: seo.canonical,
      provider: ORG,
    });
    return graph;
  }

  if (pageType === 'portfolio_case') {
    graph.push({
      '@type': 'CreativeWork',
      name: seo.h1 || seo.title,
      description: seo.description || undefined,
      url: seo.canonical,
      creator: ORG,
      ...(seo.datePublished ? { dateCreated: seo.datePublished } : {}),
    });
    return graph;
  }

  if (pageType === 'archive' || pageType === 'portfolio_archive' || pageType === 'dictionary_archive') {
    graph.push({
      '@type': 'CollectionPage',
      ...webPageBase,
    });
    return graph;
  }

  // content_page fallback
  graph.push({ '@type': 'WebPage', ...webPageBase });
  return graph;
}
