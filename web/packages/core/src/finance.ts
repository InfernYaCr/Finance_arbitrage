/**
 * Финансовые формулы сети: чистые функции без импортов (клиентский код берёт их через `@pbn/core/finance`,
 * не через barrel — тот тянет pool.json). Схема только аннуитетная. Эталоны: finance.test.ts.
 */

/** Аннуитетный платёж в месяц. rate — годовая ставка, %. */
export function annuity(principal: number, rate: number, months: number): number {
  const r = rate / 1200;
  return r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
}

/**
 * ПСК, % годовых, по ч. 2 ст. 6 353-ФЗ для равных месячных периодов: ПСК = i · 12 · 100,
 * i — корень Σ flows[k] / (1 + i)^k = 0 (flows[0] — выдача за вычетом удержаний, дальше платежи со знаком минус).
 * Бисекция: NPV растёт по i, если в начале приток, а потом оттоки.
 */
export function psk(flows: number[]): number {
  const npv = (i: number) => flows.reduce((s, f, k) => s + f / (1 + i) ** k, 0);
  if (npv(0) >= 0) return 0;
  let lo = 0;
  let hi = 1; // 1200% годовых
  for (let n = 0; n < 80; n++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) < 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 1200;
}

/** Категория потребкредита в таблице среднерыночной ПСК Банка России: иные без залога, до / свыше 100 тыс. ₽. */
export const pskCategory = (sum: number): '4.1' | '4.2' => (sum <= 100_000 ? '4.1' : '4.2');

export interface Debt {
  balance: number; // остаток долга, ₽
  rate: number; // годовая ставка, %
  months: number; // сколько месяцев осталось платить
}

export type InsuranceMode = 'body' | 'separate' | 'none';

export interface RefiOffer {
  rate: number; // годовая ставка, %
  months: number;
  feePct: number; // комиссия за выдачу, % от суммы кредита, платится сразу
  insurance: number; // страховка, ₽
  insMode: InsuranceMode; // «в тело» — включена в сумму кредита, «отдельно» — платится сразу
}

export type Verdict = 'green' | 'yellow' | 'red';
/** rate — новая ставка не даёт выигрыша; term — выигрыш съедает длинный срок; costs — комиссия и страховка. */
export type Cause = 'rate' | 'term' | 'costs';

export interface RefiResult {
  balance: number;
  oldPay: number; // платёж в первый месяц по старым долгам
  oldTotal: number; // сколько осталось заплатить по старым долгам
  principal: number; // сумма нового кредита
  newPay: number;
  upfront: number; // разовые расходы при выдаче: комиссия и страховка «отдельно»
  newTotal: number; // платежи по новому кредиту + разовые расходы
  gain: number; // oldTotal − newTotal: > 0 — по расчёту платить меньше
  payback: number | null; // месяц, в котором экономия на платежах покрыла разовые расходы
  psk: number; // ПСК нового кредита, %
  verdict: Verdict;
  trap: boolean; // «ловушка срока»: платёж ниже за счёт срока, а итог больше
  cause: Cause | null; // причина, если вердикт не зелёный
}

/** Порог «на грани»: выигрыш или проигрыш в пределах 1% от остатка долга. */
const EDGE_SHARE = 0.01;

const oldTotalOf = (debts: Debt[]) => debts.reduce((s, d) => s + annuity(d.balance, d.rate, d.months) * d.months, 0);

/** Сравнение «платить как есть» против «перекредитоваться» по сумме всех будущих платежей. */
export function refi(debts: Debt[], o: RefiOffer): RefiResult {
  const balance = debts.reduce((s, d) => s + d.balance, 0);
  const pays = debts.map((d) => annuity(d.balance, d.rate, d.months));
  const oldPay = pays.reduce((s, p) => s + p, 0);
  const oldTotal = oldTotalOf(debts);
  const oldMonths = Math.max(...debts.map((d) => d.months));

  const ins = o.insMode === 'none' ? 0 : o.insurance;
  const principal = balance + (o.insMode === 'body' ? ins : 0);
  const fee = (principal * o.feePct) / 100;
  const upfront = fee + (o.insMode === 'separate' ? ins : 0);
  const newPay = annuity(principal, o.rate, o.months);
  const newTotal = newPay * o.months + upfront;
  const gain = oldTotal - newTotal;

  // Страховка входит в ПСК, если от неё зависят условия кредита (ч. 4 ст. 6 353-ФЗ): калькулятор считает, что зависят.
  const rate = psk([principal - fee - ins, ...Array<number>(o.months).fill(-newPay)]);

  let payback: number | null = null;
  for (let k = 1, saved = 0; upfront > 0 && k <= o.months; k++) {
    saved += pays.reduce((s, p, i) => s + (debts[i].months >= k ? p : 0), 0) - newPay;
    if (saved >= upfront) {
      payback = k;
      break;
    }
  }

  const verdict: Verdict = gain > balance * EDGE_SHARE ? 'green' : gain < -balance * EDGE_SHARE ? 'red' : 'yellow';
  let cause: Cause | null = null;
  if (verdict !== 'green') {
    // Тот же кредит без расходов: на сроке не длиннее старого и на выбранном сроке.
    const bare = (months: number) => annuity(balance, o.rate, months) * months;
    if (bare(Math.min(o.months, oldMonths)) >= oldTotal) cause = 'rate';
    else if (o.months > oldMonths && bare(o.months) >= oldTotal) cause = 'term';
    else cause = 'costs';
  }

  return { balance, oldPay, oldTotal, principal, newPay, upfront, newTotal, gain, payback, psk: rate, verdict, trap: cause === 'term', cause };
}
