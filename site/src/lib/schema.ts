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

function textOnly(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function faqPage(page: FullPage): object | null {
  const pairs = page.data.extracted?.faq_pairs?.filter((pair) => (
    (pair.question?.trim() || pair.q?.trim()) && (pair.answer?.trim() || pair.a?.trim())
  ));
  if (!pairs?.length) return null;

  return {
    '@type': 'FAQPage',
    mainEntity: pairs.map((pair) => {
      const question = pair.question || pair.q || '';
      const answer = pair.answer || pair.a || '';
      return {
        '@type': 'Question',
        name: textOnly(question),
        acceptedAnswer: {
          '@type': 'Answer',
          text: textOnly(answer),
        },
      };
    }),
  };
}

function hasSpeakableSummary(page: FullPage): boolean {
  return (page.data.extracted?.key_points?.filter((point) => point.trim()).length ?? 0) >= 2;
}

export function buildJsonLd(
  page: FullPage,
  seo: SeoFields,
  pageType: PageType,
): object[] {
  const siteUrl = siteConfig.siteUrl.replace(/\/$/, '');
  const graph: object[] = [];
  const faq = faqPage(page);
  const speakable = hasSpeakableSummary(page)
    ? { '@type': 'SpeakableSpecification', cssSelector: ['.article-summary'] }
    : null;

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
      ...(speakable ? { speakable } : {}),
      publisher: ORG,
      inLanguage: 'ru',
    });
    if (faq) graph.push(faq);
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
      ...(speakable ? { speakable } : {}),
      publisher: ORG,
      inLanguage: 'ru',
      about: { '@type': 'DefinedTerm', name: seo.h1 || seo.title },
    });
    if (faq) graph.push(faq);
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
    if (faq) graph.push(faq);
    if (speakable) graph.push(speakable);
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
    if (faq) graph.push(faq);
    return graph;
  }

  // content_page fallback
  graph.push({
    '@type': 'WebPage',
    ...webPageBase,
    ...(speakable ? { speakable } : {}),
  });
  if (faq) graph.push(faq);
  return graph;
}
