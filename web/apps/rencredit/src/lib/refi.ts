/** Тексты результата калькулятора рефинансирования: одни и те же при SSG (дефолты) и в браузере (RefiCalc.astro). */
import { pskCategory, type RefiResult } from '@pbn/core/finance';
import { rub, plural } from './format';

/** Строки psk-cbr.json, которые нужны калькулятору; null — сравнение с ЦБ выключено (данные устарели). */
export type Cbr = Record<string, { label: string; avg: number; max: number }> | null;

export interface RefiView {
  badge: string;
  head: string;
  cause: string;
  payback: string;
  psk: string;
  overLimit: boolean; // ПСК выше предельной ЦБ: так не бывает, вероятна ошибка ввода
  showOffers: boolean;
}

const p1 = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;
const p3 = (n: number) => `${String(n).replace('.', ',')}%`;
const months = (n: number) => `${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])}`;

export function refiView(r: RefiResult, cbr: Cbr, oldMonths: number, newMonths: number): RefiView {
  const badge = r.verdict === 'green' ? 'По расчёту выгодно' : r.verdict === 'yellow' ? 'На грани' : r.trap ? 'Ловушка срока' : 'По расчёту невыгодно';
  const head =
    r.verdict === 'green' ? `Заплатите меньше на ${rub(r.gain)}`
    : r.verdict === 'yellow' ? `Разница ${rub(Math.abs(r.gain))} — меньше 1% от долга`
    : `Переплата больше на ${rub(-r.gain)}`;
  const cause =
    r.cause === 'rate' ? 'Новая ставка не снижает сумму платежей: даже без комиссии и страховки выходит не дешевле, чем платить как сейчас.'
    : r.cause === 'term' ? `Платёж ниже (${rub(r.newPay)} вместо ${rub(r.oldPay)}), но срок длиннее на ${months(newMonths - oldMonths)}: проценты за лишние месяцы съедают выгоду.`
    : r.cause === 'costs' ? 'Ставка ниже, но комиссия и страховка съели выгоду.'
    : '';
  const payback = !r.upfront ? '' : r.payback ? `Разовые расходы ${rub(r.upfront)} окупятся на ${r.payback}-м месяце.` : `Разовые расходы ${rub(r.upfront)} не окупятся за срок кредита.`;
  const row = cbr?.[pskCategory(r.principal)];
  const overLimit = !!row && r.psk > row.max;
  const psk = `ПСК нового кредита ≈ ${p1(r.psk)}.` + (row ? ` Среднерыночная ПСК Банка России для кредитов ${row.label} — ${p3(row.avg)}, предельная — ${p3(row.max)}.` : '')
    + (overLimit ? ' Банк не вправе заключить договор с ПСК выше предельной (ч. 11 ст. 6 353-ФЗ) — проверьте введённые данные.' : '');
  return { badge, head, cause, payback, psk, overLimit, showOffers: r.verdict === 'green' && !overLimit };
}

/** Корзина суммы для цели Метрики: точную сумму не отправляем. */
export const amountBucket = (n: number) => (n < 100_000 ? 'lt100k' : n < 300_000 ? '100k-300k' : n < 1_000_000 ? '300k-1m' : 'gt1m');
