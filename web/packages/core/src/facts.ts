import raw from './data/facts.json';

/** Факты Банка России. Файл пишет web/scripts/sync-cbr.mjs, в сборке сеть не нужна. */
export interface Facts {
  /** ISO-время последнего синка с cbr.ru. */
  fetchedAt: string;
  /** Текущая ключевая ставка, % годовых; since — дата вступления в силу (YYYY-MM-DD). */
  keyRate: { value: number; since: string; announced?: string };
  /** Ближайшее заседание совета директоров по ставке (YYYY-MM-DD). */
  nextMeeting: string;
  /** Необлагаемый лимит процентов по вкладам: 1 млн ₽ × maxRate (ст. 214.2 НК). final=false до 1 декабря. */
  taxFree: { year: number; maxRate: number; limitRub: number; final: boolean };
  /** true, если ключевые поля взяты из facts.override.json (день решения ЦБ). */
  override?: boolean;
}

export const facts = raw as Facts;
