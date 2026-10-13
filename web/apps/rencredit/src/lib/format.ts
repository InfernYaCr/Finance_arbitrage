/** Чистые функции — используются и при SSG, и в клиентских скриптах. */
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

export function range(a: number, b: number, fmt: (n: number) => string = num): string {
  return a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`;
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
