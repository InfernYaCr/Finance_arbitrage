import poolRaw from './data/pool.json';
import type { PoolOffer, Product, ProductFeature } from './types';

/* ───────── Пул партнёрских офферов ───────── */

/** Пул копируется из sites/affiliate_pool.json скриптом web/scripts/sync-pool.mjs. */
export const pool = poolRaw as PoolOffer[];

const poolById = new Map(pool.map((o) => [o.id, o]));

export function getPoolOffer(poolId: string): PoolOffer | undefined {
  return poolById.get(poolId);
}

/** Оффер можно показывать и вести по нему трафик: включён и есть ссылка. */
export function isLinkable(o: PoolOffer | undefined): o is PoolOffer {
  return !!o && o.enabled && !!o.href;
}

/** Внутренняя ссылка-редирект. Все CTA на сайте ведут сюда, а не на партнёрку напрямую. */
export function goHref(poolId: string): string {
  return `/go/${poolId}/`;
}

export interface UtmOptions {
  source?: string;   // по умолчанию — домен сайта
  medium?: string;
  campaign?: string; // страница/блок: 'home', 'guide-zaimy-bez-otkaza'…
  content?: string;  // позиция/слот: 'card-3', 'top-banner'
  term?: string;
  erid?: string;     // токен маркировки (ОРД) — передаётся в ссылке параметром erid
}

const DEFAULT_UTM = { source: 'rencredit-online.ru', medium: 'compare', campaign: 'catalog' };

/** Добавляет UTM к партнёрской ссылке (перенос buildUtmHref из site/src/lib/affiliate.ts). */
export function buildUtmHref(href: string, opts: UtmOptions = {}): string {
  const params: Record<string, string> = {
    ...(opts.erid && !/[?&]erid=/.test(href) ? { erid: opts.erid } : {}),
    utm_source: opts.source ?? DEFAULT_UTM.source,
    utm_medium: opts.medium ?? DEFAULT_UTM.medium,
    utm_campaign: opts.campaign ?? DEFAULT_UTM.campaign,
  };
  if (opts.content) params.utm_content = opts.content;
  if (opts.term) params.utm_term = opts.term;
  const qs = new URLSearchParams(params).toString();
  return `${href}${href.includes('?') ? '&' : '?'}${qs}`;
}

/** Итоговый внешний URL партнёра или null, если оффер выключен/без ссылки. */
export function outboundUrl(poolId: string, opts: UtmOptions = {}): string | null {
  const o = getPoolOffer(poolId);
  return isLinkable(o) ? buildUtmHref(o.href, opts) : null;
}

/* ───────── Фильтры и сортировка витрины ───────── */

export interface ProductFilter {
  sum?: number;                 // ₽ — подходит, если в диапазоне amountMin..amountMax
  term?: number;                // дней
  age?: number;                 // лет заёмщика
  features?: ProductFeature[];  // все перечисленные должны присутствовать
}

export function filterProducts<T extends Product>(products: T[], f: ProductFilter = {}): T[] {
  return products.filter((p) => {
    if (f.sum != null && (f.sum < p.amountMin || f.sum > p.amountMax)) return false;
    if (f.term != null && (f.term < p.termMinDays || f.term > p.termMaxDays)) return false;
    if (f.age != null && (f.age < p.ageMin || f.age > p.ageMax)) return false;
    if (f.features?.length && !f.features.every((x) => p.features.includes(x))) return false;
    return true;
  });
}

export type SortKey = 'recommended' | 'rate' | 'amount' | 'approval' | 'rating';

/** Не мутирует вход. recommended — по priority; rate — по возрастанию ставки (при равенстве — больше льготных дней). */
export function sortProducts<T extends Product>(products: T[], key: SortKey = 'recommended'): T[] {
  const byPriority = (a: T, b: T) => (b.priority ?? 0) - (a.priority ?? 0);
  const cmp: Record<SortKey, (a: T, b: T) => number> = {
    recommended: byPriority,
    rate: (a, b) => a.rateDayPct - b.rateDayPct || (b.freeDays ?? 0) - (a.freeDays ?? 0),
    amount: (a, b) => b.amountMax - a.amountMax,
    approval: (a, b) => (b.approvalPct ?? 0) - (a.approvalPct ?? 0),
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  };
  return [...products].sort((a, b) => cmp[key](a, b) || byPriority(a, b));
}

/* ───────── Калькулятор переплаты ───────── */

/**
 * Предельная ставка: 0,8% в день по договорам потребительского кредита/займа
 * (с 01.07.2023; ст. 6 353-ФЗ и ст. 12.1 151-ФЗ в ред. закона от 29.12.2022).
 */
export const MAX_RATE_DAY_PCT = 0.8;

/**
 * Предельная переплата по краткосрочным (до 1 года) займам МФО: проценты, штрафы, пени
 * и иные платежи не могут превышать сумму займа.
 *  - 100% суммы — для договоров с 01.04.2026 (Федеральный закон от 29.12.2025 № 545-ФЗ);
 *  - 130% — действовало с 01.07.2023 по 31.03.2026 (до этого 150%).
 * В задании фигурировало 130% — норма устарела, актуально 100%. Сверить с текстом закона.
 */
export const MAX_OVERPAYMENT_RATIO = 1.0;

export interface OverpaymentResult {
  /** Начисленные проценты за срок (после льготных дней), ₽. */
  interest: number;
  /** Переплата с учётом законного потолка, ₽. */
  overpay: number;
  /** Всего к возврату, ₽. */
  total: number;
  /** Сработал ли потолок переплаты. */
  capped: boolean;
}

/**
 * @param sum        сумма займа, ₽
 * @param days       срок, дней
 * @param rateDayPct ставка в день, % (0.8 = 0,8%)
 * @param freeDays   дни без процентов (первый займ под 0%)
 * @param capRatio   потолок переплаты как доля суммы (по умолчанию MAX_OVERPAYMENT_RATIO)
 */
export function overpayment(
  sum: number,
  days: number,
  rateDayPct: number,
  freeDays = 0,
  capRatio: number = MAX_OVERPAYMENT_RATIO,
): OverpaymentResult {
  const chargeable = Math.max(0, days - Math.max(0, freeDays));
  const interest = Math.round(sum * (rateDayPct / 100) * chargeable);
  const cap = Math.round(sum * capRatio);
  const overpay = Math.min(interest, cap);
  return { interest, overpay, total: sum + overpay, capped: interest > cap };
}

/** Ставка в годовых %, упрощённо: ставка в день × 365 (без льготного периода). */
export function annualRatePct(rateDayPct: number): number {
  return Math.round(rateDayPct * 365 * 10) / 10;
}
