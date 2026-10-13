import { getCollection } from 'astro:content';
import type { Product, ProductKind } from '@pbn/core';

export interface Offer extends Product {
  summary?: string;
  pros: string[];
  cons: string[];
}

export const offerHref = (o: Pick<Product, 'poolId'>) => `/go/${o.poolId}/`;
export const reviewHref = (o: Pick<Product, 'slug'>) => `/mfo/${o.slug}/`;

/** Официальный сайт кредитора из src/data/offer-sources/<slug>.json (для «Изучите все условия…»). */
const sources = import.meta.glob<{ officialUrl?: string }>('../data/offer-sources/*.json', { eager: true, import: 'default' });
export const officialUrl = (slug: string): string | undefined => sources[`../data/offer-sources/${slug}.json`]?.officialUrl;

/** Слова, которые ч. 3 ст. 28 38-ФЗ требует при указании диапазона ПСК. */
export const PSK_LABEL = 'Полная стоимость кредита (займа)';

/** Диапазон ПСК для рекламы: только когда известны обе границы, иначе null. */
export function pskRange(o: Pick<Product, 'pskMin' | 'pskMax'>): string | null {
  if (o.pskMin == null || o.pskMax == null) return null;
  const f = (n: number) => String(n).replace('.', ',');
  return o.pskMin === o.pskMax ? `${f(o.pskMax)}% годовых` : `от ${f(o.pskMin)} до ${f(o.pskMax)}% годовых`;
}

export async function getOffers(kind?: ProductKind): Promise<Offer[]> {
  const entries = await getCollection('offers');
  const list = entries.map((e) => ({ slug: e.id, ...e.data }) as Offer);
  const filtered = kind ? list.filter((o) => o.kind === kind) : list;
  return filtered.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name, 'ru'));
}

export function offerStats(offers: Offer[]) {
  const dec = offers.map((o) => o.decisionMinutes).filter((x): x is number => typeof x === 'number');
  const appr = offers.map((o) => o.approvalPct).filter((x): x is number => typeof x === 'number');
  return {
    count: offers.length,
    minDecision: dec.length ? Math.min(...dec) : 5,
    maxApproval: appr.length ? Math.max(...appr) : 90,
    maxAmount: offers.length ? Math.max(...offers.map((o) => o.amountMax)) : 100000,
  };
}
