import { filterProducts, sortProducts } from '@pbn/core';
import type { ProductKind } from '@pbn/core';
import { getOffers, creditRate, showsRate, NO_RATE, type Offer } from './offers';
import { daysWord, plural, termText } from './format';

export const KIND_URL: Record<ProductKind, string> = { mfo: '/zaimy/', card: '/karty/', credit: '/kredity/' };

export type Category = 'zaimy' | 'kredity' | 'karty' | 'refinansirovanie' | 'kreditnaya-istoriya' | 'fingramotnost';

/** Категория статьи -> какие продукты подбирать по умолчанию. */
const CATEGORY_KIND: Record<string, ProductKind> = {
  zaimy: 'mfo', kredity: 'credit', karty: 'card', refinansirovanie: 'credit', 'kreditnaya-istoriya': 'mfo', fingramotnost: 'mfo',
};

export interface CalloutCopy { pose: 'wave' | 'point' | 'think' | 'cheer' | 'shield' | 'coins'; title: string; text: string; button: string; href: string; kind: ProductKind; feature?: string }

const COPY: Record<string, Omit<CalloutCopy, 'kind'>> = {
  zaimy: { pose: 'point', title: 'Подберите займ под свою сумму', text: 'Укажите сумму и срок — покажем только подходящие предложения МФО и сравним условия.', button: 'Подобрать займ', href: '/zaimy/' },
  'zaimy-zero': { pose: 'cheer', title: 'Первый займ без процентов', text: 'У некоторых МФО новым клиентам не начисляют проценты первые дни. Сравните условия и сроки.', button: 'Смотреть займы под 0%', href: '/zaimy-bez-procentov/' },
  kredity: { pose: 'think', title: 'Сравните кредиты', text: 'Ставка, ПСК и срок в одной таблице — до того как идти в банк.', button: 'Сравнить кредиты', href: '/kredity/' },
  refinansirovanie: { pose: 'think', title: 'Сравните кредиты для рефинансирования', text: 'Прежде чем менять кредит, посчитайте ПСК и переплату по новому предложению.', button: 'Сравнить кредиты', href: '/kredity/' },
  karty: { pose: 'coins', title: 'Подберите карту под себя', text: 'Льготный период, лимит и стоимость обслуживания — сравните карты в одном списке.', button: 'Смотреть карты', href: '/karty/' },
  'kreditnaya-istoriya': { pose: 'shield', title: 'Займы при плохой кредитной истории', text: 'Часть МФО рассматривает заявки с испорченной КИ. Гарантий одобрения нет — решает кредитор.', button: 'Смотреть займы с плохой КИ', href: '/zaimy-s-plohoj-ki/' },
  fingramotnost: { pose: 'wave', title: 'Сравните условия до подписания', text: 'Сумма, срок, ставка в день и ПСК — всё, что нужно, чтобы не переплатить.', button: 'Подобрать займ', href: '/zaimy/' },
};

export interface CtaData {
  all: Offer[];
  mfo: Offer[];
  zeroCount: number;
  minDecision: number | null;
  mfoCount: number;
  cardCount: number;
  creditCount: number;
}

let cache: Promise<CtaData> | undefined;
export function getCtaData(): Promise<CtaData> {
  cache ??= getOffers().then((all) => {
    const mfo = all.filter((o) => o.kind === 'mfo');
    const dec = mfo.map((o) => o.decisionMinutes).filter((x): x is number => typeof x === 'number');
    return {
      all,
      mfo,
      zeroCount: mfo.filter((o) => o.features.includes('zero_percent') && o.freeDays).length,
      minDecision: dec.length ? Math.min(...dec) : null,
      mfoCount: mfo.length,
      cardCount: all.filter((o) => o.kind === 'card').length,
      creditCount: all.filter((o) => o.kind === 'credit').length,
    };
  });
  return cache;
}

/** Если офферов запрошенного типа нет, подменяем на тот, что есть (кредиты -> карты -> займы). */
export function resolveKind(kind: ProductKind, d: CtaData): ProductKind {
  const n = { mfo: d.mfoCount, card: d.cardCount, credit: d.creditCount };
  if (n[kind] > 0) return kind;
  return n.card > 0 && kind === 'credit' ? 'card' : 'mfo';
}

export function kindForArticle(category: string, offerKind?: ProductKind): ProductKind {
  return offerKind ?? CATEGORY_KIND[category] ?? 'mfo';
}

export function calloutCopy(category: string, d: CtaData, offerKind?: ProductKind): CalloutCopy {
  const wanted = kindForArticle(category, offerKind);
  const kind = resolveKind(wanted, d);
  let key = category in COPY ? category : 'zaimy';
  if (offerKind === 'card') key = 'karty';
  if (offerKind === 'credit' && key === 'zaimy') key = 'kredity';
  if (offerKind === 'mfo' && (key === 'karty' || key === 'kredity' || key === 'refinansirovanie')) key = 'zaimy';
  let c = COPY[key];
  // кредитов в базе пока нет: честно предлагаем то, что есть
  if (kind !== wanted && wanted === 'credit') {
    c = kind === 'card'
      ? { ...COPY.karty, title: 'Карта с льготным периодом вместо нового кредита', text: 'Если нужна сумма на короткий срок, сравните условия карт: льготный период, лимит, стоимость обслуживания.' }
      : { ...COPY.zaimy };
  } else if (kind !== wanted && wanted === 'card') c = COPY.zaimy;
  return { ...c, kind };
}

/** Компактный набор для блока «Топ-3»: сортировка по приоритету, опционально фильтр по сумме. */
export function topOffers(d: CtaData, kind: ProductKind, n = 3, sum?: number): Offer[] {
  const list = d.all.filter((o) => o.kind === kind);
  const f = sum ? filterProducts(list, { sum }) : list;
  return sortProducts(f.length ? f : list, 'recommended').slice(0, n);
}

/** Сколько предложений подходит под сумму. */
export function countForSum(offers: Offer[], sum: number): number {
  return filterProducts(offers, { sum }).length;
}

export function keyCondition(o: Offer): string {
  if (o.kind === 'card') return o.features.includes('zero_percent') && o.freeDays ? `Без % ${termText('card', 1, o.freeDays)}` : 'Кредитная карта';
  if (!showsRate(o)) return o.decisionMinutes ? `Решение за ${o.decisionMinutes} мин` : NO_RATE;
  if (o.kind === 'credit') return `${creditRate(o)}% годовых`;
  if (o.features.includes('zero_percent') && o.freeDays) return `0% первые ${daysWord(o.freeDays)}`;
  if (o.decisionMinutes) return `Решение за ${o.decisionMinutes} мин`;
  return `${String(o.rateDayPct).replace('.', ',')}% в день`;
}

export const offersPlural = (n: number) => `${n} ${plural(n, ['предложение', 'предложения', 'предложений'])}`;

/** Стабильный выбор варианта по строке (slug), чтобы соседние статьи выглядели по-разному. */
export function pickVariant(seed: string, n: number): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}
