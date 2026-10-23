/** Чистые функции — используются и при SSG, и в клиентских скриптах. */
import type { ProductKind } from '@pbn/core';

const nf = new Intl.NumberFormat('ru-RU');

export const num = (n: number) => nf.format(Math.round(n));
export const rub = (n: number) => `${num(n)} ₽`;

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const offersWord = (n: number) => `${n} ${plural(n, ['предложение', 'предложения', 'предложений'])}`;
export const daysWord = (n: number) => `${n} ${plural(n, ['день', 'дня', 'дней'])}`;
/** «18–70 лет»; без подтверждённого верхнего предела — «от 18 лет». */
export const ageText = (min: number, max?: number) => (max ? `${min}–${max} лет` : `от ${min} лет`);

export function range(a: number, b: number, fmt: (n: number) => string = num): string {
  return a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`;
}

/** Процент с запятой: 55.399 -> «55,399». */
const pf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 });
export const pct = (n: number) => pf.format(n);

/** Краткая сумма без «₽»: 7 500 000 -> «7,5 млн», 30 000 -> «30 тыс.», 500 -> «500». */
const sf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
export const money = (n: number) => (n >= 1e6 ? `${sf.format(n / 1e6)} млн` : n >= 1000 ? `${sf.format(n / 1000)} тыс.` : num(n));
export const moneyRange = (a: number, b: number) => `${range(a, b, money)} ₽`;

const MONTH_DAYS = 30.4;

/** Срок: МФО — дни; кредит — годы (или месяцы); карта — льготный период «до N дн./мес.». */
export function termText(kind: ProductKind, min: number, max: number): string {
  if (kind === 'mfo') return `${range(min, max)} дн.`;
  if (kind === 'card') return max >= 365 ? `до ${Math.round(max / MONTH_DAYS)} мес.` : `до ${max} дн.`;
  if (min % 365 === 0 && max % 365 === 0) return `${range(min / 365, max / 365)} ${plural(max / 365, ['год', 'года', 'лет'])}`;
  return `${range(Math.round(min / MONTH_DAYS), Math.round(max / MONTH_DAYS))} мес.`;
}

/** Максимальная сумма процентов по закону — 100% от суммы займа (с 1 апреля 2026 г.). */
export const LEGAL_CAP = 1;

/** Переплата за срок: льготные дни (freeDays) без процентов, общий потолок 100%. */
export function overpay(sum: number, termDays: number, rateDayPct: number, freeDays = 0): number {
  const charge = Math.max(0, termDays - freeDays);
  return Math.min(sum * (rateDayPct / 100) * charge, sum * LEGAL_CAP);
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 190));
}

const dtf = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const dateRu = (d: Date) => dtf.format(d);
