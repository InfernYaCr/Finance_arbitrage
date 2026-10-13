/**
 * Логика подборщика главной: общая для SSR (index.astro) и клиента (home-picker.ts).
 * Чистые функции, без DOM.
 */
import { overpay } from '../lib/format';

export type Ki = 'good' | 'none' | 'bad';

export interface PickOffer {
  sumMin: number; sumMax: number; termMin: number; termMax: number;
  rate: number; free: number; prio: number; idx: number;
  features: string[];
}

export interface PickState { sum: number; term: number; ki: Ki }

export const SUM = { min: 1000, max: 100000, step: 500 } as const;
export const TERM = { min: 5, max: 180, step: 1 } as const;
export const DEFAULT_STATE: PickState = { sum: 15000, term: 14, ki: 'good' };
export const TOP_N = 3;

export const KI_LABELS: Record<Ki, string> = {
  good: 'хорошая',
  none: 'пока пустая',
  bad: 'с просрочками',
};

/** Сценарии: один тап = готовый запрос. Значения подобраны под реальные лимиты витрины. */
export const SCENARIOS: { id: string; title: string; hint: string; state: PickState }[] = [
  { id: 'salary', title: 'До зарплаты', hint: '10 000 ₽ на 2 недели', state: { sum: 10000, term: 14, ki: 'good' } },
  { id: 'first', title: 'Первый займ под 0%', hint: '5 000 ₽ на неделю', state: { sum: 5000, term: 7, ki: 'none' } },
  { id: 'bad', title: 'Испорчена история', hint: '8 000 ₽ на 15 дней', state: { sum: 8000, term: 15, ki: 'bad' } },
  { id: 'big', title: 'Крупная сумма надолго', hint: '60 000 ₽ на 4 месяца', state: { sum: 60000, term: 120, ki: 'good' } },
];

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Условие «с просрочками» совпадает с чипом витрины «С плохой КИ», чтобы счётчики сходились. */
export const KI_FEATURE: Partial<Record<Ki, string>> = { bad: 'bad_history' };

export const matches = (o: PickOffer, s: PickState) =>
  s.sum >= o.sumMin && s.sum <= o.sumMax &&
  s.term >= o.termMin && s.term <= o.termMax &&
  (!KI_FEATURE[s.ki] || o.features.includes(KI_FEATURE[s.ki]!));

const byPrio = (a: PickOffer, b: PickOffer) => b.prio - a.prio || a.idx - b.idx;
const byFree = (a: PickOffer, b: PickOffer) => b.free - a.free || byPrio(a, b);

/** Подходящие предложения в порядке показа. Пустая история -> вперёд те, где первый займ без процентов. */
export function pick<T extends PickOffer>(list: T[], s: PickState): T[] {
  return list.filter((o) => matches(o, s)).sort(s.ki === 'none' ? byFree : byPrio);
}

/** Ближайший к запросу вариант, под который что-то находится (минимальное относительное изменение суммы и срока). */
export function nearest<T extends PickOffer>(list: T[], s: PickState): PickState | null {
  let best: PickState | null = null;
  let cost = Infinity;
  for (const o of list) {
    const f = KI_FEATURE[s.ki];
    if (f && !o.features.includes(f)) continue;
    const sum = clamp(s.sum, o.sumMin, o.sumMax);
    const term = clamp(s.term, o.termMin, o.termMax);
    const c = Math.abs(sum - s.sum) / s.sum + Math.abs(term - s.term) / s.term;
    if (c < cost) { cost = c; best = { sum, term, ki: s.ki }; }
  }
  return best;
}

export interface Quote { over: number; back: number; freeUsed: number }
/**
 * Льготные дни «0%» действуют только для первого займа, поэтому учитываем их,
 * лишь когда пользователь выбрал «история пока пустая». Иначе — обычная ставка.
 */
export function quote(o: PickOffer, s: PickState): Quote {
  const freeUsed = s.ki === 'none' ? Math.min(o.free, s.term) : 0;
  const over = Math.round(overpay(s.sum, s.term, o.rate, freeUsed));
  return { over, back: s.sum + over, freeUsed };
}

export const overText = (q: Quote, rub: (n: number) => string) =>
  q.over === 0 && q.freeUsed > 0
    ? '0 ₽ процентов, если займ первый'
    : q.freeUsed > 0
      ? `переплата ${rub(q.over)}, ${q.freeUsed} дн. без %`
      : `переплата ${rub(q.over)}`;

/** Угол стрелки компаса: сумма весит больше срока. Диапазон -64..64 градуса. */
export const needleAngle = (s: PickState) => {
  const f = (s.sum - SUM.min) / (SUM.max - SUM.min);
  const g = (s.term - TERM.min) / (TERM.max - TERM.min);
  return Math.round((-64 + 128 * (0.65 * f + 0.35 * g)) * 10) / 10;
};
