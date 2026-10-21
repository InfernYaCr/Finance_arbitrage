import type { Product } from './types';
import { canonicalUrl } from './seo';
import { annualRatePct } from './offers';

/** JSON-LD билдеры. Возвращают plain-объекты; в страницу вставлять через jsonLd(jsonLdGraph([...])). */

export interface Faq { q: string; a: string }
export interface Crumb { name: string; path: string }
/** Реквизиты (legalName, taxID) и email необязательны: пустое значение в JSON-LD не выводится. */
export interface OrgInfo {
  name: string;
  url: string;
  logo?: string;
  email?: string;
  legalName?: string;
  taxID?: string;
  /** Абсолютный URL редакционной политики. */
  publishingPrinciples?: string;
}

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
    ...(org.legalName ? { legalName: org.legalName } : {}),
    ...(org.taxID ? { taxID: org.taxID } : {}),
    ...(org.email ? { email: org.email, contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: org.email } } : {}),
    ...(org.publishingPrinciples ? { publishingPrinciples: org.publishingPrinciples } : {}),
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
  /** Абсолютный canonical страницы (у legacy-статей это /credit/<slug>.html). */
  url: string;
  headline: string;
  description?: string;
  datePublished: Date | string;
  dateModified?: Date | string;
  /** Автор-организация; по умолчанию — имя издателя. */
  author?: string;
  image?: string;
  publisher: OrgInfo;
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);

function articleBase(type: 'Article' | 'NewsArticle', a: ArticleInput) {
  const { url, publisher: org } = a;
  return {
    '@type': type,
    headline: a.headline,
    ...(a.description ? { description: a.description } : {}),
    mainEntityOfPage: url,
    url,
    inLanguage: 'ru',
    datePublished: iso(a.datePublished),
    dateModified: iso(a.dateModified ?? a.datePublished),
    author: { '@type': 'Organization', name: a.author ?? org.name, url: org.url },
    // Издатель целиком, а не только @id: валидаторы не всегда разрешают ссылки между узлами @graph.
    publisher: {
      '@type': 'Organization', '@id': orgId(org), name: org.name, url: org.url,
      ...(org.logo ? { logo: { '@type': 'ImageObject', url: org.logo } } : {}),
    },
    ...(a.image ? { image: new URL(a.image, url).href } : {}),
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
 * Оффер как финансовый продукт (LoanOrCredit / CreditCard). path — страница обзора на сайте (не /go/).
 * aggregateRating намеренно НЕ выводим: rating в контенте — редакционная оценка,
 * а не пользовательские отзывы (иначе нарушение правил Google по разметке отзывов).
 */
export function financialProduct(p: Product, site: string, path: string, extra: { description?: string } = {}) {
  const hasPsk = p.pskMin != null && p.pskMax != null;
  return {
    '@type': p.kind === 'card' ? 'CreditCard' : 'LoanOrCredit',
    name: p.name,
    ...(extra.description ? { description: extra.description } : {}),
    url: canonicalUrl(site, path),
    currency: 'RUB',
    amount: { '@type': 'MonetaryAmount', currency: 'RUB', minValue: p.amountMin, maxValue: p.amountMax },
    // У карты termMin/MaxDays — льготный период, а не срок кредита.
    ...(p.kind !== 'card'
      ? { loanTerm: { '@type': 'QuantitativeValue', minValue: p.termMinDays, maxValue: p.termMaxDays, unitCode: 'DAY' } }
      : {}),
    // schema.org: interestRate — номинальная ставка, annualPercentageRate — полная стоимость с комиссиями (= ПСК).
    // Ставку без диапазона ПСК не выводим (ч. 3 ст. 28 38-ФЗ, как на странице); у карт rateDayPct = 0 (льготный период).
    ...(hasPsk && p.kind !== 'card' && p.rateDayPct > 0 ? { interestRate: annualRatePct(p.rateDayPct) } : {}),
    ...(hasPsk
      ? { annualPercentageRate: { '@type': 'QuantitativeValue', minValue: p.pskMin, maxValue: p.pskMax, unitText: 'PERCENT' } }
      : {}),
    ...(p.legalName ? { provider: { '@type': 'Organization', name: p.legalName } } : {}),
  };
}

/** ItemList офферов хаба; pathOf — адрес обзора оффера. */
export function itemListProducts(name: string, products: Product[], site: string, pathOf: (p: Product) => string) {
  if (!products.length) return null;
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: financialProduct(p, site, pathOf(p)),
    })),
  };
}

/** ItemList произвольных продуктов (страхование, вклады, РКО): тип schema.org, имя, абсолютный url (можно с #якорем), поставщик. */
export interface ListEntry { type: string; name: string; url: string; provider?: string; description?: string }
export function itemList(name: string, entries: ListEntry[]) {
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
        url: e.url,
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
