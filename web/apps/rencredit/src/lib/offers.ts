import { getCollection } from 'astro:content';
import { annualRatePct, type Product, type ProductKind } from '@pbn/core';
import { pct } from './format';
import cbr from '../data/cbr-registry.json';

export interface Offer extends Product {
  summary?: string;
  pros: string[];
  cons: string[];
}

export const offerHref = (o: Pick<Product, 'poolId'>) => `/go/${o.poolId}/`;
/** Раздел обзора по виду продукта. Тот же словарь — в legacy/rencredit/gen_htaccess.py (301 со старых /mfo/<slug>/). */
export const REVIEW_DIR: Record<ProductKind, string> = { mfo: 'mfo', card: 'karty', credit: 'kredity' };
export const reviewHref = (o: Pick<Product, 'slug' | 'kind'>) => `/${REVIEW_DIR[o.kind]}/${o.slug}/`;

/** Годовая ставка кредита: «от 18» / «от 19,9» (ставка в день × 365, до 0,1). Без «% …» — подпись у вызывающего. */
export const creditRate = (o: Pick<Product, 'rateDayPct'>) => `от ${pct(annualRatePct(o.rateDayPct))}`;

/** Официальный сайт кредитора из src/data/offer-sources/<slug>.json (для «Изучите все условия…»). */
const sources = import.meta.glob<{ officialUrl?: string }>('../data/offer-sources/*.json', { eager: true, import: 'default' });
export const officialUrl = (slug: string): string | undefined => sources[`../data/offer-sources/${slug}.json`]?.officialUrl;

/** Запись снимка реестра ЦБ (web/scripts/sync-cbr-registry.mjs); asOf — дата среза ЦБ, не дата сборки. */
export interface RegistryEntry { type: string; status: string; kind?: string; since?: string; ogrn?: string; name?: string; url?: string; excludedAt?: string; asOf: string }
const byLicense: Record<string, Omit<RegistryEntry, 'asOf'>> = cbr.byLicense;
const asOfByType: Record<string, string> = { mfo: cbr.sources.mfo.asOf, bank: cbr.sources.bank.asOf };
export function registryOf(o: Pick<Product, 'cbrLicense'>): RegistryEntry | undefined {
  const r = o.cbrLicense ? byLicense[o.cbrLicense] : undefined;
  return r && { ...r, asOf: asOfByType[r.type] ?? cbr.asOf };
}
/** Вторая линия защиты (ч. 13 ст. 28 38-ФЗ): организация исключена из реестра ЦБ — оффер не собираем.
 *  Ошибку для деплоя даёт check-content.mjs; здесь только не пускаем такой оффер на сайт. */
function inRegistry(o: Offer): boolean {
  const r = registryOf(o);
  if (!r || r.status === 'active') return true;
  console.warn(`[offers] ${o.slug}: № ${o.cbrLicense} в реестре ЦБ ${r.status} — оффер скрыт`);
  return false;
}

/** Слова, которые ч. 3 ст. 28 38-ФЗ требует при указании диапазона ПСК. */
export const PSK_LABEL = 'Полная стоимость кредита (займа)';

/** Диапазон ПСК для рекламы: только когда известны обе границы, иначе null. */
export function pskRange(o: Pick<Product, 'pskMin' | 'pskMax'>): string | null {
  if (o.pskMin == null || o.pskMax == null) return null;
  const f = (n: number) => String(n).replace('.', ',');
  return o.pskMin === o.pskMax ? `${f(o.pskMax)}% годовых` : `от ${f(o.pskMin)} до ${f(o.pskMax)}% годовых`;
}

/** ч. 3 ст. 28 38-ФЗ: ставку (и «0%») показываем только вместе с диапазоном ПСК. */
export const showsRate = (o: Pick<Product, 'pskMin' | 'pskMax'>) => pskRange(o) !== null;
export const NO_RATE = 'Условия — на сайте кредитора';
/** Текст основной кнопки по виду продукта. */
export const CTA_LABEL: Record<ProductKind, string> = { mfo: 'Получить деньги', card: 'Оформить карту', credit: 'Оформить кредит' };

export async function getOffers(kind?: ProductKind): Promise<Offer[]> {
  const entries = await getCollection('offers');
  const list = entries.map((e) => ({ slug: e.id, ...e.data }) as Offer).filter(inRegistry);
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
