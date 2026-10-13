import { getCollection } from 'astro:content';
import type { Product, ProductKind } from '@pbn/core';

export interface Offer extends Product {
  summary?: string;
  pros: string[];
  cons: string[];
}

export const offerHref = (o: Pick<Product, 'poolId'>) => `/go/${o.poolId}/`;
export const reviewHref = (o: Pick<Product, 'slug'>) => `/mfo/${o.slug}/`;

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
