import type { Product } from './types';
import { canonicalUrl } from './seo';

/** JSON-LD билдеры. Возвращают plain-объекты; в страницу вставлять через jsonLd(jsonLdGraph([...])). */

export interface Faq { q: string; a: string }
export interface Crumb { name: string; path: string }
export interface OrgInfo { name: string; url: string; logo?: string; email?: string }

export function textOnly(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const orgId = (org: OrgInfo) => `${org.url.replace(/\/$/, '')}/#organization`;

/** Собирает @graph с общим @context. */
export function jsonLdGraph(nodes: Array<object | null | undefined | false>): object {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}

export function organization(org: OrgInfo) {
  return {
    '@type': 'Organization',
    '@id': orgId(org),
    name: org.name,
    url: org.url,
    ...(org.logo ? { logo: org.logo } : {}),
    ...(org.email ? { email: org.email } : {}),
  };
}

export function website(org: OrgInfo) {
  return {
    '@type': 'WebSite',
    '@id': `${org.url.replace(/\/$/, '')}/#website`,
    name: org.name,
    url: org.url,
    inLanguage: 'ru',
    publisher: { '@id': orgId(org) },
  };
}

/** Меньше двух крошек — null (на главной BreadcrumbList не нужен). */
export function breadcrumbList(site: string, crumbs: Crumb[]) {
  if (crumbs.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: canonicalUrl(site, c.path),
    })),
  };
}

export interface ArticleInput {
  site: string;
  path: string;
  headline: string;
  description?: string;
  datePublished: Date | string;
  dateModified?: Date | string;
  author?: string;
  image?: string;
  publisher: OrgInfo;
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);

function articleBase(type: 'Article' | 'NewsArticle', a: ArticleInput) {
  const url = canonicalUrl(a.site, a.path);
  return {
    '@type': type,
    headline: a.headline,
    ...(a.description ? { description: a.description } : {}),
    mainEntityOfPage: url,
    url,
    inLanguage: 'ru',
    datePublished: iso(a.datePublished),
    dateModified: iso(a.dateModified ?? a.datePublished),
    author: { '@type': 'Organization', name: a.author ?? a.publisher.name },
    publisher: { '@id': orgId(a.publisher) },
    ...(a.image ? { image: a.image } : {}),
  };
}

export const article = (a: ArticleInput) => articleBase('Article', a);
export const newsArticle = (a: ArticleInput) => articleBase('NewsArticle', a);

export function faqPage(faq: Faq[]) {
  const items = faq.filter((f) => f.q.trim() && f.a.trim());
  if (!items.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: textOnly(f.q),
      acceptedAnswer: { '@type': 'Answer', text: textOnly(f.a) },
    })),
  };
}

/**
 * Оффер как финансовый продукт (LoanOrCredit / CreditCard).
 * aggregateRating намеренно НЕ выводим: rating в контенте — редакционная оценка,
 * а не пользовательские отзывы (иначе нарушение правил Google по разметке отзывов).
 */
export function financialProduct(p: Product, site: string, extra: { description?: string } = {}) {
  return {
    '@type': p.kind === 'card' ? 'CreditCard' : 'LoanOrCredit',
    name: p.name,
    ...(extra.description ? { description: extra.description } : {}),
    url: canonicalUrl(site, `/go/${p.poolId}/`),
    currency: 'RUB',
    amount: { '@type': 'MonetaryAmount', currency: 'RUB', minValue: p.amountMin, maxValue: p.amountMax },
    loanTerm: { '@type': 'QuantitativeValue', minValue: p.termMinDays, maxValue: p.termMaxDays, unitCode: 'DAY' },
    ...(p.kind !== 'card' && p.rateDayPct > 0
      ? { annualPercentageRate: Math.round(p.rateDayPct * 365 * 10) / 10 }
      : {}),
    ...(p.legalName ? { provider: { '@type': 'Organization', name: p.legalName } } : {}),
  };
}

export function itemListProducts(name: string, products: Product[], site: string) {
  if (!products.length) return null;
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: financialProduct(p, site),
    })),
  };
}

/** ItemList произвольных продуктов (страхование, вклады, РКО): тип schema.org, имя, ссылка, поставщик. */
export interface ListEntry { type: string; name: string; path: string; provider?: string; description?: string }
export function itemList(name: string, entries: ListEntry[], site: string) {
  if (!entries.length) return null;
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': e.type,
        name: e.name,
        url: canonicalUrl(site, e.path),
        ...(e.description ? { description: e.description } : {}),
        ...(e.provider ? { provider: { '@type': 'Organization', name: e.provider } } : {}),
      },
    })),
  };
}

/** Строка для <script type="application/ld+json" set:html={jsonLd(...)}>; экранирует «<». */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
