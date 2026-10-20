/** Подстановка фактов ЦБ (@pbn/core facts.json) в тексты: <Fact k="…"/> в MDX и {{…}} в FAQ. */
import { facts } from '@pbn/core';
import { dateRu, pct, rub } from './format';

/** Полдень по местному времени: дата не съезжает на день при сборке в другом часовом поясе. */
const day = (iso: string) => dateRu(new Date(`${iso.slice(0, 10)}T12:00:00`));

const FACTS = {
  keyRate: () => `${pct(facts.keyRate.value)}%`,
  keyRateSince: () => day(facts.keyRate.since),
  nextMeeting: () => day(facts.nextMeeting),
  taxFreeLimit: () => rub(facts.taxFree.limitRub),
  taxFreeRate: () => `${pct(facts.taxFree.maxRate)}%`,
  taxFreeYear: () => String(facts.taxFree.year),
};

export type FactKey = keyof typeof FACTS;

export const factsDate = () => day(facts.fetchedAt);

export function factText(k: FactKey): string {
  const f = FACTS[k];
  if (!f) throw new Error(`Неизвестный факт «${k}». Доступны: ${Object.keys(FACTS).join(', ')}`);
  return f();
}

/** «{{keyRate}}» -> «14%». Неизвестный токен валит сборку. */
export const fillFacts = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => factText(k as FactKey));
