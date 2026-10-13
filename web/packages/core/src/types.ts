/**
 * Контракты данных сети. Меняются только по согласованию —
 * на них опираются и контент (apps/<site>/src/content), и UI.
 */

/** Сырая запись из sites/affiliate_pool.json (выгрузка Saleads). */
export interface PoolOffer {
  id: string;            // saleads-xxxxxxxx
  label: string;
  href: string;          // https://my.saleads.pro/s/<uuid>
  network: string;
  vertical: 'mfo' | 'card' | 'insurance' | 'business' | 'credit' | 'investment' | 'work' | 'other' | string;
  offer_uuid?: string;
  connector_uuid?: string;
  payout?: string;
  status: 'approve' | 'wait' | string;
  enabled: boolean;
}

export type ProductKind = 'mfo' | 'card' | 'credit';

/** Фичи для фильтров. Ключи стабильны — UI строит по ним чипы. */
export type ProductFeature =
  | 'zero_percent'      // первый займ/период без %
  | 'no_refusal'        // высокий % одобрения
  | 'bad_history'       // с плохой КИ
  | 'to_card'           // на карту
  | 'cash'              // наличными
  | 'no_photo'          // без фото/селфи
  | 'with_overdue'      // с просрочками
  | 'long_term'         // долгосрочные (installment)
  | 'round_the_clock'   // круглосуточно
  | 'new';              // новые на рынке

/**
 * Продукт = оффер с условиями для витрины и фильтров.
 * Хранится в apps/<site>/src/content/offers/<slug>.json, связан с пулом через poolId.
 */
export interface Product {
  slug: string;
  poolId: string;               // id из affiliate_pool.json (ссылка /go/<poolId>/)
  kind: ProductKind;
  name: string;                 // «Займер»
  logo?: string;                // /logos/<slug>.svg
  brandColor?: string;          // фон плитки логотипа
  amountMin: number;            // ₽
  amountMax: number;            // ₽
  termMinDays: number;
  termMaxDays: number;
  rateDayPct: number;           // ставка в день, %
  freeDays?: number;            // срок без %
  pskMin?: number;              // ПСК, % годовых — нижняя граница диапазона (для рекламы обязателен диапазон)
  pskMax?: number;              // ПСК, % годовых (диапазон верхней границы)
  approvalPct?: number;         // заявленное одобрение
  decisionMinutes?: number;
  ageMin: number;
  ageMax: number;
  features: ProductFeature[];
  rating?: number;              // 0..5
  reviewsCount?: number;
  cbrLicense?: string;          // номер в реестре ЦБ
  legalName?: string;           // ООО МФК «...»
  erid?: string;                // токен маркировки рекламы (ОРД), из Saleads
  verified: boolean;            // условия сверены с сайтом МФО?
  priority?: number;            // порядок «по умолчанию» (больше — выше)
}
