export type Feature =
  | 'zero_percent' | 'no_refusal' | 'bad_history' | 'to_card' | 'cash'
  | 'no_photo' | 'with_overdue' | 'long_term' | 'round_the_clock' | 'new';

export const FEATURE_LABELS: Record<Feature, string> = {
  zero_percent: 'Без процентов',
  no_refusal: 'Без отказа',
  bad_history: 'С плохой КИ',
  to_card: 'На карту',
  cash: 'Наличными',
  no_photo: 'Без фото',
  with_overdue: 'С просрочками',
  long_term: 'Долгосрочные',
  round_the_clock: 'Круглосуточно',
  new: 'Новые',
};

/** Порядок чипов на витрине. */
export const CHIP_ORDER: Feature[] = [
  'zero_percent', 'no_refusal', 'bad_history', 'to_card', 'no_photo',
  'with_overdue', 'long_term', 'new', 'cash', 'round_the_clock',
];
